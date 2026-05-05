import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMenus() {
  // Check blink_trial_balance and blink_ledger in role_permissions
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .or('menu_code.like.%blink_ledger%,menu_code.like.%blink_trial_balance%');
    
  console.log('Ledger/TB permissions:', data?.length);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', error?.message);
}
checkMenus();