-- Migration: Add status timestamp columns to blink_shipments
-- Run this in Supabase SQL Editor

ALTER TABLE blink_shipments
    ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS departed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arrived_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

-- Update status values: standardize any old 'booked' or 'customs_clearance' to valid ones
UPDATE blink_shipments
SET status = 'confirmed'
WHERE status IN ('booked', 'customs_clearance', 'completed');

COMMENT ON COLUMN blink_shipments.confirmed_at  IS 'Timestamp when shipment was confirmed';
COMMENT ON COLUMN blink_shipments.departed_at   IS 'Timestamp when shipment departed (set in_transit)';
COMMENT ON COLUMN blink_shipments.arrived_at    IS 'Timestamp when shipment arrived at destination';
COMMENT ON COLUMN blink_shipments.delivered_at  IS 'Timestamp when shipment was delivered to consignee';
