-- Update mutation_logs destination field documentation
-- This migration adds clarity to the destination field values

-- Add/Update comment for destination field
COMMENT ON COLUMN freight_mutation_logs.destination IS 'Mutation destination location: Gudang (warehouse), Pameran (exhibition), or Keluar TPB (leaving bonded zone)';

-- Add/Update comment for origin field for completeness
COMMENT ON COLUMN freight_mutation_logs.origin IS 'Mutation origin location: warehouse, Pameran, or other source';

-- Create index on destination for faster filtering by location
CREATE INDEX IF NOT EXISTS idx_mutation_destination ON freight_mutation_logs(destination);

-- Add comment to table for reference
COMMENT ON TABLE freight_mutation_logs IS 'Pergerakan Barang - Goods movement logs. Tracks mutations between warehouse, Pameran (exhibition), and TPB exit';
