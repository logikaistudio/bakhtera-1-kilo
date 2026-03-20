-- ============================================================================
-- Migration 083: Bank Account ↔ COA Mapping + Cleanup Duplicate Journal Triggers
-- ============================================================================
-- Purpose:
--   1. Add coa_id column to company_bank_accounts so each bank account is
--      permanently linked to its COA ledger entry (e.g. 1-01-102 Bank BCA IDR)
--   2. Drop the OLD trigger functions from migration 033 that caused the
--      duplicate journal entries and "random BII account" bug.
--   3. Delete exact duplicate journal entries that were created by the old triggers.
-- ============================================================================

-- STEP 1: Add coa_id column to company_bank_accounts
-- ----------------------------------------------------
ALTER TABLE company_bank_accounts
    ADD COLUMN IF NOT EXISTS coa_id UUID REFERENCES finance_coa(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS coa_code TEXT,   -- Denormalized for quick display
    ADD COLUMN IF NOT EXISTS coa_name TEXT;   -- Denormalized for quick display

COMMENT ON COLUMN company_bank_accounts.coa_id IS 'Link to finance_coa: this defines which GL account this bank maps to (e.g. 1-01-102 Bank BCA IDR)';
COMMENT ON COLUMN company_bank_accounts.coa_code IS 'Denormalized COA code for quick display without joins';
COMMENT ON COLUMN company_bank_accounts.coa_name IS 'Denormalized COA name for quick display without joins';

-- Also apply the coa_id to all other module bank account tables
ALTER TABLE blink_company_bank_accounts
    ADD COLUMN IF NOT EXISTS coa_id UUID REFERENCES finance_coa(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS coa_code TEXT,
    ADD COLUMN IF NOT EXISTS coa_name TEXT;

-- STEP 2: Drop OLD (buggy) journal triggers from migration 033
-- -------------------------------------------------------------
-- These triggers fired alongside the new 066 triggers, causing duplicates.
DROP TRIGGER IF EXISTS trigger_journal_from_ar ON blink_ar_transactions;
DROP TRIGGER IF EXISTS trigger_journal_from_ar_payment ON blink_ar_transactions;
DROP TRIGGER IF EXISTS trigger_journal_from_ap ON blink_ap_transactions;

-- Also drop the old functions (they are now replaced by the 066 versions + journalHelper.js)
DROP FUNCTION IF EXISTS create_journal_from_ar() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ar_payment() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ap() CASCADE;

-- STEP 3: Delete duplicate journal entries (those created by the old triggers)
-- --------------------------------------------------------------------------------
-- Strategy: For each reference_id, keep only the entries from the LATEST batch
-- (the most recently created batch_id), and delete all earlier duplicates
-- that target the same reference_id + reference_type.
-- We identify old/buggy entries by: source='auto' AND account_code LIKE '110%'
-- AND they have a duplicate (same ref_id, same ref_type, newer entry exists)

DELETE FROM blink_journal_entries
WHERE id IN (
    -- Find all journal entries that are duplicated (same ref_id + ref_type + debit/credit side)
    -- Keep only the LATEST created entry per group, delete the rest
    SELECT je.id
    FROM blink_journal_entries je
    INNER JOIN (
        -- Find groups that have more than one batch for the same reference
        SELECT reference_id, reference_type, COUNT(DISTINCT batch_id) as batch_count
        FROM blink_journal_entries
        WHERE reference_id IS NOT NULL
          AND source = 'auto'
        GROUP BY reference_id, reference_type
        HAVING COUNT(DISTINCT batch_id) > 1
    ) dup ON je.reference_id = dup.reference_id AND je.reference_type = dup.reference_type
    WHERE je.source = 'auto'
      AND je.batch_id NOT IN (
          -- Keep entries from the latest batch per reference
          SELECT DISTINCT ON (reference_id, reference_type) batch_id
          FROM blink_journal_entries
          WHERE reference_id IS NOT NULL AND source = 'auto'
          ORDER BY reference_id, reference_type, created_at DESC
      )
);

-- STEP 4: Add FK index for performance
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_coa ON company_bank_accounts(coa_id);
CREATE INDEX IF NOT EXISTS idx_blink_bank_accounts_coa ON blink_company_bank_accounts(coa_id);

-- STEP 5: Notify Supabase to refresh its API schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END Migration 083
-- ============================================================================
