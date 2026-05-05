const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function backfillAR() {
  console.log('🔄 Backfilling AR transactions from blink_invoices...\n');

  try {
    // Get unpaid invoices
    const { data: invoices, error } = await supabase
      .from('blink_invoices')
      .select('*')
      .eq('status', 'unpaid');

    if (error) throw error;

    console.log(`Found ${invoices?.length || 0} unpaid invoices`);

    for (const invoice of invoices || []) {
      // Check if AR already exists
      const { data: existing } = await supabase
        .from('big_ar_transactions')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        console.log('AR transactions already exist, skipping...');
        return;
      }

      // Create AR without invoice_id to avoid FK constraint
      const arData = {
        client_id: invoice.customer_id,
        transaction_date: invoice.invoice_date,
        due_date: invoice.due_date,
        original_amount: invoice.total_amount || 0,
        paid_amount: invoice.paid_amount || 0,
        outstanding_amount: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
        status: 'outstanding'
      };

      const { error: insertError } = await supabase
        .from('big_ar_transactions')
        .insert([arData]);

      if (insertError) {
        console.error(`Failed to create AR:`, insertError.message);
      } else {
        console.log(`✅ Created AR for invoice ${invoice.invoice_number}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

backfillAR().catch(console.error);
