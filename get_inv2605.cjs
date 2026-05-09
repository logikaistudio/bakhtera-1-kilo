require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: inv } = await supabase.from('blink_invoices').select('id').eq('invoice_number', 'INV-BLK2605-0001').single();
  if(!inv) return console.log('not found');
  
  const { data: journals } = await supabase
    .from('blink_journal_entries')
    .select('id, entry_type, account_code, account_name, description, debit, credit')
    .eq('reference_id', inv.id)
    .order('entry_type', { ascending: true });

  console.table(journals);
}

run().catch(console.error);
