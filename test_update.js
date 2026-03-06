import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    console.log('Running 078_add_exchange_rate_to_quotations.sql');
    const { data: q1, error: e1 } = await supabase.rpc('execute_sql', { query: `
        ALTER TABLE public.blink_quotations ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
        ALTER TABLE public.blink_sales_quotations ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
    `});
    console.log(q1 || e1 || 'RPC complete');
    
    // Test the change
    const { data, error } = await supabase.from('blink_quotations').select('exchange_rate').limit(1);
    console.log('Test select:', data || error);
}
run();
