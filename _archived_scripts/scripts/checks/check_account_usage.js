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

async function checkAccountUsage() {
    console.log('🔍 Checking which accounts have Journal Entries...\n');

    const { data: entries } = await supabase
        .from('blink_journal_entries')
        .select('account_code, account_name, coa_id');

    const usage = {};

    entries.forEach(e => {
        const key = `${e.account_code} - ${e.account_name}`;
        if (!usage[key]) usage[key] = 0;
        usage[key]++;
    });

    console.table(usage);
}

checkAccountUsage();
