-- Invoice Module Database Schema
-- Invoicing & Payment Tracking for Blink
-- Created: 2025-12-30

-- ============================================================================
-- 1. INVOICES Table
-- ============================================================================
-- Purpose: Store sales invoices with detailed line items and payment tracking
-- Used by: InvoiceManagement
-- Flow: Draft → Sent → Partially Paid → Paid / Overdue / Cancelled

CREATE TABLE IF NOT EXISTS blink_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-2025-0001
    quotation_id UUID REFERENCES blink_quotations(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES blink_shipments(id) ON DELETE SET NULL,
    job_number VARCHAR(50) NOT NULL,
    so_number VARCHAR(50),
    
    -- Customer Information
    customer_id UUID,
    customer_name VARCHAR(255) NOT NULL,
    customer_company VARCHAR(255),
    customer_address TEXT,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Invoice Details
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(100) DEFAULT 'NET 30',  -- NET 7, NET 14, NET 30, NET 60
    
    -- Route & Service Reference
    origin VARCHAR(255),
    destination VARCHAR(255),
    service_type VARCHAR(20),
    cargo_details JSONB,                          -- {weight, volume, commodity, containers}
    booking_details JSONB,                        -- {vessel, voyage, pol, pod, etd, eta}
    
    -- Invoice Items (Detailed Breakdown)
    invoice_items JSONB NOT NULL,
    -- Example: [
    --   {description: "Ocean Freight", qty: 20, unit: "CBM", rate: 50, amount: 1000},
    --   {description: "THC - Port", qty: 1, unit: "Job", rate: 300, amount: 300}
    -- ]
    
    -- Financial Calculations
    currency VARCHAR(10) DEFAULT 'IDR',
    subtotal DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 11.00,          -- PPN percentage
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_reason TEXT,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Tracking
    paid_amount DECIMAL(15,2) DEFAULT 0,
    outstanding_amount DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'draft',
    -- draft → sent → partially_paid → paid → overdue → cancelled
    
    -- Payment Banking Info
    bank_account_id UUID,
    bank_details JSONB,                            -- {bankName, accountName, accountNumber, swiftCode}
    
    -- Additional Info
    notes TEXT,
    customer_notes TEXT,
    
    -- Document Management
    pdf_url TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Added later: rejection columns (kept in separate migration 010)

-- Indexes
CREATE INDEX idx_blink_invoices_invoice_number ON blink_invoices(invoice_number);
CREATE INDEX idx_blink_invoices_job_number ON blink_invoices(job_number);
CREATE INDEX idx_blink_invoices_customer_id ON blink_invoices(customer_id);
CREATE INDEX idx_blink_invoices_status ON blink_invoices(status);
CREATE INDEX idx_blink_invoices_due_date ON blink_invoices(due_date);
CREATE INDEX idx_blink_invoices_invoice_date ON blink_invoices(invoice_date);

-- RLS Policies
ALTER TABLE blink_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON blink_invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON blink_invoices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON blink_invoices
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================================
-- 2. PAYMENTS Table
-- ============================================================================
-- Purpose: Track payments received for invoices
-- Used by: InvoiceManagement (Payment Recording)
-- Relationship: One invoice can have multiple payments (partial payments)

CREATE TABLE IF NOT EXISTS blink_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    invoice_id UUID REFERENCES blink_invoices(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) UNIQUE,            -- PMT-2025-0001
    
    -- Payment Details
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    exchange_rate DECIMAL(10,2),
    
    -- Payment Method
    payment_method VARCHAR(50),                    -- bank_transfer, cash, check, credit_card
    reference_number VARCHAR(255),
    
    -- Bank Details
    received_in_account VARCHAR(255),
    
    -- Proof of Payment
    proof_of_payment_url TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_blink_payments_invoice_id ON blink_payments(invoice_id);
CREATE INDEX idx_blink_payments_payment_date ON blink_payments(payment_date);

-- RLS Policies
ALTER TABLE blink_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON blink_payments
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. BANK_ACCOUNTS Table
-- ============================================================================
-- Purpose: Store company bank accounts for invoice payment details
-- Used by: InvoiceManagement (Settings)

CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    bank_name VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    swift_code VARCHAR(20),
    branch VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'IDR',
    
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one default bank account per currency
CREATE UNIQUE INDEX idx_bank_accounts_default_currency 
ON bank_accounts(currency, is_default) 
WHERE is_default = true;

-- RLS Policies
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON bank_accounts
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 4. Updated Trigger for updated_at
-- ============================================================================

CREATE TRIGGER update_blink_invoices_updated_at BEFORE UPDATE ON blink_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Sample Bank Accounts Data
-- ============================================================================

INSERT INTO bank_accounts (bank_name, account_name, account_number, currency, is_default, is_active)
VALUES 
    ('Bank Mandiri', 'PT Bakhtera-1', '1234567890', 'IDR', true, true),
    ('Bank Central Asia (BCA)', 'PT Bakhtera-1', '0987654321', 'IDR', false, true),
    ('Standard Chartered Bank', 'PT Bakhtera-1', 'USD1234567890', 'USD', true, true);

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================

COMMENT ON TABLE blink_invoices IS 'Sales invoices with detailed line items, tax calculations, and payment tracking';
COMMENT ON TABLE blink_payments IS 'Payment records for invoices supporting partial and full payments';
COMMENT ON TABLE bank_accounts IS 'Company bank accounts displayed on invoices for customer payments';

COMMENT ON COLUMN blink_invoices.invoice_items IS 'JSONB array of line items with description, qty, unit, rate, and amount';
COMMENT ON COLUMN blink_invoices.outstanding_amount IS 'Calculated field: total_amount - paid_amount';
COMMENT ON COLUMN blink_invoices.status IS 'Invoice status: draft, sent, partially_paid, paid, overdue, cancelled';
