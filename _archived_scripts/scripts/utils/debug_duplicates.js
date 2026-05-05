
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

async function checkDuplicates() {
    console.log('--- Checking for Duplicates in freight_quotations ---');
    const { data: quotations, error } = await supabase
        .from('freight_quotations')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    const map = {};
    const duplicates = [];
    quotations.forEach(q => {
        const key = q.quotation_number || 'UNKNOWN';
        if (map[key]) {
            duplicates.push({ key, id1: map[key].id, id2: q.id });
        } else {
            map[key] = q;
        }
    });

    if (duplicates.length > 0) {
        console.log('Found Duplicates:', duplicates);
    } else {
        console.log('No duplicates found based on quotation_number.');
    }

    console.log('\n--- Sample Data Keys (First Item) ---');
    if (quotations.length > 0) {
        console.log(Object.keys(quotations[0]).sort());
    }
}

checkDuplicates();
