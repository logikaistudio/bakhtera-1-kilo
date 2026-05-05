// Temporary migration script to add notes column to blink_shipments
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Use the correct Supabase project from the app
const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDUzNTAsImV4cCI6MjA0OTkyMTM1MH0.PO_Ci0xNGDpyLmYTjQoMjPewZ9H3yZu7MFMGBq3OdyI';

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationSQL = readFileSync('supabase/migrations/015_add_notes_to_shipments.sql', 'utf8');

console.log('🔄 Running migration: 015_add_notes_to_shipments.sql');
console.log('📍 Project:', supabaseUrl);

try {
    // Execute the SQL directly
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } else {
        console.log('✅ Migration successful!');
        console.log('✅ Column "notes" added to blink_shipments table');
    }
} catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
}
