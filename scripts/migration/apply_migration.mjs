import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

console.log('🚀 Applying Invoice Multi-Currency Migration...\n');

// Read SQL file
const sql = readFileSync('./supabase/migrations/060_invoice_currency_constraint.sql', 'utf8');

console.log('📄 SQL Migration Content:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(sql.substring(0, 500) + '...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✅ Migration file loaded successfully');
console.log(`📏 File size: ${sql.length} characters\n`);

console.log('📋 Migration will create:');
console.log('   1. ✅ Unique index: idx_blink_invoices_quotation_currency_unique');
console.log('   2. ✅ Helper function: get_quotation_invoice_summary()');
console.log('   3. ✅ Validation trigger: trg_validate_invoice_currency_limit');
console.log('   4. ✅ Analytics view: v_invoice_quotation_summary\n');

console.log('⚠️  MANUAL STEP REQUIRED:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Since direct SQL execution requires elevated permissions,');
console.log('please apply the migration manually via Supabase Dashboard:');
console.log('');
console.log('1. Open: ' + SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/'));
console.log('2. Navigate to: SQL Editor');
console.log('3. Click: New Query');
console.log('4. Copy the SQL from: supabase/migrations/060_invoice_currency_constraint.sql');
console.log('5. Paste and click: Run');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('💡 Alternative: Use Supabase CLI');
console.log('   $ supabase db push\n');

console.log('✨ After migration, the frontend is already configured to:');
console.log('   - Validate max 2 invoices per quotation (1 IDR + 1 USD)');
console.log('   - Show existing invoice indicator');
console.log('   - Prevent duplicate currency invoices\n');
