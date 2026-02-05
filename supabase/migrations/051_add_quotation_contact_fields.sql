-- Add missing customer contact fields to blink_quotations
-- These fields store customer contact details for quotations

ALTER TABLE blink_quotations
ADD COLUMN IF NOT EXISTS customer_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS incoterm VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255),
ADD COLUMN IF NOT EXISTS package_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS measure DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Add comments for documentation
COMMENT ON COLUMN blink_quotations.customer_contact_name IS 'Contact person name (Attn)';
COMMENT ON COLUMN blink_quotations.customer_email IS 'Customer contact email';
COMMENT ON COLUMN blink_quotations.customer_phone IS 'Customer contact phone';
COMMENT ON COLUMN blink_quotations.incoterm IS 'International Commercial Terms (e.g., FOB, CIF)';
COMMENT ON COLUMN blink_quotations.payment_terms IS 'Payment terms (e.g., Net 30 Days)';
COMMENT ON COLUMN blink_quotations.package_type IS 'Type of packaging (e.g., Cartons, Pallets)';
COMMENT ON COLUMN blink_quotations.quantity IS 'Number of packages/units';
COMMENT ON COLUMN blink_quotations.gross_weight IS 'Gross weight in kilograms';
COMMENT ON COLUMN blink_quotations.net_weight IS 'Net weight in kilograms';
COMMENT ON COLUMN blink_quotations.measure IS 'Measurement in cubic meters';
COMMENT ON COLUMN blink_quotations.terms_and_conditions IS 'Quotation terms and conditions';
