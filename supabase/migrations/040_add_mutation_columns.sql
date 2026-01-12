-- Add missing columns to freight_mutation_logs table
-- These columns are needed for complete mutation tracking

ALTER TABLE freight_mutation_logs 
ADD COLUMN IF NOT EXISTS package_number TEXT,
ADD COLUMN IF NOT EXISTS hs_code TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT,
ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'pcs';

-- Add comment
COMMENT ON COLUMN freight_mutation_logs.uom IS 'Unit of measure (satuan)';
COMMENT ON COLUMN freight_mutation_logs.package_number IS 'Package/Box number';
COMMENT ON COLUMN freight_mutation_logs.hs_code IS 'HS Code for the item';
COMMENT ON COLUMN freight_mutation_logs.condition IS 'Item condition (Baik/Rusak/Cacat)';
