-- Add selling_items and buying_items columns to blink_shipments
-- This is required for the "Selling vs Buying" analysis feature and fixes the SO creation error.

ALTER TABLE blink_shipments
ADD COLUMN IF NOT EXISTS selling_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS buying_items JSONB DEFAULT '[]';

COMMENT ON COLUMN blink_shipments.selling_items IS 'Array of items sold to customer (Revenue)';
COMMENT ON COLUMN blink_shipments.buying_items IS 'Array of items bought from vendors (Cost/COGS)';
