-- Migration: Add Payment Auto-Update Trigger for AR/AP Transactions
-- Created: 2026-05-28
-- Purpose: Automatically update blink_ar_transactions and blink_invoices when payment is recorded
-- This prevents data inconsistency between tables

-- =====================================================================
-- FUNCTION: Auto-update AR transactions on payment insertion
-- =====================================================================
CREATE OR REPLACE FUNCTION update_ar_from_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process incoming payments (from customers)
    IF NEW.reference_type = 'invoice' AND NEW.status = 'completed' THEN
        
        -- Get the invoice details
        WITH invoice_data AS (
            SELECT 
                inv.id,
                inv.total_amount,
                COALESCE(inv.paid_amount, 0) as current_paid,
                NEW.amount as payment_amt
            FROM blink_invoices inv
            WHERE inv.id = NEW.reference_id
        )
        
        -- Update blink_invoices
        UPDATE blink_invoices
        SET 
            paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
            outstanding_amount = GREATEST(0, total_amount - (COALESCE(paid_amount, 0) + NEW.amount)),
            status = CASE 
                WHEN (GREATEST(0, total_amount - (COALESCE(paid_amount, 0) + NEW.amount))) <= 0 THEN 'paid'
                WHEN (COALESCE(paid_amount, 0) + NEW.amount) > 0 THEN 'partially_paid'
                ELSE 'unpaid'
            END,
            updated_at = NOW()
        WHERE id = NEW.reference_id;
        
        -- Update blink_ar_transactions (matching invoice)
        UPDATE blink_ar_transactions
        SET 
            paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
            outstanding_amount = GREATEST(0, original_amount - (COALESCE(paid_amount, 0) + NEW.amount)),
            status = CASE 
                WHEN (GREATEST(0, original_amount - (COALESCE(paid_amount, 0) + NEW.amount))) <= 0 THEN 'paid'
                WHEN (COALESCE(paid_amount, 0) + NEW.amount) > 0 THEN 'partial'
                ELSE 'outstanding'
            END,
            last_payment_date = NEW.payment_date,
            last_payment_amount = NEW.amount,
            updated_at = NOW()
        WHERE invoice_id = NEW.reference_id;
        
    -- Process outgoing payments (to vendors)
    ELSIF NEW.reference_type = 'po' AND NEW.status = 'completed' THEN
        
        -- Update blink_purchase_orders
        UPDATE blink_purchase_orders
        SET 
            paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
            outstanding_amount = GREATEST(0, total_amount - (COALESCE(paid_amount, 0) + NEW.amount)),
            status = CASE 
                WHEN (GREATEST(0, total_amount - (COALESCE(paid_amount, 0) + NEW.amount))) <= 0 THEN 'paid'
                WHEN (COALESCE(paid_amount, 0) + NEW.amount) > 0 THEN 'partially_paid'
                ELSE 'outstanding'
            END,
            updated_at = NOW()
        WHERE id = NEW.reference_id;
        
        -- Update blink_ap_transactions (matching PO)
        UPDATE blink_ap_transactions
        SET 
            paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
            outstanding_amount = GREATEST(0, original_amount - (COALESCE(paid_amount, 0) + NEW.amount)),
            status = CASE 
                WHEN (GREATEST(0, original_amount - (COALESCE(paid_amount, 0) + NEW.amount))) <= 0 THEN 'paid'
                WHEN (COALESCE(paid_amount, 0) + NEW.amount) > 0 THEN 'partial'
                ELSE 'outstanding'
            END,
            last_payment_date = NEW.payment_date,
            last_payment_amount = NEW.amount,
            updated_at = NOW()
        WHERE po_id = NEW.reference_id;
    
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- TRIGGER: Auto-update AR on payment insertion
-- =====================================================================
DROP TRIGGER IF EXISTS auto_update_ar_on_payment ON blink_payments;
CREATE TRIGGER auto_update_ar_on_payment
AFTER INSERT ON blink_payments
FOR EACH ROW
EXECUTE FUNCTION update_ar_from_payment();

-- =====================================================================
-- SQL QUERIES FOR DATA AUDIT & RECONCILIATION
-- =====================================================================

-- QUERY 1: Find AR/Invoice mismatches
-- Purpose: Identify data inconsistencies that need fixing
-- SELECT 
--     ai.invoice_number,
--     ai.customer_name,
--     ai.paid_amount as inv_paid,
--     ar.paid_amount as ar_paid,
--     ai.outstanding_amount as inv_outstanding,
--     ar.outstanding_amount as ar_outstanding,
--     CASE 
--         WHEN ai.paid_amount != ar.paid_amount THEN '⚠️ PAID AMOUNT MISMATCH'
--         WHEN ai.outstanding_amount != ar.outstanding_amount THEN '⚠️ OUTSTANDING AMOUNT MISMATCH'
--         WHEN ai.status != ar.status THEN '⚠️ STATUS MISMATCH'
--         ELSE '✓ OK'
--     END as status
-- FROM blink_invoices ai
-- LEFT JOIN blink_ar_transactions ar ON ai.id = ar.invoice_id
-- WHERE ai.status NOT IN ('draft', 'cancelled')
-- ORDER BY status DESC, ai.invoice_date DESC;

-- QUERY 2: Find invoices marked outstanding but with zero outstanding_amount
-- Purpose: These should be marked 'paid'
-- SELECT 
--     invoice_number, 
--     customer_name, 
--     total_amount, 
--     paid_amount, 
--     outstanding_amount, 
--     status,
--     created_at
-- FROM blink_invoices
-- WHERE outstanding_amount = 0 
--   AND status NOT IN ('draft', 'cancelled', 'paid')
-- ORDER BY updated_at DESC;

-- QUERY 3: Find duplicate AR transactions for same invoice
-- Purpose: Clean up if duplicates exist
-- SELECT 
--     invoice_id,
--     COUNT(*) as duplicate_count,
--     STRING_AGG(ar_number, ', ') as ar_numbers,
--     MAX(created_at) as latest
-- FROM blink_ar_transactions
-- WHERE invoice_id IS NOT NULL
-- GROUP BY invoice_id
-- HAVING COUNT(*) > 1
-- ORDER BY duplicate_count DESC;

-- =====================================================================
-- RECONCILIATION SCRIPT (Run if data inconsistencies found)
-- =====================================================================

-- FIX 1: Update status for invoices with outstanding_amount = 0
-- UPDATE blink_invoices
-- SET status = 'paid'
-- WHERE outstanding_amount = 0 
--   AND status NOT IN ('draft', 'cancelled', 'paid')
--   AND updated_at > NOW() - INTERVAL '90 days';

-- FIX 2: Reconcile AR transactions from latest invoice state
-- UPDATE blink_ar_transactions ar
-- SET 
--     paid_amount = inv.paid_amount,
--     outstanding_amount = inv.outstanding_amount,
--     status = inv.status,
--     updated_at = NOW()
-- FROM blink_invoices inv
-- WHERE ar.invoice_id = inv.id
--   AND (ar.paid_amount != inv.paid_amount 
--        OR ar.outstanding_amount != inv.outstanding_amount
--        OR ar.status != inv.status);

-- =====================================================================
-- SIMILARLY FOR AP TRANSACTIONS
-- =====================================================================

-- UPDATE blink_ap_transactions ap
-- SET 
--     paid_amount = po.paid_amount,
--     outstanding_amount = po.outstanding_amount,
--     status = po.status,
--     updated_at = NOW()
-- FROM blink_purchase_orders po
-- WHERE ap.po_id = po.id
--   AND (ap.paid_amount != po.paid_amount 
--        OR ap.outstanding_amount != po.outstanding_amount
--        OR ap.status != po.status);
