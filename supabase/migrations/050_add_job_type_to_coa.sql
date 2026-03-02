-- Add job_type column to finance_coa table
-- Values: FREIGHT, CUSTOMS, WAREHOUSE, GENERAL, or NULL (unrestricted)

ALTER TABLE finance_coa
ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_finance_coa_job_type ON finance_coa(job_type);

-- Add comment for documentation
COMMENT ON COLUMN finance_coa.job_type IS 'Job type classification: FREIGHT, CUSTOMS, WAREHOUSE, GENERAL, or NULL for all types';
