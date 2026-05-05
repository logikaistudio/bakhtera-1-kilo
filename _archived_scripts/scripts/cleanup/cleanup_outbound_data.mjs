// Script to cleanup incorrect outbound data from database
// Run with: node cleanup_outbound_data.mjs

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

async function cleanupOutboundData() {
    console.log('🧹 Starting cleanup of incorrect outbound data...\n');

    try {
        // Step 1: Delete ALL records from freight_outbound
        console.log('📦 Step 1: Clearing freight_outbound table...');
        const { error: deleteOutboundError, count: outboundCount } = await supabase
            .from('freight_outbound')
            .delete()
            .neq('id', 'placeholder') // Delete all records
            .select('*', { count: 'exact', head: true });

        if (deleteOutboundError) {
            console.error('   ❌ Error deleting freight_outbound:', deleteOutboundError.message);
        } else {
            console.log('   ✅ Cleared freight_outbound table');
        }

        // Step 2: Reset outbound_status for all outbound quotations
        console.log('\n📋 Step 2: Resetting outbound quotation status...');
        const { data: resetData, error: resetError } = await supabase
            .from('freight_quotations')
            .update({
                outbound_status: null,
                outbound_date: null
            })
            .eq('type', 'outbound')
            .select('quotation_number');

        if (resetError) {
            console.error('   ❌ Error resetting quotation status:', resetError.message);
        } else {
            console.log(`   ✅ Reset ${resetData?.length || 0} outbound quotations`);
            if (resetData && resetData.length > 0) {
                console.log('   Reset quotations:', resetData.map(q => q.quotation_number).join(', '));
            }
        }

        // Step 3: Show current state
        console.log('\n📊 Step 3: Current database state...');

        const { count: outboundRemaining } = await supabase
            .from('freight_outbound')
            .select('*', { count: 'exact', head: true });
        console.log(`   freight_outbound records: ${outboundRemaining || 0}`);

        const { data: quotationStats } = await supabase
            .from('freight_quotations')
            .select('type, outbound_status')
            .eq('type', 'outbound');

        const processed = quotationStats?.filter(q => q.outbound_status === 'processed').length || 0;
        const pending = quotationStats?.filter(q => !q.outbound_status).length || 0;
        console.log(`   outbound quotations: ${quotationStats?.length || 0} (processed: ${processed}, pending: ${pending})`);

        console.log('\n✅ Cleanup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Refresh the application');
        console.log('   2. Create new outbound submissions');
        console.log('   3. Process them to Pabean - data should now be correct');

    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    }
}

cleanupOutboundData();
