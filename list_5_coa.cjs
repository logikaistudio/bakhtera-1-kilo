require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: coaList } = await supabase.from('finance_coa').select('code, name, id').like('code', '5%').order('code', { ascending: true });
  console.table(coaList);
}

run().catch(console.error);
