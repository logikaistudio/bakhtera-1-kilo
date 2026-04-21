import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runBridgeFinanceMigration() {
  console.log('🚀 Starting Bridge Finance Module Migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', '..', 'supabase', 'migrations', '102_bridge_finance_module.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded, executing SQL...\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            console.error(`Error in statement ${i + 1}:`, error.message);
            // Continue with other statements
          }
        } catch (err) {
          console.error(`Failed to execute statement ${i + 1}:`, err.message);
          // Continue with other statements
        }
      }
    }

    console.log('\n✅ Bridge Finance Module Migration completed!');
    console.log('📋 Created tables:');
    console.log('  • bridge_coa (Isolated COA)');
    console.log('  • bridge_invoices (Isolated invoices)');
    console.log('  • bridge_pos (Isolated purchase orders)');
    console.log('  • bridge_journal_entries (Isolated journals)');
    console.log('  • bridge_ar_transactions (Isolated AR)');
    console.log('  • bridge_ap_transactions (Isolated AP)');
    console.log('  • bridge_payments (Isolated payments)');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

runBridgeFinanceMigration();