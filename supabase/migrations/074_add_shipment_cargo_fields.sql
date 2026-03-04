-- Migration: Add shipping_mode, packages, port_of_loading, port_of_discharge to blink_shipments
-- Run this in Supabase SQL Editor

ALTER TABLE blink_shipments
    ADD COLUMN IF NOT EXISTS shipping_mode TEXT,           -- CY/CY, CY/CF, CF/CY, CF/CF
    ADD COLUMN IF NOT EXISTS packages TEXT,                -- e.g. "10 PALLETS", "5 CTNS"
    ADD COLUMN IF NOT EXISTS port_of_loading TEXT,         -- Dedicated column separate from origin
    ADD COLUMN IF NOT EXISTS port_of_discharge TEXT;       -- Dedicated column separate from destination

-- Optional: backfill port fields from origin/destination for existing records
UPDATE blink_shipments
SET 
    port_of_loading = COALESCE(port_of_loading, origin),
    port_of_discharge = COALESCE(port_of_discharge, destination)
WHERE port_of_loading IS NULL;

-- Comment on new columns
COMMENT ON COLUMN blink_shipments.shipping_mode IS 'Shipping mode: CY/CY, CY/CF, CF/CY, CF/CF';
COMMENT ON COLUMN blink_shipments.packages IS 'Number and type of packages, e.g. 10 PALLETS';
COMMENT ON COLUMN blink_shipments.port_of_loading IS 'Port/Airport of Loading (distinct from origin city)';
COMMENT ON COLUMN blink_shipments.port_of_discharge IS 'Port/Airport of Discharge (distinct from destination city)';
