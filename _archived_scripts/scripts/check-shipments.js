// Check if Shipment was Actually Inserted
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NjcxMTYsImV4cCI6MjA1MTA0MzExNn0.GhpLPJQyE7IIlmFStBqKVQ_aKcbgleVzN3LKc3wCPxk';

const supabase = createClient(supabaseUrl, anonKey);

console.log('🔍 Checking Shipments in Database\n');

async function checkShipments() {
    try {
        // Check all shipments
        const { data: shipments, error } = await supabase
            .from('blink_shipments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching shipments:', error);
            return;
        }

        console.log(`📦 Total Shipments in DB: ${shipments?.length || 0}\n`);

        if (shipments && shipments.length > 0) {
            shipments.forEach((s, i) => {
                console.log(`${i + 1}. ${s.job_number || 'NO_JOB'}`);
                console.log(`   SO: ${s.so_number || 'N/A'}`);
                console.log(`   Customer: ${s.customer || 'N/A'}`);
                console.log(`   Currency: ${s.currency || 'N/A'}`);
                console.log(`   Quoted: ${s.quoted_amount || 0}`);
                console.log(`   Status: ${s.status || 'N/A'}`);
                console.log(`   Created: ${s.created_at}\n`);
            });
        } else {
            console.log('⚠️  No shipments found in database!\n');
            console.log('This means shipment INSERT failed silently.');
            console.log('Check browser console for errors during Create SO.\n');
        }

        // Check quotations for reference
        const { data: quotations } = await supabase
            .from('blink_quotations')
            .select('id, job_number, status')
            .eq('status', 'converted');

        console.log(`📋 Converted Quotations: ${quotations?.length || 0}\n`);

        if (quotations && quotations.length > 0) {
            quotations.forEach(q => {
                console.log(`   - ${q.job_number} (${q.status})`);
            });
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkShipments();
