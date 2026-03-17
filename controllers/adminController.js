const db = require('../config/db');

exports.getAdminDashboard = async (req, res) => {
    try {
        const totalUsers = await db.query('SELECT COUNT(*) FROM users');
        const totalCampaigns = await db.query('SELECT COUNT(*) FROM campaigns');
        const activeCampaigns = await db.query("SELECT COUNT(*) FROM campaigns WHERE status = 'active'");
        const pendingCampaigns = await db.query("SELECT COUNT(*) FROM campaigns WHERE status = 'pending'");
        
        const donations = await db.query("SELECT SUM(amount) as total_raised, COUNT(*) as donation_count, COUNT(DISTINCT donor_id) as total_donors FROM donations WHERE status = 'successful'");
        
        const withdrawals = await db.query("SELECT COUNT(*) as count, SUM(amount) as total_withdrawn FROM withdraw_requests WHERE status = 'completed'");
        const pendingWithdrawals = await db.query("SELECT COUNT(*) FROM withdraw_requests WHERE status = 'pending'");
        
        res.json({
            success: true,
            stats: {
                totalUsers: parseInt(totalUsers.rows[0].count) || 0,
                totalCampaigns: parseInt(totalCampaigns.rows[0].count) || 0,
                activeCampaigns: parseInt(activeCampaigns.rows[0].count) || 0,
                pendingCampaigns: parseInt(pendingCampaigns.rows[0].count) || 0,
                totalDonationsReceived: donations.rows[0].total_raised || 0,
                totalDonors: parseInt(donations.rows[0].total_donors) || 0,
                totalWithdrawals: parseInt(withdrawals.rows[0].count) || 0,
                totalWithdrawnAmount: withdrawals.rows[0].total_withdrawn || 0,
                pendingWithdrawals: parseInt(pendingWithdrawals.rows[0].count) || 0,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getWithdrawals = async (req, res) => {
    try {
        const withdrawals = await db.query(
            `SELECT 
                w.*, 
                u.name as user_name, u.email as user_email,
                c.title as campaign_name,
                c.raised_amount as total_raised,
                c.gateway_fees as total_fees,
                (SELECT SUM(amount) FROM withdraw_requests WHERE campaign_id = c.id AND status IN ('approved', 'completed')) as total_withdrawn
             FROM withdraw_requests w 
             JOIN users u ON w.user_id = u.id 
             LEFT JOIN campaigns c ON w.campaign_id = c.id
             ORDER BY w.created_at DESC`
        );
        res.json({ success: true, withdrawals: withdrawals.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.approveWithdrawal = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const { admin_note } = req.body;
        
        let query = 'UPDATE withdraw_requests SET status = $1';
        let params = [status];
        let paramCount = 2;

        if (status === 'completed') {
            query += `, processed_at = CURRENT_TIMESTAMP`;
        }
        
        if (admin_note !== undefined) {
            query += `, admin_note = $${paramCount}`;
            params.push(admin_note);
            paramCount++;
        }

        query += ` WHERE id = $${paramCount}`;
        params.push(id);

        await db.query(query, params);
        res.json({ success: true, message: `Withdrawal ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getDonationLogs = async (req, res) => {
    try {
        const logs = await db.query(
            `SELECT d.*, donor_user.name as donor_name, c.title as campaign_title, u.username, c.slug 
             FROM donations d 
             LEFT JOIN users donor_user ON d.donor_id = donor_user.id 
             JOIN campaigns c ON d.campaign_id = c.id 
             JOIN users u ON c.user_id = u.id
             ORDER BY d.created_at DESC`
        );
        res.json({ success: true, logs: logs.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getFraudReports = async (req, res) => {
    try {
        const reports = await db.query(
            `SELECT f.*, c.title as campaign_title, u.name as reporter_name, creator.username, c.slug 
             FROM fraud_reports f 
             JOIN campaigns c ON f.campaign_id = c.id 
             JOIN users u ON f.user_id = u.id
             JOIN users creator ON c.user_id = creator.id`
        );
        res.json({ success: true, reports: reports.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAdminUsers = async (req, res) => {
    try {
        const users = await db.query(`
            SELECT 
                u.id, u.name, u.email, u.role, u.document_verified, u.created_at, u.status,
                (SELECT COUNT(*) FROM campaigns WHERE user_id = u.id) as total_campaigns,
                (SELECT COUNT(*) FROM donations WHERE donor_id = u.id AND status = 'successful') as total_donations
            FROM users u
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, users: users.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleUserVerification = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await db.query('SELECT document_verified FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        
        const newStatus = !user.rows[0].document_verified;
        await db.query('UPDATE users SET document_verified = $1 WHERE id = $2', [newStatus, id]);
        
        res.json({ success: true, document_verified: newStatus });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true, message: `User marked as ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAdminCampaigns = async (req, res) => {
    try {
        const campaignsResult = await db.query(
            `SELECT c.*, u.name as fundraiser_name, u.username, u.email as fundraiser_email, u.phone as fundraiser_phone
             FROM campaigns c 
             JOIN users u ON c.user_id = u.id 
             ORDER BY c.created_at DESC`
        );
        res.json({ success: true, campaigns: campaignsResult.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
