import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnn21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI0MTg2MTIsImV4cCI6MjA0Nzk5NDYxMn0.2dOK5aD3PnTjgqJHIPW-g1dvcHGvAB1aFSANS-DQJX8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeBIGMigration() {
    console.log('🚀 Executing BIG module migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'supabase/migrations/035_big_module_schema.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        return;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('📄 Read migration file: 035_big_module_schema.sql\n');

    // Since we can't run DDL via anon key, we'll create tables using individual insert calls
    // or check if an exec_sql RPC function exists

    // Try to check if tables exist and create data entries instead
    console.log('⚠️  Note: DDL statements require Supabase Dashboard or service role key.');
    console.log('    Attempting to verify table structure via queries...\n');

    // Individual table creation via testing
    const tables = [
        'big_events',
        'big_quotations',
        'big_quotation_items',
        'big_invoices',
        'big_invoice_items',
        'big_costs',
        'big_ar_transactions'
    ];

    let existingTables = 0;
    let missingTables = [];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('id').limit(1);

        if (error && error.code === '42P01') {
            console.log(`❌ "${table}" - Does not exist`);
            missingTables.push(table);
        } else if (error && error.message.includes('schema cache')) {
            console.log(`❌ "${table}" - Not in schema cache`);
            missingTables.push(table);
        } else if (error) {
            console.log(`⚠️ "${table}" - Error: ${error.message}`);
        } else {
            console.log(`✅ "${table}" - Exists`);
            existingTables++;
        }
    }

    console.log(`\n📊 Summary: ${existingTables}/${tables.length} tables exist\n`);

    if (missingTables.length > 0) {
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('📋 COPY AND PASTE THE FOLLOWING SQL INTO SUPABASE SQL EDITOR:');
        console.log('═══════════════════════════════════════════════════════════════════\n');
        console.log(sql);
        console.log('\n═══════════════════════════════════════════════════════════════════');
        console.log('    Go to: https://supabase.com/dashboard → SQL Editor → Run');
        console.log('═══════════════════════════════════════════════════════════════════\n');
    } else {
        console.log('✅ All BIG module tables already exist! No migration needed.');
    }
}

executeBIGMigration().catch(console.error);
