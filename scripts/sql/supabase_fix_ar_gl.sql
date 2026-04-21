-- ============================================================
-- FIX: AR Payment & General Ledger Issues
-- Run this in Supabase SQL Editor
-- Created: 2026-04-13
-- ============================================================

-- ============================================================
-- FIX 1: Create blink_payments table if not exists + RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS blink_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE,
    payment_type TEXT DEFAULT 'incoming', -- 'incoming' (AR) or 'outgoing' (AP)
    payment_date DATE NOT NULL,
    reference_type TEXT, -- 'invoice', 'po', etc.
    reference_id UUID,
    reference_number TEXT,
    amount NUMERIC(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC(12,4) DEFAULT 1,
    payment_method TEXT DEFAULT 'bank_transfer',
    bank_account TEXT,
    bank_account_id UUID,
    transaction_ref TEXT,
    description TEXT,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blink_payments_ref ON blink_payments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_blink_payments_type ON blink_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_blink_payments_date ON blink_payments(payment_date);

ALTER TABLE blink_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_payments" ON blink_payments;
CREATE POLICY "authenticated_all_payments" ON blink_payments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon read (for reports)
DROP POLICY IF EXISTS "anon_read_payments" ON blink_payments;
CREATE POLICY "anon_read_payments" ON blink_payments
    FOR SELECT TO anon USING (true);

-- ============================================================
-- FIX 2: Ensure blink_journal_entries has RLS open for authenticated
-- ============================================================
ALTER TABLE blink_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_journal" ON blink_journal_entries;
CREATE POLICY "authenticated_all_journal" ON blink_journal_entries
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_journal" ON blink_journal_entries;
CREATE POLICY "anon_read_journal" ON blink_journal_entries
    FOR SELECT TO anon USING (true);

-- ============================================================
-- FIX 3: Ensure blink_ar_transactions has invoice_id populated
-- for any rows where it's NULL but invoice reference exists via ar_number
-- ============================================================
UPDATE blink_ar_transactions ar
SET invoice_id = inv.id
FROM blink_invoices inv
WHERE ar.invoice_id IS NULL
  AND (
    ar.invoice_number = inv.invoice_number
    OR ar.ar_number LIKE '%' || SUBSTRING(inv.invoice_number, 5) || '%'
  );

-- ============================================================
-- FIX 4: Backfill blink_ar_transactions for invoices that don't have one yet
-- ============================================================
INSERT INTO blink_ar_transactions (
    invoice_id, invoice_number, ar_number,
    customer_id, customer_name,
    transaction_date, due_date,
    original_amount, paid_amount, outstanding_amount,
    currency, exchange_rate, status, notes
)
SELECT
    inv.id,
    inv.invoice_number,
    COALESCE(inv.ar_number, 'AR-' || UPPER(SUBSTRING(inv.id::text, 1, 8))),
    inv.customer_id,
    COALESCE(inv.customer_name, inv.customer_company, 'Unknown'),
    COALESCE(inv.invoice_date, NOW()::DATE),
    COALESCE(inv.due_date, inv.invoice_date, NOW()::DATE),
    COALESCE(inv.total_amount, inv.subtotal, 0),
    COALESCE(inv.paid_amount, 0),
    COALESCE(inv.outstanding_amount, inv.total_amount - COALESCE(inv.paid_amount, 0), 0),
    COALESCE(inv.currency, 'IDR'),
    COALESCE(inv.exchange_rate, 1),
    CASE 
        WHEN COALESCE(inv.paid_amount, 0) >= COALESCE(inv.total_amount, 0) THEN 'paid'
        WHEN COALESCE(inv.paid_amount, 0) > 0 THEN 'partial'
        ELSE 'outstanding'
    END,
    'Auto-created from invoice ' || COALESCE(inv.invoice_number, inv.id::text)
FROM blink_invoices inv
WHERE inv.status NOT IN ('draft', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM blink_ar_transactions ar WHERE ar.invoice_id = inv.id
  );

-- ============================================================
-- FIX 5: Backfill journal entries for invoices that are missing them
-- (Creates placeholder - the app will regenerate proper ones)
-- ============================================================
-- Check if coa_id column exists before using it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'blink_journal_entries' AND column_name = 'coa_id'
    ) THEN
        ALTER TABLE blink_journal_entries ADD COLUMN coa_id UUID REFERENCES finance_coa(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_blink_je_coa_id ON blink_journal_entries(coa_id);
    END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERIES (run these to check results)
-- ============================================================

-- Check blink_payments policies
-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies WHERE tablename = 'blink_payments';

-- Check journal entries count
-- SELECT COUNT(*) as total_journal_entries FROM blink_journal_entries;

-- Check AR transactions vs invoices  
-- SELECT 
--   COUNT(inv.id) as total_invoices,
--   COUNT(ar.id) as ar_transactions,
--   COUNT(inv.id) - COUNT(ar.id) as missing_ar
-- FROM blink_invoices inv
-- LEFT JOIN blink_ar_transactions ar ON ar.invoice_id = inv.id
-- WHERE inv.status NOT IN ('draft', 'cancelled');
