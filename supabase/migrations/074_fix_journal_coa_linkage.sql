-- Migration 074: Fix journal entries with coa_id = NULL
-- Backfill coa_id by matching account_code to finance_coa.code
-- This ensures Trial Balance, P&L, and Balance Sheet display correctly.
--
-- Run in Supabase SQL Editor or via supabase db push

-- 1. Backfill coa_id from account_code
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.account_code IS NOT NULL
  AND je.account_code != ''
  AND coa.code = je.account_code;

-- 2. For entries still missing coa_id, try to match by account_name keywords + entry_type
-- AR entries (Piutang Usaha)
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('invoice', 'ar')
  AND je.debit > 0  -- Dr side = AR (Piutang)
  AND coa.type = 'ASSET'
  AND coa.code LIKE '1-03%'
  AND coa.is_active = true
  LIMIT 1;

-- Revenue entries
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('invoice', 'ar')
  AND je.credit > 0  -- Cr side = Revenue
  AND coa.type = 'REVENUE'
  AND coa.is_active = true
  LIMIT 1;

-- AP Payment debit (reduce hutang usaha)
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.entry_type = 'bill_payment'
  AND je.debit > 0
  AND coa.type = 'LIABILITY'
  AND coa.code LIKE '2%'
  AND coa.is_active = true
  LIMIT 1;

-- PO / Expense debit
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.entry_type = 'purchase_order'
  AND je.debit > 0
  AND coa.type IN ('COGS', 'EXPENSE')
  AND coa.is_active = true
  LIMIT 1;

-- 3. Add index for faster P&L / Trial Balance queries
CREATE INDEX IF NOT EXISTS idx_blink_journal_coa_id ON blink_journal_entries(coa_id);
CREATE INDEX IF NOT EXISTS idx_blink_journal_entry_date ON blink_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_blink_journal_account_code ON blink_journal_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_blink_journal_entry_type ON blink_journal_entries(entry_type);

-- 4. Summary report
SELECT
  'Total entries' AS label, COUNT(*) AS count FROM blink_journal_entries
UNION ALL
SELECT 'Entries with coa_id', COUNT(*) FROM blink_journal_entries WHERE coa_id IS NOT NULL
UNION ALL
SELECT 'Entries without coa_id', COUNT(*) FROM blink_journal_entries WHERE coa_id IS NULL;
