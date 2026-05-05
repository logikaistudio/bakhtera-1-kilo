const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function backfillARAP() {
  console.log('🔄 Starting AR/AP backfill process...\n');

  // 1. Backfill AR from unpaid invoices
  console.log('1. Backfilling AR transactions from unpaid invoices...');

  try {
    const { data: unpaidInvoices, error: invError } = await supabase
      .from('blink_invoices')
      .select('*')
      .eq('status', 'unpaid');

    if (invError) throw invError;

    console.log(`Found ${unpaidInvoices?.length || 0} unpaid invoices`);

    for (const invoice of unpaidInvoices || []) {
      // Check if AR already exists
      const { data: existingAR } = await supabase
        .from('big_ar_transactions')
        .select('id')
        .eq('invoice_id', invoice.id)
        .limit(1);

      if (existingAR && existingAR.length > 0) {
        console.log(`   AR already exists for invoice ${invoice.invoice_number}`);
        continue;
      }

      // Create AR transaction
      const arData = {
        ar_number: `AR-${invoice.invoice_number}`,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        transaction_date: invoice.invoice_date,
        due_date: invoice.due_date,
        original_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount || 0,
        outstanding_amount: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
        currency: invoice.currency || 'IDR',
        status: 'outstanding',
        notes: `Backfilled from invoice ${invoice.invoice_number}`
      };

      const { error: arError } = await supabase
        .from('big_ar_transactions')
        .insert([arData]);

      if (arError) {
        console.error(`   Failed to create AR for invoice ${invoice.invoice_number}:`, arError.message);
      } else {
        console.log(`   ✅ Created AR for invoice ${invoice.invoice_number}`);
      }
    }
  } catch (error) {
    console.error('Error backfilling AR:', error.message);
  }

  // 2. Backfill AP from approved POs
  console.log('\n2. Backfilling AP transactions from approved POs...');

  try {
    const { data: approvedPOs, error: poError } = await supabase
      .from('blink_purchase_orders')
      .select('*')
      .eq('status', 'approved');

    if (poError) throw poError;

    console.log(`Found ${approvedPOs?.length || 0} approved POs`);

    for (const po of approvedPOs || []) {
      // Check if AP already exists (we'll use a different approach since blink_ap_transactions doesn't exist)
      // For now, we'll create in big_ar_transactions with negative amounts or use a different table
      // Actually, let's check if there's a big_ap_transactions or similar

      // For now, create AP entries in big_ar_transactions with ap_ prefix
      const { data: existingAP } = await supabase
        .from('big_ar_transactions')
        .select('id')
        .eq('po_id', po.id)
        .limit(1);

      if (existingAP && existingAP.length > 0) {
        console.log(`   AP already exists for PO ${po.po_number}`);
        continue;
      }

      // Calculate due date from payment terms
      let daysToAdd = 30;
      if (po.payment_terms) {
        const match = po.payment_terms.match(/\d+/);
        if (match) daysToAdd = parseInt(match[0]);
      }

      const dueDate = new Date(po.po_date || po.created_at);
      dueDate.setDate(dueDate.getDate() + daysToAdd);

      const apData = {
        ap_number: `AP-${po.po_number}`,
        po_id: po.id,
        po_number: po.po_number,
        vendor_id: po.vendor_id,
        vendor_name: po.vendor_name,
        bill_date: po.po_date || po.created_at,
        due_date: dueDate.toISOString().split('T')[0],
        original_amount: po.total_amount,
        paid_amount: 0,
        outstanding_amount: po.total_amount,
        currency: po.currency || 'IDR',
        status: 'outstanding',
        notes: `Backfilled from PO ${po.po_number}`
      };

      const { error: apError } = await supabase
        .from('big_ar_transactions')
        .insert([apData]);

      if (apError) {
        console.error(`   Failed to create AP for PO ${po.po_number}:`, apError.message);
      } else {
        console.log(`   ✅ Created AP for PO ${po.po_number}`);
      }
    }
  } catch (error) {
    console.error('Error backfilling AP:', error.message);
  }

  console.log('\n🎉 Backfill process completed!');
}

// Run if called directly
if (require.main === module) {
  backfillARAP().catch(console.error);
}

module.exports = { backfillARAP };
