import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GhpLPJQyE7IIlmFStBqKVQ_aKcbgleV';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
    console.log('🔍 Checking revenue data in Supabase...\n');
    
    // Check quotations
    const { data: quotations, error: quotError } = await supabase
        .from('blink_quotations')
        .select('*');
    
    if (quotError) {
        console.error('❌ Error fetching quotations:', quotError);
        return;
    }
    
    console.log(`📋 Total Quotations: ${quotations?.length || 0}`);
    if (quotations && quotations.length > 0) {
        const rg = quotations.filter(q => q.quotation_type === 'RG').length;
        const op = quotations.filter(q => q.quotation_type === 'OP').length;
        console.log(`   - Regular (RG): ${rg}`);
        console.log(`   - Operation (OP): ${op}`);
        console.log(`\nSample quotation:`, quotations[0]);
    }
    
    // Check shipments
    const { data: shipments, error: shipError } = await supabase
        .from('blink_shipments')
        .select('*');
    
    if (shipError) {
        console.error('❌ Error fetching shipments:', shipError);
        return;
    }
    
    console.log(`\n🚚 Total Shipments: ${shipments?.length || 0}`);
    if (shipments && shipments.length > 0) {
        const paid = shipments.filter(s => s.status === 'delivered' || s.status === 'completed').length;
        console.log(`   - Paid: ${paid}`);
        console.log(`   - In Transit: ${shipments.length - paid}`);
        console.log(`\nSample shipment:`, shipments[0]);
        
        // Calculate revenue
        const totalRevenue = shipments
            .filter(s => s.status === 'delivered' || s.status === 'completed')
            .reduce((sum, s) => {
                const amount = s.currency === 'USD' ? s.quoted_amount * 15000 : s.quoted_amount;
                return sum + amount;
            }, 0);
        
        console.log(`\n💰 Total Revenue: Rp ${totalRevenue.toLocaleString('id-ID')}`);
    }
}

checkData().catch(console.error);
