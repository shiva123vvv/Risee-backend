const { pool } = require('../config/db');

exports.getDashboardData = async (req, res) => {
    try {
        const { uid } = req.params;

        // Fetch user specific stats and fundraisers
        const fundraisersQuery = `
            SELECT 
                c.id, 
                c.title, 
                c.goal_amount, 
                c.raised_amount, 
                c.image_url as image, 
                c.created_at,
                c.end_date,
                c.status,
                u.username,
                c.slug,
                COALESCE(c.gateway_fees, 0) as gateway_fees,
                COALESCE(SUM(CASE WHEN wr.status IN ('pending', 'approved', 'completed') THEN wr.amount ELSE 0 END), 0) as withdrawn_amount
            FROM campaigns c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN withdraw_requests wr ON c.id = wr.campaign_id
            WHERE c.user_id = (SELECT id FROM users WHERE email = $1 OR id::text = $1 LIMIT 1)
            GROUP BY c.id, u.username, c.slug
        `;
        
        const { rows: fundraisers } = await pool.query(fundraisersQuery, [uid]);

        // Calculate total balance from all campaigns
        const userBalance = fundraisers.reduce((sum, f) => {
            const available = Number(f.raised_amount) - Number(f.withdrawn_amount) - Number(f.gateway_fees);
            return sum + (available > 0 ? available : 0);
        }, 0);

        res.json({
            balance: userBalance,
            totalDonated: 0,
            impactCount: 0,
            fundraisers: fundraisers.map(f => ({
                ...f,
                raised_usd: (Number(f.raised_amount) / 83).toFixed(2),
                withdrawn_usd: (Number(f.withdrawn_amount) / 83).toFixed(2),
                available_balance: (Number(f.raised_amount) - Number(f.withdrawn_amount) - Number(f.gateway_fees)).toFixed(2)
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { uid } = req.params;
        const { name, phone, bio, location } = req.body;
        let profilePicture = null;

        if (req.file) {
            profilePicture = `/uploads/${req.file.filename}`;
        }

        // Add missing columns if they don't exist
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255)`);

        let query = `
            UPDATE users 
            SET name = $1, phone = $2, bio = $3, location = $4
        `;
        let params = [name, phone, bio, location];

        if (profilePicture) {
            query += `, profile_picture = $5 WHERE id::text = $6 OR email = $6`;
            params.push(profilePicture, uid);
        } else {
            query += ` WHERE id::text = $5 OR email = $5`;
            params.push(uid);
        }

        await pool.query(query, params);

        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};
