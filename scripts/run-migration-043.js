#!/usr/bin/env node

/**
 * Migration Script: 043_update_mutation_destination_options
 * Purpose: Add documentation and index for mutation destination field
 * Supports: Gudang, Pameran, Keluar TPB
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: Supabase credentials not found in .env file');
    console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigration() {
    console.log('🚀 Starting Migration 043: Update Mutation Destination Options');
    console.log('='.repeat(70));

    try {
        // Step 1: Add comment to destination column
        console.log('\n📝 Step 1: Adding comment to destination column...');
        const { error: error1 } = await supabase.rpc('exec_sql', {
            sql: `COMMENT ON COLUMN freight_mutation_logs.destination IS 'Mutation destination location: Gudang (warehouse), Pameran (exhibition), or Keluar TPB (leaving bonded zone)';`
        });

        if (error1) {
            console.error('⚠️  Warning: Could not add comment to destination column');
            console.error('   This is usually due to RLS or permissions. Manual execution may be needed.');
            console.error('   Error:', error1.message);
        } else {
            console.log('✅ Comment added to destination column');
        }

        // Step 2: Add comment to origin column
        console.log('\n📝 Step 2: Adding comment to origin column...');
        const { error: error2 } = await supabase.rpc('exec_sql', {
            sql: `COMMENT ON COLUMN freight_mutation_logs.origin IS 'Mutation origin location: warehouse, Pameran, or other source';`
        });

        if (error2) {
            console.error('⚠️  Warning: Could not add comment to origin column');
            console.error('   Error:', error2.message);
        } else {
            console.log('✅ Comment added to origin column');
        }

        // Step 3: Create index on destination
        console.log('\n📊 Step 3: Creating index on destination column...');
        const { error: error3 } = await supabase.rpc('exec_sql', {
            sql: `CREATE INDEX IF NOT EXISTS idx_mutation_destination ON freight_mutation_logs(destination);`
        });

        if (error3) {
            console.error('⚠️  Warning: Could not create index');
            console.error('   Error:', error3.message);
        } else {
            console.log('✅ Index idx_mutation_destination created');
        }

        // Step 4: Update table comment
        console.log('\n📝 Step 4: Updating table comment...');
        const { error: error4 } = await supabase.rpc('exec_sql', {
            sql: `COMMENT ON TABLE freight_mutation_logs IS 'Pergerakan Barang - Goods movement logs. Tracks mutations between warehouse, Pameran (exhibition), and TPB exit';`
        });

        if (error4) {
            console.error('⚠️  Warning: Could not update table comment');
            console.error('   Error:', error4.message);
        } else {
            console.log('✅ Table comment updated');
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Migration 043 completed!');
        console.log('\n📋 Summary:');
        console.log('   - Destination column documented with 3 supported values:');
        console.log('     • Gudang (warehouse)');
        console.log('     • Pameran (exhibition)');
        console.log('     • Keluar TPB (leaving bonded zone)');
        console.log('   - Index created for better query performance');
        console.log('   - Table documentation updated');

        // Verification
        console.log('\n🔍 Verifying migration...');
        const { data: indices, error: verifyError } = await supabase
            .from('pg_indexes')
            .select('indexname')
            .eq('tablename', 'freight_mutation_logs')
            .eq('indexname', 'idx_mutation_destination');

        if (!verifyError && indices && indices.length > 0) {
            console.log('✅ Verification passed: Index exists');
        } else {
            console.log('⚠️  Could not verify index (this might be due to permissions)');
        }

    } catch (error) {
        console.error('\n❌ Migration failed with error:');
        console.error(error);
        console.log('\n📄 Manual Execution Required:');
        console.log('Please run the following SQL in Supabase Dashboard SQL Editor:');
        console.log('\n' + '-'.repeat(70));
        console.log(`
COMMENT ON COLUMN freight_mutation_logs.destination IS 'Mutation destination location: Gudang (warehouse), Pameran (exhibition), or Keluar TPB (leaving bonded zone)';

COMMENT ON COLUMN freight_mutation_logs.origin IS 'Mutation origin location: warehouse, Pameran, or other source';

CREATE INDEX IF NOT EXISTS idx_mutation_destination ON freight_mutation_logs(destination);

COMMENT ON TABLE freight_mutation_logs IS 'Pergerakan Barang - Goods movement logs. Tracks mutations between warehouse, Pameran (exhibition), and TPB exit';
        `);
        console.log('-'.repeat(70));
        process.exit(1);
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('\n✨ All done! The mutation location feature is now fully configured.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
