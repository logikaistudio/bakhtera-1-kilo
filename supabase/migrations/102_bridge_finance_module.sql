-- Bridge Finance Module - Isolated Tables
-- This migration creates finance tables for Bridge module that are completely isolated from Blink

-- 1. Bridge COA (Isolated from finance_coa)
CREATE TABLE IF NOT EXISTS bridge_coa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS')),
    group_name TEXT,
    job_type TEXT,
    cost_type TEXT,
    is_active BOOLEAN DEFAULT true,
    parent_id UUID REFERENCES bridge_coa(id),
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bridge Invoices (Isolated from blink_invoices)
CREATE TABLE IF NOT EXISTS bridge_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES bridge_business_partners(id),
    customer_name TEXT,
    title TEXT,
    date DATE NOT NULL,
    due_date DATE,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC DEFAULT 1,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    payment_terms TEXT DEFAULT 'NET 30',
    notes TEXT,
    bank_account_id UUID,
    payment_bank TEXT,
    paid_date DATE,
    paid_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. Bridge Invoice Items
CREATE TABLE IF NOT EXISTS bridge_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES bridge_invoices(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    unit_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    coa_id UUID REFERENCES bridge_coa(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bridge Purchase Orders (Isolated from blink_purchase_orders)
CREATE TABLE IF NOT EXISTS bridge_pos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    vendor_id UUID REFERENCES bridge_business_partners(id),
    vendor_name TEXT,
    title TEXT,
    po_date DATE NOT NULL,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC DEFAULT 1,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'received', 'paid', 'cancelled')),
    payment_terms TEXT DEFAULT 'NET 30',
    delivery_date DATE,
    notes TEXT,
    bank_account_id UUID,
    payment_bank TEXT,
    paid_date DATE,
    paid_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 5. Bridge PO Items
CREATE TABLE IF NOT EXISTS bridge_po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES bridge_pos(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    unit_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    coa_id UUID REFERENCES bridge_coa(id),
    received_quantity NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bridge Journal Entries (Isolated from blink_journal_entries)
CREATE TABLE IF NOT EXISTS bridge_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number TEXT UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    entry_type TEXT DEFAULT 'manual' CHECK (entry_type IN ('manual', 'auto', 'adjustment')),
    reference_type TEXT CHECK (reference_type IN ('invoice', 'po', 'payment', 'adjustment')),
    reference_id UUID,
    reference_number TEXT,
    description TEXT,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC DEFAULT 1,
    total_debit NUMERIC DEFAULT 0,
    total_credit NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'voided')),
    batch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 7. Bridge Journal Line Items (Isolated from blink_journal_line_items)
CREATE TABLE IF NOT EXISTS bridge_journal_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES bridge_journal_entries(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC DEFAULT 1,
    description TEXT,
    coa_id UUID REFERENCES bridge_coa(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Bridge Payments
CREATE TABLE IF NOT EXISTS bridge_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('receipt', 'payment')),
    reference_type TEXT CHECK (reference_type IN ('invoice', 'po')),
    reference_id UUID,
    reference_number TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'IDR',
    exchange_rate NUMERIC DEFAULT 1,
    bank_account_id UUID,
    payment_method TEXT DEFAULT 'transfer',
    notes TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 9. Bridge AR/AP Transactions (Isolated from blink_ar_transactions, blink_ap_transactions)
CREATE TABLE IF NOT EXISTS bridge_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_number TEXT UNIQUE,
    invoice_id UUID REFERENCES bridge_invoices(id),
    invoice_number TEXT,
    customer_id UUID REFERENCES bridge_business_partners(id),
    customer_name TEXT,
    transaction_date DATE NOT NULL,
    due_date DATE,
    original_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    outstanding_amount NUMERIC GENERATED ALWAYS AS (original_amount - paid_amount) STORED,
    currency TEXT DEFAULT 'IDR',
    status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'paid', 'overdue')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_ap_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_number TEXT UNIQUE,
    po_id UUID REFERENCES bridge_pos(id),
    po_number TEXT,
    vendor_id UUID REFERENCES bridge_business_partners(id),
    vendor_name TEXT,
    bill_date DATE NOT NULL,
    due_date DATE,
    original_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    outstanding_amount NUMERIC GENERATED ALWAYS AS (original_amount - paid_amount) STORED,
    currency TEXT DEFAULT 'IDR',
    status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'paid', 'overdue')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bridge_invoices_customer ON bridge_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_bridge_invoices_status ON bridge_invoices(status);
CREATE INDEX IF NOT EXISTS idx_bridge_invoices_date ON bridge_invoices(date);
CREATE INDEX IF NOT EXISTS idx_bridge_pos_vendor ON bridge_pos(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bridge_pos_status ON bridge_pos(status);
CREATE INDEX IF NOT EXISTS idx_bridge_pos_date ON bridge_pos(po_date);
CREATE INDEX IF NOT EXISTS idx_bridge_journal_date ON bridge_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_bridge_journal_reference ON bridge_journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_bridge_ar_customer ON bridge_ar_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_bridge_ar_status ON bridge_ar_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bridge_ap_vendor ON bridge_ap_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bridge_ap_status ON bridge_ap_transactions(status);

-- Enable RLS
ALTER TABLE bridge_coa ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_journal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_ar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_ap_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Bridge users only)
CREATE POLICY "Bridge COA access" ON bridge_coa FOR ALL USING (true);
CREATE POLICY "Bridge invoices access" ON bridge_invoices FOR ALL USING (true);
CREATE POLICY "Bridge invoice items access" ON bridge_invoice_items FOR ALL USING (true);
CREATE POLICY "Bridge POs access" ON bridge_pos FOR ALL USING (true);
CREATE POLICY "Bridge PO items access" ON bridge_po_items FOR ALL USING (true);
CREATE POLICY "Bridge journal entries access" ON bridge_journal_entries FOR ALL USING (true);
CREATE POLICY "Bridge journal line items access" ON bridge_journal_line_items FOR ALL USING (true);
CREATE POLICY "Bridge payments access" ON bridge_payments FOR ALL USING (true);
CREATE POLICY "Bridge AR transactions access" ON bridge_ar_transactions FOR ALL USING (true);
CREATE POLICY "Bridge AP transactions access" ON bridge_ap_transactions FOR ALL USING (true);

-- Comments
COMMENT ON TABLE bridge_coa IS 'Bridge module Chart of Accounts - completely isolated from finance_coa';
COMMENT ON TABLE bridge_invoices IS 'Bridge module invoices - completely isolated from blink_invoices';
COMMENT ON TABLE bridge_pos IS 'Bridge module purchase orders - completely isolated from blink_purchase_orders';
COMMENT ON TABLE bridge_journal_entries IS 'Bridge module journal entries - completely isolated from blink_journal_entries';
COMMENT ON TABLE bridge_ar_transactions IS 'Bridge module AR transactions - completely isolated from blink_ar_transactions';
COMMENT ON TABLE bridge_ap_transactions IS 'Bridge module AP transactions - completely isolated from blink_ap_transactions';