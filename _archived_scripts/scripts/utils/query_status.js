const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);

async function run() {
  const { data: q } = await supabase.from('blink_quotations').select('id, quotation_number, status').eq('quotation_number', 'BLK2604-0001');
  console.log('Quotations:', q);

  const { data: s } = await supabase.from('blink_shipments').select('id, job_number, status, bl_status').eq('job_number', 'BLK2604-0001');
  console.log('Shipments:', s);
}
run();
