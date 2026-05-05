import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const fixMode = process.argv.includes('--fix');

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

    // 2. Check Invoice totals against journal entries
    const invoiceEntries = entries.filter(e => String(e.entry_type || '').trim().toLowerCase() === 'invoice');
    if (invoiceEntries.length > 0) {
        const invoiceIds = [...new Set(invoiceEntries.map(e => e.reference_id).filter(Boolean))];
        const { data: invoices, error: invoiceError } = await supabase
            .from('blink_invoices')
            .select('id, invoice_number, total_amount')
            .in('id', invoiceIds);

        if (invoiceError) {
            console.warn('⚠️ Could not load invoices for validation:', invoiceError.message);
        } else {
            const mismatches = [];
            const invoiceMap = new Map((invoices || []).map(inv => [inv.id, inv]));

            invoiceIds.forEach(id => {
                const related = invoiceEntries.filter(e => e.reference_id === id);
                const invoice = invoiceMap.get(id);
                if (!invoice) return;

                const invoiceTotal = Number(invoice.total_amount || 0);
                const batchTotals = {};

                related.forEach(e => {
                    const batchId = e.batch_id || 'no-batch';
                    if (!batchTotals[batchId]) batchTotals[batchId] = { debit: 0, credit: 0, count: 0 };
                    batchTotals[batchId].debit += (e.debit || 0);
                    batchTotals[batchId].credit += (e.credit || 0);
                    batchTotals[batchId].count += 1;
                });

                const totalDebit = Object.values(batchTotals).reduce((sum, b) => sum + b.debit, 0);
                const totalCredit = Object.values(batchTotals).reduce((sum, b) => sum + b.credit, 0);

                const goodBatchIds = Object.entries(batchTotals)
                    .filter(([, totals]) => Math.abs(totals.debit - invoiceTotal) <= 0.01 && Math.abs(totals.credit - invoiceTotal) <= 0.01)
                    .map(([batchId]) => batchId);
                const badBatchIds = Object.entries(batchTotals)
                    .filter(([, totals]) => Math.abs(totals.debit - invoiceTotal) > 0.01 || Math.abs(totals.credit - invoiceTotal) > 0.01)
                    .map(([batchId]) => batchId);

                if (Object.keys(batchTotals).length > 1) {
                    console.log(`\nℹ️ Invoice ${invoice.invoice_number} has ${Object.keys(batchTotals).length} journal batches:`);
                    Object.entries(batchTotals).forEach(([batchId, totals]) => {
                        const matchDebit = Math.abs(totals.debit - invoiceTotal) <= 0.01;
                        const matchCredit = Math.abs(totals.credit - invoiceTotal) <= 0.01;
                        console.log(`  Batch ${batchId}: entries=${totals.count} debit=${totals.debit.toLocaleString()} credit=${totals.credit.toLocaleString()} ${matchDebit && matchCredit ? '(matches invoice total)' : ''}`);
                    });
                }

                if (Math.abs(totalDebit - invoiceTotal) > 0.01 || Math.abs(totalCredit - invoiceTotal) > 0.01) {
                    mismatches.push({
                        id,
                        invoice_number: invoice.invoice_number,
                        invoice_total: invoiceTotal,
                        journal_debit: totalDebit,
                        journal_credit: totalCredit,
                        batchCount: Object.keys(batchTotals).length,
                        badBatches: badBatchIds,
                        goodBatches: goodBatchIds
                    });
                }
            });

            if (mismatches.length > 0) {
                console.log(`\n⚠️ Invoice / Journal total mismatches found for ${mismatches.length} invoice(s):`);
                mismatches.forEach(item => {
                    console.log(`  Invoice ${item.invoice_number} (ID ${item.id}): invoice_total=${item.invoice_total.toLocaleString()} journal_debit=${item.journal_debit.toLocaleString()} journal_credit=${item.journal_credit.toLocaleString()} batches=${item.batchCount}`);
                    if (item.goodBatches.length > 0 && item.badBatches.length > 0) {
                        console.log(`    Good batch(es): ${item.goodBatches.join(', ')}`);
                        console.log(`    Bad batch(es): ${item.badBatches.join(', ')}`);
                    }
                });
                if (fixMode) {
                    const badBatchIds = mismatches.flatMap(item => item.badBatches || []);
                    const uniqueBadBatchIds = [...new Set(badBatchIds)];
                    if (uniqueBadBatchIds.length > 0) {
                        console.log(`\n🔧 Fix mode enabled: deleting ${uniqueBadBatchIds.length} bad batch(es): ${uniqueBadBatchIds.join(', ')}`);
                        const { error: deleteError } = await supabase
                            .from('blink_journal_entries')
                            .delete()
                            .in('batch_id', uniqueBadBatchIds);
                        if (deleteError) {
                            console.error('❌ Failed to delete bad batches:', deleteError);
                        } else {
                            console.log('✅ Bad journal batches removed.');
                        }
                    }
                } else {
                    console.log('');
                    console.log('💡 To remove stale batches, rerun with --fix');
                }
            } else {
                console.log('✅ All invoice-related journal entries match invoice totals.\n');
            }
        }
    }

    // 3. Check COA accounts
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
