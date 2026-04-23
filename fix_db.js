import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
  console.log('--- FIXING BLINK DASHBOARD PERMISSION ---');
  const { data, error } = await supabase
    .from('role_permissions')
    .update({ can_access: true, can_view: true })
    .eq('role_id', 'blink_admin')
    .eq('menu_code', 'blink_dashboard');
    
  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log('Successfully updated blink_dashboard for blink_admin!');
  }
}

fix();
