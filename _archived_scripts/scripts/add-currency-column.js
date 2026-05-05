// Add Currency Column to blink_shipments via Script
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🔧 Adding currency column to blink_shipments...\n');

async function addCurrencyColumn() {
    try {
        // Execute SQL to add column
        const { data, error } = await supabase.rpc('exec', {
            sql: `
                ALTER TABLE blink_shipments 
                ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
                
                UPDATE blink_shipments 
                SET currency = 'USD' 
                WHERE currency IS NULL;
            `
        });

        if (error) {
            console.log('⚠️  Using alternative method...');
            // Alternative: Just document it needs manual execution
            console.log('Please run this SQL in Supabase Dashboard:\n');
            console.log('ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT \'USD\';\n');
        } else {
            console.log('✅ Currency column added!\n');
        }

    } catch (error) {
        console.log('ℹ️  Run this SQL manually in Supabase Dashboard:\n');
        console.log('--------------------------------------------------');
        console.log('ALTER TABLE blink_shipments');
        console.log('ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT \'USD\';');
        console.log('--------------------------------------------------\n');
    }
}

addCurrencyColumn();
