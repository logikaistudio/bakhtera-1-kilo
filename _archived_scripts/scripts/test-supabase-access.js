// Test Supabase Access and Check RLS
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_GhpLPJQyE7IIlmFStBqKVQ_aKcbgleV';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBLINKAccess() {
    console.log('🔍 Testing BLINK table access...');

    // Test 1: Can we read?
    const { data: quotations, error: readError } = await supabase
        .from('blink_quotations')
        .select('*')
        .limit(5);

    if (readError) {
        console.error('❌ Read Error:', readError.message);
        console.log('💡 This is likely RLS blocking access');
        console.log('📝 You MUST disable RLS via Dashboard SQL Editor');
        return false;
    }

    console.log('✅ Read access OK, found', quotations.length, 'quotations');

    // Test 2: Can we insert?
    const testQuotation = {
        job_number: 'TEST-' + Date.now(),
        quotation_number: 'TEST-' + Date.now(),
        customer_name: 'Test Customer',
        quotation_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        origin: 'Test Origin',
        destination: 'Test Destination',
        service_type: 'sea',
        total_amount: 1000,
        status: 'draft'
    };

    const { data: insertData, error: insertError } = await supabase
        .from('blink_quotations')
        .insert([testQuotation])
        .select();

    if (insertError) {
        console.error('❌ Insert Error:', insertError.message);
        console.log('💡 RLS is blocking INSERT operations');
        return false;
    }

    console.log('✅ Insert access OK');
    console.log('✅ ALL ACCESS WORKS - RLS is already disabled or permissive!');
    return true;
}

testBLINKAccess();
