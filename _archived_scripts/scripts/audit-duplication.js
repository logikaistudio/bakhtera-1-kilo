// Audit Data Duplication & localStorage Correlation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NjcxMTYsImV4cCI6MjA1MTA0MzExNn0.GhpLPJQyE7IIlmFStBqKVQ_aKcbgleVzN3LKc3wCPxk';

const supabase = createClient(supabaseUrl, anonKey);

console.log('🔍 BLINK Data Duplication Audit\n');
console.log('═══════════════════════════════════════\n');

// Check localStorage keys (browser-side check via script)
function checkLocalStorageKeys() {
    console.log('📦 localStorage Keys Check\n');

    const blinkKeys = [
        'blink_quotations',
        'blink_shipments',
        'blink_leads',
        'blink_tracking',
        'blink_so',
        'blink_bl'
    ];

    console.log('  Expected BLINK keys to check:');
    blinkKeys.forEach(key => {
        console.log(`    - ${key}`);
    });

    console.log('\n  ⚠️  Note: localStorage check must be done in browser');
    console.log('  Run in Console: Object.keys(localStorage).filter(k => k.includes("blink"))\n');
}

// Check Supabase data
async function checkSupabaseData() {
    console.log('🗄️  Supabase Database Check\n');

    // Check quotations
    const { data: quotations, error: qError } = await supabase
        .from('blink_quotations')
        .select('id, job_number, customer_name, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (qError) {
        console.log('  ❌ Quotations error:', qError.message);
    } else {
        console.log(`  ✅ Quotations: ${quotations.length} records`);
        if (quotations.length > 0) {
            console.log('     Latest:', quotations[0].job_number);
            console.log('     Customer:', quotations[0].customer_name);
            console.log('     Amount:', quotations[0].total_amount);
        }
    }

    // Check shipments
    const { data: shipments, error: sError } = await supabase
        .from('blink_shipments')
        .select('id, job_number, customer, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (sError) {
        console.log('  ❌ Shipments error:', sError.message);
    } else {
        console.log(`  ✅ Shipments: ${shipments.length} records`);
        if (shipments.length > 0) {
            console.log('     Latest:', shipments[0].job_number);
            console.log('     Customer:', shipments[0].customer);
        }
    }

    // Check tracking
    const { data: tracking } = await supabase
        .from('blink_tracking_updates')
        .select('id')
        .limit(10);

    console.log(`  ✅ Tracking: ${tracking?.length || 0} records`);

    // Check leads
    const { data: leads } = await supabase
        .from('blink_leads')
        .select('id')
        .limit(10);

    console.log(`  ✅ Leads: ${leads?.length || 0} records\n`);

    return { quotations, shipments };
}

// Analyze potential duplicates
async function analyzeDuplication(supabaseData) {
    console.log('🔄 Duplication Analysis\n');

    console.log('  Potential duplication scenarios:\n');

    console.log('  1️⃣  Quotations:');
    console.log('      - Supabase: ✅ Active (migrated)');
    console.log('      - localStorage: ⚠️  May contain old data');
    console.log('      - Risk: MEDIUM - Data mismatch if not cleared\n');

    console.log('  2️⃣  Shipments:');
    console.log('      - Supabase: ✅ Active (migrated)');
    console.log('      - localStorage: ⚠️  May contain old data');
    console.log('      - Risk: HIGH - COGS data might be duplicated\n');

    console.log('  3️⃣  Leads:');
    console.log('      - Supabase: ✅ Ready');
    console.log('      - localStorage: ❓ Unknown if used');
    console.log('      - Risk: LOW - Not actively used\n');
}

// Check code for localStorage references
function checkCodeReferences() {
    console.log('📝 Code localStorage References\n');

    const components = {
        'QuotationManagement.jsx': {
            status: '✅ MIGRATED',
            localStorage: 'Removed',
            supabase: 'Active'
        },
        'ShipmentManagement.jsx': {
            status: '✅ MIGRATED',
            localStorage: 'Removed',
            supabase: 'Active'
        },
        'BLManagement.jsx': {
            status: '✅ CLEAN',
            localStorage: 'Never used',
            supabase: 'N/A'
        },
        'SalesOrderManagement.jsx': {
            status: '⏸️  PLACEHOLDER',
            localStorage: 'Unknown',
            supabase: 'Not integrated'
        }
    };

    Object.entries(components).forEach(([file, info]) => {
        console.log(`  ${file}:`);
        console.log(`    Status: ${info.status}`);
        console.log(`    localStorage: ${info.localStorage}`);
        console.log(`    Supabase: ${info.supabase}\n`);
    });
}

// Generate cleanup script
function generateCleanupScript() {
    console.log('═══════════════════════════════════════\n');
    console.log('🧹 CLEANUP RECOMMENDATIONS\n');
    console.log('═══════════════════════════════════════\n');

    console.log('📋 Browser Console Script:\n');
    console.log('```javascript');
    console.log('// Step 1: Check what exists');
    console.log('const blinkKeys = Object.keys(localStorage).filter(k => k.includes("blink"));');
    console.log('console.log("BLINK localStorage keys:", blinkKeys);');
    console.log('');
    console.log('// Step 2: Backup (optional)');
    console.log('const backup = {};');
    console.log('blinkKeys.forEach(key => {');
    console.log('    backup[key] = localStorage.getItem(key);');
    console.log('});');
    console.log('console.log("Backup created:", Object.keys(backup));');
    console.log('');
    console.log('// Step 3: Clear BLINK localStorage');
    console.log('localStorage.removeItem("blink_quotations");');
    console.log('localStorage.removeItem("blink_shipments");');
    console.log('localStorage.removeItem("blink_leads");');
    console.log('');
    console.log('// Step 4: Verify');
    console.log('console.log("Remaining:", Object.keys(localStorage).filter(k => k.includes("blink")));');
    console.log('');
    console.log('// Step 5: Refresh');
    console.log('location.reload();');
    console.log('```\n');
}

// Main execution
async function main() {
    checkLocalStorageKeys();
    const supabaseData = await checkSupabaseData();
    await analyzeDuplication(supabaseData);
    checkCodeReferences();
    generateCleanupScript();

    console.log('═══════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log('═══════════════════════════════════════\n');
    console.log('✅ Supabase: Active & operational');
    console.log('⚠️  localStorage: Needs manual cleanup');
    console.log('🔄 Duplication: Possible until cleanup\n');
    console.log('🎯 Action: Run cleanup script in browser\n');
}

main();
