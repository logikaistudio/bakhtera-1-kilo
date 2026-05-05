/**
 * Script untuk seed data COA kepala 5 ke Supabase
 * Jalankan: node scripts/seed-cogs-coa.js
 */

// Baca env dari file .env
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env file
let supabaseUrl, supabaseKey;
try {
    const envContent = readFileSync('.env', 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
        }
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
        }
    }
} catch (e) {
    console.error('❌ Cannot read .env file:', e.message);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

console.log('🔌 Connecting to Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

const cogsAccounts = [
    // Level 1
    { code: '5000', name: 'HARGA POKOK PENJUALAN (HPP)', type: 'EXPENSE', parent_code: null, level: 1, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    // Level 2
    { code: '5100', name: 'Biaya Freight & Pengiriman', type: 'EXPENSE', parent_code: '5000', level: 2, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    { code: '5200', name: 'Biaya Kepabeanan & Ekspedisi', type: 'EXPENSE', parent_code: '5000', level: 2, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    { code: '5300', name: 'Biaya Operasional Pelabuhan', type: 'EXPENSE', parent_code: '5000', level: 2, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    { code: '5400', name: 'Biaya Asuransi & Dokumen', type: 'EXPENSE', parent_code: '5000', level: 2, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    { code: '5500', name: 'Biaya Lain-lain COGS', type: 'EXPENSE', parent_code: '5000', level: 2, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    // Level 3 - Freight
    { code: '5101', name: 'Ocean Freight', type: 'EXPENSE', parent_code: '5100', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5102', name: 'Air Freight', type: 'EXPENSE', parent_code: '5100', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5103', name: 'Trucking / Darat', type: 'EXPENSE', parent_code: '5100', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5104', name: 'Biaya Inland Transport', type: 'EXPENSE', parent_code: '5100', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5105', name: 'Rail Freight', type: 'EXPENSE', parent_code: '5100', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    // Level 3 - Customs
    { code: '5201', name: 'Bea Masuk / Import Duty', type: 'EXPENSE', parent_code: '5200', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5202', name: 'PPN Impor', type: 'EXPENSE', parent_code: '5200', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5203', name: 'Biaya PPJK / Customs Broker', type: 'EXPENSE', parent_code: '5200', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5204', name: 'Biaya Pemeriksaan Fisik', type: 'EXPENSE', parent_code: '5200', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5205', name: 'Biaya Survey / Surveyor', type: 'EXPENSE', parent_code: '5200', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    // Level 3 - Port
    { code: '5301', name: 'THC (Terminal Handling Charge)', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5302', name: 'Demurrage', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5303', name: 'Detention', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5304', name: 'Biaya Bongkar Muat (B/M)', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5305', name: 'Storage / Penumpukan', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5306', name: 'Port Handling Fee', type: 'EXPENSE', parent_code: '5300', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    // Level 3 - Insurance & Doc
    { code: '5401', name: 'Asuransi Cargo', type: 'EXPENSE', parent_code: '5400', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5402', name: 'Biaya Dokumentasi / Documentation Fee', type: 'EXPENSE', parent_code: '5400', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5403', name: 'Biaya Pengurusan BL / AWB', type: 'EXPENSE', parent_code: '5400', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5404', name: 'Biaya Fumigasi', type: 'EXPENSE', parent_code: '5400', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    // Level 3 - Other
    { code: '5501', name: 'Biaya Lain-lain Pengiriman', type: 'EXPENSE', parent_code: '5500', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5502', name: 'Biaya Penyimpanan / Warehousing', type: 'EXPENSE', parent_code: '5500', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
    { code: '5503', name: 'Bank Charges', type: 'EXPENSE', parent_code: '5500', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: false, is_active: true },
    { code: '5504', name: 'Charges - Others', type: 'EXPENSE', parent_code: '5500', level: 3, group_name: 'Cost of Goods Sold', is_trial_balance: true, is_profit_loss: true, is_balance_sheet: false, is_ar: false, is_ap: true, is_active: true },
];

async function seedCOGSAccounts() {
    console.log(`\n📊 Seeding ${cogsAccounts.length} COGS accounts (kepala 5)...`);
    
    const { data, error } = await supabase
        .from('finance_coa')
        .upsert(cogsAccounts, { onConflict: 'code' })
        .select();
    
    if (error) {
        console.error('❌ Error seeding:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        process.exit(1);
    }
    
    console.log(`✅ Successfully seeded ${data?.length || cogsAccounts.length} COGS accounts!`);
    console.log('\n📋 Accounts inserted/updated:');
    (data || cogsAccounts).forEach(acc => {
        console.log(`   ${acc.code} - ${acc.name}`);
    });
}

seedCOGSAccounts();
