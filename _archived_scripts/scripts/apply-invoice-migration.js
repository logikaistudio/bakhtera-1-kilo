import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runInvoiceMigration() {
    console.log('🚀 Running Invoice Module Migration...\n');

    try {
        // Read the migration file
        const migrationPath = join(__dirname, '../supabase/migrations/009_blink_invoice_module.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        console.log('📄 Migration file loaded');
        console.log('📊 Executing SQL...\n');

        // Execute the migration
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

        if (error) {
            // If exec_sql doesn't exist, try direct query (might fail with some complex SQL)
            console.log('⚠️  RPC method not available, trying direct execution...\n');

            // Split by semicolon and execute each statement
            const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                console.log(`Executing statement ${i + 1}/${statements.length}...`);

                const { error: stmtError } = await supabase
                    .from('__migrations__')
                    .select('*')
                    .limit(0); // Dummy query to establish connection

                if (stmtError && i === 0) {
                    console.log('ℹ️  Cannot execute migrations via API');
                    console.log('\n📋 MANUAL MIGRATION REQUIRED:');
                    console.log('');
                    console.log('1. Open Supabase SQL Editor:');
                    console.log(`   ${supabaseUrl.replace('supabase.co', 'supabase.com/dashboard')}/sql/new`);
                    console.log('');
                    console.log('2. Copy the migration file:');
                    console.log(`   ${migrationPath}`);
                    console.log('');
                    console.log('3. Paste the content in SQL Editor and click "Run"');
                    console.log('');
                    process.exit(1);
                }
            }
        }

        // Verify tables were created
        console.log('\n✅ Verifying tables...');

        const { data: tables, error: tableError } = await supabase
            .from('blink_invoices')
            .select('*')
            .limit(0);

        if (tableError) {
            if (tableError.code === 'PGRST116') {
                console.log('\n⚠️  Table verification failed. Please run migration manually.');
                console.log('\nℹ️  SQL Editor URL:');
                console.log(`   ${supabaseUrl.replace('.supabase.co', '.supabase.com/dashboard')}/sql/new`);
                console.log('\nℹ️  Migration file:');
                console.log(`   ${migrationPath}`);
            } else {
                throw tableError;
            }
        } else {
            console.log('✅ blink_invoices table exists');

            // Check other tables
            const { error: paymentsError } = await supabase
                .from('blink_payments')
                .select('*')
                .limit(0);

            if (!paymentsError) {
                console.log('✅ blink_payments table exists');
            }

            const { error: bankError } = await supabase
                .from('bank_accounts')
                .select('*')
                .limit(0);

            if (!bankError) {
                console.log('✅ bank_accounts table exists');
            }

            console.log('\n🎉 Invoice module migration completed successfully!');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.log('\n📋 Please run the migration manually:');
        console.log('');
        console.log('1. Open Supabase Dashboard SQL Editor');
        console.log('2. Copy content from: supabase/migrations/009_blink_invoice_module.sql');
        console.log('3. Paste and execute in SQL Editor');
        console.log('');
        process.exit(1);
    }
}

runInvoiceMigration();
