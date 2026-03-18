const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

// Strip channel_binding=require which crashes Node PG driver on Windows
const safeUrl = DATABASE_URL ? DATABASE_URL.replace('&channel_binding=require', '').replace('?channel_binding=require', '') : '';

const pool = new Pool({
  connectionString: safeUrl,
  ssl: safeUrl && safeUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('✅ Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
