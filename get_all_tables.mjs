/**
 * Get all existing tables in Supabase
 * 
 * Usage: node get_all_tables.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    // Use defaults
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllTables() {
    console.log('\n📊 SCANNING ALL EXISTING TABLES IN YOUR SUPABASE\n');
    console.log('='.repeat(70) + '\n');

    // List of common table names to test
    const commonTables = [
        // Core
        'user_sessions', 'user_audit_log', 'menu_registry', 'role_permissions', 'user_menu_permissions',
        // Bridge Operasional
        'freight_customers', 'freight_vendors', 'freight_warehouse', 'freight_inbound', 'freight_outbound',
        'freight_inventory', 'freight_customs', 'freight_reject', 'freight_pic', 'blink_shipments', 'freight_mutation_logs',
        // Finance
        'finance_coa', 'blink_invoices', 'blink_payments', 'blink_purchase_orders', 'blink_ap_transactions',
        'blink_ar_transactions', 'blink_journal_entries', 'blink_journal_line_items', 'bank_accounts', 'company_bank_accounts',
        // Pabean
        'freight_bc_codes', 'freight_hs_codes', 'blink_sales_quotations',
        // Big Finance
        'big_events', 'big_quotations', 'big_quotation_items', 'big_invoices', 'big_invoice_items',
        'big_costs', 'big_ap_transactions', 'big_ar_transactions',
        // Admin
        'partners', 'partner_accounts', 'partner_types', 'company_settings', 'delivery_notes', 'delivery_note_items',
        // Additional
        'blink_business_partners', 'freight_quotations', 'freight_invoices', 'freight_purchases', 'freight_events',
        'business_partners', 'bridge_assets'
    ];

    const existingTables = [];
    const missingTables = [];

    for (const tableName of commonTables) {
        try {
            const { error } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true })
                .limit(1);

            if (!error) {
                existingTables.push(tableName);
            } else if (error.code !== 'PGRST116') {
                existingTables.push(tableName); // Exists but with access issue
            } else {
                missingTables.push(tableName);
            }
        } catch (e) {
            missingTables.push(tableName);
        }
    }

    console.log(`✅ EXISTING TABLES (${existingTables.length}):\n`);
    existingTables.forEach(t => console.log(`  • ${t}`));

    console.log(`\n❌ MISSING TABLES (${missingTables.length}):\n`);
    missingTables.slice(0, 10).forEach(t => console.log(`  • ${t}`));
    if (missingTables.length > 10) {
        console.log(`  ... and ${missingTables.length - 10} more`);
    }

    console.log('\n' + '='.repeat(70) + '\n');

    return existingTables;
}

getAllTables().then(tables => {
    console.log('📋 Use these table names for any SQL queries.');
    console.log('Only query/modify tables that exist!\n');
});
