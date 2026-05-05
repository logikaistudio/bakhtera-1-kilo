// Migration 011 Executor
// Run this script to apply the BL/AWB enhancements migration

import { supabase } from './src/lib/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🚀 Starting Migration 011: Enhance PO, BL, and AWB Documents...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/011_enhance_po_bl_awb.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📊 SQL Length:', migrationSQL.length, 'characters\n');

    try {
        // Execute the migration SQL
        console.log('⚙️  Executing migration...');

        const { data, error } = await supabase.rpc('exec_sql', {
            sql_query: migrationSQL
        });

        if (error) {
            // If RPC doesn't exist, try direct approach
            console.log('ℹ️  RPC method not available, trying alternative approach...');

            // Split SQL into individual statements
            const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i] + ';';
                console.log(`   [${i + 1}/${statements.length}] Executing...`);

                const { error: stmtError } = await supabase.rpc('exec_sql', {
                    sql_query: statement
                });

                if (stmtError) {
                    console.error(`   ❌ Error in statement ${i + 1}:`, stmtError.message);
                    console.error(`   SQL: ${statement.substring(0, 100)}...`);
                    throw stmtError;
                }

                console.log(`   ✅ Statement ${i + 1} executed successfully`);
            }
        }

        console.log('\n✅ Migration 011 applied successfully!');
        console.log('\n📋 Changes applied:');
        console.log('   • Added bl_subject to blink_shipments');
        console.log('   • Added quotation_id to blink_shipments');
        console.log('   • Added quotation_shipper_name to blink_shipments');
        console.log('   • Added quotation_consignee_name to blink_shipments');
        console.log('   • Created performance indexes');
        console.log('   • Added PO shipper/consignee fields');
        console.log('\n🎉 Database is ready for the new features!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n💡 Alternative approach:');
        console.error('   1. Open Supabase Dashboard');
        console.error('   2. Go to SQL Editor');
        console.error('   3. Copy contents of supabase/migrations/011_enhance_po_bl_awb.sql');
        console.error('   4. Paste and click "Run"');
        process.exit(1);
    }
}

// Run the migration
runMigration()
    .then(() => {
        console.log('\n✨ All done! You can now test the BL Management features.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Fatal error:', err);
        process.exit(1);
    });
