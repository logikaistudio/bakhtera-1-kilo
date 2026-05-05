import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

let supabaseUrl, supabaseKey;

try {
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
    supabaseUrl = envVars.VITE_SUPABASE_URL;
    supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {
    console.warn("⚠️ Could not read .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDateRanges() {
    console.log('🔍 Checking Journal Entry Dates...\n');

    const { data: entries, error } = await supabase
        .from('blink_journal_entries')
        .select('entry_date')
        .order('entry_date', { ascending: true });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (entries.length === 0) {
        console.log('⚠️ No journal entries found in the database.');
    } else {
        const first = entries[0].entry_date;
        const last = entries[entries.length - 1].entry_date;
        console.log(`✅ Found ${entries.length} entries.`);
        console.log(`📅 Earliest Date: ${first}`);
        console.log(`📅 Latest Date:   ${last}`);

        console.log('\nSample Dates:');
        console.table(entries.slice(0, 5));
    }
}

checkDateRanges();
