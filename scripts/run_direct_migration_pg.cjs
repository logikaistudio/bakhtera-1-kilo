
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Resolve path to .env file
const envPath = path.resolve(__dirname, '../.env');
let connectionString = '';

try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const lines = envConfig.split('\n');
    lines.forEach(line => {
        if (line.startsWith('DATABASE_URL=')) {
            connectionString = line.split('=')[1].trim();
            // Remove quotes if present
            if (connectionString.startsWith('"') && connectionString.endsWith('"')) {
                connectionString = connectionString.slice(1, -1);
            }
        }
    });
} catch (e) {
    console.error('Error reading .env file:', e);
}

if (!connectionString) {
    console.error('Could not find DATABASE_URL in .env');
    // Attempt to construct from other vars if available, but DATABASE_URL is standard for Supabase
    process.exit(1);
}

console.log('Connecting to database...');

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function runMigrationDirectly() {
    try {
        await client.connect();

        console.log('✅ Connected. Running migration...');

        const sql = `
            ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS outbound_status TEXT;
            ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS outbound_date TIMESTAMP WITH TIME ZONE;
        `;

        await client.query(sql);
        console.log('✅ Migration executed successfully!');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

runMigrationDirectly();
