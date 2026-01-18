-- Migration: Add outbound processing status fields to freight_quotations
-- Purpose: Track whether approved outbound quotations have been processed to Pabean
-- Date: 2026-01-18

-- Add outbound_status column to track processing status
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(50) DEFAULT NULL;

-- Add outbound_date column to track when it was processed
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS outbound_date TIMESTAMP DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN freight_quotations.outbound_status IS 'Status pemrosesan barang keluar: NULL (belum diproses), processed (sudah diproses ke Pabean)';
COMMENT ON COLUMN freight_quotations.outbound_date IS 'Tanggal pemrosesan ke Pabean - Barang Keluar';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_freight_quotations_outbound_status 
ON freight_quotations(outbound_status) 
WHERE outbound_status IS NOT NULL;
