-- Add storage location columns to freight_mutation_logs table
-- These columns are needed for tracking mutation and storage locations

ALTER TABLE freight_mutation_logs 
ADD COLUMN IF NOT EXISTS mutation_location TEXT CHECK (mutation_location IN ('warehouse', 'pameran', 'outbound')),
ADD COLUMN IF NOT EXISTS storage_location TEXT;

-- Add comment
COMMENT ON COLUMN freight_mutation_logs.mutation_location IS 'Mutation location (Lokasi Mutasi): warehouse, pameran, or outbound';
COMMENT ON COLUMN freight_mutation_logs.storage_location IS 'Storage location (Lokasi Penyimpanan)';

-- Set default mutation_location based on destination for existing records
UPDATE freight_mutation_logs 
SET mutation_location = CASE 
    WHEN LOWER(destination) = 'warehouse' OR LOWER(destination) = 'gudang' THEN 'warehouse'
    WHEN LOWER(destination) LIKE '%pameran%' THEN 'pameran'
    ELSE 'outbound'
END
WHERE mutation_location IS NULL;
