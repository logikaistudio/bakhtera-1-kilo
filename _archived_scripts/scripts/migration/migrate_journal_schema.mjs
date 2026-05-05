import { config } from 'dotenv';
import { Client } from 'pg';

config();

const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or PG_CONNECTION_STRING in environment.');
    process.exit(1);
}

const client = new Client({ connectionString });

async function run() {
    await client.connect();
    try {
        console.log('🔧 Starting journal schema migration...');
        await client.query('BEGIN');

        console.log('✅ Creating finance_periods table if missing...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS finance_periods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                year INTEGER NOT NULL,
                month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
                closed_at TIMESTAMPTZ,
                closed_by TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(year, month)
            );
        `);

        console.log('✅ Altering blink_journal_entries table to add new metadata columns...');
        await client.query(`ALTER TABLE blink_journal_entries
            ADD COLUMN IF NOT EXISTS journal_type TEXT CHECK (journal_type IN ('auto', 'reversal', 'general', 'note')) DEFAULT 'auto',
            ADD COLUMN IF NOT EXISTS cash_direction TEXT CHECK (cash_direction IN ('cash_in', 'cash_out', 'bank_in', 'bank_out', 'other')) DEFAULT 'other',
            ADD COLUMN IF NOT EXISTS period_month INTEGER,
            ADD COLUMN IF NOT EXISTS period_year INTEGER,
            ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(18,2),
            ADD COLUMN IF NOT EXISTS foreign_currency TEXT DEFAULT 'IDR',
            ADD COLUMN IF NOT EXISTS reversal_of_batch_id TEXT,
            ADD COLUMN IF NOT EXISTS is_kbi_transaction BOOLEAN DEFAULT FALSE;
        `);

        console.log('✅ Populating period_month and period_year from entry_date...');
        await client.query(`
            UPDATE blink_journal_entries
            SET period_month = EXTRACT(MONTH FROM entry_date)::INTEGER,
                period_year = EXTRACT(YEAR FROM entry_date)::INTEGER
            WHERE period_month IS NULL OR period_year IS NULL;
        `);

        console.log('✅ Normalizing journal_type, cash_direction, and foreign fields...');
        await client.query(`
            UPDATE blink_journal_entries
            SET journal_type = COALESCE(journal_type, 'auto'),
                cash_direction = COALESCE(cash_direction, 'other'),
                foreign_currency = COALESCE(foreign_currency, currency, 'IDR'),
                is_kbi_transaction = COALESCE(is_kbi_transaction, false);
        `);

        console.log('✅ Committing migration.');
        await client.query('COMMIT');
        console.log('🎉 Journal schema migration completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

run().catch(err => {
    console.error('❌ Migration execution error:', err);
    process.exit(1);
});
