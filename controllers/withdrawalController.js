const db = require('../config/db');

// Calculate available user balance internally
const getUserBalance = async (user_id) => {
    // total raised 
    const raisedQuery = await db.query(
        'SELECT COALESCE(SUM(raised_amount), 0) as total_raised, COALESCE(SUM(gateway_fees), 0) as total_fees FROM campaigns WHERE user_id = $1',
        [user_id]
    );
    const totalRaised = Number(raisedQuery.rows[0].total_raised);
    const totalFees = Number(raisedQuery.rows[0].total_fees);

    // total withdrawn (pending + approved + completed)
    const withdrawnQuery = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdraw_requests WHERE user_id = $1 AND status IN ('pending', 'approved', 'completed')",
        [user_id]
    );
    const totalWithdrawn = Number(withdrawnQuery.rows[0].total_withdrawn);

    return totalRaised - totalFees - totalWithdrawn;
};

exports.requestWithdrawal = async (req, res) => {
    const { campaign_id, amount, method, account_holder_name, bank_account_number, ifsc_code, bank_name, upi_id, paypal_email } = req.body;
    const user_id = req.user.id;

    try {
        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount < 500) {
            return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is 500 INR' });
        }

        let availableBalance = 0;
        
        if (campaign_id) {
            const campQuery = await db.query(`
                SELECT 
                    COALESCE(raised_amount, 0) as raised, 
                    COALESCE(gateway_fees, 0) as fees,
                    COALESCE((SELECT SUM(amount) FROM withdraw_requests WHERE campaign_id = $1 AND status IN ('pending', 'approved', 'completed')), 0) as withdrawn
                FROM campaigns WHERE id = $1 AND user_id = $2
            `, [campaign_id, user_id]);
            
            if (campQuery.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Campaign not found' });
            }
            const c = campQuery.rows[0];
            availableBalance = Number(c.raised) - Number(c.fees) - Number(c.withdrawn);
        } else {
            availableBalance = await getUserBalance(user_id);
        }
        
        if (parsedAmount > availableBalance) {
            return res.status(400).json({ success: false, message: 'Withdraw amount exceeds available balance' });
        }

        const withdrawal = await db.query(
            `INSERT INTO withdraw_requests (
                campaign_id, user_id, amount, method, account_holder_name, bank_account_number, ifsc_code, bank_name, upi_id, paypal_email
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [campaign_id || null, user_id, parsedAmount, method, account_holder_name, bank_account_number, ifsc_code, bank_name, upi_id, paypal_email]
        );

        res.status(201).json({ success: true, message: 'Withdrawal request submitted and pending admin approval.', withdrawal: withdrawal.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getUserWithdrawals = async (req, res) => {
    const user_id = req.user.id;
    try {
        const availableBalance = await getUserBalance(user_id);

        const result = await db.query(
            `SELECT * FROM withdraw_requests 
             WHERE user_id = $1 
             ORDER BY created_at DESC`, [user_id]
        );

        // Fetch user campaigns with their individual balances
        const campaignsQuery = await db.query(
            `SELECT 
                c.id, 
                c.title,
                c.slug,
                c.goal_amount,
                c.end_date,
                c.image_url as image,
                COALESCE(c.raised_amount, 0) as raised_amount, 
                COALESCE(c.gateway_fees, 0) as gateway_fees,
                COALESCE((SELECT SUM(w.amount) FROM withdraw_requests w WHERE w.campaign_id = c.id AND w.status IN ('pending', 'approved', 'completed')), 0) as withdrawn_amount
            FROM campaigns c 
            WHERE c.user_id = $1 
            ORDER BY c.created_at DESC`, [user_id]
        );

        const campaigns = campaignsQuery.rows.map(c => {
            const raised = Number(c.raised_amount);
            const fees = Number(c.gateway_fees);
            const withdrawn = Number(c.withdrawn_amount);
            const available_balance = raised - fees - withdrawn;
            
            return {
                ...c,
                raised,
                fees,
                withdrawn,
                available_balance: available_balance > 0 ? available_balance : 0
            };
        });

        res.json({ success: true, withdrawals: result.rows, availableBalance, campaigns });
    } catch (err) {
        console.log("GET USER WITHDRAWALS FAILED:", err);
        res.status(500).json({ success: false, message: err.message, stack: err.stack });
    }
};
