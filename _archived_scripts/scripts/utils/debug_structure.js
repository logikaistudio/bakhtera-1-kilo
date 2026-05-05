
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

async function checkStructure() {
    console.log('--- Checking Columns in freight_quotations ---');
    // Using RPC or just trying to select the specific column to see if it errors
    const { data, error } = await supabase
        .from('freight_quotations')
        .select('approved_date, approved_by')
        .limit(1);

    if (error) {
        console.error('Error selecting approved_date:', error.message);
    } else {
        console.log('Successfully selected approved_date. Columns exist.');
    }
}

checkStructure();
