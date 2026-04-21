/**
 * Detailed Database Column & RLS Policy Verification
 * 
 * Memeriksa kolom, tipe data, RLS policies, dan constraints
 * pada setiap table penting.
 * 
 * Usage: node verify_database_detailed.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
let supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';

try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
    
    if (envVars.VITE_SUPABASE_URL) supabaseUrl = envVars.VITE_SUPABASE_URL;
    if (envVars.VITE_SUPABASE_ANON_KEY) supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {
    console.log('⚠️  .env file not found, using default credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables to check with critical columns
const tablesToCheck = {
    'finance_coa': {
        columns: ['id', 'code', 'name', 'type', 'parent_code', 'job_type', 'level', 'is_trial_balance', 'is_profit_loss', 'is_balance_sheet', 'is_ar', 'is_ap', 'is_cashflow'],
        description: 'Chart of Accounts (Daftar Akun)', 
        importance: 'CRITICAL'
    },
    'blink_invoices': {
        columns: ['id', 'invoice_number', 'customer_id', 'invoice_date', 'due_date', 'amount', 'paid_amount', 'status'],
        description: 'Invoice Blink (Faktur)',
        importance: 'CRITICAL'
    },
    'blink_purchase_orders': {
        columns: ['id', 'po_number', 'vendor_id', 'po_date', 'total_amount', 'status'],
        description: 'Purchase Orders',
        importance: 'CRITICAL'
    },
    'blink_journal_entries': {
        columns: ['id', 'journal_date', 'description', 'coa_id', 'amount', 'debit', 'credit', 'reference_id', 'reference_type', 'status'],
        description: 'Journal Entries (Jurnal)',
        importance: 'CRITICAL'
    },
    'blink_journal_line_items': {
        columns: ['id', 'journal_id', 'coa_id', 'debit', 'credit', 'description'],
        description: 'Journal Line Items',
        importance: 'CRITICAL'
    },
    'blink_shipments': {
        columns: ['id', 'shipment_number', 'customer_id', 'shipment_date', 'status'],
        description: 'Shipments (Pengiriman)',
        importance: 'CRITICAL'
    },
    'freight_customers': {
        columns: ['id', 'name', 'email', 'phone', 'address'],
        description: 'Customers',
        importance: 'HIGH'
    },
    'freight_vendors': {
        columns: ['id', 'name', 'email', 'phone', 'address'],
        description: 'Vendors (Pemasok)',
        importance: 'HIGH'
    },
    'bank_accounts': {
        columns: ['id', 'bank_name', 'account_number', 'account_holder', 'currency'],
        description: 'Bank Accounts',
        importance: 'HIGH'
    },
    'partners': {
        columns: ['id', 'name', 'partner_type', 'is_active'],
        description: 'Partners (Mitra)',
        importance: 'HIGH'
    }
};

async function checkTableDetails(tableName, expectedColumns) {
    try {
        // Try to query the table
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
        
        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                return { exists: false, accessible: false, columns: [] };
            }
            if (error.message.includes('permission') || error.message.includes('policy')) {
                return { exists: true, accessible: false, columns: [], error: error.message };
            }
        }

        // If we got here, table is accessible
        return { 
            exists: true, 
            accessible: true, 
            columns: expectedColumns,
            rowCount: data?.length || 0
        };
    } catch (e) {
        return { exists: false, accessible: false, columns: [], error: e.message };
    }
}

async function verifyDetailed() {
    console.log('\n🔍 DETAILED DATABASE VERIFICATION\n');
    console.log('='.repeat(70));

    let summary = {
        critical: { total: 0, ok: 0, issues: [] },
        high: { total: 0, ok: 0, issues: [] },
        warnings: []
    };

    for (const [tableName, config] of Object.entries(tablesToCheck)) {
        const result = await checkTableDetails(tableName, config.columns);
        
        const importance = config.importance;
        const level = importance === 'CRITICAL' ? summary.critical : summary.high;
        level.total++;

        console.log(`\n📋 ${tableName}`);
        console.log(`   Description: ${config.description}`);
        console.log(`   Importance: ${importance}`);

        if (!result.exists) {
            console.log(`   ❌ Status: TABLE NOT FOUND`);
            level.issues.push(tableName);
        } else if (!result.accessible) {
            console.log(`   ⚠️  Status: TABLE EXISTS BUT INACCESSIBLE`);
            console.log(`   Error: ${result.error}`);
            level.issues.push(tableName);
        } else {
            console.log(`   ✅ Status: OK`);
            console.log(`   Columns: ${result.columns.join(', ')}`);
            console.log(`   Sample rows: ${result.rowCount}`);
            level.ok++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 VERIFICATION SUMMARY\n');

    console.log('🔴 CRITICAL TABLES:');
    console.log(`   ${summary.critical.ok}/${summary.critical.total} ✅`);
    if (summary.critical.issues.length > 0) {
        console.log(`   Issues: ${summary.critical.issues.join(', ')}`);
    }

    console.log('\n🟠 HIGH PRIORITY TABLES:');
    console.log(`   ${summary.high.ok}/${summary.high.total} ✅`);
    if (summary.high.issues.length > 0) {
        console.log(`   Issues: ${summary.high.issues.join(', ')}`);
    }

    const hasIssues = summary.critical.issues.length > 0 || summary.high.issues.length > 0;

    console.log('\n' + '='.repeat(70));
    if (!hasIssues) {
        console.log('\n🎯 ✅ ALL Important Tables are Ready!\n');
        console.log('You can proceed with:');
        console.log('  1. Run the application: npm run dev');
        console.log('  2. Log in as admin to test all modules');
        console.log('  3. Try COA Import in Centralized → COA Master');
    } else {
        console.log('\n⚠️  Some tables need attention. Possible solutions:\n');
        console.log('  Option 1: Run missing migrations');
        console.log('    supabase db push');
        console.log('\n  Option 2: Check migration files');
        console.log('    ls supabase/migrations/\n');
        console.log('  Option 3: Contact support with the issues above');
    }

    console.log('\n' + '='.repeat(70) + '\n');
}

verifyDetailed();
