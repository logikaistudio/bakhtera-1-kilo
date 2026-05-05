import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verifying blink_quotations table structure...\n');

async function verifyColumns() {
    try {
        // Try to select with new columns to verify they exist
        const { data, error } = await supabase
            .from('blink_quotations')
            .select('customer_contact_name, customer_email, customer_phone, incoterm, payment_terms, package_type, quantity, gross_weight, net_weight, measure, terms_and_conditions')
            .limit(1);

        if (error) {
            console.error('❌ Error querying new columns:', error);
            console.error('Migration may not have been applied correctly.');
            return;
        }

        console.log('✅ All new columns are accessible!');
        console.log('\n📋 Verified columns:');
        console.log('   ✓ customer_contact_name');
        console.log('   ✓ customer_email');
        console.log('   ✓ customer_phone');
        console.log('   ✓ incoterm');
        console.log('   ✓ payment_terms');
        console.log('   ✓ package_type');
        console.log('   ✓ quantity');
        console.log('   ✓ gross_weight');
        console.log('   ✓ net_weight');
        console.log('   ✓ measure');
        console.log('   ✓ terms_and_conditions');

        console.log('\n🎉 Migration successful! You can now submit quotations without errors.');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

verifyColumns();
