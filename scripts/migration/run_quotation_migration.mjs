import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('🔧 Running migration: 051_add_quotation_contact_fields.sql\n');

        // Read migration file
        const migrationSQL = readFileSync('./supabase/migrations/051_add_quotation_contact_fields.sql', 'utf8');

        // Execute migration
        const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

        if (error) {
            console.error('❌ Migration failed:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint
            });

            console.log('\n⚠️  If exec_sql function does not exist, please run the migration manually:');
            console.log('1. Go to Supabase Dashboard → SQL Editor');
            console.log('2. Copy and paste the content of: supabase/migrations/051_add_quotation_contact_fields.sql');
            console.log('3. Click "Run"');
            return;
        }

        console.log('✅ Migration completed successfully!');
        console.log('\n📋 Added columns to blink_quotations:');
        console.log('   - customer_contact_name');
        console.log('   - customer_email');
        console.log('   - customer_phone');
        console.log('   - incoterm');
        console.log('   - payment_terms');
        console.log('   - package_type');
        console.log('   - quantity');
        console.log('   - gross_weight');
        console.log('   - net_weight');
        console.log('   - measure');
        console.log('   - terms_and_conditions');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

runMigration();
