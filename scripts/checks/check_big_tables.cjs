const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkBigTables() {
  const tables = ['big_invoices', 'big_ar_transactions'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (!error) {
        console.log(`✅ ${table} exists`);
      } else {
        console.log(`❌ ${table} error: ${error.message}`);
      }
    } catch (e) {
      console.log(`❌ ${table} does not exist`);
    }
  }
}

checkBigTables().catch(console.error);