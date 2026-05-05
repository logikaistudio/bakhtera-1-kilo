/**
 * Verify all tables used by app pages exist and are accessible.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneW1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';
try {
  const envPath = join(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split(/\r?\n/).forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  if (envVars.VITE_SUPABASE_URL) supabaseUrl = envVars.VITE_SUPABASE_URL;
  if (envVars.SUPABASE_SERVICE_ROLE_KEY) supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  if (envVars.VITE_SUPABASE_ANON_KEY) supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {
  // ignore
}
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'bank_accounts',
  'big_ar_transactions',
  'big_costs',
  'big_events',
  'big_invoice_items',
  'big_invoices',
  'big_quotation_items',
  'big_quotations',
  'blink_ap_transactions',
  'blink_ar_transactions',
  'blink_bl_documents',
  'blink_business_partners',
  'blink_invoices',
  'blink_journal_entries',
  'blink_payments',
  'blink_pos',
  'blink_purchase_orders',
  'blink_quotations',
  'blink_sales_orders',
  'blink_sales_quotations',
  'blink_shipments',
  'bridge_assets',
  'bridge_business_partners',
  'code_of_accounts',
  'company_bank_accounts',
  'finance_coa',
  'freight_customers',
  'freight_delivery_notes',
  'freight_outbound',
  'freight_quotations',
  'freight_vendors',
  'freight_warehouse',
  'role_permissions',
  'users'
];

async function checkTable(tableName) {
  try {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      return { tableName, ok: false, error: error.message, code: error.code };
    }
    return { tableName, ok: true };
  } catch (e) {
    return { tableName, ok: false, error: e.message, code: null };
  }
}

(async () => {
  console.log('Verifying application tables...\n');
  const results = [];
  for (const table of tables) {
    const result = await checkTable(table);
    results.push(result);
    console.log(`${result.ok ? '✅' : '❌'} ${result.tableName}${result.ok ? '' : ` - ${result.error}`}`);
  }
  const missing = results.filter(r => !r.ok);
  console.log('\nSummary:');
  console.log(`  Total tables checked: ${results.length}`);
  console.log(`  Existing and accessible: ${results.length - missing.length}`);
  console.log(`  Missing or inaccessible: ${missing.length}`);
  if (missing.length > 0) {
    console.log('\nMissing/inaccessible tables:');
    missing.forEach(r => console.log(`  • ${r.tableName} - ${r.error}`));
  }
})();
