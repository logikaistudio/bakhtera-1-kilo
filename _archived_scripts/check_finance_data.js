import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: accounts, error: errCoa } = await supabase.from('finance_coa').select('*');
  console.log(`finance_coa count: ${accounts?.length}`);
  
  const today = '2026-05-05';
  const { data: r1, error: e1 } = await supabase.from('blink_journal_entries')
      .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
      .not('coa_id', 'is', null)
      .lte('entry_date', today);
  const { data: r2, error: e2 } = await supabase.from('blink_journal_entries')
      .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
      .is('coa_id', null)
      .lte('entry_date', today);
      
  console.log(`r1 count: ${r1?.length}, error: ${e1?.message}`);
  console.log(`r2 count: ${r2?.length}, error: ${e2?.message}`);
}
check();
