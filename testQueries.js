const db = require('./config/db');
async function test() {
    try {
        const user_id = 1;

        await db.query(
            'SELECT COALESCE(SUM(raised_amount), 0) as total_raised, COALESCE(SUM(gateway_fees), 0) as total_fees FROM campaigns WHERE user_id = $1',
            [user_id]
        );

        await db.query(`SELECT * FROM withdraw_requests WHERE user_id = $1 ORDER BY created_at DESC`, [user_id]);

        await db.query(`SELECT c.id, c.title, c.slug, c.goal_amount, c.end_date, c.image_url as image, COALESCE(c.raised_amount, 0) as raised_amount, COALESCE(c.gateway_fees, 0) as gateway_fees, COALESCE((SELECT SUM(w.amount) FROM withdraw_requests w WHERE w.campaign_id = c.id AND w.status IN ('pending', 'approved', 'completed')), 0) as withdrawn_amount FROM campaigns c WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [user_id]);

        console.log('QUERY OK');
    } catch(e) {
        console.error('QUERY ERROR:', e.message);
    }
    process.exit(0);
}
test();
