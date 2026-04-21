import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('🚀 Applying Bridge Aging View Migration...');

    try {
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '062_add_bridge_aging_view.sql');
        const sqlContent = readFileSync(sqlPath, 'utf8');

        console.log('📄 SQL file loaded.');

        // Try to execute via exec_sql RPC if available
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql: sqlContent });

        if (rpcError) {
            console.warn('⚠️  RPC exec_sql failed:', rpcError.message);
            console.log('🔄 Attempting direct SQL execution via statement splitting...');

            // Split by semicolon, naive approach but works for simple views
            const statements = sqlContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const statement of statements) {
                // Determine if it's a valid statement
                if (statement.startsWith('--') || statement.startsWith('/*')) continue;

                console.log(`▶️ Executing: ${statement.substring(0, 50)}...`);
                // Use a direct query fallback or just warn the user
                // Actually, without exec_sql, we can't run DDL via the JS client easily unless we have a specific function.
                // But we can try the `rpc` again with individual statements if the error was due to complexity? 
                // No, if the RPC doesn't exist, we can't run SQL from here.

                console.error('❌ Cannot execute DDL (CREATE VIEW) via standard Supabase client without a helper function.');
                throw new Error('Please run the migration manually in the Supabase Dashboard SQL Editor.');
            }
        }

        console.log('✅ Migration executed successfully!');

        // Verification
        const { data, error: verifyError } = await supabase
            .from('view_bridge_aging_monitor')
            .select('count', { count: 'exact', head: true });

        if (!verifyError) {
            console.log('🎉 Verification successful: View exists and is accessible.');
        } else {
            console.warn('⚠️  Verification warning: View might be created but not accessible:', verifyError.message);
        }

    } catch (err) {
        console.error('\n❌ Migration Failed:', err.message);
        console.log('\n👉 ACTION REQUIRED:');
        console.log('1. Open your Supabase Dashboard');
        console.log('2. Go to the SQL Editor');
        console.log('3. Copy the contents of: supabase/migrations/062_add_bridge_aging_view.sql');
        console.log('4. Run the query.');
    }
}

applyMigration();
