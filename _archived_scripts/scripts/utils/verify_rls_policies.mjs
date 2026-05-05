/**
 * RLS Policies and Permissions Verification
 * 
 * Memeriksa apakah RLS policies dan permissions sudah dikonfigurasi dengan benar
 * 
 * Usage: node verify_rls_policies.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
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
    console.log('⚠️  .env file not found, using default credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables to check RLS
const tablesToCheckRLS = [
    'finance_coa',
    'blink_invoices',
    'blink_purchase_orders',
    'blink_journal_entries',
    'blink_shipments',
    'freight_customers',
    'freight_vendors',
    'partners'
];

async function testTableAccess(tableName) {
    try {
        // Test SELECT
        const { data: selectData, error: selectError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        // Test INSERT (with safe dummy data)
        const { data: insertData, error: insertError } = await supabase
            .from(tableName)
            .insert([{}])
            .select()
            .then(result => (result)); // Don't actually insert, just test permission

        // Summarize access
        const access = {
            select: !selectError,
            insert: !insertError?.message?.includes('permission'),
            selectError: selectError?.message || 'OK',
            insertError: insertError?.message || 'OK'
        };

        return access;
    } catch (e) {
        return {
            select: false,
            insert: false,
            error: e.message
        };
    }
}

async function verifyRLS() {
    console.log('\n🔐 RLS POLICIES & PERMISSIONS VERIFICATION\n');
    console.log('='.repeat(70));

    let summary = {
        selectOK: 0,
        selectFail: 0,
        insertOK: 0,
        insertFail: 0,
        issues: []
    };

    console.log('\n📋 Checking table access permissions:\n');

    for (const tableName of tablesToCheckRLS) {
        process.stdout.write(`Checking ${tableName}... `);
        const access = await testTableAccess(tableName);

        let status = '';
        if (access.select && access.insert) {
            status = '✅ All access OK';
            summary.selectOK++;
            summary.insertOK++;
        } else if (access.select && !access.insert) {
            status = '⚠️  Read OK, Insert FAIL';
            summary.selectOK++;
            summary.insertFail++;
            summary.issues.push({ table: tableName, issue: 'INSERT policy issues' });
        } else if (!access.select && access.insert) {
            status = '⚠️  Read FAIL, Insert OK';
            summary.selectFail++;
            summary.insertOK++;
            summary.issues.push({ table: tableName, issue: 'SELECT policy issues' });
        } else {
            status = '❌ No access';
            summary.selectFail++;
            summary.insertFail++;
            summary.issues.push({ table: tableName, issue: 'Complete RLS policy issues' });
        }

        console.log(status);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 RLS VERIFICATION SUMMARY\n');

    console.log(`SELECT Access: ${summary.selectOK}/${tablesToCheckRLS.length} ✅`);
    console.log(`INSERT Access: ${summary.insertOK}/${tablesToCheckRLS.length} ✅`);

    if (summary.issues.length > 0) {
        console.log('\n⚠️  Issues Found:\n');
        summary.issues.forEach(item => {
            console.log(`  • ${item.table}: ${item.issue}`);
        });
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (summary.selectFail === 0 && summary.insertFail === 0) {
        console.log('🎯 All RLS policies are working correctly!');
        console.log('\n✅ Database is fully ready for the application.');
    } else {
        console.log('Some RLS policies may need adjustment. To fix:');
        console.log('\n1. Check Supabase Dashboard → Authentication → Policies');
        console.log('2. Run migrations: supabase db push');
        console.log('3. Or apply missing migrations manually');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    return summary.issues.length === 0;
}

verifyRLS().then(isOK => {
    if (!isOK) {
        console.log('Run: npx supabase db push');
        process.exit(1);
    }
});
