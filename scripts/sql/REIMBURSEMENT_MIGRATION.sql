-- ═══════════════════════════════════════════════════════════════════
-- REIMBURSEMENT FEATURE - SCHEMA MIGRATION
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Add columns untuk reimbursement tracking
ALTER TABLE blink_invoices
ADD COLUMN IF NOT EXISTS reimbursement_reference_invoice_id UUID,
ADD COLUMN IF NOT EXISTS is_reimbursement BOOLEAN DEFAULT FALSE;

-- Step 2: Add foreign key constraint (reference to original invoice)
ALTER TABLE blink_invoices
ADD CONSTRAINT fk_reimbursement_reference 
FOREIGN KEY (reimbursement_reference_invoice_id) 
REFERENCES blink_invoices(id) ON DELETE SET NULL;

-- Step 3: Create index untuk optimized queries on reimbursement invoices
CREATE INDEX IF NOT EXISTS idx_invoices_reimbursement 
ON blink_invoices(is_reimbursement, reimbursement_reference_invoice_id)
WHERE is_reimbursement = TRUE;

-- Step 4: Verify migration success
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'blink_invoices' 
AND column_name IN ('reimbursement_reference_invoice_id', 'is_reimbursement')
ORDER BY column_name;

-- Expected output:
-- is_reimbursement | boolean | NO | 'false'::boolean
-- reimbursement_reference_invoice_id | uuid | YES | NULL
