import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

// Helper to make requests to Supabase REST API
function supabaseFetch(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${supabaseUrl}/rest/v1/${endpoint}`);
        const options = {
            method,
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function migrateInvoices() {
    try {
        console.log("Fetching existing invoices...");
        const invoices = await supabaseFetch('blink_invoices?status=neq.draft&status=neq.cancelled');
        console.log(`Found ${invoices.length} active invoices.`);

        console.log("Fetching existing invoice journal entries...");
        const currentJournals = await supabaseFetch('blink_journal_entries?select=reference_id&reference_type=eq.ar');

        const existingInvoiceIdsWithJournal = new Set(currentJournals.map(je => je.reference_id));
        console.log(`Found ${existingInvoiceIdsWithJournal.size} invoices that already have journal entries.`);

        const invoicesToMigrate = invoices.filter(inv => !existingInvoiceIdsWithJournal.has(inv.id));
        console.log(`Invoices needing migration: ${invoicesToMigrate.length}`);

        if (invoicesToMigrate.length === 0) {
            console.log("No invoices need migrating. Exiting.");
            return;
        }

        console.log("Fetching COAs...");
        const arCoas = await supabaseFetch('finance_coa?type=eq.ASSET&name=ilike.*piutang*&limit=1');
        const revCoas = await supabaseFetch('finance_coa?type=eq.REVENUE&name=ilike.*pendapatan*&limit=1');

        const arCoa = arCoas?.[0];
        const revCoa = revCoas?.[0];

        if (!arCoa || !revCoa) {
            throw new Error("Could not find Piutang or Pendapatan COAs.");
        }

        const entriesToInsert = [];

        for (const inv of invoicesToMigrate) {
            const batchId = crypto.randomUUID();
            const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
            // Simple random tail to avoid collisions
            const entryNum = `JE-MIG-${dateStr}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
            const billDate = inv.invoice_date || new Date().toISOString().split('T')[0];
            const exRate = inv.exchange_rate || 16000;
            const idrNote = inv.currency !== 'IDR' ? ` (Rate: ${exRate})` : '';

            entriesToInsert.push({
                entry_number: entryNum + '-D',
                entry_date: billDate,
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_id: inv.id,
                reference_number: inv.invoice_number,
                account_code: arCoa.code,
                account_name: `${arCoa.name} - ${inv.customer_name}`,
                debit: inv.total_amount,
                credit: 0,
                currency: inv.currency || 'IDR',
                exchange_rate: exRate,
                description: `Invoice ${inv.invoice_number} - ${inv.customer_name}${idrNote}`,
                batch_id: batchId,
                source: 'migration',
                coa_id: arCoa.id,
                party_name: inv.customer_name
            });

            entriesToInsert.push({
                entry_number: entryNum + '-C',
                entry_date: billDate,
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_id: inv.id,
                reference_number: inv.invoice_number,
                account_code: revCoa.code,
                account_name: `${revCoa.name} - ${inv.customer_name}`,
                debit: 0,
                credit: inv.total_amount,
                currency: inv.currency || 'IDR',
                exchange_rate: exRate,
                description: `Invoice ${inv.invoice_number} - ${inv.customer_name}${idrNote}`,
                batch_id: batchId,
                source: 'migration',
                coa_id: revCoa.id,
                party_name: inv.customer_name
            });
        }

        console.log(`Generating ${entriesToInsert.length} journal entries...`);

        // Insert in chunks of 500
        const CHUNK_SIZE = 500;
        for (let i = 0; i < entriesToInsert.length; i += CHUNK_SIZE) {
            const chunk = entriesToInsert.slice(i, i + CHUNK_SIZE);
            await supabaseFetch('blink_journal_entries', 'POST', chunk);
            console.log(`Inserted chunk ${i / CHUNK_SIZE + 1}...`);
        }

        console.log("Migration completed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrateInvoices();
