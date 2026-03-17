const db = require('../config/db');
const Razorpay = require('razorpay');

exports.createOrder = async (req, res) => {
    const { amount, currency = 'INR' } = req.body;
    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: 'Razorpay keys are not configured on the server yet' });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const isZeroDecimal = ['jpy', 'krw', 'vnd', 'bif', 'clp', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'vuv', 'xaf', 'xof', 'xpf'].includes(currency.toLowerCase());
        const multiplier = isZeroDecimal ? 1 : 100;

        const options = {
            amount: Math.round(amount * multiplier), // amount in the smallest currency unit
            currency: currency.toUpperCase(),
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.donate = async (req, res) => {
    const { campaign_id, native_amount, native_tip_amount, amount_inr, tip_inr, donor_name, email, phone, razorpay_payment_id, razorpay_order_id, razorpay_signature, donation_currency = 'INR' } = req.body;
    const donor_id = req.user?.id; // user id from middleware

    try {
        // Start a transaction
        await db.query('BEGIN');

        // 1. Record the donation natively exactly as the donor paid
        const newDonation = await db.query(
            'INSERT INTO donations (campaign_id, donor_id, amount, tip_amount, donor_name, email, phone, razorpay_payment_id, donation_currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [campaign_id, donor_id || null, native_amount || amount_inr, native_tip_amount || tip_inr, donor_name || 'Anonymous Friend', email || null, phone || null, razorpay_payment_id, donation_currency]
        );

        // Cost of processing flat 2-3% based on INR volume across multiple currencies via Razorpay
        const gatewayFee = (amount_inr || native_amount) * 0.03;

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


