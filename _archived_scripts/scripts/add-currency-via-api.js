// Execute ALTER TABLE via Supabase REST API
import fetch from 'node-fetch';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

console.log('🔧 Executing ALTER TABLE via REST API...\n');

async function addCurrencyColumn() {
    try {
        // Try using pg_catalog to execute SQL
        const sql = `
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'blink_shipments' AND column_name = 'currency'
                ) THEN
                    ALTER TABLE blink_shipments ADD COLUMN currency TEXT DEFAULT 'USD';
                    RAISE NOTICE 'Currency column added';
                ELSE
                    RAISE NOTICE 'Currency column already exists';
                END IF;
            END $$;
        `;

        console.log('📝 SQL to execute:');
        console.log(sql);
        console.log('');

        // Execute via rpc if available
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({ query: sql })
        });

        const result = await response.text();
        console.log('Response:', response.status, result);

        if (response.ok) {
            console.log('\n✅ SQL executed successfully!\n');
        } else {
            console.log('\n⚠️  REST API method not available');
            console.log('Using alternative: File-based migration\n');

            // Create migration file
            const migrationSQL = `-- Add currency column to blink_shipments
-- Migration: 008_add_currency_column
-- Date: 2025-12-30

-- Add currency column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blink_shipments' AND column_name = 'currency'
    ) THEN
        ALTER TABLE blink_shipments ADD COLUMN currency TEXT DEFAULT 'USD';
        RAISE NOTICE 'Currency column added successfully';
    ELSE
        RAISE NOTICE 'Currency column already exists';
    END IF;
END $$;

-- Update existing records
UPDATE blink_shipments SET currency = 'USD' WHERE currency IS NULL;

-- Add comment
COMMENT ON COLUMN blink_shipments.currency IS 'Currency code (USD/IDR/etc)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Migration complete!' as status;
`;

            console.log('📄 Migration file content saved to:');
            console.log('   supabase/migrations/008_add_currency_column.sql\n');
            console.log('🔑 Please run this SQL in Supabase Dashboard:\n');
            console.log('═══════════════════════════════════════');
            console.log(migrationSQL);
            console.log('═══════════════════════════════════════\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n📋 MANUAL STEPS REQUIRED:\n');
        console.log('1. Go to: https://nkyoszmtyrpdwfjxggmb.supabase.co/project/_/sql');
        console.log('2. Paste this SQL:\n');
        console.log('   ALTER TABLE blink_shipments ADD COLUMN currency TEXT DEFAULT \'USD\';\n');
        console.log('3. Click RUN\n');
        console.log('4. Hard refresh browser (Cmd+Shift+R)\n');
    }
}

addCurrencyColumn();
