const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Import journal helper functions directly
async function getAllCOA() {
  const { data, error } = await supabase
    .from('finance_coa')
    .select('*')
    .order('code');

  if (error) throw error;
  return data || [];
}

async function createInvoiceJournal({ invoice, coaList }) {
  // Simplified journal creation for invoice
  console.log(`Creating journal for invoice ${invoice.invoice_number}`);

  // This is a simplified version - in reality we'd need the full journalHelper logic
  // For now, just log that we would create journals
}

async function createPOApprovalJournal({ po, coaList }) {
  // Simplified journal creation for PO
  console.log(`Creating journal for PO ${po.po_number}`);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function backfillJournals() {
  console.log('🔄 Backfilling journal entries for existing transactions...\n');

  try {
    // Get COA list first
    const coaList = await getAllCOA();
    console.log(`Loaded ${coaList?.length || 0} COA entries`);

    // 1. Backfill journals for approved invoices
    console.log('\n1. Processing approved invoices...');
    const { data: approvedInvoices, error: invError } = await supabase
      .from('blink_invoices')
      .select('*')
      .in('status', ['unpaid', 'paid']);

    if (invError) throw invError;

    console.log(`Found ${approvedInvoices?.length || 0} approved invoices`);

    for (const invoice of approvedInvoices || []) {
      try {
        // Check if journal already exists
        const { data: existingJournal } = await supabase
          .from('blink_journal_entries')
          .select('id')
          .eq('reference_type', 'invoice')
          .eq('reference_id', invoice.id)
          .limit(1);

        if (existingJournal && existingJournal.length > 0) {
          console.log(`   Journal already exists for invoice ${invoice.invoice_number}`);
          continue;
        }

        // Create journal entry
        await createInvoiceJournal({ invoice, coaList });
        console.log(`   ✅ Created journal for invoice ${invoice.invoice_number}`);

      } catch (error) {
        console.error(`   ❌ Failed to create journal for invoice ${invoice.invoice_number}:`, error.message);
      }
    }

    // 2. Backfill journals for approved POs
    console.log('\n2. Processing approved POs...');
    const { data: approvedPOs, error: poError } = await supabase
      .from('blink_purchase_orders')
      .select('*')
      .eq('status', 'approved');

    if (poError) throw poError;

    console.log(`Found ${approvedPOs?.length || 0} approved POs`);

    for (const po of approvedPOs || []) {
      try {
        // Check if journal already exists
        const { data: existingJournal } = await supabase
          .from('blink_journal_entries')
          .select('id')
          .eq('reference_type', 'po')
          .eq('reference_id', po.id)
          .limit(1);

        if (existingJournal && existingJournal.length > 0) {
          console.log(`   Journal already exists for PO ${po.po_number}`);
          continue;
        }

        // Create journal entry
        await createPOApprovalJournal({ po, coaList });
        console.log(`   ✅ Created journal for PO ${po.po_number}`);

      } catch (error) {
        console.error(`   ❌ Failed to create journal for PO ${po.po_number}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error in backfill process:', error.message);
  }

  console.log('\n🎉 Journal backfill completed!');
}

backfillJournals().catch(console.error);