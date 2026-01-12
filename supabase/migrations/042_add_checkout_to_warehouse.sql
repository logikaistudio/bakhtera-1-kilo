-- Migration: Add checkout fields to freight_warehouse table
-- This enables tracking when items are checked out of warehouse

ALTER TABLE freight_warehouse ADD COLUMN IF NOT EXISTS checked_out BOOLEAN DEFAULT FALSE;
ALTER TABLE freight_warehouse ADD COLUMN IF NOT EXISTS checkout_date TEXT;
ALTER TABLE freight_warehouse ADD COLUMN IF NOT EXISTS checkout_bc_number TEXT;

-- Add index for faster queries on checked_out status
CREATE INDEX IF NOT EXISTS idx_warehouse_checked_out ON freight_warehouse(checked_out);
