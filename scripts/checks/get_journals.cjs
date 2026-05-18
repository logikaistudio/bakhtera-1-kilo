const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: journals } = await supabase
    .from('blink_journal_entries')
    .select('id, entry_type, account_code, account_name, description, debit, credit')
    .order('entry_date', { ascending: false })
    .limit(30);

  console.table(journals);
}

run().catch(console.error);
