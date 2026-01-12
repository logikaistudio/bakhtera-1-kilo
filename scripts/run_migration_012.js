
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env variables manually since we are in a script
const envPath = path.resolve(__dirname, '../.env');
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envConfig = readFileSync(envPath, 'utf8');
    const lines = envConfig.split('\n');
    lines.forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].trim();
        }
        if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) {
            // Prefer Valid Service Role Key if available for DDL
            supabaseKey = line.split('=')[1].trim();
        } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=') && !supabaseKey) {
            supabaseKey = line.split('=')[1].trim();
        }
    });
} catch (e) {
    console.error('Error reading .env file:', e);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('🚀 Running 012_add_outbound_status.sql ...\n');

        const sqlPath = path.resolve(__dirname, '../supabase/migrations/012_add_outbound_status.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`Executing: ${statement}`);

            try {
                // Try RPC first
                const { error } = await supabase.rpc('exec_sql', { sql: statement });
                if (error) {
                    console.log(`RPC Error (expected if not enabled): ${error.message}`);
                    throw error;
                } else {
                    console.log('✅ Success via RPC');
                }
            } catch (err) {
                // Since we don't have direct SQL access via client without pg, 
                // and if RPC fails, we warn the user.
                console.error(`❌ Failed to execute: ${err.message}`);
                errorCount++;
            }
        }

        if (errorCount > 0) {
            console.log('\n⚠️  Migration encountered errors. Please check console.');
        } else {
            console.log('\n✅ Migration 012 completed successfully!');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
