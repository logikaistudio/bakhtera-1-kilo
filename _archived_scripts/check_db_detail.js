import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const today = '2026-05-05';
  
  // Check with both COA and non-COA entries
  const { data: r1, error: e1 } = await supabase.from('blink_journal_entries')
      .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
      .not('coa_id', 'is', null)
      .lte('entry_date', today);
  
  console.log('=== Entries with coa_id ===');
  console.log('Count:', r1?.length);
  if (r1 && r1.length > 0) {
    console.log('Sample:', JSON.stringify(r1.slice(0, 3), null, 2));
  }
  
  // Check without coa_id
  const { data: r2, error: e2 } = await supabase.from('blink_journal_entries')
      .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
      .is('coa_id', null)
      .lte('entry_date', today);
      
  console.log('\n=== Entries without coa_id ===');
  console.log('Count:', r2?.length);
  if (r2 && r2.length > 0) {
    console.log('Sample:', JSON.stringify(r2.slice(0, 3), null, 2));
  }
  
  // Total count
  const { count, error } = await supabase
    .from('blink_journal_entries')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n=== Total entries ===');
  console.log('Count:', count);
}
check();