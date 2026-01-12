
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

async function checkInventory() {
    console.log('--- Checking Inventory Columns ---');
    const { data, error } = await supabase.from('freight_inventory').select('*').limit(1);
    if (error) console.error(error);
    else if (data.length > 0) console.log(Object.keys(data[0]));
    else console.log('No inventory data found.');
}

checkInventory();
