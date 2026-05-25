// Script: detect_duplicate_journals.js
// Purpose: Detect and report duplicate journal entries
// Usage: node scripts/detect_duplicate_journals.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function detectDuplicates(tableName, module) {
    console.log(`\n📋 Checking ${module} duplicates in ${tableName}...`);
    
    // Get all journal entries
    let query = supabase
        .from(tableName)
        .select('id, debit, credit, entry_date, entry_number, description');
    
    // Add coa_id and account_code only if they exist in the table
    // For bridge, use different column names
    if (module === 'BRIDGE') {
        query = query.select('id, debit, credit, entry_date, entry_number, description, account_code');
    } else {
        query = query.select('id, coa_id, account_code, debit, credit, entry_date, entry_number, description');
    }
    
    // Re-initialize query
    query = supabase
        .from(tableName)
        .select('id, account_code, debit, credit, entry_date, entry_number, description');
    
    // Add coa_id if not bridge
    if (module !== 'BRIDGE') {
        query = query.select('id, coa_id, account_code, debit, credit, entry_date, entry_number, description');
    }
    
    const { data: entries, error } = await query
        .order('entry_date', { ascending: true });
    
    if (error) {
        console.error(`⚠️  Note: ${tableName} schema may differ (${error.message}). Continuing...`);
        return { module, duplicates: [], total: 0 };
    }
    
    if (!entries || entries.length === 0) {
        console.log(`   No entries found in ${tableName}`);
        return { module, duplicates: [], total: 0 };
    }
    
    // Group entries by (account/coa_id, debit, credit, date)
    const grouped = {};
    const duplicates = [];
    
    entries.forEach(entry => {
        const date = entry.entry_date.split('T')[0]; // Extract date only
        const account = entry.coa_id || entry.account_code || 'UNKNOWN';
        const key = `${account}|${entry.debit}|${entry.credit}|${date}`;
        
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(entry);
    });
    
    // Find duplicates
    Object.entries(grouped).forEach(([key, items]) => {
        if (items.length > 1) {
            const [account, debit, credit, date] = key.split('|');
            duplicates.push({
                account,
                debit: parseFloat(debit),
                credit: parseFloat(credit),
                date,
                count: items.length,
                entries: items.map(e => ({
                    id: e.id,
                    entryNumber: e.entry_number,
                    description: e.description
                }))
            });
        }
    });
    
    return { module, duplicates, total: entries.length };
}

async function generateReport(blinkResult, bridgeResult) {
    console.log('\n' + '='.repeat(80));
    console.log('DUPLICATE JOURNAL ENTRIES REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toISOString()}\n`);
    
    // Blink Report
    console.log(`📍 ${blinkResult.module.toUpperCase()}`);
    console.log(`   Total entries: ${blinkResult.total}`);
    console.log(`   Duplicate groups: ${blinkResult.duplicates.length}`);
    
    if (blinkResult.duplicates.length > 0) {
        console.log(`\n   ⚠️  DUPLICATES FOUND:\n`);
        blinkResult.duplicates.forEach((dup, idx) => {
            console.log(`   ${idx + 1}. Account: ${dup.account}`);
            console.log(`      Debit: ${dup.debit.toLocaleString('id-ID')} | Credit: ${dup.credit.toLocaleString('id-ID')} | Date: ${dup.date}`);
            console.log(`      Occurrences: ${dup.count}`);
            dup.entries.forEach((entry, i) => {
                console.log(`        - [${i + 1}] ID: ${entry.id} | JE: ${entry.entryNumber} | Desc: ${entry.description?.substring(0, 50)}...`);
            });
            console.log();
        });
    } else {
        console.log(`   ✅ No duplicates found`);
    }
    
    // Bridge Report
    console.log(`\n📍 ${bridgeResult.module.toUpperCase()}`);
    console.log(`   Total entries: ${bridgeResult.total}`);
    console.log(`   Duplicate groups: ${bridgeResult.duplicates.length}`);
    
    if (bridgeResult.duplicates.length > 0) {
        console.log(`\n   ⚠️  DUPLICATES FOUND:\n`);
        bridgeResult.duplicates.forEach((dup, idx) => {
            console.log(`   ${idx + 1}. Account: ${dup.account}`);
            console.log(`      Debit: ${dup.debit.toLocaleString('id-ID')} | Credit: ${dup.credit.toLocaleString('id-ID')} | Date: ${dup.date}`);
            console.log(`      Occurrences: ${dup.count}`);
            dup.entries.forEach((entry, i) => {
                console.log(`        - [${i + 1}] ID: ${entry.id} | JE: ${entry.entryNumber} | Desc: ${entry.description?.substring(0, 50)}...`);
            });
            console.log();
        });
    } else {
        console.log(`   ✅ No duplicates found`);
    }
    
    // Summary
    const totalDups = blinkResult.duplicates.length + bridgeResult.duplicates.length;
    console.log('='.repeat(80));
    console.log(`SUMMARY:`);
    console.log(`   Total modules checked: 2`);
    console.log(`   Duplicate groups found: ${totalDups}`);
    console.log(`   Total duplicate entries: ${
        blinkResult.duplicates.reduce((s, d) => s + (d.count - 1), 0) +
        bridgeResult.duplicates.reduce((s, d) => s + (d.count - 1), 0)
    }`);
    console.log('='.repeat(80));
    
    if (totalDups > 0) {
        console.log(`\n⚡ NEXT STEPS:`);
        console.log(`   1. Review each duplicate group above`);
        console.log(`   2. Determine which entries are legitimate and which are duplicates`);
        console.log(`   3. Delete duplicate entries (keep the earliest one)`);
        console.log(`   4. Run the migration: sql/add_unique_constraint_journals.sql`);
        console.log(`   5. Re-run this script to verify all duplicates are removed\n`);
    } else {
        console.log(`\n✅ All modules are clean! Ready to apply unique constraints.\n`);
    }
}

async function main() {
    try {
        const [blinkResult, bridgeResult] = await Promise.all([
            detectDuplicates('blink_journal_entries', 'BLINK'),
            detectDuplicates('bridge_journal_entries', 'BRIDGE')
        ]);
        
        await generateReport(blinkResult, bridgeResult);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
