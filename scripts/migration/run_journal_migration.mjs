// Script to run journal entries migration
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== Journal Migration Tool ===\n');

// First check if there's any data in AR or AP
console.log('1. Checking existing AR and AP data...');

const { data: arData, error: arError } = await supabase
    .from('blink_ar_transactions')
    .select('id, ar_number, customer_name, original_amount')
    .limit(5);

const { data: apData, error: apError } = await supabase
    .from('blink_ap_transactions')
    .select('id, ap_number, vendor_name, original_amount')
    .limit(5);

console.log(`\nAR Transactions found: ${arData?.length || 0}`);
if (arData && arData.length > 0) {
    console.log('Sample AR:', arData.slice(0, 3));
}

console.log(`\nAP Transactions found: ${apData?.length || 0}`);
if (apData && apData.length > 0) {
    console.log('Sample AP:', apData.slice(0, 3));
}

// Check existing journal entries
console.log('\n2. Checking existing journal entries...');
const { data: journalData, error: journalError } = await supabase
    .from('blink_journal_entries')
    .select('id, entry_number, account_name, debit, credit')
    .limit(5);

console.log(`Journal entries found: ${journalData?.length || 0}`);
if (journalData && journalData.length > 0) {
    console.log('Sample journals:', journalData);
}

// If no AR/AP data exists, we can't generate journals
if ((!arData || arData.length === 0) && (!apData || apData.length === 0)) {
    console.log('\n⚠️ No AR or AP transactions found in database.');
    console.log('Journal entries will be created automatically when:');
    console.log('  - Invoice is approved (creates AR -> creates Journal)');
    console.log('  - PO is approved (creates AP -> creates Journal)');
    console.log('\nTo see journal entries, please:');
    console.log('  1. Go to Invoice Management');
    console.log('  2. Approve some invoices');
    console.log('  3. Then check Jurnal Umum again');
    process.exit(0);
}

// Check finance_coa
console.log('\n3. Checking Chart of Accounts (COA)...');
const { data: coaData, error: coaError } = await supabase
    .from('finance_coa')
    .select('id, code, name')
    .limit(10);

console.log(`COA entries found: ${coaData?.length || 0}`);
if (coaData && coaData.length > 0) {
    console.log('Sample COA:', coaData.slice(0, 5));
}

// Now let's manually create journal entries from AR
if (arData && arData.length > 0) {
    console.log('\n4. Creating journal entries from AR transactions...');

    const arCoa = coaData?.find(c => c.code.startsWith('120'));
    const revenueCoa = coaData?.find(c => c.code.startsWith('400'));

    for (const ar of arData) {
        const batchId = crypto.randomUUID();
        const entryNum = `JE-AR-${Date.now().toString().slice(-6)}`;

        // Check if already exists
        const { data: existing } = await supabase
            .from('blink_journal_entries')
            .select('id')
            .eq('reference_id', ar.id)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`  - AR ${ar.ar_number} already has journal entry`);
            continue;
        }

        // DEBIT entry
        const { error: debitError } = await supabase
            .from('blink_journal_entries')
            .insert({
                entry_number: entryNum + '-D',
                entry_date: new Date().toISOString().split('T')[0],
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_id: ar.id,
                reference_number: ar.ar_number,
                account_code: arCoa?.code || '120-001',
                account_name: 'Piutang Usaha - ' + ar.customer_name,
                debit: ar.original_amount,
                credit: 0,
                currency: 'IDR',
                description: 'Invoice ' + ar.ar_number + ' - ' + ar.customer_name,
                batch_id: batchId,
                source: 'auto',
                coa_id: arCoa?.id,
                party_name: ar.customer_name
            });

        // CREDIT entry
        const { error: creditError } = await supabase
            .from('blink_journal_entries')
            .insert({
                entry_number: entryNum + '-C',
                entry_date: new Date().toISOString().split('T')[0],
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_id: ar.id,
                reference_number: ar.ar_number,
                account_code: revenueCoa?.code || '400-001',
                account_name: 'Pendapatan Jasa',
                debit: 0,
                credit: ar.original_amount,
                currency: 'IDR',
                description: 'Invoice ' + ar.ar_number + ' - ' + ar.customer_name,
                batch_id: batchId,
                source: 'auto',
                coa_id: revenueCoa?.id,
                party_name: ar.customer_name
            });

        if (debitError || creditError) {
            console.log(`  ✗ Failed for AR ${ar.ar_number}:`, debitError || creditError);
        } else {
            console.log(`  ✓ Created journals for AR ${ar.ar_number}`);
        }
    }
}

// Create journal entries from AP
if (apData && apData.length > 0) {
    console.log('\n5. Creating journal entries from AP transactions...');

    const apCoa = coaData?.find(c => c.code.startsWith('210'));
    const expenseCoa = coaData?.find(c => c.code.startsWith('500'));

    for (const ap of apData) {
        const batchId = crypto.randomUUID();
        const entryNum = `JE-AP-${Date.now().toString().slice(-6)}`;

        // Check if already exists
        const { data: existing } = await supabase
            .from('blink_journal_entries')
            .select('id')
            .eq('reference_id', ap.id)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`  - AP ${ap.ap_number} already has journal entry`);
            continue;
        }

        // DEBIT entry (Expense)
        const { error: debitError } = await supabase
            .from('blink_journal_entries')
            .insert({
                entry_number: entryNum + '-D',
                entry_date: new Date().toISOString().split('T')[0],
                entry_type: 'po',
                reference_type: 'ap',
                reference_id: ap.id,
                reference_number: ap.ap_number,
                account_code: expenseCoa?.code || '500-001',
                account_name: 'Beban Operasional',
                debit: ap.original_amount,
                credit: 0,
                currency: 'IDR',
                description: 'PO ' + ap.ap_number + ' - ' + ap.vendor_name,
                batch_id: batchId,
                source: 'auto',
                coa_id: expenseCoa?.id,
                party_name: ap.vendor_name
            });

        // CREDIT entry (AP)
        const { error: creditError } = await supabase
            .from('blink_journal_entries')
            .insert({
                entry_number: entryNum + '-C',
                entry_date: new Date().toISOString().split('T')[0],
                entry_type: 'po',
                reference_type: 'ap',
                reference_id: ap.id,
                reference_number: ap.ap_number,
                account_code: apCoa?.code || '210-001',
                account_name: 'Hutang Usaha - ' + ap.vendor_name,
                debit: 0,
                credit: ap.original_amount,
                currency: 'IDR',
                description: 'PO ' + ap.ap_number + ' - ' + ap.vendor_name,
                batch_id: batchId,
                source: 'auto',
                coa_id: apCoa?.id,
                party_name: ap.vendor_name
            });

        if (debitError || creditError) {
            console.log(`  ✗ Failed for AP ${ap.ap_number}:`, debitError || creditError);
        } else {
            console.log(`  ✓ Created journals for AP ${ap.ap_number}`);
        }
    }
}

// Final check
console.log('\n6. Final check - Journal entries after migration...');
const { data: finalJournals } = await supabase
    .from('blink_journal_entries')
    .select('entry_number, account_name, debit, credit, entry_date')
    .order('created_at', { ascending: false })
    .limit(10);

console.log(`\nTotal journal entries now: ${finalJournals?.length || 0}`);
if (finalJournals && finalJournals.length > 0) {
    console.log('\nRecent journal entries:');
    finalJournals.forEach(j => {
        console.log(`  ${j.entry_date} | ${j.entry_number} | ${j.account_name} | D: ${j.debit} | C: ${j.credit}`);
    });
}

console.log('\n=== Migration Complete ===');
console.log('Please refresh Jurnal Umum page to see the data.');
