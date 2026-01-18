-- =====================================================
-- Add Source Reference Columns for Outbound Submissions
-- =====================================================
-- These columns store reference to the source inbound pengajuan
-- when creating an outbound submission

-- Add source_pengajuan_id column
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS source_pengajuan_id TEXT REFERENCES freight_quotations(id);

-- Add source_pengajuan_number column
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS source_pengajuan_number TEXT;

-- Add source_bc_document_number column (reference to inbound BC document)
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS source_bc_document_number TEXT;

-- Add source_bc_document_date column
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS source_bc_document_date DATE;

-- Add outbound_status column for tracking outbound processing state
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS outbound_status TEXT DEFAULT 'pending' CHECK (outbound_status IN ('pending', 'approved', 'processed'));

-- Add approved_date and approved_by columns if not exist
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS approved_date DATE;

ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_quotations_source_pengajuan ON freight_quotations(source_pengajuan_id);
CREATE INDEX IF NOT EXISTS idx_quotations_type ON freight_quotations(type);
CREATE INDEX IF NOT EXISTS idx_quotations_document_status ON freight_quotations(document_status);

-- Comment
COMMENT ON COLUMN freight_quotations.source_pengajuan_id IS 'Reference to source inbound pengajuan for outbound submissions';
COMMENT ON COLUMN freight_quotations.source_pengajuan_number IS 'Read-only copy of source pengajuan number';
COMMENT ON COLUMN freight_quotations.source_bc_document_number IS 'Read-only copy of source BC document number';
COMMENT ON COLUMN freight_quotations.source_bc_document_date IS 'Read-only copy of source BC document date';
