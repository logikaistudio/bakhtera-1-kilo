import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRLS() {
  // Check if data exists - try getting raw data without auth
  // First, let's see what data we CAN get with anon key
  const { data, error, count } = await supabase
    .from('blink_journal_entries')
    .select('*', { count: 'exact', head: true });
    
  console.log('With anon key - count:', count);
  console.log('Error:', error?.message);
  
  // Try without RLS (via postgrest)
  const { data: data2, error: e2 } = await supabase
    .from('blink_journal_entries')
    .select('*')
    .limit(5);
    
  console.log('\nSample data with anon:', data2?.length);
  if (data2 && data2.length > 0) {
    console.log('First entry:', JSON.stringify(data2[0], null, 2));
  }
  
  // Check finance_coa too
  const { count: coaCount, error: coaError } = await supabase
    .from('finance_coa')
    .select('*', { count: 'exact', head: true });
    
  console.log('\nfinance_coa count:', coaCount);
  console.log('Error:', coaError?.message);
}
checkRLS();