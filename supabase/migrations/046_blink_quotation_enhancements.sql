-- Blink Quotation Enhancements
-- Add new fields for quotation improvements
-- Created: 2026-01-24

-- ============================================================================
-- 1. Add new columns to blink_quotations
-- ============================================================================

-- Add weight measurement fields (Gross Weight, Net Weight, Measure)
ALTER TABLE blink_quotations ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,2);
ALTER TABLE blink_quotations ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2);
ALTER TABLE blink_quotations ADD COLUMN IF NOT EXISTS measure DECIMAL(10,3);

-- ============================================================================
-- 2. Add new columns to blink_shipments (for data consistency)
-- ============================================================================

-- Add weight measurement fields
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,2);
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2);
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS measure DECIMAL(10,3);

-- Add selling/buying tracking columns
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS selling_items JSONB;
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS buying_items JSONB;

-- ============================================================================
-- 3. Update quotation_type comment (CM -> EV)
-- ============================================================================

COMMENT ON COLUMN blink_quotations.quotation_type IS 'RG=Regular, PJ=Project, EV=Event';

-- ============================================================================
-- Comments for new columns
-- ============================================================================

COMMENT ON COLUMN blink_quotations.gross_weight IS 'Gross weight in kilograms';
COMMENT ON COLUMN blink_quotations.net_weight IS 'Net weight in kilograms';
COMMENT ON COLUMN blink_quotations.measure IS 'Measure/Volume in cubic meters (M3)';

COMMENT ON COLUMN blink_shipments.gross_weight IS 'Gross weight in kilograms';
COMMENT ON COLUMN blink_shipments.net_weight IS 'Net weight in kilograms';
COMMENT ON COLUMN blink_shipments.measure IS 'Measure/Volume in cubic meters (M3)';
COMMENT ON COLUMN blink_shipments.selling_items IS 'Selling price items from quotation (read-only reference)';
COMMENT ON COLUMN blink_shipments.buying_items IS 'Buying/cost items that can be edited and added';
