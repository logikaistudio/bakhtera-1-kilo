import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
    console.log('🚀 Running Partner Migrations...\n');

    try {
        // Read migration files
        const bridgeMigration = readFileSync('./supabase/migrations/050_bridge_business_partners.sql', 'utf8');
        const bigMigration = readFileSync('./supabase/migrations/051_big_business_partners.sql', 'utf8');

        // Split SQL into individual statements
        const bridgeStatements = bridgeMigration
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        const bigStatements = bigMigration
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

        // Run Bridge migration
        console.log('📦 Creating bridge_business_partners table...');
        for (const statement of bridgeStatements) {
            const { error } = await supabase.rpc('exec', { query: statement });
            if (error && !error.message.includes('already exists')) {
                console.error('Statement:', statement.substring(0, 100) + '...');
                console.error('Error:', error);
            }
        }
        console.log('✅ Bridge migration completed\n');

        // Run Big migration
        console.log('📦 Creating big_business_partners table...');
        for (const statement of bigStatements) {
            const { error } = await supabase.rpc('exec', { query: statement });
            if (error && !error.message.includes('already exists')) {
                console.error('Statement:', statement.substring(0, 100) + '...');
                console.error('Error:', error);
            }
        }
        console.log('✅ Big migration completed\n');

        console.log('🎉 All migrations completed!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigrations();
