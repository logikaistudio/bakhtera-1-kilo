/**
 * Fix for COA Import RLS Policy Issue
 * 
 * This script fixes the row-level security policy on the finance_coa table
 * to allow COA records to be imported successfully.
 * 
 * Usage:
 *   node fix_coa_rls_policy.mjs
 * 
 * The script will read credentials from the supabase client or use the hardcoded URL.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load from .env first
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
    // .env not found, use defaults
    console.log('⚠️  .env file not found, using default Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCoaRlsPolicy() {
    console.log('🔧 Fixing finance_coa RLS Policy...\n');

    try {
        // Read the migration file
        const migrationPath = join(__dirname, 'supabase/migrations/090_fix_finance_coa_rls_policy.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        // Execute using the exec_sql RPC function (which should exist in the Supabase project)
        console.log('📝 Executing SQL migration...');
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

        if (error) {
            console.error('❌ Error executing migration:', error);
            console.log('\n💡 Alternative: Run the SQL manually in Supabase Dashboard:');
            console.log('   1. Go to SQL Editor in Supabase Dashboard');
            console.log('   2. Create a new query');
            console.log('   3. Copy and paste the contents of supabase/migrations/090_fix_finance_coa_rls_policy.sql');
            console.log('   4. Execute the query');
            process.exit(1);
        }

        console.log('✅ finance_coa RLS Policy fixed successfully!');
        console.log('\n📋 Changes made:');
        console.log('   • Dropped old "Enable all for authenticated users" policy');
        console.log('   • Created separate policies for SELECT, INSERT, UPDATE, DELETE');
        console.log('   • All policies now use permissive USING/WITH CHECK (true) conditions');
        console.log('\n🎯 You can now import COA records without RLS policy violations!');

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        console.log('\n💡 Alternative: Run the SQL manually in Supabase Dashboard');
        process.exit(1);
    }
}

fixCoaRlsPolicy();
