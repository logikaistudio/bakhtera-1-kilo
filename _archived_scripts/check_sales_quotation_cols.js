import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('blink_sales_quotations').select('*').limit(1);
  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('Record:', data[0] ? Object.keys(data[0]) : 'No records found');
  }
}
check();
