import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// --- Environment Variable Loading Logic ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

let supabaseUrl, supabaseKey;

try {
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
    supabaseUrl = envVars.VITE_SUPABASE_URL;
    supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {
    console.warn("⚠️ Could not read .env file, falling back to process.env or hardcoded defaults (if valid).");
    // Fallback if .env read failed (e.g. file permissions), though manual read usually works better than dotenv in some contexts
}

if (!supabaseUrl || !supabaseKey) {
    // Last resort hardcoded for this session, copied from my memory of the user's project if available, or just fail
    console.error("❌ Failed to load credentials from .env.");
    process.exit(1);
}
// ------------------------------------------

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyIntegrity() {
    console.log('🔍 Starting General Journal Integrity Check...\n');

    // 1. Fetch all journal entries
    const { data: entries, error } = await supabase
        .from('blink_journal_entries')
        .select('*');

    if (error) {
        console.error('❌ Error fetching entries:', error.message);
        return;
    }

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
    const autoEntries = entries.filter(e => e.source === 'auto' && e.reference_id && e.reference_type);

    // Check Invoices
    const invoiceIds = [...new Set(autoEntries.filter(e => e.reference_type === 'invoice').map(e => e.reference_id))];
    if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase.from('blink_invoices').select('id').in('id', invoiceIds);
        const validInvoiceIds = new Set(invoices?.map(i => i.id) || []);
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
        const { data: pos } = await supabase.from('blink_purchase_orders').select('id').in('id', poIds);
        const validPoIds = new Set(pos?.map(p => p.id) || []);
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
}

verifyIntegrity();
