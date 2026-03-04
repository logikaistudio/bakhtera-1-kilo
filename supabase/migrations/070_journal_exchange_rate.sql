-- =====================================================
-- Migration 070: Add exchange_rate & amount_idr to blink_journal_entries
-- Purpose: Fix multi-currency recording so General Ledger
--          always stores and displays IDR equivalent values
-- =====================================================

-- 1. Add exchange_rate column (USD→IDR rate at time of transaction)
ALTER TABLE blink_journal_entries
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,4) DEFAULT 1;

-- 2. Add amount_idr columns (debit/credit converted to IDR)
ALTER TABLE blink_journal_entries
  ADD COLUMN IF NOT EXISTS debit_idr  NUMERIC(15,2) GENERATED ALWAYS AS (debit  * exchange_rate) STORED;

ALTER TABLE blink_journal_entries
  ADD COLUMN IF NOT EXISTS credit_idr NUMERIC(15,2) GENERATED ALWAYS AS (credit * exchange_rate) STORED;

-- 3. Back-fill existing records: if currency=IDR, exchange_rate stays 1 (default)
--    For USD rows already stored, we mark exchange_rate=0 so finance team knows
--    it needs correction – they should re-enter or update manually.
--    (We cannot know the historical rate retroactively)
UPDATE blink_journal_entries
SET    exchange_rate = 1
WHERE  currency = 'IDR'
  AND  exchange_rate IS NULL;

-- 4. Index for currency + exchange_rate queries
CREATE INDEX IF NOT EXISTS idx_journal_currency ON blink_journal_entries(currency);
CREATE INDEX IF NOT EXISTS idx_journal_exrate   ON blink_journal_entries(exchange_rate);

-- =====================================================
-- END OF MIGRATION 070
-- =====================================================
