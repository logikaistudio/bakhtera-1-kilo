-- Migration 080: Fix status constraints for PO and Invoice to support 'manager_approval'
-- Run this in Supabase SQL Editor

-- 1. Drop and recreate PO status check to include 'manager_approval'
ALTER TABLE blink_purchase_orders
    DROP CONSTRAINT IF EXISTS blink_purchase_orders_status_check;

ALTER TABLE blink_purchase_orders
    ADD CONSTRAINT blink_purchase_orders_status_check
    CHECK (status IN ('draft', 'submitted', 'manager_approval', 'approved', 'received', 'cancelled', 'rejected'));

-- 2. Drop and recreate Journal entry_type check to include all types used
ALTER TABLE blink_journal_entries
    DROP CONSTRAINT IF EXISTS blink_journal_entries_entry_type_check;

ALTER TABLE blink_journal_entries
    ADD CONSTRAINT blink_journal_entries_entry_type_check
    CHECK (entry_type IN ('invoice', 'payment', 'po', 'bill_payment', 'adjustment', 'ar', 'ap', 'journal'));

-- 3. Also ensure blink_journal_entries has extra columns used by auto-journal code
ALTER TABLE blink_journal_entries
    ADD COLUMN IF NOT EXISTS batch_id UUID,
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,4) DEFAULT 1,
    ADD COLUMN IF NOT EXISTS coa_id UUID REFERENCES finance_coa(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS party_name TEXT;

-- 4. Add index on batch_id for batch journal lookups
CREATE INDEX IF NOT EXISTS idx_journal_batch ON blink_journal_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_journal_coa ON blink_journal_entries(coa_id);
CREATE INDEX IF NOT EXISTS idx_journal_source ON blink_journal_entries(source);
