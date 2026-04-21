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

async function verifyLedgerLogic() {
    console.log('🔍 Testing Ledger Logic for Account 2100 (Liability)...\n');

    // 1. Fetch Account Info
    const { data: accounts } = await supabase
        .from('finance_coa')
        .select('*')
        .like('code', '2100%') // Utang Usaha
        .limit(1);

    if (!accounts || accounts.length === 0) {
        console.error('❌ Account 2100 not found');
        return;
    }

    const account = accounts[0];
    console.log(`✅ Account: ${account.code} - ${account.name} (Type: ${account.type})`);

    // 2. Fetch Entries
    const { data: entries } = await supabase
        .from('blink_journal_entries')
        .select('*')
        .eq('coa_id', account.id)
        .order('entry_date', { ascending: true });

    console.log(`✅ Loaded ${entries.length} entries.`);

    // 3. Simulate Logic
    let runningBalance = 0;

    // Determine Normal Balance
    // ASSET, EXPENSE -> Normal Debit (+)
    // LIABILITY, EQUITY, REVENUE -> Normal Credit (+)
    const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.type);

    console.log(`ℹ️ Account is ${isNormalCredit ? 'Normal Credit' : 'Normal Debit'}`);

    console.log('\n--- Transaction Log ---');
    console.log(`| Date       | Desc             | Debit       | Credit      | Balance (Running) |`);
    console.log(`|------------|------------------|-------------|-------------|-------------------|`);

    entries.forEach(e => {
        const debit = e.debit || 0;
        const credit = e.credit || 0;

        let change = 0;
        if (isNormalCredit) {
            change = credit - debit; // Credit increases balance
        } else {
            change = debit - credit; // Debit increases balance
        }

        runningBalance += change;

        console.log(`| ${e.entry_date} | ${e.description.substring(0, 16)} | ${String(debit).padStart(11)} | ${String(credit).padStart(11)} | ${String(runningBalance).padStart(17)} |`);
    });

    console.log('\n✅ Final Balance:', runningBalance);
}

verifyLedgerLogic();
