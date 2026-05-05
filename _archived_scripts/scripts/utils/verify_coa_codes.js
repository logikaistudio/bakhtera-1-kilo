import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// --- Environment Variable Loading Logic ---
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

async function verifyCoaCodes() {
    console.log('🔍 Verifying Account Codes against Master Data...\n');

    // 1. Fetch Master Data (COA)
    const { data: masterCoa, error: coaError } = await supabase
        .from('finance_coa')
        .select('id, code, name');

    if (coaError) {
        console.error('❌ Error fetching Master COA:', coaError.message);
        return;
    }

    // Create lookup map
    const coaMap = new Map(masterCoa.map(c => [c.id, c]));
    console.log(`✅ Loaded ${masterCoa.length} Master Accounts.`);

    // 2. Fetch Journal Entries
    const { data: entries, error: journalError } = await supabase
        .from('blink_journal_entries')
        .select('id, entry_number, coa_id, account_code, account_name');

    if (journalError) {
        console.error('❌ Error fetching Journal Entries:', journalError.message);
        return;
    }
    console.log(`✅ Loaded ${entries.length} Journal Entries.`);

    // 3. Compare
    console.log('\n--- Checking Discrepancies ---');
    let issues = 0;

    entries.forEach(entry => {
        if (!entry.coa_id) {
            console.error(`❌ [${entry.entry_number}] Missing COA ID`);
            issues++;
            return;
        }

        const master = coaMap.get(entry.coa_id);

        if (!master) {
            console.error(`❌ [${entry.entry_number}] COA ID ${entry.coa_id} not found in Master Data`);
            issues++;
            return;
        }

        if (master.code !== entry.account_code) {
            console.warn(`⚠️ [${entry.entry_number}] Code Mismatch! Journal: "${entry.account_code}" vs Master: "${master.code}"`);
            issues++;
        }
    });

    if (issues === 0) {
        console.log('🎉 SUCCESS: All journal account codes match the Master Data perfectly.');
    } else {
        console.log(`\n⚠️ Found ${issues} issues.`);
    }
}

verifyCoaCodes();
