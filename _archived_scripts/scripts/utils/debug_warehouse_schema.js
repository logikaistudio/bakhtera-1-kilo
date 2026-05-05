
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

async function checkWarehouse() {
    console.log('--- Checking Warehouse Schema ---');
    const { data, error } = await supabase.from('freight_warehouse').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample Data:', data[0]);
    } else {
        console.log('No warehouse data found, but table exists.');
        // Try inserting dummy to see error/structure? No, safer to just list columns if possible. 
        // Or assume 'quantity' is standard based on codebase.
    }
}

checkWarehouse();
