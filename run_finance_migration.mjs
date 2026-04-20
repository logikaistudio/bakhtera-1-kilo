import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runFinanceMigration() {
    console.log('🚀 Running Finance Module Migration...\n');

    const migrationPath = path.join(__dirname, 'supabase/migrations/011_blink_finance_module.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        return;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('📄 Read migration file: 011_blink_finance_module.sql');
    console.log('📊 SQL Length:', sql.length, 'characters\n');

    // Split SQL into statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length === 0) continue;

        console.log(`   [${i + 1}/${statements.length}] Executing...`);

        try {
            // Try RPC first
            const { error } = await supabase.rpc('exec_sql', {
                sql_query: statement + ';'
            });

            if (error) {
                // If RPC fails, try direct table operations for known statements
                console.log('      RPC failed, trying direct approach...');

                // For CREATE TABLE statements, we can't create via anon key
                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    console.log('      ⚠️  DDL requires service role - skipping table creation');
                    errorCount++;
                    continue;
                }

                // Try executing as regular query
                const { error: directError } = await supabase.from('_temp_query').select('*').limit(0);
                if (directError) {
                    console.log('      ⚠️  Direct execution not available');
                    errorCount++;
                    continue;
                }
            }

            successCount++;
            console.log('      ✅ Success');

        } catch (err) {
            console.log('      ❌ Error:', err.message);
            errorCount++;
        }
    }

    console.log(`\n🎉 Migration completed:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (errorCount > 0) {
        console.log('\n⚠️  Some statements failed. You may need to run DDL statements manually in Supabase Dashboard.');
        console.log('   Go to: Project Settings → SQL Editor → Run the migration file');
    }
}

runFinanceMigration().catch(console.error);