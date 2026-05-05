// Script to check and fix company_settings data
// Run with: node scripts/check-company-settings.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompanySettings() {
    console.log('🔍 Checking company_settings table...\n');

    // Get all rows
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`📊 Found ${data.length} row(s):\n`);

    data.forEach((row, index) => {
        console.log(`--- Row ${index + 1} ---`);
        console.log('ID:', row.id);
        console.log('Company Name:', row.company_name);
        console.log('Address:', row.company_address);
        console.log('Phone:', row.company_phone);
        console.log('Email:', row.company_email);
        console.log('NPWP:', row.company_npwp);
        console.log('Updated At:', row.updated_at);
        console.log('');
    });

    // If more than 1 row, offer to clean up
    if (data.length > 1) {
        console.log('⚠️  Multiple rows detected! This may cause issues.');
        console.log('The most recent row (first one) will be kept.');

        // Delete old rows, keep the newest
        const idsToDelete = data.slice(1).map(row => row.id);
        console.log('\n🗑️  Deleting old rows:', idsToDelete);

        const { error: deleteError } = await supabase
            .from('company_settings')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.error('❌ Delete error:', deleteError.message);
        } else {
            console.log('✅ Old rows deleted successfully!');
        }
    }
}

checkCompanySettings();
