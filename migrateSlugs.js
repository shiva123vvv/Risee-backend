const { pool } = require('./config/db');
const { generateUniqueSlug } = require('./utils/slugify');

async function migrate() {
    try {
        const campaigns = await pool.query('SELECT id, title FROM campaigns WHERE slug IS NULL');
        console.log(`Found ${campaigns.rows.length} campaigns without slugs.`);

        for (const campaign of campaigns.rows) {
            const slug = await generateUniqueSlug(campaign.title);
            await pool.query('UPDATE campaigns SET slug = $1 WHERE id = $2', [slug, campaign.id]);
            console.log(`Updated campaign #${campaign.id} with slug: ${slug}`);
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
