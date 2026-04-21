const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const d = fs.readFileSync('.env', 'utf-8');
const url = d.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = d.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);

async function test() {
  const { data } = await supabase.from('blink_shipments').select('buying_items').limit(1);
  console.log(data);
}
test();
