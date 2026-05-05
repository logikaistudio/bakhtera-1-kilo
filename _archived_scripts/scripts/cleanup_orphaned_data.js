/**
 * CLEANUP ORPHANED PABEAN DATA
 * 
 * This script cleans up orphaned data in Pabean tables where
 * the parent pengajuan no longer exists in freight_quotations
 * 
 * Usage: node cleanup_orphaned_data.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

// Supabase configuration - uses same config as your app
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: Supabase credentials not found!');
    console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
    console.error('');
    console.error('Expected .env location:', join(__dirname, '../.env'));
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function findOrphanedData() {
    log('\n🔍 STEP 1: Identifying orphaned data...', 'blue');

    const orphanedData = {
        inbound: [],
        outbound: [],
        reject: [],
        warehouse: []
    };

    // Find orphaned inbound transactions
    log('  Checking freight_inbound...', 'yellow');
    const { data: inboundData, error: inboundError } = await supabase
        .from('freight_inbound')
        .select('id, pengajuan_id, pengajuan_number, customs_doc_number, date, asset_name');

    if (inboundError) {
        log(`  ❌ Error fetching inbound: ${inboundError.message}`, 'red');
    } else {
        // Check which ones are orphaned (NULL pengajuan_id OR pengajuan doesn't exist)
        for (const item of inboundData || []) {
            // If no pengajuan_id at all, it's orphaned
            if (!item.pengajuan_id) {
                orphanedData.inbound.push(item);
                continue;
            }

            // If has pengajuan_id, check if parent exists
            const { data: parent, error: parentError } = await supabase
                .from('freight_quotations')
                .select('id')
                .eq('id', item.pengajuan_id)
                .maybeSingle();

            if (!parent || parentError) {
                orphanedData.inbound.push(item);
            }
        }
        log(`  Found ${orphanedData.inbound.length} orphaned inbound records`,
            orphanedData.inbound.length > 0 ? 'yellow' : 'green');
    }

    // Find orphaned outbound transactions
    log('  Checking freight_outbound...', 'yellow');
    const { data: outboundData, error: outboundError } = await supabase
        .from('freight_outbound')
        .select('id, pengajuan_id, pengajuan_number, customs_doc_number, date, asset_name');

    if (outboundError) {
        log(`  ❌ Error fetching outbound: ${outboundError.message}`, 'red');
    } else {
        for (const item of outboundData || []) {
            if (!item.pengajuan_id) {
                orphanedData.outbound.push(item);
                continue;
            }

            const { data: parent, error: parentError } = await supabase
                .from('freight_quotations')
                .select('id')
                .eq('id', item.pengajuan_id)
                .maybeSingle();

            if (!parent || parentError) {
                orphanedData.outbound.push(item);
            }
        }
        log(`  Found ${orphanedData.outbound.length} orphaned outbound records`,
            orphanedData.outbound.length > 0 ? 'yellow' : 'green');
    }

    // Find orphaned reject transactions
    log('  Checking freight_reject...', 'yellow');
    const { data: rejectData, error: rejectError } = await supabase
        .from('freight_reject')
        .select('id, pengajuan_id, customs_doc_number, date');

    if (rejectError) {
        log(`  ❌ Error fetching reject: ${rejectError.message}`, 'red');
    } else {
        for (const item of rejectData || []) {
            if (!item.pengajuan_id) {
                orphanedData.reject.push(item);
                continue;
            }

            const { data: parent, error: parentError } = await supabase
                .from('freight_quotations')
                .select('id')
                .eq('id', item.pengajuan_id)
                .maybeSingle();

            if (!parent || parentError) {
                orphanedData.reject.push(item);
            }
        }
        log(`  Found ${orphanedData.reject.length} orphaned reject records`,
            orphanedData.reject.length > 0 ? 'yellow' : 'green');
    }

    // Find orphaned warehouse inventory
    log('  Checking freight_warehouse...', 'yellow');
    const { data: warehouseData, error: warehouseError } = await supabase
        .from('freight_warehouse')
        .select('id, pengajuan_id, pengajuan_number, bc_document_number, item_name');

    if (warehouseError) {
        log(`  ❌ Error fetching warehouse: ${warehouseError.message}`, 'red');
    } else {
        for (const item of warehouseData || []) {
            if (!item.pengajuan_id) {
                orphanedData.warehouse.push(item);
                continue;
            }

            const { data: parent, error: parentError } = await supabase
                .from('freight_quotations')
                .select('id')
                .eq('id', item.pengajuan_id)
                .maybeSingle();

            if (!parent || parentError) {
                orphanedData.warehouse.push(item);
            }
        }
        log(`  Found ${orphanedData.warehouse.length} orphaned warehouse records`,
            orphanedData.warehouse.length > 0 ? 'yellow' : 'green');
    }

    return orphanedData;
}

async function deleteOrphanedData(orphanedData) {
    log('\n🗑️  STEP 2: Deleting orphaned data...', 'blue');

    let totalDeleted = 0;

    // Delete orphaned inbound
    if (orphanedData.inbound.length > 0) {
        log(`  Deleting ${orphanedData.inbound.length} orphaned inbound records...`, 'yellow');
        const ids = orphanedData.inbound.map(item => item.id);
        const { error } = await supabase
            .from('freight_inbound')
            .delete()
            .in('id', ids);

        if (error) {
            log(`  ❌ Error deleting inbound: ${error.message}`, 'red');
        } else {
            log(`  ✅ Deleted ${orphanedData.inbound.length} inbound records`, 'green');
            totalDeleted += orphanedData.inbound.length;
        }
    }

    // Delete orphaned outbound
    if (orphanedData.outbound.length > 0) {
        log(`  Deleting ${orphanedData.outbound.length} orphaned outbound records...`, 'yellow');
        const ids = orphanedData.outbound.map(item => item.id);
        const { error } = await supabase
            .from('freight_outbound')
            .delete()
            .in('id', ids);

        if (error) {
            log(`  ❌ Error deleting outbound: ${error.message}`, 'red');
        } else {
            log(`  ✅ Deleted ${orphanedData.outbound.length} outbound records`, 'green');
            totalDeleted += orphanedData.outbound.length;
        }
    }

    // Delete orphaned reject
    if (orphanedData.reject.length > 0) {
        log(`  Deleting ${orphanedData.reject.length} orphaned reject records...`, 'yellow');
        const ids = orphanedData.reject.map(item => item.id);
        const { error } = await supabase
            .from('freight_reject')
            .delete()
            .in('id', ids);

        if (error) {
            log(`  ❌ Error deleting reject: ${error.message}`, 'red');
        } else {
            log(`  ✅ Deleted ${orphanedData.reject.length} reject records`, 'green');
            totalDeleted += orphanedData.reject.length;
        }
    }

    // Delete orphaned warehouse
    if (orphanedData.warehouse.length > 0) {
        log(`  Deleting ${orphanedData.warehouse.length} orphaned warehouse records...`, 'yellow');
        const ids = orphanedData.warehouse.map(item => item.id);
        const { error } = await supabase
            .from('freight_warehouse')
            .delete()
            .in('id', ids);

        if (error) {
            log(`  ❌ Error deleting warehouse: ${error.message}`, 'red');
        } else {
            log(`  ✅ Deleted ${orphanedData.warehouse.length} warehouse records`, 'green');
            totalDeleted += orphanedData.warehouse.length;
        }
    }

    return totalDeleted;
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════╗', 'magenta');
    log('║     CLEANUP ORPHANED PABEAN DATA - AUTOMATED SCRIPT   ║', 'magenta');
    log('╚════════════════════════════════════════════════════════╝', 'magenta');

    try {
        // Step 1: Find orphaned data
        const orphanedData = await findOrphanedData();

        const totalOrphaned =
            orphanedData.inbound.length +
            orphanedData.outbound.length +
            orphanedData.reject.length +
            orphanedData.warehouse.length;

        log(`\n📊 Summary:`, 'blue');
        log(`  Total orphaned records found: ${totalOrphaned}`, totalOrphaned > 0 ? 'yellow' : 'green');
        log(`    - Inbound: ${orphanedData.inbound.length}`, 'yellow');
        log(`    - Outbound: ${orphanedData.outbound.length}`, 'yellow');
        log(`    - Reject: ${orphanedData.reject.length}`, 'yellow');
        log(`    - Warehouse: ${orphanedData.warehouse.length}`, 'yellow');

        if (totalOrphaned === 0) {
            log('\n✅ No orphaned data found! Database is clean.', 'green');
            return;
        }

        // Show details
        if (orphanedData.inbound.length > 0) {
            log('\n📋 Orphaned Inbound Records:', 'yellow');
            orphanedData.inbound.forEach(item => {
                log(`    - ${item.customs_doc_number} (Pengajuan: ${item.pengajuan_number || item.pengajuan_id})`, 'yellow');
            });
        }

        if (orphanedData.warehouse.length > 0) {
            log('\n📦 Orphaned Warehouse Records:', 'yellow');
            orphanedData.warehouse.forEach(item => {
                log(`    - ${item.item_name} (BC: ${item.bc_document_number})`, 'yellow');
            });
        }

        // Step 2: Delete orphaned data
        const totalDeleted = await deleteOrphanedData(orphanedData);

        // Summary
        log('\n╔════════════════════════════════════════════════════════╗', 'green');
        log('║                   CLEANUP COMPLETE                     ║', 'green');
        log('╚════════════════════════════════════════════════════════╝', 'green');
        log(`\n✅ Successfully deleted ${totalDeleted} orphaned records!`, 'green');
        log('\n💡 Tip: Refresh your application to see the updated data.\n', 'blue');

    } catch (error) {
        log('\n❌ ERROR during cleanup:', 'red');
        log(error.message, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run the script
main();
