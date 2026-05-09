require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: coa } = await supabase.from('finance_coa').select('id, code, name').eq('code', '5-00-000-0-1-00').single();
  if (!coa) return console.error('COA 5-00-000-0-1-00 not found!');
  console.log('Target COA:', coa.code, coa.name, coa.id);

  // Fix: COGS credit side — any cogs entry with credit > 0 posted to wrong discount accounts (5-02-xxx)
  const { data: wrongCredits } = await supabase
    .from('blink_journal_entries')
    .select('id, account_code, account_name, credit, description')
    .eq('entry_type', 'cogs')
    .gt('credit', 0)
    .not('account_code', 'eq', '5-00-000-0-1-00')
    .like('account_code', '5%');

  console.log(`Found ${wrongCredits?.length || 0} wrong COGS credit entries in Blink`);
  if (wrongCredits?.length) {
    for (const r of wrongCredits) {
      console.log('  Fix:', r.account_code, '->', coa.code, '|', r.description?.slice(0, 50));
      await supabase.from('blink_journal_entries').update({
        account_code: coa.code,
        account_name: coa.name,
        coa_id: coa.id
      }).eq('id', r.id);
    }
  }

  // Also fix Bridge COGS credit entries
  const { data: bWrong } = await supabase
    .from('bridge_journal_entries')
    .select('id, account_code, account_name, credit, description')
    .eq('entry_type', 'cogs')
    .gt('credit', 0)
    .not('account_code', 'eq', '5-00-000-0-1-00')
    .like('account_code', '5%');

  console.log(`Found ${bWrong?.length || 0} wrong COGS credit entries in Bridge`);
  if (bWrong?.length) {
    for (const r of bWrong) {
      console.log('  Fix Bridge:', r.account_code, '->', coa.code);
      await supabase.from('bridge_journal_entries').update({
        account_code: coa.code,
        account_name: coa.name,
        coa_id: coa.id
      }).eq('id', r.id);
    }
  }

  console.log('Done!');
}

run().catch(console.error);
