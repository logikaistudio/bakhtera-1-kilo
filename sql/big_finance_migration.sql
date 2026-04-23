-- ============================================================
-- Bridge Finance Tables Migration
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 0. big_coa (Chart of Accounts Bridge) — buat jika belum ada
CREATE TABLE IF NOT EXISTS big_coa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE','COGS')),
    normal_balance TEXT DEFAULT 'DEBIT',
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    parent_id UUID REFERENCES big_coa(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. big_invoices
CREATE TABLE IF NOT EXISTS big_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    payment_terms TEXT DEFAULT 'NET 30',
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    customer_id UUID,
    currency TEXT DEFAULT 'IDR',
    invoice_items JSONB DEFAULT '[]',
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    grand_total NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    paid_amount NUMERIC(18,2) DEFAULT 0,
    outstanding_amount NUMERIC(18,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','paid','overdue','cancelled')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. big_pos (Purchase Orders)
CREATE TABLE IF NOT EXISTS big_pos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    po_date DATE NOT NULL,
    due_date DATE,
    payment_terms TEXT DEFAULT 'NET 30',
    vendor_name TEXT NOT NULL,
    vendor_address TEXT,
    vendor_id UUID,
    currency TEXT DEFAULT 'IDR',
    po_items JSONB DEFAULT '[]',
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    grand_total NUMERIC(18,2) DEFAULT 0,
    paid_amount NUMERIC(18,2) DEFAULT 0,
    outstanding_amount NUMERIC(18,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','paid','cancelled')),
    approval_status TEXT DEFAULT 'draft',
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. big_ar_transactions
CREATE TABLE IF NOT EXISTS big_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_number TEXT UNIQUE,
    invoice_id UUID REFERENCES big_invoices(id) ON DELETE SET NULL,
    invoice_number TEXT,
    customer_name TEXT NOT NULL,
    customer_id UUID,
    transaction_date DATE NOT NULL,
    due_date DATE,
    original_amount NUMERIC(18,2) DEFAULT 0,
    paid_amount NUMERIC(18,2) DEFAULT 0,
    outstanding_amount NUMERIC(18,2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC(12,6) DEFAULT 1,
    status TEXT DEFAULT 'current' CHECK (status IN ('current','partial','paid','overdue')),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. big_ap_transactions
CREATE TABLE IF NOT EXISTS big_ap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_number TEXT UNIQUE,
    po_id UUID REFERENCES big_pos(id) ON DELETE SET NULL,
    po_number TEXT,
    vendor_name TEXT NOT NULL,
    vendor_id UUID,
    transaction_date DATE NOT NULL,
    due_date DATE,
    original_amount NUMERIC(18,2) DEFAULT 0,
    paid_amount NUMERIC(18,2) DEFAULT 0,
    outstanding_amount NUMERIC(18,2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC(12,6) DEFAULT 1,
    status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding','partial','paid','overdue')),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. big_payments (AR & AP payments)
CREATE TABLE IF NOT EXISTS big_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('incoming','outgoing')),
    payment_date DATE NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    reference_number TEXT,
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT DEFAULT 'IDR',
    payment_method TEXT DEFAULT 'bank_transfer',
    bank_account TEXT,
    transaction_ref TEXT,
    description TEXT,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. big_journal_entries (sudah ada, pastikan struktur benar)
CREATE TABLE IF NOT EXISTS big_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    reference_number TEXT,
    total_debit NUMERIC(18,2) DEFAULT 0,
    total_credit NUMERIC(18,2) DEFAULT 0,
    entry_type TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'posted',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. big_journal_line_items
CREATE TABLE IF NOT EXISTS big_journal_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES big_journal_entries(id) ON DELETE CASCADE,
    coa_id UUID,
    description TEXT,
    debit NUMERIC(18,2) DEFAULT 0,
    credit NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK to big_coa only if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'big_journal_line_items_coa_id_fkey'
    ) THEN
        ALTER TABLE big_journal_line_items
            ADD CONSTRAINT big_journal_line_items_coa_id_fkey
            FOREIGN KEY (coa_id) REFERENCES big_coa(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- Auto-update timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER big_invoices_updated_at BEFORE UPDATE ON big_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER big_pos_updated_at BEFORE UPDATE ON big_pos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- RLS (Disable untuk development, enable per kebutuhan)
-- ============================================================
ALTER TABLE big_coa DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_pos DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_ar_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_ap_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_journal_line_items DISABLE ROW LEVEL SECURITY;
