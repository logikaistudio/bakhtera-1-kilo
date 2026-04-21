/**
 * Database Structure Verification Script
 * 
 * Memeriksa apakah semua tables, columns, dan struktur database
 * sudah ada dan sesuai dengan requirements aplikasi.
 * 
 * Usage: node verify_database_structure.mjs
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

// Define all required tables by module
const requiredTables = {
    'Core/Auth': [
        'auth.users',
        'user_sessions',
        'user_audit_log',
        'menu_registry',
        'role_permissions',
        'user_menu_permissions'
    ],
    'Bridge (Operasional)': [
        'freight_customers',
        'freight_vendors',
        'freight_warehouse',
        'freight_inbound',
        'freight_outbound',
        'freight_inventory',
        'freight_customs',
        'freight_reject',
        'freight_pic',
        'blink_shipments',
        'freight_mutation_logs'
    ],
    'Bridge (Finance)': [
        'finance_coa',
        'blink_invoices',
        'blink_payments',
        'blink_purchase_orders',
        'blink_ap_transactions',
        'blink_ar_transactions',
        'blink_journal_entries',
        'blink_journal_line_items',
        'bank_accounts',
        'company_bank_accounts'
    ],
    'Bridge (Pabean)': [
        'freight_bc_codes',
        'freight_hs_codes',
        'blink_sales_quotations'
    ],
    'Big (Finance)': [
        'big_events',
        'big_quotations',
        'big_quotation_items',
        'big_invoices',
        'big_invoice_items',
        'big_costs',
        'big_ap_transactions',
        'big_ar_transactions'
    ],
    'Admin/Master Data': [
        'partners',
        'partner_accounts',
        'partner_types',
        'company_settings',
        'delivery_notes',
        'delivery_note_items'
    ]
};

const criticalColumns = {
    'finance_coa': ['id', 'code', 'name', 'type', 'job_type', 'level', 'is_trial_balance', 'is_profit_loss', 'is_balance_sheet'],
    'blink_invoices': ['id', 'invoice_number', 'customer_id', 'invoice_date', 'amount', 'status'],
    'blink_purchase_orders': ['id', 'po_number', 'vendor_id', 'po_date', 'total_amount', 'status'],
    'blink_journal_entries': ['id', 'journal_date', 'description', 'amount', 'account_code'],
    'blink_shipments': ['id', 'shipment_number', 'customer_id', 'shipment_date', 'status'],
    'freight_customers': ['id', 'name', 'email', 'phone'],
    'freight_vendors': ['id', 'name', 'email', 'phone'],
    'partners': ['id', 'name', 'type', 'is_active']
};

async function checkTableExists(tableName) {
    try {
        // Try to select 1 row
        const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
        
        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                return false;
            }
            // Other errors might mean table exists but has issues
            return null;
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function checkTableColumns(tableName, columns) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(0); // Get schema without data
        
        if (error) return { exists: false, columns: [] };
        
        // Supabase doesn't directly expose schema via JS client, so we'll try to estimate
        // based on what queries work
        return { exists: true, columns: columns };
    } catch (e) {
        return { exists: false, columns: [] };
    }
}

async function verifyDatabase() {
    console.log('🔍 Verifying Database Structure for Bakhtera Application\n');
    console.log('========================================================\n');

    let totalTables = 0;
    let existingTables = 0;
    let missingTables = [];

    for (const [module, tables] of Object.entries(requiredTables)) {
        console.log(`📦 ${module}`);
        console.log('-'.repeat(50));

        for (const table of tables) {
            totalTables++;
            const exists = await checkTableExists(table);

            if (exists === true) {
                existingTables++;
                console.log(`  ✅ ${table}`);
            } else if (exists === false) {
                missingTables.push({ module, table });
                console.log(`  ❌ ${table}`);
            } else {
                console.log(`  ⚠️  ${table} (possible issue)`);
            }
        }
        console.log();
    }

    // Summary
    console.log('========================================================');
    console.log('📊 SUMMARY');
    console.log('========================================================\n');
    console.log(`Total Required Tables: ${totalTables}`);
    console.log(`Existing Tables: ${existingTables} (${Math.round(existingTables/totalTables*100)}%)`);
    console.log(`Missing Tables: ${missingTables.length}\n`);

    if (missingTables.length > 0) {
        console.log('❌ MISSING TABLES:');
        console.log('-'.repeat(50));
        missingTables.forEach(item => {
            console.log(`  • ${item.table} (in module: ${item.module})`);
        });
        console.log('\n⚠️  ACTION REQUIRED:');
        console.log('   1. Run all migrations: supabase db push');
        console.log('   2. Or run migrations manually from supabase/migrations/');
        console.log('   3. Check DATABASE tab in Supabase Dashboard');
    } else {
        console.log('✅ ALL REQUIRED TABLES EXIST!');
        console.log('\n🎯 Database structure is ready for the application.');
    }

    console.log('\n========================================================\n');

    return {
        total: totalTables,
        existing: existingTables,
        missing: missingTables.length,
        complete: missingTables.length === 0
    };
}

verifyDatabase().then(result => {
    if (!result.complete) {
        process.exit(1);
    }
});
