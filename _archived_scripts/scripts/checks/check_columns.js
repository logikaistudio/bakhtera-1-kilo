
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
    console.log('Checking blink_ap_transactions columns...');
    const { data: ap, error: apError } = await supabase
        .from('blink_ap_transactions')
        .select('*')
        .limit(1);

    if (ap && ap.length > 0) {
        console.log('AP Columns:', Object.keys(ap[0]));
    } else {
        console.log('No AP data found or error:', apError);
    }

    console.log('\nChecking blink_invoices columns...');
    const { data: inv, error: invError } = await supabase
        .from('blink_invoices')
        .select('*')
        .limit(1);

    if (inv && inv.length > 0) {
        console.log('Invoice Columns:', Object.keys(inv[0]));
    } else {
        console.log('No Invoice data found or error:', invError);
    }
}

checkColumns();
