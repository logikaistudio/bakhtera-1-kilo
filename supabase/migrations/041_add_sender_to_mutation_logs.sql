-- Add sender column to freight_mutation_logs table
-- This column stores the shipper/pengirim information for Pabean Barang Mutasi

ALTER TABLE freight_mutation_logs 
ADD COLUMN IF NOT EXISTS sender TEXT;

-- Add comment
COMMENT ON COLUMN freight_mutation_logs.sender IS 'Sender/Shipper name (Pengirim)';
