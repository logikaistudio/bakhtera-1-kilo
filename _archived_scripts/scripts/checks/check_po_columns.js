
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
    console.log('Checking blink_purchase_orders columns...');
    const { data, error } = await supabase
        .from('blink_purchase_orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching PO:', error.message);
    } else if (data && data.length > 0) {
        console.log('PO Columns:', Object.keys(data[0]));
    } else {
        // If empty, try to get definition another way or insert dummy to see error?
        // Actually, if empty, we can't see keys from data[0].
        // But usually there is data. If not, I'll rely on error if I try to select a specific column.
        console.log('Table is empty, cannot deduce columns from row. Trying to inspect schema via error hack.');
        const { error: err2 } = await supabase.from('blink_purchase_orders').select('created_by').limit(1);
        if (err2) console.log('created_by column check:', err2.message);
        else console.log('created_by column exists.');
    }
}

checkColumns();
