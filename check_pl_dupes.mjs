import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    // 1. Check all journal entries grouped by reference_id for duplicates
    const { data: entries, error } = await supabase
        .from('blink_journal_entries')
        .select('id, entry_number, entry_type, reference_type, reference_id, reference_number, coa_id, account_code, account_name, debit, credit, batch_id, entry_date')
        .order('entry_date', { ascending: false });

    if (error) { console.error('Error:', error); return; }

    console.log(`\n=== Total Journal Entries: ${entries.length} ===\n`);

    // Group by batch_id
    const batches = {};
    entries.forEach(e => {
        const key = e.batch_id || e.id;
        if (!batches[key]) batches[key] = [];
        batches[key].push(e);
    });

    console.log(`Total Batches: ${Object.keys(batches).length}\n`);

    // Check for duplicate reference_ids (same invoice having multiple journal batches)
    const refGroups = {};
    entries.forEach(e => {
        if (e.reference_id) {
            if (!refGroups[e.reference_id]) refGroups[e.reference_id] = new Set();
            refGroups[e.reference_id].add(e.batch_id);
        }
    });

    const dupes = Object.entries(refGroups).filter(([, batches]) => batches.size > 1);
    if (dupes.length > 0) {
        console.log(`\n⚠️  DUPLICATE JOURNAL BATCHES found for ${dupes.length} reference(s):\n`);
        for (const [refId, batchSet] of dupes) {
            const relatedEntries = entries.filter(e => e.reference_id === refId);
            console.log(`  Reference ID: ${refId}`);
            console.log(`  Reference Number: ${relatedEntries[0]?.reference_number}`);
            console.log(`  Entry Type: ${relatedEntries[0]?.entry_type}`);
            console.log(`  Batch count: ${batchSet.size}`);
            console.log(`  Entries:`);
            relatedEntries.forEach(e => {
                console.log(`    ${e.entry_number} | ${e.account_code} ${e.account_name} | Dr ${e.debit} | Cr ${e.credit} | batch: ${e.batch_id?.substring(0,8)}`);
            });
            console.log('');
        }
    } else {
        console.log('✅ No duplicate journal batches found for any reference.\n');
    }

    // 2. Check COA accounts
    const { data: coa } = await supabase.from('finance_coa').select('id, code, name, type').order('code');
    console.log('\n=== COA Accounts ===');
    coa?.forEach(c => {
        console.log(`  ${c.code} | ${c.name} | Type: ${c.type}`);
    });

    // 3. Summarize by COA type for P&L
    console.log('\n=== P&L Summary from Journal Entries ===');
    const coaMap = {};
    coa?.forEach(c => { coaMap[c.id] = c; });
    
    const summary = {};
    entries.forEach(e => {
        const acc = coaMap[e.coa_id];
        if (!acc) return;
        if (!['REVENUE', 'COGS', 'COST', 'DIRECT_COST', 'EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE'].includes(acc.type)) return;
        
        const key = `${acc.code} ${acc.name} (${acc.type})`;
        if (!summary[key]) summary[key] = { debit: 0, credit: 0 };
        summary[key].debit += (e.debit || 0);
        summary[key].credit += (e.credit || 0);
    });

    Object.entries(summary).sort().forEach(([key, val]) => {
        const net = key.includes('REVENUE') || key.includes('OTHER_INCOME')
            ? val.credit - val.debit
            : val.debit - val.credit;
        console.log(`  ${key}: Dr=${val.debit.toLocaleString()} Cr=${val.credit.toLocaleString()} → Net=${net.toLocaleString()}`);
    });
}

check().catch(console.error);
