import { createClient } from '@supabase/supabase-js';

// Supabase configuration with service role key for DDL operations
const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 Running migration: 045_add_outbound_source_reference.sql');
    console.log('📍 Target:', supabaseUrl);

    try {
        // Execute each ALTER TABLE statement separately
        const statements = [
            // Add source_pengajuan_id
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS source_pengajuan_id TEXT`,

            // Add source_pengajuan_number
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS source_pengajuan_number TEXT`,

            // Add source_bc_document_number
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS source_bc_document_number TEXT`,

            // Add source_bc_document_date
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS source_bc_document_date DATE`,

            // Add outbound_status
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS outbound_status TEXT DEFAULT 'pending'`,

            // Add approved_date
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS approved_date DATE`,

            // Add approved_by
            `ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS approved_by TEXT`,
        ];

        for (const sql of statements) {
            console.log('\n📝 Executing:', sql.substring(0, 60) + '...');
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

            if (error) {
                // Try alternative method - direct query
                console.log('⚠️ RPC not available, trying direct...');
            }
        }

        // Verify columns exist by querying table info
        console.log('\n🔍 Verifying migration...');
        const { data, error: verifyError } = await supabase
            .from('freight_quotations')
            .select('source_pengajuan_id, source_pengajuan_number, source_bc_document_number, outbound_status')
            .limit(1);

        if (verifyError) {
            console.log('⚠️ Verification query error (columns may not exist yet):', verifyError.message);
            console.log('\n📋 Please run the following SQL manually in Supabase Dashboard > SQL Editor:');
            console.log('─'.repeat(60));
            statements.forEach(s => console.log(s + ';'));
            console.log('─'.repeat(60));
        } else {
            console.log('✅ Migration verified! Columns exist in freight_quotations');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    }
}

runMigration();
