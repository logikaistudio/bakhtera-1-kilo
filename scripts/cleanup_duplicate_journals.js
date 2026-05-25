// Script: cleanup_duplicate_journals.js
// Purpose: Delete duplicate journal entries (keeps the oldest one)
// Usage: node scripts/cleanup_duplicate_journals.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanupDuplicates(tableName, module) {
    console.log(`\n🧹 Cleaning duplicates in ${tableName}...`);
    
    // Get all entries sorted by date
    let query = supabase
        .from(tableName)
        .select('id, account_code, debit, credit, entry_date, entry_number, description');
    
    if (module !== 'BRIDGE') {
        query = supabase
            .from(tableName)
            .select('id, coa_id, account_code, debit, credit, entry_date, entry_number, description');
    }
    
    const { data: entries, error } = await query
        .order('entry_date', { ascending: true });
    
    if (error || !entries || entries.length === 0) {
        console.log(`   ℹ️  No entries found or table schema differs. Skipping.`);
        return { module, deleted: 0 };
    }
    
    // Group entries and find duplicates to delete
    const grouped = {};
    const toDelete = [];
    
    entries.forEach(entry => {
        const date = entry.entry_date.split('T')[0];
        const account = entry.coa_id || entry.account_code || 'UNKNOWN';
        const key = `${account}|${entry.debit}|${entry.credit}|${date}`;
        
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(entry);
    });
    
    // Find IDs to delete (keep first/oldest, delete the rest)
    Object.values(grouped).forEach(group => {
        if (group.length > 1) {
            // Skip first, delete rest
            for (let i = 1; i < group.length; i++) {
                toDelete.push({
                    id: group[i].id,
                    keep: group[0].id,
                    account: group[0].coa_id || group[0].account_code,
                    entry: group[0].entry_number
                });
            }
        }
    });
    
    if (toDelete.length === 0) {
        console.log(`   ✅ No duplicates found to delete`);
        return { module, deleted: 0 };
    }
    
    console.log(`\n   Found ${toDelete.length} duplicate entries to delete:`);
    toDelete.forEach((item, idx) => {
        console.log(`   ${idx + 1}. Delete ID: ${item.id} (keep: ${item.keep})`);
        console.log(`      Account: ${item.account}, Entry: ${item.entry}`);
    });
    
    // Confirm deletion
    console.log(`\n   ⚠️  WARNING: This will DELETE ${toDelete.length} entries from ${tableName}`);
    console.log(`   Proceeding with deletion...\n`);
    
    // Delete duplicates in batches
    let deletedCount = 0;
    for (const item of toDelete) {
        try {
            const { error: delError } = await supabase
                .from(tableName)
                .delete()
                .eq('id', item.id);
            
            if (delError) {
                console.log(`   ❌ Failed to delete ${item.id}: ${delError.message}`);
            } else {
                deletedCount++;
                console.log(`   ✅ Deleted: ${item.id}`);
            }
        } catch (err) {
            console.log(`   ❌ Error deleting ${item.id}:`, err.message);
        }
    }
    
    return { module, deleted: deletedCount };
}

async function main() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('DUPLICATE JOURNAL ENTRIES CLEANUP SCRIPT');
        console.log('='.repeat(80));
        
        const [blinkResult, bridgeResult] = await Promise.all([
            cleanupDuplicates('blink_journal_entries', 'BLINK'),
            cleanupDuplicates('bridge_journal_entries', 'BRIDGE')
        ]);
        
        console.log('\n' + '='.repeat(80));
        console.log('CLEANUP SUMMARY');
        console.log('='.repeat(80));
        console.log(`BLINK:  Deleted ${blinkResult.deleted} entries`);
        console.log(`BRIDGE: Deleted ${bridgeResult.deleted} entries`);
        console.log(`TOTAL:  Deleted ${blinkResult.deleted + bridgeResult.deleted} entries`);
        console.log('='.repeat(80));
        
        if (blinkResult.deleted > 0 || bridgeResult.deleted > 0) {
            console.log(`\n⚡ NEXT STEPS:`);
            console.log(`   1. Run detection script to verify: node scripts/detect_duplicate_journals.js`);
            console.log(`   2. Apply migration: Run sql/add_unique_constraint_journals.sql in Supabase`);
            console.log(`   3. Re-run detection to confirm all duplicates are gone\n`);
        } else {
            console.log(`\n✅ No duplicates to clean. Database is ready for migration.\n`);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
