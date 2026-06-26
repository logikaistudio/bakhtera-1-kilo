import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fsxdykjcajasmgybqdua.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw'
);

async function debug() {
    console.log('=== 1. Check blink_business_partners table columns ===');
    const { data: partners, error: pErr } = await supabase
        .from('blink_business_partners')
        .select('*')
        .limit(3);
    
    if (pErr) {
        console.error('Error fetching partners:', pErr);
    } else if (partners && partners.length > 0) {
        console.log('Columns:', Object.keys(partners[0]).join(', '));
        console.log('\nFirst 3 partners:');
        partners.forEach(p => {
            console.log(`  Name: "${p.partner_name}" | address_line1: "${p.address_line1}" | address: "${p.address}" | city: "${p.city}"`);
        });
    }

    console.log('\n=== 2. Search for USUI partner ===');
    const { data: usui, error: uErr } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, address_line1, address, city, postal_code, country')
        .ilike('partner_name', '%USUI%');
    
    if (uErr) console.error('Error:', uErr);
    else console.log('USUI results:', JSON.stringify(usui, null, 2));

    console.log('\n=== 3. Check invoice INV-BLK2606-0014 ===');
    const { data: inv, error: iErr } = await supabase
        .from('blink_invoices')
        .select('id, invoice_number, customer_id, customer_name, customer_address, customer_company')
        .eq('invoice_number', 'INV-BLK2606-0014')
        .limit(1);
    
    if (iErr) console.error('Error:', iErr);
    else console.log('Invoice data:', JSON.stringify(inv, null, 2));

    console.log('\n=== 4. All partners with address_line1 filled ===');
    const { data: withAddr, error: waErr } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, address_line1')
        .not('address_line1', 'is', null)
        .neq('address_line1', '')
        .limit(10);
    
    if (waErr) console.error('Error:', waErr);
    else {
        console.log(`Partners with address: ${withAddr?.length || 0}`);
        withAddr?.forEach(p => console.log(`  ID: ${p.id} | "${p.partner_name}" | addr: "${p.address_line1}"`));
    }

    console.log('\n=== 5. All partners WITHOUT address ===');
    const { data: noAddr, error: naErr } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, address_line1, address')
        .or('address_line1.is.null,address_line1.eq.')
        .limit(10);
    
    if (naErr) console.error('Error:', naErr);
    else {
        console.log(`Partners without address: ${noAddr?.length || 0}`);
        noAddr?.forEach(p => console.log(`  ID: ${p.id} | "${p.partner_name}" | line1: "${p.address_line1}" | addr: "${p.address}"`));
    }

    console.log('\n=== 6. Test maybeSingle ===');
    const { data: testData, error: testErr } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, address_line1')
        .ilike('partner_name', '%USUI%')
        .limit(1);
    
    if (testErr) console.error('maybeSingle test error:', testErr);
    else console.log('maybeSingle test result:', JSON.stringify(testData, null, 2));
}

debug().catch(console.error);
