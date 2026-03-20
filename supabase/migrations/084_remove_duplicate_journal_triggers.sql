-- ============================================================================
-- Migration 084: Drop obsolete auto-journal triggers 
-- ============================================================================
-- Purpose:
--   Journal entries for PO Approval, Invoice Generation, and Payments
--   are now fully handled by the React frontend (`utils/journalHelper.js`).
--   Having these triggers active simultaneously causes DOUBLE JOURNAL ENTRIES
--   for every transaction. 
--   We must drop these triggers to ensure accurate accounting.
-- ============================================================================

-- Drop 066 triggers (Blink PO, Invoice, Payments)
DROP TRIGGER IF EXISTS trigger_journal_from_blink_invoice ON blink_invoices;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_in ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_out ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_po ON blink_purchase_orders;

-- Drop trigger functions
DROP FUNCTION IF EXISTS create_journal_from_blink_invoice() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ar_payment_v2() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ap_payment_v2() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_blink_po() CASCADE;

-- Also just to be absolutely sure, drop 033 triggers again
DROP TRIGGER IF EXISTS trigger_journal_from_ar ON blink_ar_transactions;
DROP TRIGGER IF EXISTS trigger_journal_from_ar_payment ON blink_ar_transactions;
DROP TRIGGER IF EXISTS trigger_journal_from_ap ON blink_ap_transactions;

DROP FUNCTION IF EXISTS create_journal_from_ar() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ar_payment() CASCADE;
DROP FUNCTION IF EXISTS create_journal_from_ap() CASCADE;

-- ============================================================================
-- END Migration 084
-- ============================================================================
