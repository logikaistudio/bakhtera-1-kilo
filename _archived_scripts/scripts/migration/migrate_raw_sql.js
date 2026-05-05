import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function migrateWithRawSQL() {
  console.log('🔄 Attempting migration with raw SQL to bypass schema cache...\n');

  try {
    // Try to execute raw SQL using rpc function
    console.log('📊 Fetching AR data with raw SQL...');
    const { data: arData, error: arError } = await supabase.rpc('exec_sql', {
      sql: 'SELECT * FROM big_ar_transactions'
    });

    if (arError) {
      console.log('❌ RPC failed, trying direct query...');

      // Try direct query with explicit table reference
      const { data: directARData, error: directARError } = await supabase
        .from('big_ar_transactions')
        .select('*');

      if (directARError) {
        console.error('❌ Direct query also failed:', directARError.message);
        return;
      }

      console.log(`📊 Found ${directARData.length} AR records`);

      // Try inserting with raw SQL
      for (const ar of directARData) {
        const insertSQL = `
          INSERT INTO blink_ar_transactions (
            invoice_id, invoice_number, ar_number, customer_id, customer_name,
            transaction_date, due_date, original_amount, paid_amount, outstanding_amount,
            currency, exchange_rate, status, notes
          ) VALUES (
            '${ar.invoice_id || ''}', '${ar.invoice_number || ''}', '${ar.ar_number || 'AR-' + ar.id.slice(0, 6).toUpperCase()}',
            '${ar.client_id || ''}', '${ar.customer_name || 'Unknown'}', '${ar.transaction_date}',
            '${ar.due_date}', ${ar.original_amount}, ${ar.paid_amount || 0}, ${ar.outstanding_amount || ar.original_amount},
            '${ar.currency || 'IDR'}', ${ar.exchange_rate || 1}, '${ar.status || 'outstanding'}',
            'Migrated from big_ar_transactions'
          )
        `;

        try {
          const { error: insertError } = await supabase.rpc('exec_sql', {
            sql: insertSQL
          });

          if (insertError) {
            console.error('❌ Insert failed:', insertError.message);
          } else {
            console.log('✅ Inserted AR record');
          }
        } catch (e) {
          console.error('❌ Exception:', e.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  await migrateWithRawSQL();
}

main().catch(console.error);