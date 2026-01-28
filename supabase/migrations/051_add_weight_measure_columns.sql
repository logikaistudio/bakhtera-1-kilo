-- Add missing weight and measure columns to blink_quotations
ALTER TABLE blink_quotations
ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS net_weight NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS measure NUMERIC(15,3); -- CBM usually needs 3 decimals

-- Add missing weight and measure columns to blink_shipments (for SO conversion)
ALTER TABLE blink_shipments
ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS net_weight NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS measure NUMERIC(15,3);

COMMENT ON COLUMN blink_quotations.measure IS 'Volume measurement in CBM';
COMMENT ON COLUMN blink_shipments.measure IS 'Volume measurement in CBM';
