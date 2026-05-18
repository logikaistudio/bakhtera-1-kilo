const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('finance_coa').select('code, name, type').ilike('name', '%discont%');
  console.log("discont:", data);
  const { data: data2 } = await supabase.from('finance_coa').select('code, name, type').ilike('name', '%discount%');
  console.log("discount:", data2);
  const { data: data3 } = await supabase.from('finance_coa').select('code, name, type').ilike('name', '%air%export%');
  console.log("air export:", data3);
}
run();
