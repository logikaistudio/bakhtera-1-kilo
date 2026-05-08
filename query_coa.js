const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('finance_coa').select('code, name, type').ilike('name', '%discont%');
  console.log("discont:", data);
  const { data2 } = await supabase.from('finance_coa').select('code, name, type').ilike('name', '%discount%');
  console.log("discount:", data2);
}
run();
