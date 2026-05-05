// Quick script to run migration
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationSQL = readFileSync('supabase/migrations/010_add_shipping_details_to_shipments.sql', 'utf8');

console.log('Running migration...');
const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

if (error) {
    console.error('Migration failed:', error);
} else {
    console.log('Migration successful!');
}
