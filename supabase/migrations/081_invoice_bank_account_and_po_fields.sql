-- Migration 081: Add bank account fields to blink_invoices and extra PO fields
-- Run this in Supabase SQL Editor

-- 1. Add bank account fields to blink_invoices
--    payment_bank_account_id: references which company bank account is printed on the invoice
--    payment_bank_account: human-readable bank string (e.g. "BCA | 123456789 a/n PT Bakhtera")
ALTER TABLE blink_invoices
    ADD COLUMN IF NOT EXISTS payment_bank_account_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_bank_account TEXT,
    ADD COLUMN IF NOT EXISTS sales_person TEXT;

-- 2. Add SO/shipment linkage fields to blink_purchase_orders
ALTER TABLE blink_purchase_orders
    ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES blink_shipments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS job_number TEXT,
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(15,2);

-- After adding outstanding_amount, set initial values
UPDATE blink_purchase_orders
SET outstanding_amount = total_amount - COALESCE(paid_amount, 0)
WHERE outstanding_amount IS NULL;

-- 3. Add index for quick lookup by shipment_id
CREATE INDEX IF NOT EXISTS idx_po_shipment ON blink_purchase_orders(shipment_id);
CREATE INDEX IF NOT EXISTS idx_po_job_number ON blink_purchase_orders(job_number);
CREATE INDEX IF NOT EXISTS idx_invoice_bank ON blink_invoices(payment_bank_account_id);
