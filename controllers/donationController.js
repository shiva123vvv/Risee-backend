const db = require('../config/db');
const axios = require('axios');

exports.createOrder = async (req, res) => {
    const { amount, currency = 'INR', donor_email, donor_phone } = req.body;
    try {
        let cleanPhone = (donor_phone || "").replace(/[^\d+]/g, "");
        if (!cleanPhone.startsWith("+") && cleanPhone.length > 10) {
            cleanPhone = "+" + cleanPhone;
        }
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            cleanPhone = "9999999999";
        }

        const requestPayload = {
            order_amount: Math.round(parseFloat(amount) * 100) / 100, // strictly 2 decimals max
            order_currency: currency.toUpperCase(),
            customer_details: {
                customer_id: req.user?.id ? `user_${req.user.id}_${Date.now()}` : `guest_${Date.now()}`,
                customer_phone: cleanPhone,
                customer_email: donor_email || "guest@example.com"
            }
        };

        const response = await axios.post('https://api.cashfree.com/pg/orders', requestPayload, {
            headers: {
                'X-Client-Id': process.env.CASHFREE_APP_ID,
                'X-Client-Secret': process.env.CASHFREE_SECRET_KEY,
                'x-api-version': '2023-08-01',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        res.json({ success: true, order: response.data });
    } catch (err) {
        const errorData = err.response?.data || err.message;
        const errorMessage = errorData?.message || err.message;
        require('fs').appendFileSync('error_trace.log', JSON.stringify(errorData, null, 2) + '\n');
        console.error('Cashfree Create Order Error:', errorData);
        res.status(err.response?.status || 500).json({ success: false, message: errorMessage, errorDetails: errorData });
    }
};

exports.donate = async (req, res) => {
    const { campaign_id, native_amount, native_tip_amount, amount_inr, tip_inr, donor_name, email, phone, cashfree_order_id, cashfree_payment_session_id, donation_currency = 'INR' } = req.body;
    const donor_id = req.user?.id; // user id from middleware

    try {
        // Start a transaction
        await db.query('BEGIN');

        // 1. Record the donation natively exactly as the donor paid
        const newDonation = await db.query(
            'INSERT INTO donations (campaign_id, donor_id, amount, tip_amount, donor_name, email, phone, razorpay_payment_id, donation_currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [campaign_id, donor_id || null, native_amount || amount_inr, native_tip_amount || tip_inr, donor_name || 'Anonymous Friend', email || null, phone || null, cashfree_order_id, donation_currency]
        );

        // Cost of processing flat 3.5% common for International and India
        const gatewayFee = (amount_inr || native_amount) * 0.035;

        // 2. Update the campaign's raised amount with standard INR value
        await db.query(
            'UPDATE campaigns SET raised_amount = raised_amount + $1, gateway_fees = COALESCE(gateway_fees, 0) + $2 WHERE id = $3',
            [amount_inr || native_amount, gatewayFee, campaign_id]
        );

        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            donation: newDonation.rows[0],
            message: 'Donation successful'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getUserDonations = async (req, res) => {
    const user_id = req.user.id;
    try {
        const donations = await db.query(
            `SELECT d.*, c.title as campaign_title 
       FROM donations d 
       JOIN campaigns c ON d.campaign_id = c.id 
       WHERE d.donor_id = $1 
       ORDER BY d.created_at DESC`,
            [user_id]
        );
        res.json({ success: true, donations: donations.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getDonorStats = async (req, res) => {
    const user_id = req.user.id;
    try {
        const totalDonated = await db.query('SELECT SUM(amount) FROM donations WHERE donor_id = $1', [user_id]);
        const supportedCampaigns = await db.query('SELECT COUNT(DISTINCT campaign_id) FROM donations WHERE donor_id = $1', [user_id]);
        const recentDonations = await db.query(
            `SELECT d.*, c.title as campaign_title 
             FROM donations d 
             JOIN campaigns c ON d.campaign_id = c.id 
             WHERE d.donor_id = $1 
             ORDER BY d.created_at DESC LIMIT 5`, [user_id]
        );

        res.json({
            success: true,
            stats: {
                totalDonated: totalDonated.rows[0].sum || 0,
                supportedCount: supportedCampaigns.rows[0].count,
                recent: recentDonations.rows.map(d => ({
                    id: d.id,
                    amount: d.amount,
                    date: d.created_at,
                    campaign: d.campaign_title
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


