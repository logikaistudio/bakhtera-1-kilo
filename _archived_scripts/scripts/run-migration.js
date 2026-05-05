// Auto-execute Supabase Migration
import { supabase } from './src/lib/supabase.js';
import fs from 'fs';

console.log('🚀 Starting Supabase migration...');

// Read migration SQL
const migrationSQL = fs.readFileSync(
    '/Users/hoeltz/Documents/GitHub/FreightOne/supabase/migrations/006_blink_module_schema.sql',
    'utf8'
);

console.log('📄 Migration SQL loaded');

// Try to execute via RPC (requires pg_execute function in Supabase)
async function runMigration() {
    try {
        // Attempt 1: Use raw SQL execution if available
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            console.error('❌ RPC Method failed:', error.message);
            console.log('\n⚠️  This is expected - need manual execution via Dashboard');
            console.log('\n📋 SOLUTION:');
            console.log('1. Open: https://nkyoszmtyrpdwfjxggmb.supabase.co');
            console.log('2. Go to SQL Editor → New Query');
            console.log('3. Copy-paste from: supabase/migrations/006_blink_module_schema.sql');
            console.log('4. Click Run');
            return false;
        }

        console.log('✅ Migration executed successfully!');
        console.log('Data:', data);
        return true;

    } catch (err) {
        console.error('❌ Error:', err.message);
        return false;
    }
}

runMigration();
