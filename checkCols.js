const { pool } = require('./config/db');

async function checkCols() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'campaigns'");
        res.rows.forEach(r => console.log(r.column_name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCols();
