// Script to FORCE delete all quotations and related data
// Run with: node force_delete_all.mjs

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceDeleteAll() {
    console.log('🔥 FORCE DELETE: Starting comprehensive cleanup...\n');
    console.log('⚠️  WARNING: This will DELETE ALL quotation-related data!\n');

    try {
        // Step 1: Delete from freight_outbound (no dependencies)
        console.log('📦 Step 1: Deleting freight_outbound...');
        const { error: err1 } = await supabase
            .from('freight_outbound')
            .delete()
            .neq('id', '00000000'); // Match all
        console.log(err1 ? `   ❌ Error: ${err1.message}` : '   ✅ Done');

        // Step 2: Delete from freight_inbound (no dependencies)
        console.log('📦 Step 2: Deleting freight_inbound...');
        const { error: err2 } = await supabase
            .from('freight_inbound')
            .delete()
            .neq('id', '00000000');
        console.log(err2 ? `   ❌ Error: ${err2.message}` : '   ✅ Done');

        // Step 3: Delete from freight_reject (no dependencies)
        console.log('📦 Step 3: Deleting freight_reject...');
        const { error: err3 } = await supabase
            .from('freight_reject')
            .delete()
            .neq('id', '00000000');
        console.log(err3 ? `   ❌ Error: ${err3.message}` : '   ✅ Done');

        // Step 4: Delete from freight_warehouse
        console.log('📦 Step 4: Deleting freight_warehouse...');
        const { error: err4 } = await supabase
            .from('freight_warehouse')
            .delete()
            .neq('id', '00000000');
        console.log(err4 ? `   ❌ Error: ${err4.message}` : '   ✅ Done');

        // Step 5: Delete from freight_mutation_logs
        console.log('📦 Step 5: Deleting freight_mutation_logs...');
        const { error: err5 } = await supabase
            .from('freight_mutation_logs')
            .delete()
            .neq('id', 0); // id is likely integer
        console.log(err5 ? `   ❌ Error: ${err5.message}` : '   ✅ Done');

        // Step 6: Delete from freight_customs
        console.log('📦 Step 6: Deleting freight_customs...');
        const { error: err6 } = await supabase
            .from('freight_customs')
            .delete()
            .neq('id', '00000000');
        console.log(err6 ? `   ❌ Error: ${err6.message}` : '   ✅ Done');

        // Step 7: Unlink invoices
        console.log('📦 Step 7: Unlinking freight_invoices...');
        const { error: err7 } = await supabase
            .from('freight_invoices')
            .update({ quotation_id: null })
            .neq('id', '00000000');
        console.log(err7 ? `   ❌ Error: ${err7.message}` : '   ✅ Done');

        // Step 8: Unlink purchases
        console.log('📦 Step 8: Unlinking freight_purchases...');
        const { error: err8 } = await supabase
            .from('freight_purchases')
            .update({ quotation_id: null })
            .neq('id', '00000000');
        console.log(err8 ? `   ❌ Error: ${err8.message}` : '   ✅ Done');

        // Step 9: Unlink shipments
        console.log('📦 Step 9: Unlinking freight_shipments...');
        const { error: err9 } = await supabase
            .from('freight_shipments')
            .update({ quotation_id: null })
            .neq('id', '00000000');
        console.log(err9 ? `   ❌ Error: ${err9.message}` : '   ✅ Done');

        // Step 10: Delete warehouse_inventory (different table name)
        console.log('📦 Step 10: Deleting warehouse_inventory...');
        const { error: err10 } = await supabase
            .from('warehouse_inventory')
            .delete()
            .neq('id', '00000000');
        console.log(err10 ? `   ❌ Error: ${err10.message}` : '   ✅ Done');

        // Step 11: Finally delete all quotations
        console.log('\n🔥 Step 11: Deleting ALL freight_quotations...');
        const { data: quotations, error: fetchErr } = await supabase
            .from('freight_quotations')
            .select('id, quotation_number, type');

        if (fetchErr) {
            console.log(`   ❌ Fetch error: ${fetchErr.message}`);
        } else {
            console.log(`   Found ${quotations?.length || 0} quotations to delete:`);
            quotations?.forEach(q => console.log(`      - ${q.quotation_number} (${q.type})`));

            const { error: delErr, count } = await supabase
                .from('freight_quotations')
                .delete()
                .neq('id', '00000000');

            console.log(delErr ? `   ❌ Delete error: ${delErr.message}` : `   ✅ Deleted all quotations`);
        }

        // Final status check
        console.log('\n📊 Final status check...');

        const tables = [
            'freight_quotations',
            'freight_inbound',
            'freight_outbound',
            'freight_reject',
            'freight_warehouse',
            'freight_mutation_logs',
            'freight_customs'
        ];

        for (const table of tables) {
            const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            console.log(`   ${table}: ${count || 0} records`);
        }

        console.log('\n✅ Force delete completed!');
        console.log('\n📝 Next steps:');
        console.log('   1. Refresh the application');
        console.log('   2. All quotation data should be cleared');

    } catch (error) {
        console.error('❌ Force delete failed:', error.message);
    }
}

forceDeleteAll();
