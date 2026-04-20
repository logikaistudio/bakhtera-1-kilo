import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function fetchWithAuth(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

async function migrateARData() {
  console.log('🚀 Migrating AR data using REST API...\n');

  try {
    // Fetch data from big_ar_transactions
    console.log('📊 Fetching AR data...');
    const response = await fetchWithAuth('big_ar_transactions?select=*');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const arData = await response.json();
    console.log(`📊 Found ${arData.length} AR records`);

    if (arData.length === 0) return;

    // Transform and insert each record
    for (const ar of arData) {
      const blinkData = {
        invoice_id: ar.invoice_id,
        invoice_number: ar.invoice_number || null,
        ar_number: ar.ar_number || `AR-${ar.id.slice(0, 6).toUpperCase()}`,
        customer_id: ar.client_id,
        customer_name: ar.customer_name || 'Unknown',
        transaction_date: ar.transaction_date,
        due_date: ar.due_date,
        original_amount: ar.original_amount,
        paid_amount: ar.paid_amount || 0,
        outstanding_amount: ar.outstanding_amount || (ar.original_amount - (ar.paid_amount || 0)),
        currency: ar.currency || 'IDR',
        exchange_rate: ar.exchange_rate || 1,
        status: ar.status || 'outstanding',
        notes: 'Migrated from big_ar_transactions'
      };

      console.log('Inserting:', JSON.stringify(blinkData, null, 2));

      const insertResponse = await fetchWithAuth('blink_ar_transactions', {
        method: 'POST',
        body: JSON.stringify(blinkData)
      });

      if (insertResponse.ok) {
        console.log('✅ Successfully inserted AR record');
      } else {
        const errorText = await insertResponse.text();
        console.error('❌ Insert failed:', errorText);
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function migrateAPData() {
  console.log('🚀 Migrating AP data using REST API...\n');

  try {
    // Fetch data from big_ap_transactions
    console.log('📊 Fetching AP data...');
    const response = await fetchWithAuth('big_ap_transactions?select=*');
    if (!response.ok) {
      console.log('ℹ️ No AP data to migrate or table not accessible');
      return;
    }
    const apData = await response.json();
    console.log(`📊 Found ${apData.length} AP records`);

    // Transform and insert each record
    for (const ap of apData) {
      const blinkData = {
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
        notes: 'Migrated from big_ap_transactions'
      };

      console.log('Inserting:', JSON.stringify(blinkData, null, 2));

      const insertResponse = await fetchWithAuth('blink_ap_transactions', {
        method: 'POST',
        body: JSON.stringify(blinkData)
      });

      if (insertResponse.ok) {
        console.log('✅ Successfully inserted AP record');
      } else {
        const errorText = await insertResponse.text();
        console.error('❌ Insert failed:', errorText);
      }
    }

  } catch (error) {
    console.error('❌ AP Migration failed:', error.message);
  }
}

async function main() {
  console.log('🔄 Starting REST API Migration...\n');

  await migrateARData();
  console.log('\n' + '='.repeat(50) + '\n');
  await migrateAPData();

  console.log('\n🎉 Migration completed!');
  console.log('📋 Next steps:');
  console.log('   1. Check Blink AR/AP pages to verify data appears');
  console.log('   2. Test new approvals create transactions in Blink tables');
  console.log('   3. Run financial reports to ensure transactions are included');
}

main().catch(console.error);