const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const createTables = require('./config/initDb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

const db = require('./config/db');
app.get('/uploads/:filename', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT data, mimetype FROM app_images WHERE filename = $1', [req.params.filename]);
        if (rows.length > 0) {
            const imgBuffer = Buffer.from(rows[0].data, 'base64');
            res.writeHead(200, {
                'Content-Type': rows[0].mimetype,
                'Content-Length': imgBuffer.length,
                'Cache-Control': 'public, max-age=31536000'
            });
            return res.end(imgBuffer);
        }
        // Fallback to legacy Render host for very old images before the Railway migration
        const legacyUrl = `https://risee-backend.onrender.com/uploads/${req.params.filename}`;
        try {
            const axios = require('axios');
            await axios.head(legacyUrl); // check if the image still exists on Render
            res.redirect(legacyUrl);
        } catch (e) {
            // Render wiped the old ephemeral image permanently; fallback to aesthetic placeholder
            res.redirect('https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&q=80');
        }
    } catch (err) {
        res.redirect('https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&q=80');
    }
});

// Initialize Database
createTables();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/donations', require('./routes/donationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Recovery DB Route
app.get('/api/migrate-now', async (req, res) => {
    const { pool } = require('./config/db');
    try {
        await pool.query(`ALTER TABLE withdraw_requests 
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS method VARCHAR(50),
            ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(100),
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS admin_note TEXT;
        `);
        await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS gateway_fees DECIMAL(12, 2) DEFAULT 0;`);
        res.json({ success: true, message: 'All schemas patched successfully!' });
    } catch(err) {
        console.error("MIGRATION_ERR:", err);
        res.json({ success: false, message: err.message, stack: err.stack, details: JSON.stringify(err) });
    }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
