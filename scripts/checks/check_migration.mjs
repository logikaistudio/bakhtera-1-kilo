// Simple migration script - add notes column to blink_shipments
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envFile = readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    console.error('Present keys:', Object.keys(envVars));
    process.exit(1);
}

console.log('🔄 Connecting to Supabase...');
console.log('📍 URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

// Check if column exists by trying to select it
console.log('\n🔍 Checking if notes column exists...');
const { data: testData, error: testError } = await supabase
    .from('blink_shipments')
    .select('notes')
    .limit(1);

if (testError) {
    if (testError.message.includes('column') && testError.message.includes('does not exist')) {
        console.log('❌ Column "notes" does not exist');
        console.log('\n📝 SQL needed:');
        console.log('ALTER TABLE blink_shipments ADD COLUMN notes TEXT;');
        console.log('\n⚠️  Please run this in Supabase SQL Editor manually.');
    } else {
        console.error('❌ Unexpected error:', testError);
    }
    process.exit(1);
} else {
    console.log('✅ Column "notes" already exists!');
    console.log('✅ No migration needed - you can create Sales Orders now.');
}
