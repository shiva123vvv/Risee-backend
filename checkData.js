const { pool } = require('./config/db');

async function checkData() {
    try {
        const campaigns = await pool.query('SELECT id, title, slug, user_id FROM campaigns');
        console.log('--- CAMPAIGNS ---');
        campaigns.rows.forEach(c => console.log(`ID: ${c.id}, Title: ${c.title}, Slug: ${c.slug}, UserID: ${c.user_id}`));

        const users = await pool.query('SELECT id, username FROM users');
        console.log('--- USERS ---');
        users.rows.forEach(u => console.log(`ID: ${u.id}, Username: ${u.username}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
