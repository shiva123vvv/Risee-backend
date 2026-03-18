const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateUniqueUsername } = require('../utils/slugify');

exports.register = async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    try {
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const username = await generateUniqueUsername(name || email);

        const newUser = await db.query(
            'INSERT INTO users (name, email, username, password, role, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, username, role, phone, bank_details',
            [name, email, username, hashedPassword, role || 'donor', phone]
        );

        const token = jwt.sign(
            { id: newUser.rows[0].id, role: newUser.rows[0].role },
            process.env.JWT_SECRET || 'risee_fallback_secret_key',
            { expiresIn: '1d' }
        );

        res.status(201).json({ success: true, token, user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET || 'risee_fallback_secret_key',
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.rows[0].id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                username: user.rows[0].username,
                role: user.rows[0].role,
                phone: user.rows[0].phone,
                bank_details: user.rows[0].bank_details
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.syncWithFirebase = async (req, res) => {
    const { email, name, role, phone } = req.body;
    try {
        let user;
        if (email) {
            user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        } else if (phone) {
            user = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        } else {
            return res.status(400).json({ success: false, message: 'Email or phone required for sync' });
        }

        const userRole = email === 'support.risee@gmail.com' ? 'admin' : (role || 'donor');

        if (user.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(Math.random().toString(36), salt);

            const displayName = name || (email ? email.split('@')[0] : (phone ? phone.toString() : 'User'));
            const username = await generateUniqueUsername(displayName);

            user = await db.query(
                'INSERT INTO users (name, email, username, password, role, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, username, role, phone, bank_details',
                [displayName, email || null, username, hashedPassword, userRole, phone || null]
            );
        } else if (email === 'support.risee@gmail.com' && user.rows[0].role !== 'admin') {
            user = await db.query(
                'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, name, email, username, role, phone, bank_details',
                ['admin', email]
            );
        }

        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET || 'risee_fallback_secret_key',
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.rows[0].id,
                name: user.rows[0].name,
                email: user.rows[0].email,
                username: user.rows[0].username,
                role: user.rows[0].role,
                phone: user.rows[0].phone,
                bank_details: user.rows[0].bank_details
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateBankDetails = async (req, res) => {
    const { bank_details } = req.body;
    const user_id = req.user.id;
    try {
        const result = await db.query(
            'UPDATE users SET bank_details = $1 WHERE id = $2 RETURNING id, name, email, username, role, bank_details',
            [bank_details, user_id]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getMe = async (req, res) => {
    const user_id = req.user.id;
    try {
        const user = await db.query('SELECT id, name, email, username, role, phone, bank_details FROM users WHERE id = $1', [user_id]);
        if (user.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user: user.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.switchRole = async (req, res) => {
    const { role } = req.body;
    const user_id = req.user.id;

    if (!['fundraiser', 'donor'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    try {
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, username, role, phone, bank_details',
            [role, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const token = jwt.sign(
            { id: result.rows[0].id, role: result.rows[0].role },
            process.env.JWT_SECRET || 'risee_fallback_secret_key',
            { expiresIn: '1d' }
        );

        res.json({ success: true, token, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
