import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnn21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI0MTg2MTIsImV4cCI6MjA0Nzk5NDYxMn0.2dOK5aD3PnTjgqJHIPW-g1dvcHGvAB1aFSANS-DQJX8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🚀 Starting BIG module database migration...\n');

    try {
        // Test connection first
        const { data: testData, error: testError } = await supabase
            .from('freight_customers')
            .select('id')
            .limit(1);

        if (testError) {
            console.error('❌ Connection test failed:', testError.message);
            return;
        }
        console.log('✅ Supabase connection successful\n');

        // Create tables using raw SQL via RPC (if available) or check if tables exist
        // Since we can't run raw DDL via anon key, we'll verify tables exist

        const tables = [
            'big_events',
            'big_quotations',
            'big_quotation_items',
            'big_invoices',
            'big_invoice_items',
            'big_costs',
            'big_ar_transactions'
        ];

        console.log('📋 Checking BIG module tables...\n');

        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('id').limit(1);
            if (error && error.code === '42P01') {
                console.log(`❌ Table "${table}" does not exist - needs to be created via Supabase Dashboard`);
            } else if (error) {
                console.log(`⚠️ Table "${table}": ${error.message}`);
            } else {
                console.log(`✅ Table "${table}" exists`);
            }
        }

        console.log('\n📝 Note: To create missing tables, please run the SQL script in Supabase Dashboard:');
        console.log('   1. Go to https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to SQL Editor');
        console.log('   4. Paste contents of supabase_big_schema.sql');
        console.log('   5. Click "Run"\n');

    } catch (error) {
        console.error('❌ Migration error:', error.message);
    }
}

runMigration();
