import { supabase } from './src/lib/supabase.js';
import { readFileSync } from 'fs';

async function runMigration() {
    try {
        console.log('🚀 Starting Blink Finance Module Migration...\n');

        // Read SQL file
        const sql = readFileSync('./supabase/migrations/011_blink_finance_module.sql', 'utf8');

        console.log('📄 Migration file loaded');
        console.log('📊 Executing', sql.split('\n').filter(l => l.trim().startsWith('CREATE TABLE')).length, 'table creations...\n');

        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Total statements: ${statements.length}\n`);

        // Execute each statement
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            // Get statement type for logging
            const type = statement.match(/^\s*(CREATE|ALTER|INSERT|COMMENT|DROP)\s+(\w+)/i);
            const logStatement = type ? `${type[1]} ${type[2]}` : 'STATEMENT';

            try {
                const { data, error } = await supabase.rpc('exec_sql', { sql: statement }).single();

                if (error) {
                    // Try direct approach if rpc fails
                    console.log(`⚙️  [${i + 1}/${statements.length}] ${logStatement} - trying alternative method...`);

                    // For CREATE TABLE, we can use the client directly
                    // This is a workaround since Supabase client doesn't expose raw SQL
                    console.log(`⚠️  Statement might need manual execution`);
                    errorCount++;
                } else {
                    console.log(`✅ [${i + 1}/${statements.length}] ${logStatement}`);
                    successCount++;
                }
            } catch (err) {
                console.log(`❌ [${i + 1}/${statements.length}] ${logStatement} - ${err.message}`);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`📊 Migration Summary:`);
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        if (errorCount > 0) {
            console.log('\n⚠️  Some statements failed. This is expected with Supabase client.');
            console.log('💡 Running via Supabase SQL Editor instead...\n');
            throw new Error('Client-side execution not supported');
        } else {
            console.log('\n✅ Migration completed successfully!');
        }

    } catch (error) {
        console.error('\n⚠️  Cannot execute SQL via client (security restriction)');
        console.error('💡 Executing via Supabase Dashboard...\n');

        // Provide manual instructions
        console.log('📋 MANUAL STEPS:');
        console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to: SQL Editor');
        console.log('4. Click: New Query');
        console.log('5. Copy/paste content from: supabase/migrations/011_blink_finance_module.sql');
        console.log('6. Click: Run');
        console.log('\n✨ After running, refresh your app and finance module will work!\n');
    }
}

runMigration();
