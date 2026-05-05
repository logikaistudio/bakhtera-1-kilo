// Direct Shipment Insert Test
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🧪 Testing Shipment Insert\n');

async function testInsert() {
    try {
        // Test shipment data
        const testShipment = {
            job_number: 'JOB-2025-TEST',
            so_number: 'SO-2025-TEST',
            customer: 'Test Customer',
            origin: 'Jakarta',
            destination: 'Singapore',
            service_type: 'sea',
            quoted_amount: 47000000,
            currency: 'IDR',
            status: 'pending',
            created_from: 'manual_test'
        };

        console.log('📦 Inserting test shipment...');
        console.log('Data:', testShipment);

        const { data, error } = await supabase
            .from('blink_shipments')
            .insert([testShipment])
            .select();

        if (error) {
            console.log('\n❌ INSERT FAILED!');
            console.log('Error:', error.message);
            console.log('Code:', error.code);
            console.log('Details:', error.details);
            console.log('Hint:', error.hint);
        } else {
            console.log('\n✅ INSERT SUCCESS!');
            console.log('Created ID:', data[0].id);
            console.log('Job Number:', data[0].job_number);
        }

        // Check total shipments
        const { data: all } = await supabase
            .from('blink_shipments')
            .select('job_number, currency, quoted_amount');

        console.log(`\n📊 Total shipments in DB: ${all?.length || 0}`);
        if (all && all.length > 0) {
            all.forEach(s => {
                console.log(`   - ${s.job_number}: ${s.currency} ${s.quoted_amount}`);
            });
        }

    } catch (error) {
        console.error('\n❌ Exception:', error.message);
    }
}

testInsert();
