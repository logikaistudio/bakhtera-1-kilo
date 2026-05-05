import pkg from 'pg';
const { Client } = pkg;
import { config } from 'dotenv';

config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function verifyIntegrity() {
    console.log('🔍 Starting General Journal Integrity Check...\n');

    try {
        await client.connect();

        // 1. Fetch all journal entries
        const result = await client.query(`
            SELECT * FROM blink_journal_entries
            ORDER BY entry_date DESC, entry_number
        `);
        const entries = result.rows;

        console.log(`✅ Fetched ${entries.length} journal entries.`);

        // 2. Check COA Correlation
        console.log('\n--- Checking COA Integrity ---');
        const invalidCoa = entries.filter(e => !e.coa_id);
        if (invalidCoa.length > 0) {
            console.warn(`⚠️ Found ${invalidCoa.length} entries with missing COA ID:`);
            invalidCoa.forEach(e => console.log(`   - [${e.entry_number}] ${e.account_name} (${e.account_code})`));
        } else {
            console.log('✅ All entries have valid COA IDs.');
        }

        const missingJournalType = entries.filter(e => !e.journal_type);
        if (missingJournalType.length > 0) {
            console.warn(`⚠️ Found ${missingJournalType.length} entries without journal_type:`);
            missingJournalType.slice(0, 10).forEach(e => console.log(`   - [${e.entry_number}] entry_type=${e.entry_type}`));
        } else {
            console.log('✅ All entries have journal_type assigned.');
        }

        const missingPeriod = entries.filter(e => !e.period_month || !e.period_year);
        if (missingPeriod.length > 0) {
            console.warn(`⚠️ Found ${missingPeriod.length} entries without period_month/period_year:`);
            missingPeriod.slice(0, 10).forEach(e => console.log(`   - [${e.entry_number}] entry_date=${e.entry_date}`));
        } else {
            console.log('✅ All entries have a valid journal period.');
        }

        // 3. Check Balance per Batch
        console.log('\n--- Checking Batch Balances ---');
        const batches = {};
        entries.forEach(e => {
            if (!batches[e.batch_id]) batches[e.batch_id] = { debit: 0, credit: 0, entries: [] };
            batches[e.batch_id].debit += (e.debit || 0);
            batches[e.batch_id].credit += (e.credit || 0);
            batches[e.batch_id].entries.push(e.entry_number);
        });

        let unbalancedCount = 0;
        Object.keys(batches).forEach(batchId => {
            const diff = Math.abs(batches[batchId].debit - batches[batchId].credit);
            if (diff > 0.01) { // Floating point tolerance
                console.error(`❌ Unbalanced Batch [${batchId}]:`);
                console.error(`   Debit: ${batches[batchId].debit.toLocaleString()}`);
                console.error(`   Credit: ${batches[batchId].credit.toLocaleString()}`);
                console.error(`   Diff: ${diff.toLocaleString()}`);
                console.error(`   Entries: ${batches[batchId].entries.join(', ')}`);
                unbalancedCount++;
            }
        });

        if (unbalancedCount === 0) {
            console.log(`✅ All ${Object.keys(batches).length} transactions are balanced.`);
        }

        // 4. Check Source Correlation (Orphans)
        console.log('\n--- Checking Source Document Correlation ---');
        const autoEntries = entries.filter(e => e.journal_type === 'auto' && e.reference_id && e.reference_type);

        // Check Invoices
        const invoiceIds = [...new Set(autoEntries.filter(e => e.reference_type === 'invoice').map(e => e.reference_id))];
        if (invoiceIds.length > 0) {
            const invoiceResult = await client.query(`
                SELECT id FROM blink_invoices WHERE id = ANY($1)
            `, [invoiceIds]);
            const validInvoiceIds = new Set(invoiceResult.rows.map(i => i.id));
            const orphanInvoices = invoiceIds.filter(id => !validInvoiceIds.has(id));

            if (orphanInvoices.length > 0) {
                console.warn(`⚠️ Found ${orphanInvoices.length} entries pointing to non-existent Invoices.`);
            } else {
                console.log(`✅ All ${invoiceIds.length} Invoice references are valid.`);
            }
        } else {
            console.log('ℹ️ No Invoice references found.');
        }

        // Check POs
        const poIds = [...new Set(autoEntries.filter(e => e.reference_type === 'po').map(e => e.reference_id))];
        if (poIds.length > 0) {
            const poResult = await client.query(`
                SELECT id FROM blink_purchase_orders WHERE id = ANY($1)
            `, [poIds]);
            const validPoIds = new Set(poResult.rows.map(p => p.id));
            const orphanPos = poIds.filter(id => !validPoIds.has(id));

            if (orphanPos.length > 0) {
                console.warn(`⚠️ Found ${orphanPos.length} entries pointing to non-existent Purchase Orders.`);
            } else {
                console.log(`✅ All ${poIds.length} PO references are valid.`);
            }
        } else {
            console.log('ℹ️ No PO references found.');
        }

        console.log('\n🎉 Verification Complete.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

verifyIntegrity();
