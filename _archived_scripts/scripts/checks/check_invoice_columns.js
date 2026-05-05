
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

async function checkInvoiceColumns() {
    console.log('Checking blink_invoices columns...');
    const { data: invData, error: invError } = await supabase
        .from('blink_invoices')
        .select('*')
        .limit(1);

    if (invError) {
        console.error('Error fetching Invoice:', invError.message);
    } else if (invData && invData.length > 0) {
        console.log('Invoice Columns:', Object.keys(invData[0]));
        console.log('Has coa_id:', Object.keys(invData[0]).includes('coa_id'));
        console.log('Has created_by:', Object.keys(invData[0]).includes('created_by'));
    } else {
        console.log('Table blink_invoices is empty. Checking columns by selecting them specifically.');

        // Check coa_id
        const { error: errCoa } = await supabase.from('blink_invoices').select('coa_id').limit(1);
        console.log('coa_id column check:', errCoa ? errCoa.message : 'Exists');

        // Check created_by
        const { error: errCreatedBy } = await supabase.from('blink_invoices').select('created_by').limit(1);
        console.log('created_by column check:', errCreatedBy ? errCreatedBy.message : 'Exists');

        // Check finance_coa relation
        const { error: errRel } = await supabase.from('blink_invoices').select('finance_coa(id, code)').limit(1);
        console.log('finance_coa join check:', errRel ? errRel.message : 'Relation Exists');
    }
}

checkInvoiceColumns();
