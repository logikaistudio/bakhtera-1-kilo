import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data: menus } = await supabase.from('menu_registry').select('*').like('menu_code', 'blink%')
  console.log("Registered Menus:", menus?.length, menus?.map(m => m.menu_code).join(', '))

  const { data: rolePerms } = await supabase.from('role_permissions').select('*').eq('role_id', 'blinkadmin')
  console.log("Role Perms:", rolePerms?.length, rolePerms?.map(rp => rp.menu_code).join(', '))
}

test()
