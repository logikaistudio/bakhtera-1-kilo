-- Migration: Add 'module' column to blink_approval_history
-- This column is needed to isolate Blink approvals from Bridge/Big modules
-- Values: 'blink_sales' (for quotations/invoices) or 'blink_operations' (for shipments/POs)

-- Step 1: Add the column if it doesn't exist
ALTER TABLE blink_approval_history
    ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'blink_operations';

-- Step 2: Add index for faster filtering by module
CREATE INDEX IF NOT EXISTS idx_blink_approval_history_module
    ON blink_approval_history(module);

-- Step 3: Verify structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'blink_approval_history'
ORDER BY ordinal_position;
