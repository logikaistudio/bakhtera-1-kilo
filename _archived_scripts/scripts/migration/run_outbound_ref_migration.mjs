import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const runMigration = async () => {
    console.log('🚀 Generating Migration SQL...');

    const sql = `
    ALTER TABLE freight_quotations 
    ADD COLUMN IF NOT EXISTS source_pengajuan_number TEXT,
    ADD COLUMN IF NOT EXISTS source_bc_document_number TEXT,
    ADD COLUMN IF NOT EXISTS source_bc_document_date TIMESTAMP;

    COMMENT ON COLUMN freight_quotations.source_pengajuan_number IS 'Reference to original inbound pengajuan number';
    COMMENT ON COLUMN freight_quotations.source_bc_document_number IS 'Reference to original inbound BC document number';
    `;

    console.log('\n📋 Please run this SQL in Supabase SQL Editor:');
    console.log('------------------------------------------------');
    console.log(sql);
    console.log('------------------------------------------------');
};

runMigration();
