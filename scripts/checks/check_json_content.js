
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

async function checkJsonContent() {
    console.log('Checking PO JSON content...');
    const { data: po, error: poError } = await supabase
        .from('blink_purchase_orders')
        .select('items')
        .not('items', 'is', null)
        .limit(1);

    if (po && po.length > 0) {
        console.log('PO Items JSON Sample:', JSON.stringify(po[0].items, null, 2));
    } else {
        console.log('No PO items found to inspect.');
    }

    console.log('\nChecking Invoice JSON content...');
    const { data: inv, error: invError } = await supabase
        .from('blink_invoices')
        .select('invoice_items')
        .not('invoice_items', 'is', null)
        .limit(1);

    if (inv && inv.length > 0) {
        console.log('Invoice Items JSON Sample:', JSON.stringify(inv[0].invoice_items, null, 2));
    } else {
        console.log('No Invoice items found to inspect.');
    }
}

checkJsonContent();
