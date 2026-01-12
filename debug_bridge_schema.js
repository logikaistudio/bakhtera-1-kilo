
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

async function checkBridgeSchema() {
    console.log('Checking Bridge module tables...');

    const tables = ['freight_quotations', 'freight_customs', 'freight_warehouse', 'freight_assets'];

    for (const table of tables) {
        console.log(`\n-----------------------------------`);
        console.log(`Checking table: ${table}`);
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`${table} Columns:`, Object.keys(data[0]).sort());
        } else {
            console.log(`${table}: Table exists but no data found to infer columns.`);
            // Attempt to insert dummy to see error if needed, but let's just log this for now.
        }
    }
}

checkBridgeSchema();
