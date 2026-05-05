import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testDateRange() {
  const today = new Date();
  const dateRange = {
    start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  };
  
  console.log('Date Range:', dateRange);
  
  // Try with this exact date range
  const { data, error } = await supabase
    .from('blink_journal_entries')
    .select('id, coa_id, account_code, debit, credit, entry_date')
    .gte('entry_date', dateRange.start)
    .lte('entry_date', dateRange.end);
    
  console.log('\nEntries in range:', data?.length);
  console.log('Error:', error?.message);
  if (data && data.length > 0) {
    console.log('Sample:', data.slice(0, 3));
  }
  
  // Try without date filter to see all
  const { data: all } = await supabase
    .from('blink_journal_entries')
    .select('id, entry_date');
    
  console.log('\nAll entries:', all?.length);
}
testDateRange();