import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const runMigration = async () => {
    console.log('🚀 Starting Database Cleanup...');

    // SQL to remove columns if they exist to avoid conflict
    const sql = `
        ALTER TABLE freight_quotations 
        DROP COLUMN IF EXISTS source_pengajuan_number,
        DROP COLUMN IF EXISTS source_bc_document_number,
        DROP COLUMN IF EXISTS source_bc_document_date;
    `;

    console.log('📝 Executing SQL...');
    console.log(sql);

    // We cannot execute DDL directly via supabase-js client usually, 
    // but we will try remote Procedure or just print for manual execution if it fails.
    // In this environment, we usually print instructions.

    console.log('\n⚠️  IMPORTANT: Supabase JS Client cannot execute DDL (ALTER TABLE) directly.');
    console.log('👉 Please run the following SQL in your Supabase SQL Editor:\n');
    console.log(sql);

    console.log('\n✅ Script finished (Manual Action Required)');
};

runMigration().catch(console.error);
