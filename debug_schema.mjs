/**
 * Debug: Check database schema and table details
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
    if (envVars.VITE_SUPABASE_ANON_KEY) supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {
    // Use defaults
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('\n🔍 DATABASE SCHEMA DEBUG\n');
    console.log('='.repeat(70));

    // Test 1: Check finance_coa
    console.log('\n1️⃣  Testing finance_coa:\n');
    const { data: coaData, error: coaError, status: coaStatus } = await supabase
        .from('finance_coa')
        .select('id, code, name')
        .limit(5);

    if (coaError) {
        console.log(`   ❌ Error: ${coaError.message}`);
        console.log(`   Status: ${coaStatus}`);
    } else {
        console.log(`   ✅ Success! Rows returned: ${coaData?.length || 0}`);
        if (coaData?.length > 0) {
            console.log(`   Sample: ${JSON.stringify(coaData[0])}`);
        }
    }

    // Test 2: Check blink_purchase_orders existence and access
    console.log('\n2️⃣  Testing blink_purchase_orders:\n');
    const { data: poData, error: poError, status: poStatus } = await supabase
        .from('blink_purchase_orders')
        .select('*', { count: 'exact', head: true })
        .limit(1);

    if (poError) {
        console.log(`   ❌ Error: ${poError.message}`);
        console.log(`   Code: ${poError.code}`);
        console.log(`   Status: ${poStatus}\n`);
        console.log(`   Note: Table might be in different schema or not queryable right now`);
    } else {
        console.log(`   ✅ Success! Table is accessible`);
    }

    // Test 3: Check partners
    console.log('\n3️⃣  Testing partners:\n');
    const { data: partnerData, error: partnerError, status: partnerStatus } = await supabase
        .from('partners')
        .select('*', { count: 'exact', head: true })
        .limit(1);

    if (partnerError) {
        console.log(`   ❌ Error: ${partnerError.message}`);
        console.log(`   Status: ${partnerStatus}`);
    } else {
        console.log(`   ✅ Success! Table is accessible`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 RECOMMENDATIONS:\n');
    console.log('   • Only fix tables that are accessible');
    console.log('   • Start with finance_coa (which is CRITICAL for COA Import)');
    console.log('   • Other tables can be fixed later\n');
}

debug();
