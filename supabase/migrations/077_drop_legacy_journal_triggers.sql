-- =============================================
-- MIGRATION 077: Drop Duplicate Journal Triggers
-- =============================================
-- Problem: 
-- The React frontend is now handling all double-entry journal creation via the
-- robust `journalHelper.js` system. This allows for complex fuzzy matching, 
-- item-level custom COA assignments, and sequential JE numbering (e.g., JE-PAY-OUT-2603-0001).
-- However, legacy PostgreSQL triggers were left running in the background. 
-- These triggers independently insert duplicate, less accurate journal entries using 
-- Epoch timestamps. Worse, the `LPAD(..., 8)` caused unique constraint errors if two
-- entries occurred within 100 seconds.
-- 
-- Fix:
-- We drop the legacy journal triggers so `journalHelper.js` acts as the single source of truth.

DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_in ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_out ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_po ON blink_purchase_orders;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_invoice ON blink_invoices;

-- Also drop their underlying functions to clean up the DB
DROP FUNCTION IF EXISTS create_journal_from_ar_payment_v2() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ap_payment_v2() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_blink_po() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_blink_invoice() CASCADE;

-- If any other V1 versions existed, drop them out of caution:
DROP FUNCTION IF EXISTS create_journal_from_ar_payment() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ap_payment() CASCADE;
