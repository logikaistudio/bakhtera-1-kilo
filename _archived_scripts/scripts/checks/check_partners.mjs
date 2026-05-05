import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking blink_business_partners table...\n');

async function checkPartners() {
    try {
        // Check if table exists and get count
        const { data, error, count } = await supabase
            .from('blink_business_partners')
            .select('*', { count: 'exact', head: false })
            .limit(5);

        if (error) {
            console.error('❌ Error accessing blink_business_partners:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return;
        }

        console.log(`✅ Table exists! Found ${count} total partners`);
        console.log('\n📋 Sample partners (first 5):');

        if (data && data.length > 0) {
            data.forEach((partner, index) => {
                console.log(`\n${index + 1}. ${partner.partner_name}`);
                console.log(`   Code: ${partner.partner_code}`);
                console.log(`   Type: ${partner.partner_type}`);
                console.log(`   Roles: ${[
                    partner.is_customer ? 'Customer' : null,
                    partner.is_vendor ? 'Vendor' : null,
                    partner.is_agent ? 'Agent' : null,
                    partner.is_transporter ? 'Transporter' : null
                ].filter(Boolean).join(', ')}`);
                console.log(`   Status: ${partner.status}`);
            });
        } else {
            console.log('⚠️  No partners found in database');
        }

        // Check by role
        console.log('\n📊 Partners by role:');

        const roles = ['customer', 'vendor', 'agent', 'transporter'];
        for (const role of roles) {
            const { count: roleCount } = await supabase
                .from('blink_business_partners')
                .select('*', { count: 'exact', head: true })
                .eq(`is_${role}`, true)
                .eq('status', 'active');

            console.log(`   ${role.charAt(0).toUpperCase() + role.slice(1)}s: ${roleCount || 0}`);
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkPartners();
