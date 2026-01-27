-- Add group_name column to store original Excel group value for hierarchical display
-- Example values: "Operational Income", "Non Operational Cost", "Liabilities", etc.

ALTER TABLE finance_coa 
ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);

-- Create index for faster group-based queries
CREATE INDEX IF NOT EXISTS idx_finance_coa_group_name ON finance_coa(group_name);

-- Add comment for documentation
COMMENT ON COLUMN finance_coa.group_name IS 'Original group/category name from Excel for hierarchical display (e.g., Operational Income, Liabilities)';

-- Update existing records to auto-populate group_name based on type if null
UPDATE finance_coa 
SET group_name = CASE
    WHEN type = 'ASSET' THEN 'Assets'
    WHEN type = 'LIABILITY' THEN 'Liabilities'
    WHEN type = 'EQUITY' THEN 'Equity'
    WHEN type = 'REVENUE' THEN 'Revenue'
    WHEN type = 'EXPENSE' THEN 'Expenses'
    ELSE 'Other'
END
WHERE group_name IS NULL;
