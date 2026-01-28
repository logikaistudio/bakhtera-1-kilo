-- Add terms_and_conditions column to blink_quotations
ALTER TABLE blink_quotations
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

COMMENT ON COLUMN blink_quotations.terms_and_conditions IS 'Customizable terms and conditions for the quotation';
