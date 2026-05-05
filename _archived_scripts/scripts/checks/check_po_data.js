
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

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPOs() {
    console.log('Checking blink_purchase_orders table...');

    // Check if we can fetch POs
    const { data: pos, error } = await supabase
        .from('blink_purchase_orders')
        .select('*');

    if (error) {
        console.error('Error fetching POs:', error);
    } else {
        console.log(`Found ${pos.length} POs.`);
        if (pos.length > 0) {
            console.log('First PO sample:', pos[0]);
        }
    }

    // Check relationship with vendors
    console.log('\nChecking relationship with vendors...');
    const { data: posWithVendors, error: relError } = await supabase
        .from('blink_purchase_orders')
        .select('*, vendors:vendor_id(name, code)')
        .limit(1);

    if (relError) {
        console.error('Error fetching POs with vendors:', relError);
    } else {
        console.log('PO with vendor data:', JSON.stringify(posWithVendors, null, 2));
    }

    // Check relationship with finance_coa
    console.log('\nChecking relationship with finance_coa...');
    const { data: posWithCoa, error: coaError } = await supabase
        .from('blink_purchase_orders')
        .select('*, finance_coa(id, code, name)')
        .limit(1);

    if (coaError) {
        console.error('Error fetching POs with COA:', coaError);
    } else {
        console.log('PO with COA data:', JSON.stringify(posWithCoa, null, 2));
    }
}

checkPOs();
