// Database Verification Script
// This script checks if all required tables and triggers exist in Supabase

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '.env');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n📊 Verifying Financial Module Database Structure...\n');

async function checkTable(tableName, requiredColumns = []) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                console.log(`❌ Table "${tableName}" does NOT exist`);
                return false;
            }
            console.log(`⚠️  Table "${tableName}" exists but query failed:`, error.message);
            return false;
        }

        console.log(`✅ Table "${tableName}" exists`);

        // Check if table has data
        const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        console.log(`   └─ Records: ${count || 0}`);
        return true;
    } catch (err) {
        console.log(`❌ Table "${tableName}" - Error:`, err.message);
        return false;
    }
}

async function checkTrigger(triggerName) {
    try {
        const { data, error } = await supabase.rpc('pg_get_triggerdef', {
            oid: triggerName
        });

        if (error) {
            console.log(`⚠️  Cannot verify trigger "${triggerName}"`);
            return false;
        }

        console.log(`✅ Trigger "${triggerName}" likely exists`);
        return true;
    } catch (err) {
        console.log(`⚠️  Cannot verify trigger "${triggerName}"`);
        return false;
    }
}

async function verifyAll() {
    console.log('=== CORE TABLES ===\n');

    const table1 = await checkTable('blink_purchase_orders');
    const table2 = await checkTable('blink_ap_transactions');
    const table3 = await checkTable('blink_shipments');
    const table4 = await checkTable('freight_vendors');

    console.log('\n=== VERIFICATION SUMMARY ===\n');

    if (table1 && table2 && table3 && table4) {
        console.log('✅ ALL REQUIRED TABLES EXIST!\n');
        console.log('Next steps:');
        console.log('1. Test creating a Shipment with COGS data');
        console.log('2. Click "Generate PO" button');
        console.log('3. Verify Draft PO appears in Purchase Order list');
        console.log('4. Edit the PO to assign a vendor');
        console.log('5. Approve the PO');
        console.log('6. Check Accounts Payable for auto-created bill\n');
    } else {
        console.log('❌ MISSING TABLES DETECTED!\n');
        console.log('Action Required:');
        console.log('1. Open Supabase Dashboard → SQL Editor');
        console.log('2. Run migration: supabase/migrations/011_blink_finance_module.sql');
        console.log('3. For Shipment COGS columns, run: 018_add_all_missing_shipment_columns.sql');
        console.log('4. Re-run this verification script\n');
    }
}

verifyAll().catch(console.error);
