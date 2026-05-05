import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAllTables() {
  const tables = [
    'blink_journal_entries',
    'journal_entries', 
    'finance_journal_entries',
    'journal',
    'finance_transactions',
    'transactions'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`${table}: ${count || 0} entries`);
      }
    } catch (e) {
      // Skip if table doesn't exist
    }
  }
  
  // Check blink_journal_entries detail
  console.log('\n=== blink_journal_entries detail ===');
  const { data } = await supabase
    .from('blink_journal_entries')
    .select('entry_date')
    .order('entry_date', { ascending: false })
    .limit(10);
  console.log('Entry dates:', data?.map(d => d.entry_date));
  
  // Check distinct dates in range
  const { data: dates } = await supabase
    .from('blink_journal_entries')
    .select('entry_date');
  const uniqueDates = [...new Set(dates?.map(d => d.entry_date))];
  console.log('Unique dates:', uniqueDates);
}
checkAllTables();