
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_zBNo20xIrukA@ep-square-fog-a40qfxb9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });

async function check() {
    try {
        const res = await pool.query("SELECT id, title FROM campaigns WHERE title LIKE '%Batch%'");
        console.log(`Found ${res.rows.length} campaigns with 'Batch' in title`);
        res.rows.forEach(r => console.log(`${r.id}: ${r.title}`));
        
        const allRes = await pool.query("SELECT count(*) FROM campaigns");
        console.log(`Total campaigns in DB: ${allRes.rows[0].count}`);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
