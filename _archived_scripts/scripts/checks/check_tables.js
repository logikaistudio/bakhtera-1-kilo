import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
  const tables = ['blink_ar_transactions', 'blink_ap_transactions', 'big_ar_transactions', 'big_ap_transactions'];
  console.log('🔍 Checking AR/AP tables...\n');

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists (${count || 0} rows)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  // Check sample data
  console.log('\n📊 Sample data check:');
  try {
    const { data: blinkAR } = await supabase.from('blink_ar_transactions').select('*').limit(1);
    if (blinkAR && blinkAR.length > 0) {
      console.log('Blink AR sample:', JSON.stringify(blinkAR[0], null, 2));
    } else {
      console.log('Blink AR: no data');
    }
  } catch (e) {
    console.log('Blink AR sample error:', e.message);
  }

  try {
    const { data: bigAR } = await supabase.from('big_ar_transactions').select('*').limit(1);
    if (bigAR && bigAR.length > 0) {
      console.log('Big AR sample:', JSON.stringify(bigAR[0], null, 2));
    } else {
      console.log('Big AR: no data');
    }
  } catch (e) {
    console.log('Big AR sample error:', e.message);
  }
}

checkTables().catch(console.error);