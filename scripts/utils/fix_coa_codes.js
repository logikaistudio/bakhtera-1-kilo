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

async function fixCoaCodes() {
    console.log('🛠 Fixing Journal Account Codes...\n');

    // 1. Fetch Master Data
    const { data: masterCoa } = await supabase.from('finance_coa').select('id, code, name');
    const coaMap = new Map(masterCoa.map(c => [c.id, c]));

    // 2. Fetch Journal Entries
    const { data: entries } = await supabase.from('blink_journal_entries').select('id, coa_id, account_code');

    let fixedCount = 0;

    for (const entry of entries) {
        if (!entry.coa_id) continue;

        const master = coaMap.get(entry.coa_id);
        if (master && master.code !== entry.account_code) {
            console.log(`Creating fix for JE ${entry.id}: ${entry.account_code} -> ${master.code}`);

            const { error } = await supabase
                .from('blink_journal_entries')
                .update({
                    account_code: master.code,
                    account_name: master.name
                })
                .eq('id', entry.id);

            if (error) {
                console.error(`❌ Failed to update ${entry.id}:`, error.message);
            } else {
                fixedCount++;
            }
        }
    }

    console.log(`\n✅ Successfully updated ${fixedCount} journal entries to match Master Data.`);
}

fixCoaCodes();
