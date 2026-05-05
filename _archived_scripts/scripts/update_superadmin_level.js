import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !supabaseServiceKey)) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

// Use service key if available, otherwise anon key
const key = supabaseServiceKey || supabaseKey;
const supabase = createClient(supabaseUrl, key);

async function fixUserLevelConstraint() {
    try {
        console.log('Step 1: Dropping old constraint...');

        // Drop the old constraint
        const dropResult = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_level_check;'
        });

        if (dropResult.error) {
            console.log('Note: Could not drop constraint via RPC (expected if RPC not available)');
        }

        console.log('Step 2: Adding new constraint with correct values...');

        // Add new constraint with all correct values
        const addResult = await supabase.rpc('exec_sql', {
            sql: `ALTER TABLE users ADD CONSTRAINT users_user_level_check 
                  CHECK (user_level IN ('super_admin', 'admin', 'manager', 'staff', 'view_only', 'direksi', 'chief', 'viewer'));`
        });

        if (addResult.error) {
            console.log('Note: Could not add constraint via RPC');
        }

        console.log('Step 3: Updating superadmin user level...');

        // Now update the user
        const { data, error } = await supabase
            .from('users')
            .update({ user_level: 'super_admin' })
            .eq('username', 'superadmin')
            .select();

        if (error) {
            console.error('❌ Error updating user:', error.message);
            console.error('Full error:', error);
            process.exit(1);
        }

        console.log('✅ Successfully updated superadmin user level to "super_admin"');
        console.log('Updated user:', data);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

fixUserLevelConstraint();
