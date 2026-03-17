const db = require('./config/db');

async function setupDatabase() {
    try {
        console.log('🚀 Starting Database Enhancement...');

        // 1. Add missing columns to campaigns
        await db.query(`
            ALTER TABLE campaigns 
            ADD COLUMN IF NOT EXISTS category VARCHAR(100),
            ADD COLUMN IF NOT EXISTS location VARCHAR(255),
            ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS story TEXT,
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS raised_amount DECIMAL(15, 2) DEFAULT 0;
        `);

        // 2. Create saved_campaigns table
        await db.query(`
            CREATE TABLE IF NOT EXISTS saved_campaigns (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, campaign_id)
            );
        `);

        // 3. Create campaign_updates table
        await db.query(`
            CREATE TABLE IF NOT EXISTS campaign_updates (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                title VARCHAR(255),
                message TEXT,
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Update donations table (add message)
        await db.query(`
            ALTER TABLE donations 
            ADD COLUMN IF NOT EXISTS message TEXT,
            ADD COLUMN IF NOT EXISTS donor_name VARCHAR(255);
        `);

        // 5. Create withdrawals table
        await db.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                amount DECIMAL(15, 2) NOT NULL,
                bank_details JSONB NOT NULL,
                status VARCHAR(50) DEFAULT 'pending', -- pending, approved, completed, rejected
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Create fraud_reports table
        await db.query(`
            CREATE TABLE IF NOT EXISTS fraud_reports (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'open', -- open, investigated, resolved
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 6. Add bank_details to users
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS bank_details JSONB;
        `);

        console.log('✅ Database Enhancement Complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database Enhancement Failed:', err);
        process.exit(1);
    }
}

setupDatabase();
