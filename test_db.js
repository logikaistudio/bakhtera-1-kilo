import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data, error } = await supabase.from('company_settings').select('*')
  console.log('company_settings:', { data, error })

  const { data: d2, error: e2 } = await supabase.from('approval_requests').select('*')
  console.log('approval_requests:', { data: d2, error: e2 })
}
test()
