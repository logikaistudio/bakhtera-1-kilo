import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log('--- CHECKING USER ---');
  // Assume user is 'reza' or 'Reza'
  const { data: users, error: uErr } = await supabase.from('users').select('*').ilike('username', '%reza%');
  if (uErr) console.error(uErr);
  else {
    console.log('Users found:', users.map(u => ({ id: u.id, username: u.username, user_level: u.user_level })));
    
    if (users.length > 0) {
      const user = users[0];
      console.log(`\n--- CHECKING PERMISSIONS FOR ROLE: ${user.user_level} ---`);
      const { data: perms, error: pErr } = await supabase.from('role_permissions').select('*').eq('role_id', user.user_level);
      if (pErr) console.error(pErr);
      else {
        const accessible = perms.filter(p => p.can_access).map(p => p.menu_code);
        console.log(`Menus with can_access=true for ${user.user_level}:`, accessible);
      }
    }
  }
}

check();
