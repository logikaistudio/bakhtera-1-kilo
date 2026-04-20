-- ============================================================
-- FIX 1: Add coa_id column to blink_journal_entries
-- ============================================================
ALTER TABLE blink_journal_entries
    ADD COLUMN IF NOT EXISTS coa_id UUID REFERENCES finance_coa(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_blink_je_coa_id ON blink_journal_entries(coa_id);

-- ============================================================
-- FIX 2: Create blink_ar_transactions table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS blink_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES blink_invoices(id) ON DELETE CASCADE,
    invoice_number TEXT,
    ar_number TEXT UNIQUE,
    customer_id UUID,
    customer_name TEXT,
    transaction_date DATE,
    due_date DATE,
    original_amount NUMERIC(15,2) DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    outstanding_amount NUMERIC(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC(12,4) DEFAULT 1,
    status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'partial', 'paid', 'overdue', 'cancelled', 'partially_paid', 'current', 'unpaid')),
    last_payment_date DATE,
    last_payment_amount NUMERIC(15,2),
    payment_method TEXT,
    payment_bank_account TEXT,
    payment_bank_account_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_blink_ar_invoice_id ON blink_ar_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_blink_ar_customer ON blink_ar_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_blink_ar_status ON blink_ar_transactions(status);

-- ============================================================
-- FIX 3: Create blink_ap_transactions table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS blink_ap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES blink_purchase_orders(id) ON DELETE CASCADE,
    po_number TEXT,
    ap_number TEXT UNIQUE,
    vendor_id UUID,
    vendor_name TEXT,
    bill_date DATE,
    due_date DATE,
    original_amount NUMERIC(15,2) DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    outstanding_amount NUMERIC(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC(12,4) DEFAULT 1,
    status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'partial', 'paid', 'overdue', 'cancelled')),
    last_payment_date DATE,
    last_payment_amount NUMERIC(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blink_ap_po_id ON blink_ap_transactions(po_id);
CREATE INDEX IF NOT EXISTS idx_blink_ap_vendor ON blink_ap_transactions(vendor_id);

-- ============================================================
-- Enable RLS (allow authenticated users to read/write)
-- ============================================================
ALTER TABLE blink_ar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blink_ap_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_ar" ON blink_ar_transactions;
CREATE POLICY "authenticated_all_ar" ON blink_ar_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_ap" ON blink_ap_transactions;
CREATE POLICY "authenticated_all_ap" ON blink_ap_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FIX 4: Create blink_approval_history table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS blink_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID,
    document_type VARCHAR(50), 
    document_number VARCHAR(100),
    action VARCHAR(50), 
    actor_role VARCHAR(50),
    actor_name VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Legacy/Compatibility fields
    approved_at TIMESTAMPTZ,
    approver VARCHAR(100),
    status VARCHAR(50),
    reason TEXT
);

ALTER TABLE blink_approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_approval_history" ON blink_approval_history;
CREATE POLICY "authenticated_all_approval_history" ON blink_approval_history
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

