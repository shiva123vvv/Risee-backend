const db = require('../config/db');
const { generateUniqueSlug } = require('../utils/slugify');

exports.createCampaign = async (req, res) => {
    const { 
        title, description, story, goal_amount, currency, category, urgency_level, location,
        organizer_name, organizer_email, organizer_country_code, organizer_phone, contact_method,
        beneficiary_name, beneficiary_type, beneficiary_relation, beneficiary_age, 
        beneficiary_location, beneficiary_country_code, beneficiary_phone, beneficiary_base, beneficiary_employment,
        hospital_name, hospital_location, ailment, education_institution, school_location,
        ngo_registration_no, ngo_type, memorial_for, event_name, event_date,
        business_name, industry_type, project_name, sports_event, animal_species, shelter_name,
        religious_institution, religious_location, environment_project
    } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const user_id = req.user.id;
    const slug = await generateUniqueSlug(title);

    // Strict Category to Beneficiary Type Validation Mapping
    const beneficiaryMapping = {
        'Medical': ['Myself', 'Family (Individual)', 'Family (Group)', 'Friend (Individual)', 'Friend (Group)'],
        'Education': ['Myself', 'Family (Individual)', 'Friend (Individual)', 'Other'],
        'Animal Welfare': ['NGO', 'Other'],
        'Environment': ['NGO', 'Other'],
        'Religious / Community': ['NGO', 'Other'],
        'Memorial': ['Family (Individual)', 'Family (Group)', 'Friend (Individual)', 'Friend (Group)'],
        'Non-Profit / NGO': ['NGO'],
        'Family & Personal Needs': ['Myself', 'Family (Individual)', 'Friend (Individual)'],
        'Creative Projects': ['Myself', 'Other'],
        'Startups & Business': ['Myself', 'Other'],
        'Technology & Innovation': ['Myself', 'Other'],
        'Sports': ['Myself', 'Other'],
        'Events': ['Myself', 'Other'],
        'Disaster & Emergency': ['Myself', 'NGO', 'Other']
    };

    if (category in beneficiaryMapping && !beneficiaryMapping[category].includes(beneficiary_type)) {
        return res.status(400).json({ 
            success: false, 
            message: `Invalid beneficiary type '${beneficiary_type}' for category '${category}'.` 
        });
    }

    try {
        const newCampaign = await db.query(
            `INSERT INTO campaigns (
                user_id, slug, title, description, story, goal_amount, currency, category, urgency_level, location,
                organizer_name, organizer_email, organizer_country_code, organizer_phone, contact_method,
                beneficiary_name, beneficiary_type, beneficiary_relation, beneficiary_age, 
                beneficiary_location, beneficiary_country_code, beneficiary_phone, beneficiary_base, beneficiary_employment,
                hospital_name, hospital_location, ailment, education_institution, school_location,
                ngo_registration_no, ngo_type, memorial_for, event_name, event_date,
                business_name, industry_type, project_name, sports_event, animal_species, shelter_name,
                religious_institution, religious_location, environment_project,
                image_url, end_date
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45) RETURNING *`,
            [
                user_id, slug, title, description || title, story || description || title, goal_amount, currency || 'INR', category, urgency_level || 'Standard', location,
                organizer_name, organizer_email, organizer_country_code, organizer_phone, contact_method,
                beneficiary_name, beneficiary_type, beneficiary_relation, beneficiary_age, 
                beneficiary_location, beneficiary_country_code, beneficiary_phone, beneficiary_base, beneficiary_employment,
                hospital_name, hospital_location, ailment, education_institution, school_location,
                ngo_registration_no, ngo_type, memorial_for, event_name, event_date || null,
                business_name, industry_type, project_name, sports_event, animal_species, shelter_name,
                religious_institution, religious_location, environment_project,
                image_url,
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
            ]
        );
        // Fetch username for the response
        const user = await db.query('SELECT username FROM users WHERE id = $1', [user_id]);
        
        res.status(201).json({ 
            success: true, 
            campaign: { 
                ...newCampaign.rows[0], 
                username: user.rows[0].username 
            } 
        });
    } catch (err) {
        console.error("Create Campaign Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllCampaigns = async (req, res) => {
    const { category, search } = req.query;
    let query = `
        SELECT c.*, u.username 
        FROM campaigns c 
        JOIN users u ON c.user_id = u.id 
        WHERE 1=1
    `;
    let params = [];

    if (category && category !== 'all') {
        query += " AND category = $" + (params.length + 1);
        params.push(category);
    }
    if (search) {
        query += " AND (title ILIKE $" + (params.length + 1) + " OR description ILIKE $" + (params.length + 1) + ")";
        params.push(`%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    try {
        const campaigns = await db.query(query, params);
        console.log(`Backend returning ${campaigns.rows.length} campaigns`);
        res.json({ success: true, campaigns: campaigns.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getCampaignBySlug = async (req, res) => {
    const { username, slug } = req.params;
    try {
        const campaign = await db.query(
            `SELECT c.*, u.username 
             FROM campaigns c 
             JOIN users u ON c.user_id = u.id 
             WHERE u.username = $1 AND c.slug = $2`, 
            [username, slug]
        );
        
        if (campaign.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        const id = campaign.rows[0].id;

        // Fetch updates
        const updates = await db.query('SELECT * FROM campaign_updates WHERE campaign_id = $1 ORDER BY created_at DESC', [id]);

        // Fetch recent donations (last 10)
        const recentDonations = await db.query(
            'SELECT donor_name, amount, message, donation_currency, tip_amount, created_at FROM donations WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 10',
            [id]
        );

        res.json({ 
            success: true, 
            campaign: campaign.rows[0], 
            updates: updates.rows,
            donations: recentDonations.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getCampaignById = async (req, res) => {
    const { id } = req.params;
    try {
        const campaign = await db.query(
            `SELECT c.*, u.username 
             FROM campaigns c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.id = $1`, 
            [id]
        );
        if (campaign.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        // Fetch updates
        const updates = await db.query('SELECT * FROM campaign_updates WHERE campaign_id = $1 ORDER BY created_at DESC', [id]);

        // Fetch recent donations (last 10)
        const recentDonations = await db.query(
            'SELECT donor_name, amount, message, donation_currency, tip_amount, created_at FROM donations WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 10',
            [id]
        );

        res.json({ 
            success: true, 
            campaign: campaign.rows[0], 
            updates: updates.rows,
            donations: recentDonations.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateCampaign = async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const user_id = req.user.id;

    try {
        const campaign = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
        if (campaign.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }

        // Use loose equality or cast to ensure comparison works regardless of type (string vs int)
        if (campaign.rows[0].user_id != user_id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const allowedFields = [
            'title', 'description', 'story', 'goal_amount', 'currency', 'category', 'urgency_level', 'location',
            'organizer_name', 'organizer_email', 'organizer_country_code', 'organizer_phone', 'contact_method',
            'beneficiary_name', 'beneficiary_type', 'beneficiary_relation', 'beneficiary_age', 
            'beneficiary_location', 'beneficiary_country_code', 'beneficiary_phone', 'beneficiary_base', 'beneficiary_employment',
            'hospital_name', 'hospital_location', 'ailment', 'education_institution', 'school_location',
            'ngo_registration_no', 'ngo_type', 'memorial_for', 'event_name', 'event_date',
            'business_name', 'industry_type', 'project_name', 'sports_event', 'animal_species', 'shelter_name',
            'religious_institution', 'religious_location', 'environment_project', 'status'
        ];

        let updateFields = [];
        let params = [];
        let count = 1;

        allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                updateFields.push(`${field} = $${count}`);
                // Handle empty strings for numbers/dates by converting to null
                params.push(body[field] === "" ? null : body[field]);
                count++;
            }
        });

        if (req.files && req.files.image) {
            updateFields.push(`image_url = $${count}`);
            params.push(`/uploads/${req.files.image[0].filename}`);
            count++;
        }

        let currentDocs = campaign.rows[0].documents || [];
        let docsModified = false;

        if (body.documents) {
            try {
                currentDocs = typeof body.documents === 'string' ? JSON.parse(body.documents) : body.documents;
                docsModified = true;
            } catch (e) {
                console.error("Error parsing documents:", e);
            }
        }

        if (req.files && req.files.documents) {
            const documentUrls = req.files.documents.map(file => ({
                name: file.originalname,
                url: `/uploads/${file.filename}`,
                type: file.mimetype,
                size: file.size,
                uploaded_at: new Date()
            }));
            currentDocs = [...currentDocs, ...documentUrls];
            docsModified = true;
        }

        if (docsModified) {
            updateFields.push(`documents = $${count}`);
            params.push(JSON.stringify(currentDocs));
            count++;
        }

        if (updateFields.length === 0) {
            return res.json({ success: true, campaign: campaign.rows[0] });
        }

        params.push(id);
        const query = `UPDATE campaigns SET ${updateFields.join(', ')} WHERE id = $${count} RETURNING *`;
        
        console.log("Executing Update Query:", query, "with params:", params);
        const updatedCampaign = await db.query(query, params);

        res.json({ success: true, campaign: updatedCampaign.rows[0] });
    } catch (err) {
        console.error("Update Campaign Error Details:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getUserCampaigns = async (req, res) => {
    const user_id = req.user.id;
    try {
        const campaigns = await db.query(
            `SELECT c.*, u.username 
             FROM campaigns c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.user_id = $1 
             ORDER BY c.created_at DESC`, 
            [user_id]
        );
        res.json({ success: true, campaigns: campaigns.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleSaveCampaign = async (req, res) => {
    const user_id = req.user.id;
    const { campaign_id } = req.body;
    try {
        const existing = await db.query('SELECT * FROM saved_campaigns WHERE user_id = $1 AND campaign_id = $2', [user_id, campaign_id]);
        if (existing.rows.length > 0) {
            await db.query('DELETE FROM saved_campaigns WHERE user_id = $1 AND campaign_id = $2', [user_id, campaign_id]);
            return res.json({ success: true, saved: false });
        } else {
            await db.query('INSERT INTO saved_campaigns (user_id, campaign_id) VALUES ($1, $2)', [user_id, campaign_id]);
            return res.json({ success: true, saved: true });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSavedCampaigns = async (req, res) => {
    const user_id = req.user.id;
    try {
        const campaigns = await db.query(
            `SELECT c.*, u.username 
             FROM campaigns c 
             JOIN saved_campaigns s ON c.id = s.campaign_id 
             JOIN users u ON c.user_id = u.id
             WHERE s.user_id = $1`, [user_id]
        );
        res.json({ success: true, campaigns: campaigns.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.addCampaignUpdate = async (req, res) => {
    const { id } = req.params;
    const { title, message } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const update = await db.query(
            'INSERT INTO campaign_updates (campaign_id, title, message, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, title, message, image_url]
        );
        res.json({ success: true, update: update.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getOrganizerStats = async (req, res) => {
    const user_id = req.user.id;
    try {
        const campaignsCount = await db.query('SELECT COUNT(*) FROM campaigns WHERE user_id = $1', [user_id]);
        const totalRaised = await db.query('SELECT SUM(raised_amount) FROM campaigns WHERE user_id = $1', [user_id]);
        const totalDonorsResult = await db.query('SELECT COUNT(DISTINCT donor_id) FROM donations WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = $1)', [user_id]);
        const pendingWithdrawals = await db.query("SELECT SUM(amount) FROM withdraw_requests WHERE user_id = $1 AND status = 'pending'", [user_id]);

        res.json({
            success: true,
            stats: {
                totalCampaigns: campaignsCount.rows[0].count,
                totalRaised: totalRaised.rows[0].sum || 0,
                totalDonors: totalDonorsResult.rows[0].count,
                pendingWithdrawals: pendingWithdrawals.rows[0].sum || 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteCampaignUpdate = async (req, res) => {
    const { updateId } = req.params;
    const user_id = req.user.id;
    try {
        const update = await db.query(
            `SELECT u.*, c.user_id 
             FROM campaign_updates u 
             JOIN campaigns c ON u.campaign_id = c.id 
             WHERE u.id = $1`, [updateId]
        );
        if (update.rows.length === 0) return res.status(404).json({ success: false, message: 'Update not found' });
        if (update.rows[0].user_id != user_id && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
        await db.query('DELETE FROM campaign_updates WHERE id = $1', [updateId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.extendCampaign = async (req, res) => {
    const { id } = req.params;
    const { days = 30 } = req.body;
    const user_id = req.user.id;

    try {
        const campaign = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
        if (campaign.rows.length === 0) return res.status(404).json({ success: false, message: 'Campaign not found' });

        if (campaign.rows[0].user_id != user_id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const currentEndDate = campaign.rows[0].end_date ? new Date(campaign.rows[0].end_date) : new Date();
        const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

        const updated = await db.query(
            'UPDATE campaigns SET end_date = $1 WHERE id = $2 RETURNING *',
            [newEndDate, id]
        );

        res.json({ success: true, campaign: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteCampaign = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const campaign = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
        if (campaign.rows.length === 0) return res.status(404).json({ success: false, message: 'Campaign not found' });

        if (campaign.rows[0].user_id != user_id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this campaign' });
        }

        await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
        res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
