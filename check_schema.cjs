require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: qData, error: qErr } = await supabase.from('blink_quotations').select('*').limit(1);
    console.log('Quotation keys:', qData && qData.length > 0 ? Object.keys(qData[0]) : qErr || 'No data');
}
run();
