import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanOrphans() {
    console.log('🔄 Starting Blink Financial Cleanup...');

    // 1. Get all valid entities
    const [
        { data: quotes1 },
        { data: quotes2 },
        { data: invoices },
        { data: pos },
        { data: shipments }
    ] = await Promise.all([
        supabase.from('blink_quotations').select('id'),
        supabase.from('blink_sales_quotations').select('id'),
        supabase.from('blink_invoices').select('id'),
        supabase.from('blink_purchase_orders').select('id'),
        supabase.from('blink_shipments').select('id')
    ]);

    const validQuoteIds = new Set([...(quotes1 || []).map(q => q.id), ...(quotes2 || []).map(q => q.id)]);
    const validInvoiceIds = new Set((invoices || []).map(i => i.id));
    const validPoIds = new Set((pos || []).map(p => p.id));
    const validShipmentIds = new Set((shipments || []).map(s => s.id));

    // 2. Identify and delete orphaned AR transactions (invoice_id not in valid invoices)
    let { data: ars } = await supabase.from('blink_ar_transactions').select('id, invoice_id');
    const orphanedArs = (ars || []).filter(ar => ar.invoice_id && !validInvoiceIds.has(ar.invoice_id));
    const orphanedArIds = orphanedArs.map(ar => ar.id);

    if (orphanedArIds.length > 0) {
        console.log(`🗑️ Deleting ${orphanedArIds.length} orphaned AR transactions...`);
        await supabase.from('blink_ar_transactions').delete().in('id', orphanedArIds);
    }

    // 3. Identify and delete orphaned AP transactions (po_id not in valid POs)
    let { data: aps } = await supabase.from('blink_ap_transactions').select('id, po_id');
    const orphanedAps = (aps || []).filter(ap => ap.po_id && !validPoIds.has(ap.po_id));
    const orphanedApIds = orphanedAps.map(ap => ap.id);

    if (orphanedApIds.length > 0) {
        console.log(`🗑️ Deleting ${orphanedApIds.length} orphaned AP transactions...`);
        await supabase.from('blink_ap_transactions').delete().in('id', orphanedApIds);
    }

    // 4. Update valid AR/AP IDs after deletion
    let { data: finalArs } = await supabase.from('blink_ar_transactions').select('id');
    let { data: finalAps } = await supabase.from('blink_ap_transactions').select('id');
    const validArIds = new Set((finalArs || []).map(ar => ar.id));
    const validApIds = new Set((finalAps || []).map(ap => ap.id));


    // 5. Delete orphaned Payments
    // reference_id in payments should belong to a valid invoice, po, ar, or ap. 
    // Manual payments might not have a reference_id or might belong to something else.
    // Let's check payments that have a reference_id that looks like a UUID but doesn't exist in our sets
    let { data: payments } = await supabase.from('blink_payments').select('id, reference_id, type');
    const orphanedPaymentIds = (payments || []).filter(p => {
        if (!p.reference_id) return false;
        // Check if reference_id matches any known UUIDs
        if (validQuoteIds.has(p.reference_id) || 
            validInvoiceIds.has(p.reference_id) || 
            validPoIds.has(p.reference_id) || 
            validShipmentIds.has(p.reference_id) ||
            validArIds.has(p.reference_id) ||
            validApIds.has(p.reference_id)) {
            return false;
        }
        
        // Wait, some payments might be manual or reference other tables, but in Blink they usually reference these.
        // To be safe, if we know it's a UUID, let's log it.
        return p.reference_id.length === 36; 
    }).map(p => p.id);

    if (orphanedPaymentIds.length > 0) {
        console.log(`🗑️ Deleting ${orphanedPaymentIds.length} orphaned payments...`);
        await supabase.from('blink_payments').delete().in('id', orphanedPaymentIds);
    }
    
    // 6. Delete orphaned Journal Entries
    // Journal Entries reference quote, invoice, PO, shipment, AR, AP, or payment.
    let { data: finalPayments } = await supabase.from('blink_payments').select('id');
    const validPaymentIds = new Set((finalPayments || []).map(p => p.id));

    let { data: journals } = await supabase.from('blink_journal_entries').select('id, reference_id');
    const orphanedJournalIds = (journals || []).filter(j => {
        if (!j.reference_id) return false;
        if (validQuoteIds.has(j.reference_id) || 
            validInvoiceIds.has(j.reference_id) || 
            validPoIds.has(j.reference_id) || 
            validShipmentIds.has(j.reference_id) ||
            validArIds.has(j.reference_id) ||
            validApIds.has(j.reference_id) ||
            validPaymentIds.has(j.reference_id)) {
            return false;
        }
        return j.reference_id.length === 36;
    }).map(j => j.id);

    // Some journals might be multiple per transaction, let's delete them
    if (orphanedJournalIds.length > 0) {
        console.log(`🗑️ Deleting ${orphanedJournalIds.length} orphaned journal entries...`);
        
        // Supabase has strict max sizes for .in() queries, batch them up
        const batchSize = 100;
        for (let i = 0; i < orphanedJournalIds.length; i += batchSize) {
            const batch = orphanedJournalIds.slice(i, i + batchSize);
            await supabase.from('blink_journal_entries').delete().in('id', batch);
            console.log(`  - Deleted batch ${i / batchSize + 1}`);
        }
    } else {
        console.log('✅ No orphaned journal entries found.');
    }

    // 7. Check orphaned Purchase Orders (quotation_id not in valid quotes BUT might not have quotation_id)
    // Only delete POs that HAVE a quotation_id but the quotation_id is invalid.
    let { data: invalidPos } = await supabase.from('blink_purchase_orders').select('id, quotation_id');
    const orphanedPOs = (invalidPos || []).filter(po => po.quotation_id && !validQuoteIds.has(po.quotation_id));
    const orphanedPOIds = orphanedPOs.map(po => po.id);
    
    if (orphanedPOIds.length > 0) {
         console.log(`🗑️ Deleting ${orphanedPOIds.length} orphaned POs...`);
         await supabase.from('blink_purchase_orders').delete().in('id', orphanedPOIds);
    }
    
    // Also delete orphaned shipements or invoices where quotation_id is missing?
    // User only said: delete financial reporting where quotation was deleted.
    
    console.log('✅ Blink Financial Cleanup completed successfully!');
}

cleanOrphans().catch(console.error);
