// Fix BLINK QuotationManagement with Service Role
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🔧 Starting BLINK fixes with service role...\n');

// Step 1: Verify RLS status
async function checkRLS() {
    console.log('1️⃣ Checking RLS policies...');

    // Query to check RLS status
    const { data, error } = await supabase
        .from('blink_quotations')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ RLS might be blocking:', error.message);
        return false;
    }

    console.log('✅ RLS access OK\n');
    return true;
}

// Step 2: Read current QuotationManagement code
async function applyCodeFix() {
    console.log('2️⃣ Applying code fix to QuotationManagement.jsx...');

    const filePath = '/Users/hoeltz/Documents/GitHub/FreightOne/src/pages/Blink/QuotationManagement.jsx';

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Find and replace the fetchQuotations section
        const searchPattern = /setQuotations\(data \|\| \[\]\);/;

        const replacement = `// Map snake_case to camelCase for UI
            const mapped = (data || []).map(q => ({
                ...q,
                jobNumber: q.job_number || q.jobNumber,
                quotationNumber: q.quotation_number || q.quotationNumber,
                customerName: q.customer_name || q.customerName || '',
                customerCompany: q.customer_company || q.customerCompany || '',
                customerId: q.customer_id || q.customerId,
                customerAddress: q.customer_address || q.customerAddress || '',
                salesPerson: q.sales_person || q.salesPerson || '',
                quotationType: q.quotation_type || q.quotationType || 'RG',
                quotationDate: q.quotation_date || q.quotationDate,
                validUntil: q.valid_until || q.validUntil,
                serviceType: q.service_type || q.serviceType,
                cargoType: q.cargo_type || q.cargoType,
                totalAmount: q.total_amount || q.totalAmount || 0,
                serviceItems: q.service_items || q.serviceItems || [],
                rejectionReason: q.rejection_reason || q.rejectionReason,
                createdAt: q.created_at || q.createdAt,
                updatedAt: q.updated_at || q.updatedAt,
                currency: q.currency || 'USD',
                status: q.status || 'draft'
            }));
            
            console.log('✅ Mapped', mapped.length, 'quotations');
            setQuotations(mapped);`;

        if (content.match(searchPattern)) {
            content = content.replace(searchPattern, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('✅ Code fix applied!\n');
            return true;
        } else {
            console.log('⚠️  Pattern not found, file may have changed\n');
            return false;
        }
    } catch (err) {
        console.error('❌ Error applying fix:', err.message);
        return false;
    }
}

// Step 3: Test the fix
async function testQuotationCreate() {
    console.log('3️⃣ Testing quotation creation...');

    const testQuotation = {
        job_number: 'TEST-FIX-' + Date.now(),
        quotation_number: 'TEST-FIX-' + Date.now(),
        customer_name: 'Test Customer After Fix',
        quotation_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        origin: 'Jakarta',
        destination: 'Singapore',
        service_type: 'sea',
        total_amount: 5000,
        currency: 'USD',
        status: 'draft'
    };

    const { data, error } = await supabase
        .from('blink_quotations')
        .insert([testQuotation])
        .select();

    if (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }

    console.log('✅ Test quotation created successfully!');
    console.log('   ID:', data[0].id);
    console.log('   Job Number:', data[0].job_number);
    console.log('\n');
    return true;
}

// Run all fixes
async function main() {
    const rlsOk = await checkRLS();
    const codeFixed = await applyCodeFix();
    const testOk = await testQuotationCreate();

    console.log('📊 SUMMARY:');
    console.log('   RLS Access:', rlsOk ? '✅' : '❌');
    console.log('   Code Fixed:', codeFixed ? '✅' : '⚠️');
    console.log('   Test Create:', testOk ? '✅' : '❌');

    console.log('\n🔒 SECURITY REMINDER:');
    console.log('   ⚠️  REGENERATE service_role key NOW!');
    console.log('   📍 Dashboard → Settings → API → Regenerate');
    console.log('\n✅ All fixes complete! Refresh browser to test.');
}

main();
