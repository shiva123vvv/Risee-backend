const { pool } = require('./config/db');
const { generateUniqueSlug, generateUniqueUsername } = require('./utils/slugify');

async function fixMissingData() {
    try {
        // 1. Fix missing usernames
        const users = await pool.query('SELECT id, name, email FROM users WHERE username IS NULL');
        console.log(`Found ${users.rows.length} users without usernames.`);
        for (const user of users.rows) {
            const username = await generateUniqueUsername(user.name || user.email);
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, user.id]);
            console.log(`Updated user #${user.id} with username: ${username}`);
        }

        // 2. Fix missing slugs
        const campaigns = await pool.query('SELECT id, title FROM campaigns WHERE slug IS NULL');
        console.log(`Found ${campaigns.rows.length} campaigns without slugs.`);
        for (const campaign of campaigns.rows) {
            const slug = await generateUniqueSlug(campaign.title);
            await pool.query('UPDATE campaigns SET slug = $1 WHERE id = $2', [slug, campaign.id]);
            console.log(`Updated campaign #${campaign.id} with slug: ${slug}`);
        }

        console.log('Cleanup completed.');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
}

fixMissingData();
