
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
try {
    fs.readFileSync(path.join(__dirname, '.env'), 'utf-8').split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
} catch (e) {
    console.error('Error reading .env', e);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function dumpInventory() {
    console.log('--- Dumping Freight Warehouse Inventory ---');
    const { data, error } = await supabase
        .from('freight_warehouse')
        .select('id, item_code, asset_name, quantity, pengajuan_number');

    if (error) {
        console.error('Error:', error);
    } else {
        console.table(data);
        console.log(`Total records: ${data.length}`);
    }
}

dumpInventory();
