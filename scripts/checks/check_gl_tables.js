
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

async function checkGLTables() {
    console.log('Checking for GL related tables...');

    // Check for common names
    const tables = ['finance_gl_entries', 'finance_journal_entries', 'finance_ledger', 'blink_journal_entries'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table '${table}' check failed:`, error.message);
        } else {
            console.log(`Table '${table}' EXISTS.`);

            // If exists, show columns
            const { data } = await supabase.from(table).select('*').limit(1);
            if (data && data.length > 0) {
                console.log(`Columns for ${table}:`, Object.keys(data[0]));
            } else {
                console.log(`Table ${table} exists but is empty.`);
            }
        }
    }
}

checkGLTables();
