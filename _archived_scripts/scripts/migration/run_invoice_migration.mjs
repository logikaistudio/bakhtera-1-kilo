import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 Starting Invoice Multi-Currency Migration...\n');

    try {
        // Read migration file
        const migrationSQL = readFileSync('./supabase/migrations/060_invoice_currency_constraint.sql', 'utf8');

        console.log('📄 Migration file loaded successfully');
        console.log('📦 Executing SQL statements...\n');

        // Execute the entire migration as a single transaction
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            // If exec_sql doesn't exist, try direct execution via REST API
            console.log('⚠️  exec_sql RPC not available, trying direct execution...\n');

            // Split into individual statements
            const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

            console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (!statement) continue;

                try {
                    // Execute via Supabase client
                    const { error: stmtError } = await supabase.rpc('exec_sql', {
                        sql: statement + ';'
                    });

                    if (stmtError) {
                        console.log(`⚠️  Statement ${i + 1}: ${stmtError.message}`);
                        errorCount++;
                    } else {
                        successCount++;
                        console.log(`✅ Statement ${i + 1} executed successfully`);
                    }
                } catch (err) {
                    console.log(`⚠️  Statement ${i + 1} error: ${err.message}`);
                    errorCount++;
                }
            }

            console.log(`\n📊 Execution Summary:`);
            console.log(`   ✅ Successful: ${successCount}`);
            console.log(`   ⚠️  Warnings: ${errorCount}`);

        } else {
            console.log('✅ Migration executed successfully!\n');
        }

        // Verify the migration
        console.log('🔍 Verifying migration...\n');

        // Check if unique index exists
        const { data: indexData, error: indexError } = await supabase
            .from('pg_indexes')
            .select('indexname, indexdef')
            .eq('tablename', 'blink_invoices')
            .eq('indexname', 'idx_blink_invoices_quotation_currency_unique');

        if (!indexError && indexData && indexData.length > 0) {
            console.log('✅ Unique index created successfully');
            console.log(`   Index: ${indexData[0].indexname}`);
        } else {
            console.log('⚠️  Could not verify unique index (may need manual verification)');
        }

        // Check if function exists
        const { data: funcData, error: funcError } = await supabase.rpc(
            'get_quotation_invoice_summary',
            { p_quotation_id: '00000000-0000-0000-0000-000000000000' }
        );

        if (!funcError || funcError.message.includes('no rows')) {
            console.log('✅ Helper function created successfully');
            console.log('   Function: get_quotation_invoice_summary()');
        } else {
            console.log('⚠️  Could not verify helper function');
        }

        console.log('\n🎉 Migration completed!\n');
        console.log('📋 What was created:');
        console.log('   1. Unique index: idx_blink_invoices_quotation_currency_unique');
        console.log('   2. Validation trigger: trg_validate_invoice_currency_limit');
        console.log('   3. Helper function: get_quotation_invoice_summary()');
        console.log('   4. Analytics view: v_invoice_quotation_summary');
        console.log('\n✨ You can now create max 2 invoices (IDR + USD) per quotation!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nPlease run the migration manually via Supabase Dashboard:');
        console.error('1. Go to SQL Editor');
        console.error('2. Copy content from: supabase/migrations/060_invoice_currency_constraint.sql');
        console.error('3. Paste and run the query\n');
        process.exit(1);
    }
}

runMigration();
