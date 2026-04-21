-- BIG Event Organizer Database Schema
-- CORRECTED: Uses freight_customers/freight_vendors with TEXT id

CREATE TABLE IF NOT EXISTS big_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    client_id TEXT REFERENCES freight_customers(id),
    event_date DATE,
    event_end_date DATE,
    venue TEXT,
    status TEXT DEFAULT 'planning',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number TEXT UNIQUE,
    event_id UUID REFERENCES big_events(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES freight_customers(id),
    quotation_date DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 11,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES big_quotations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    unit_price DECIMAL(15,2) DEFAULT 0,
    amount DECIMAL(15,2) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE,
    quotation_id UUID REFERENCES big_quotations(id),
    event_id UUID REFERENCES big_events(id),
    client_id TEXT REFERENCES freight_customers(id),
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 11,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'draft',
    coa_revenue_id UUID REFERENCES finance_coa(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES big_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    unit_price DECIMAL(15,2) DEFAULT 0,
    amount DECIMAL(15,2) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES big_events(id) ON DELETE CASCADE,
    cost_number TEXT UNIQUE,
    description TEXT NOT NULL,
    vendor_id TEXT REFERENCES freight_vendors(id),
    cost_date DATE DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    coa_expense_id UUID REFERENCES finance_coa(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS big_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES big_invoices(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES freight_customers(id),
    transaction_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    original_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    outstanding_amount DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'outstanding',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE big_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_ar_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all big_events" ON big_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_quotations" ON big_quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_quotation_items" ON big_quotation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_invoices" ON big_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_invoice_items" ON big_invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_costs" ON big_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all big_ar_transactions" ON big_ar_transactions FOR ALL USING (true) WITH CHECK (true);
