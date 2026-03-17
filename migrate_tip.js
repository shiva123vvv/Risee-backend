
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_zBNo20xIrukA@ep-square-fog-a40qfxb9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });

async function migrate() {
    try {
        await pool.query("ALTER TABLE donations ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(12, 2) DEFAULT 0");
        console.log('✅ tip_amount column added successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
