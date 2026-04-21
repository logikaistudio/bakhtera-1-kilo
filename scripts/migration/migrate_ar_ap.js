import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function migrateARTransactions() {
  console.log('🚀 Starting AR transaction migration from big_ar_transactions to blink_ar_transactions...\n');

  try {
    // First, try to refresh schema cache by doing a simple query
    console.log('🔄 Refreshing schema cache...');
    await supabase.from('blink_journal_entries').select('id').limit(1);

    // Get all data from big_ar_transactions
    const { data: bigARData, error: fetchError } = await supabase
      .from('big_ar_transactions')
      .select('*');

    if (fetchError) {
      console.error('❌ Error fetching big_ar_transactions:', fetchError.message);
      return;
    }

    if (!bigARData || bigARData.length === 0) {
      console.log('ℹ️ No data to migrate from big_ar_transactions');
      return;
    }

    console.log(`📊 Found ${bigARData.length} records in big_ar_transactions`);

    // Transform data to blink_ar_transactions format
    const blinkARData = bigARData.map(ar => ({
      invoice_id: ar.invoice_id,
      invoice_number: ar.invoice_number || (ar.invoice_id ? `INV-${ar.invoice_id.slice(0, 6).toUpperCase()}` : null),
      ar_number: ar.ar_number || `AR-${ar.invoice_id ? ar.invoice_id.slice(0, 6).toUpperCase() : ar.id.slice(0, 6).toUpperCase()}`,
      customer_id: ar.client_id, // big_ar uses client_id, blink uses customer_id
      customer_name: ar.customer_name || 'Unknown',
      transaction_date: ar.transaction_date,
      due_date: ar.due_date,
      original_amount: ar.original_amount,
      paid_amount: ar.paid_amount || 0,
      outstanding_amount: ar.outstanding_amount || (ar.original_amount - (ar.paid_amount || 0)),
      currency: ar.currency || 'IDR',
      exchange_rate: ar.exchange_rate || 1,
      status: ar.status || 'outstanding',
      notes: ar.notes || 'Migrated from big_ar_transactions'
    }));

    console.log('Sample transformed data:', JSON.stringify(blinkARData[0], null, 2));

    // Insert into blink_ar_transactions one by one to avoid batch issues
    let successCount = 0;
    for (const arData of blinkARData) {
      try {
        const { data, error } = await supabase
          .from('blink_ar_transactions')
          .insert([arData])
          .select();

        if (error) {
          console.error(`❌ Error inserting AR record ${arData.invoice_id}:`, error.message);
        } else {
          successCount++;
          console.log(`✅ Inserted AR record: ${arData.ar_number}`);
        }
      } catch (e) {
        console.error(`❌ Exception inserting AR record:`, e.message);
      }
    }

    console.log(`✅ Successfully migrated ${successCount}/${bigARData.length} AR transactions`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function migrateAPTransactions() {
  console.log('🚀 Starting AP transaction migration from big_ap_transactions to blink_ap_transactions...\n');

  try {
    // First, try to refresh schema cache by doing a simple query
    console.log('🔄 Refreshing schema cache...');
    await supabase.from('blink_journal_entries').select('id').limit(1);

    // Get all data from big_ap_transactions
    const { data: bigAPData, error: fetchError } = await supabase
      .from('big_ap_transactions')
      .select('*');

    if (fetchError) {
      console.error('❌ Error fetching big_ap_transactions:', fetchError.message);
      return;
    }

    if (!bigAPData || bigAPData.length === 0) {
      console.log('ℹ️ No data to migrate from big_ap_transactions');
      return;
    }

    console.log(`📊 Found ${bigAPData.length} records in big_ap_transactions`);

    // Transform data to blink_ap_transactions format
    const blinkAPData = bigAPData.map(ap => ({
      po_id: ap.po_id,
      po_number: ap.po_number,
      ap_number: ap.ap_number || `AP-${ap.po_number || ap.id.slice(0, 6).toUpperCase()}`,
      vendor_id: ap.vendor_id,
      vendor_name: ap.vendor_name || 'Unknown Vendor',
      bill_date: ap.bill_date || ap.transaction_date,
      due_date: ap.due_date,
      original_amount: ap.original_amount,
      paid_amount: ap.paid_amount || 0,
      outstanding_amount: ap.outstanding_amount || (ap.original_amount - (ap.paid_amount || 0)),
      currency: ap.currency || 'IDR',
      exchange_rate: ap.exchange_rate || 1,
      status: ap.status || 'outstanding',
      notes: ap.notes || 'Migrated from big_ap_transactions'
    }));

    console.log('Sample transformed data:', JSON.stringify(blinkAPData[0], null, 2));

    // Insert into blink_ap_transactions one by one to avoid batch issues
    let successCount = 0;
    for (const apData of blinkAPData) {
      try {
        const { data, error } = await supabase
          .from('blink_ap_transactions')
          .insert([apData])
          .select();

        if (error) {
          console.error(`❌ Error inserting AP record ${apData.po_id}:`, error.message);
        } else {
          successCount++;
          console.log(`✅ Inserted AP record: ${apData.ap_number}`);
        }
      } catch (e) {
        console.error(`❌ Exception inserting AP record:`, e.message);
      }
    }

    console.log(`✅ Successfully migrated ${successCount}/${bigAPData.length} AP transactions`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  console.log('🔄 Starting Blink AR/AP Migration...\n');

  await migrateARTransactions();
  console.log('\n' + '='.repeat(50) + '\n');
  await migrateAPTransactions();

  console.log('\n🎉 All migrations completed!');
  console.log('📋 Next steps:');
  console.log('   1. Check Blink AR/AP pages to verify data appears');
  console.log('   2. Test new approvals create transactions in Blink tables');
  console.log('   3. Run financial reports to ensure transactions are included');
}

main().catch(console.error);