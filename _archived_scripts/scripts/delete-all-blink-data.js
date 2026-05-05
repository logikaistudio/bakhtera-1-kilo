// Delete All BLINK Data - Fresh Start
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🗑️  BLINK Data Cleanup - DELETE ALL\n');
console.log('═══════════════════════════════════════\n');

async function deleteAllBLINKData() {
    try {
        // Delete in correct order (respecting FK constraints)

        // 1. Delete tracking updates (has FK to shipments)
        console.log('1️⃣  Deleting tracking updates...');
        const { error: trackingError, count: trackingCount } = await supabase
            .from('blink_tracking_updates')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (trackingError) {
            console.log('   ⚠️  Tracking:', trackingError.message);
        } else {
            console.log(`   ✅ Deleted ${trackingCount || 0} tracking updates\n`);
        }

        // 2. Delete shipments (has FK to quotations)
        console.log('2️⃣  Deleting shipments...');
        const { error: shipmentsError, count: shipmentsCount } = await supabase
            .from('blink_shipments')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (shipmentsError) {
            console.log('   ⚠️  Shipments:', shipmentsError.message);
        } else {
            console.log(`   ✅ Deleted ${shipmentsCount || 0} shipments\n`);
        }

        // 3. Delete quotations
        console.log('3️⃣  Deleting quotations...');
        const { error: quotationsError, count: quotationsCount } = await supabase
            .from('blink_quotations')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (quotationsError) {
            console.log('   ⚠️  Quotations:', quotationsError.message);
        } else {
            console.log(`   ✅ Deleted ${quotationsCount || 0} quotations\n`);
        }

        // 4. Delete leads
        console.log('4️⃣  Deleting leads...');
        const { error: leadsError, count: leadsCount } = await supabase
            .from('blink_leads')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (leadsError) {
            console.log('   ⚠️  Leads:', leadsError.message);
        } else {
            console.log(`   ✅ Deleted ${leadsCount || 0} leads\n`);
        }

        console.log('═══════════════════════════════════════\n');
        console.log('✅ ALL BLINK DATA DELETED!\n');
        console.log('📊 Summary:\n');
        console.log(`   Tracking: ${trackingCount || 0} deleted`);
        console.log(`   Shipments: ${shipmentsCount || 0} deleted`);
        console.log(`   Quotations: ${quotationsCount || 0} deleted`);
        console.log(`   Leads: ${leadsCount || 0} deleted\n`);
        console.log('🔄 Next Steps:\n');
        console.log('   1. Clear browser localStorage');
        console.log('   2. Hard refresh (Cmd+Shift+R)');
        console.log('   3. Create new quotation with IDR');
        console.log('   4. Test complete flow\n');
        console.log('⚠️  REGENERATE service_role key after testing!\n');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

deleteAllBLINKData();
