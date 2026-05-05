
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

async function checkItemTables() {
    console.log('Checking blink_purchase_order_items...');
    const { data: poItems, error: poError } = await supabase
        .from('blink_purchase_order_items')
        .select('*')
        .limit(1);

    if (poItems) {
        console.log('PO Items Table Exists. Columns:', poItems.length > 0 ? Object.keys(poItems[0]) : 'Empty table');
    } else {
        console.log('PO Items table check failed:', poError?.message);
    }

    console.log('\nChecking blink_invoice_items...');
    const { data: invItems, error: invError } = await supabase
        .from('blink_invoice_items')
        .select('*')
        .limit(1);

    if (invItems) {
        console.log('Invoice Items Table Exists. Columns:', invItems.length > 0 ? Object.keys(invItems[0]) : 'Empty table');
    } else {
        console.log('Invoice Items table check failed (might utilize JSON in invoices table):', invError?.message);
    }
}

checkItemTables();
