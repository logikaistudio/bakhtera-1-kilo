import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDiff() {
  console.log('=== Checking differences ===');
  console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20) + '...');
  
  // Check database stats
  const tables = [
    'finance_coa',
    'blink_journal_entries',
    'role_permissions',
    'users'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`${table}: ${count || 0} records`);
      } else {
        console.log(`${table}: ERROR - ${error.message}`);
      }
    } catch (e) {
      console.log(`${table}: TABLE NOT FOUND`);
    }
  }
  
  // Check RLS status
  console.log('\n=== RLS Check (basic) ===');
  const { data, error } = await supabase
    .from('blink_journal_entries')
    .select('id')
    .limit(1);
    
  console.log('blink_journal_entries RLS test:', error ? 'ERROR: ' + error.message : 'OK');
}
checkDiff();