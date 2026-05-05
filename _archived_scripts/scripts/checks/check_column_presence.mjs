/**
 * Check whether blink_quotations has partner_id and some expected columns.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';
try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
    if (envVars.VITE_SUPABASE_URL) supabaseUrl = envVars.VITE_SUPABASE_URL;
    if (envVars.SUPABASE_SERVICE_ROLE_KEY) supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
    if (envVars.VITE_SUPABASE_ANON_KEY) supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {}
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn(name) {
    console.log(`Checking column ${name}...`);
    const { data, error } = await supabase
        .from('blink_quotations')
        .select(name)
        .limit(1);
    if (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
    } else {
        console.log(`  ✅ ${name}: available`);
    }
}

async function run() {
    await checkColumn('partner_id');
    await checkColumn('customer_id');
    await checkColumn('quotation_number');
}

run();
