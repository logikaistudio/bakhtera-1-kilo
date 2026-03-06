import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// read .env
const envPath = path.resolve('.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { 
    sql_string: `
      ALTER TABLE public.blink_quotations ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
      ALTER TABLE public.blink_sales_quotations ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
    `
  });
  console.log('Migration Result:', data || error);

  // Test
  const { data: test, error: tErr } = await supabase.from('blink_quotations').select('exchange_rate').limit(1);
  console.log('Select test:', test, tErr);
}
run();
