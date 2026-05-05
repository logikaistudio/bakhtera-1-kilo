
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
fs.readFileSync(path.join(__dirname, '.env'), 'utf-8').split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- Checking BC Codes ---');
    const { data: bcCodes, error: bcError } = await supabase.from('freight_bc_codes').select('*').limit(5);
    if (bcError) console.error(bcError);
    else console.log(bcCodes);

    console.log('\n--- Checking Quotations (Item Code) ---');
    const { data: quotations, error: qError } = await supabase.from('freight_quotations').select('id, quotation_number, item_code, packages').order('created_at', { ascending: false }).limit(3);
    if (qError) console.error(qError);
    else console.log(JSON.stringify(quotations, null, 2));
}

checkData();
