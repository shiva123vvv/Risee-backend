const db = require('./config/db');
(async () => {
    try {
        const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'withdraw_requests'`);
        console.log("=== WR Columns ===");
        res.rows.forEach(r => console.log(r.column_name));
    } catch(e) {
        console.error(e.message);
    }
    process.exit(0);
})();
