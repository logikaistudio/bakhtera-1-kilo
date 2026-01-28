-- Add missing columns for Quotation Print Details
ALTER TABLE blink_quotations
ADD COLUMN IF NOT EXISTS incoterm TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30 Days',
ADD COLUMN IF NOT EXISTS package_type TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC,
ADD COLUMN IF NOT EXISTS customer_contact_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

COMMENT ON COLUMN blink_quotations.incoterm IS 'E.g. FOB, CIF, EXW';
COMMENT ON COLUMN blink_quotations.package_type IS 'E.g. Cartons, Pallets, 40HC';
