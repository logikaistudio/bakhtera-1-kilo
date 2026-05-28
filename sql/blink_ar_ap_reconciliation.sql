-- BLINK AR/AP Reconciliation & Data Audit Queries
-- Purpose: Identify and fix data inconsistencies
-- Created: 2026-05-28

-- =====================================================================
-- STEP 1: IDENTIFY DATA INCONSISTENCIES
-- =====================================================================

-- AUDIT 1.1: Find AR/Invoice mismatches
-- This query compares blink_invoices with blink_ar_transactions to find data gaps
SELECT 
    ai.invoice_number,
    ai.customer_name,
    ai.paid_amount as inv_paid_amount,
    ar.paid_amount as ar_paid_amount,
    ai.outstanding_amount as inv_outstanding,
    ar.outstanding_amount as ar_outstanding,
    ai.status as inv_status,
    ar.status as ar_status,
    CASE 
        WHEN ar.id IS NULL THEN '🔴 NO AR RECORD'
        WHEN ai.paid_amount != ar.paid_amount THEN '⚠️ PAID AMOUNT MISMATCH'
        WHEN ai.outstanding_amount != ar.outstanding_amount THEN '⚠️ OUTSTANDING AMOUNT MISMATCH'
        WHEN ai.status != ar.status THEN '⚠️ STATUS MISMATCH'
        ELSE '✅ OK'
    END as data_status,
    ai.updated_at as inv_updated_at,
    ar.updated_at as ar_updated_at
FROM blink_invoices ai
LEFT JOIN blink_ar_transactions ar ON ai.id = ar.invoice_id
WHERE ai.status NOT IN ('draft', 'cancelled')
ORDER BY data_status DESC, ai.invoice_date DESC
LIMIT 100;

-- AUDIT 1.2: Find invoices marked outstanding but with zero outstanding_amount
-- These should be status='paid'
SELECT 
    invoice_number, 
    customer_name, 
    total_amount, 
    paid_amount, 
    outstanding_amount, 
    status,
    invoice_date,
    updated_at,
    (total_amount - paid_amount) as calculated_outstanding
FROM blink_invoices
WHERE outstanding_amount = 0 
  AND status NOT IN ('draft', 'cancelled', 'paid')
  AND status NOT IN ('paid', 'archived')
ORDER BY updated_at DESC
LIMIT 50;

-- AUDIT 1.3: Find invoices with negative outstanding_amount (data corruption)
SELECT 
    invoice_number,
    customer_name,
    total_amount,
    paid_amount,
    outstanding_amount,
    status,
    (paid_amount - total_amount) as overpayment_amount
FROM blink_invoices
WHERE outstanding_amount < 0
ORDER BY outstanding_amount ASC;

-- AUDIT 1.4: Find duplicate AR transactions for same invoice
-- This indicates data integrity issues
SELECT 
    invoice_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(ar_number, ', ') as ar_numbers,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM blink_ar_transactions
WHERE invoice_id IS NOT NULL
GROUP BY invoice_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- AUDIT 1.5: Find invoices without corresponding AR record
-- These may be invoices created before AR automation
SELECT 
    inv.invoice_number,
    inv.customer_name,
    inv.outstanding_amount,
    inv.status,
    inv.created_at,
    COUNT(ar.id) as ar_count
FROM blink_invoices inv
LEFT JOIN blink_ar_transactions ar ON inv.id = ar.invoice_id
WHERE inv.status NOT IN ('draft', 'cancelled')
GROUP BY inv.id, inv.invoice_number, inv.customer_name, inv.outstanding_amount, inv.status, inv.created_at
HAVING COUNT(ar.id) = 0
ORDER BY inv.created_at DESC
LIMIT 50;

-- AUDIT 1.6: Find AR transactions with no matching invoice
-- Orphaned AR records
SELECT 
    ar_number,
    invoice_number,
    customer_name,
    original_amount,
    outstanding_amount,
    status,
    created_at
FROM blink_ar_transactions
WHERE invoice_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM blink_invoices WHERE id = ar.invoice_id)
ORDER BY created_at DESC
LIMIT 50;

-- AUDIT 1.7: Summary of AR/AP status distribution
SELECT 
    'Invoice Status' as entity_type,
    status,
    COUNT(*) as count,
    SUM(outstanding_amount) as total_outstanding
FROM blink_invoices
WHERE status NOT IN ('draft', 'cancelled')
GROUP BY status
UNION ALL
SELECT 
    'AR Transaction Status',
    status,
    COUNT(*),
    SUM(outstanding_amount)
FROM blink_ar_transactions
GROUP BY status
ORDER BY entity_type, status;

-- =====================================================================
-- STEP 2: SIMILAR CHECKS FOR AP/PO
-- =====================================================================

-- AUDIT 2.1: Find AP/PO mismatches
SELECT 
    po.po_number,
    po.vendor_name,
    po.paid_amount as po_paid_amount,
    ap.paid_amount as ap_paid_amount,
    po.outstanding_amount as po_outstanding,
    ap.outstanding_amount as ap_outstanding,
    po.status as po_status,
    ap.status as ap_status,
    CASE 
        WHEN ap.id IS NULL THEN '🔴 NO AP RECORD'
        WHEN po.paid_amount != ap.paid_amount THEN '⚠️ PAID AMOUNT MISMATCH'
        WHEN po.outstanding_amount != ap.outstanding_amount THEN '⚠️ OUTSTANDING AMOUNT MISMATCH'
        WHEN po.status != ap.status THEN '⚠️ STATUS MISMATCH'
        ELSE '✅ OK'
    END as data_status
FROM blink_purchase_orders po
LEFT JOIN blink_ap_transactions ap ON po.id = ap.po_id
WHERE po.status NOT IN ('draft', 'cancelled', 'rejected')
ORDER BY data_status DESC, po.po_date DESC
LIMIT 100;

-- =====================================================================
-- STEP 3: RECONCILIATION SCRIPTS (Use with CAUTION!)
-- =====================================================================

-- FIX 3.1: Mark invoices as 'paid' if outstanding_amount = 0
-- This corrects status mismatches where payment was recorded but status wasn't updated
BEGIN;
  UPDATE blink_invoices
  SET status = 'paid', updated_at = NOW()
  WHERE outstanding_amount = 0 
    AND status NOT IN ('draft', 'cancelled', 'paid', 'archived')
    AND paid_amount >= total_amount;
  
  -- VERIFY
  SELECT invoice_number, status, outstanding_amount, paid_amount, total_amount
  FROM blink_invoices
  WHERE status = 'paid'
  ORDER BY updated_at DESC
  LIMIT 10;
COMMIT;

-- FIX 3.2: Reconcile AR transactions from latest invoice state
-- This updates AR to match invoice data
BEGIN;
  WITH mismatched_ar AS (
    SELECT 
        ar.id as ar_id,
        inv.id as inv_id,
        inv.paid_amount as correct_paid,
        inv.outstanding_amount as correct_outstanding,
        inv.status as correct_status,
        ar.paid_amount as current_ar_paid,
        ar.outstanding_amount as current_ar_outstanding,
        ar.status as current_ar_status
    FROM blink_ar_transactions ar
    JOIN blink_invoices inv ON ar.invoice_id = inv.id
    WHERE ar.paid_amount != inv.paid_amount 
       OR ar.outstanding_amount != inv.outstanding_amount
       OR ar.status != inv.status
  )
  UPDATE blink_ar_transactions ar
  SET 
      paid_amount = m.correct_paid,
      outstanding_amount = m.correct_outstanding,
      status = CASE 
          WHEN m.correct_status = 'paid' THEN 'paid'
          WHEN m.correct_paid > 0 AND m.correct_outstanding > 0 THEN 'partial'
          ELSE m.correct_status
      END,
      updated_at = NOW()
  FROM mismatched_ar m
  WHERE ar.id = m.ar_id;
  
  -- VERIFY
  SELECT COUNT(*) as reconciled_records FROM mismatched_ar;
COMMIT;

-- FIX 3.3: Create missing AR records for invoices without AR
-- This handles invoices created before AR automation was in place
BEGIN;
  INSERT INTO blink_ar_transactions (
      ar_number,
      invoice_id,
      invoice_number,
      customer_id,
      customer_name,
      transaction_date,
      due_date,
      currency,
      original_amount,
      paid_amount,
      outstanding_amount,
      status,
      created_at,
      updated_at
  )
  SELECT 
      'AR-' || inv.invoice_number,
      inv.id,
      inv.invoice_number,
      inv.customer_id,
      inv.customer_name,
      inv.invoice_date,
      inv.due_date,
      inv.currency,
      inv.total_amount,
      inv.paid_amount,
      inv.outstanding_amount,
      CASE 
          WHEN inv.status = 'paid' THEN 'paid'
          WHEN inv.paid_amount > 0 THEN 'partial'
          WHEN inv.status = 'overdue' THEN 'overdue'
          ELSE 'outstanding'
      END as status,
      NOW(),
      NOW()
  FROM blink_invoices inv
  WHERE inv.status NOT IN ('draft', 'cancelled')
    AND NOT EXISTS (SELECT 1 FROM blink_ar_transactions ar WHERE ar.invoice_id = inv.id)
  ON CONFLICT (ar_number) DO NOTHING;
  
  -- VERIFY
  SELECT COUNT(*) as created_ar_records FROM blink_ar_transactions WHERE created_at >= NOW() - INTERVAL '1 minute';
COMMIT;

-- FIX 3.4: Similar reconciliation for AP/PO
BEGIN;
  UPDATE blink_ap_transactions ap
  SET 
      paid_amount = po.paid_amount,
      outstanding_amount = po.outstanding_amount,
      status = CASE 
          WHEN po.status = 'paid' THEN 'paid'
          WHEN po.paid_amount > 0 AND po.outstanding_amount > 0 THEN 'partial'
          ELSE po.status
      END,
      updated_at = NOW()
  FROM blink_purchase_orders po
  WHERE ap.po_id = po.id
    AND (ap.paid_amount != po.paid_amount 
         OR ap.outstanding_amount != po.outstanding_amount
         OR ap.status != po.status);
COMMIT;

-- =====================================================================
-- STEP 4: FINAL VERIFICATION
-- =====================================================================

-- VERIFY 4.1: Count of OK vs Problem items
SELECT 
    CASE 
        WHEN inv_paid_amount = ar_paid_amount 
             AND inv_outstanding = ar_outstanding 
             AND inv_status = ar_status THEN 'OK'
        ELSE 'PROBLEM'
    END as consistency_status,
    COUNT(*) as count,
    SUM(inv_outstanding) as total_outstanding_amount
FROM (
    SELECT 
        ai.paid_amount as inv_paid_amount,
        ar.paid_amount as ar_paid_amount,
        ai.outstanding_amount as inv_outstanding,
        ar.outstanding_amount as ar_outstanding,
        ai.status as inv_status,
        ar.status as ar_status
    FROM blink_invoices ai
    LEFT JOIN blink_ar_transactions ar ON ai.id = ar.invoice_id
    WHERE ai.status NOT IN ('draft', 'cancelled')
) summary
GROUP BY consistency_status;

-- VERIFY 4.2: Count invoices with outstanding_amount > 0 (truly outstanding)
SELECT 
    'Truly Outstanding (outstanding_amount > 0)' as category,
    COUNT(*) as count,
    SUM(outstanding_amount) as total_amount
FROM blink_invoices
WHERE outstanding_amount > 0 AND status NOT IN ('draft', 'cancelled', 'paid')
UNION ALL
SELECT 
    'Incorrectly Outstanding (outstanding_amount = 0, status != paid)',
    COUNT(*),
    SUM(outstanding_amount)
FROM blink_invoices
WHERE outstanding_amount = 0 AND status NOT IN ('draft', 'cancelled', 'paid');

-- =====================================================================
-- STEP 5: DASHBOARD TEST
-- =====================================================================

-- TEST: Verify aging list query returns only outstanding items
SELECT 
    'AR' as type,
    invoice_number as doc_number,
    customer_name as partner,
    outstanding_amount as amount,
    due_date,
    EXTRACT(DAY FROM CURRENT_DATE - due_date)::INT as days_overdue,
    status
FROM blink_invoices
WHERE outstanding_amount > 0 
  AND status NOT IN ('draft', 'cancelled')
  AND invoice_date IS NOT NULL
ORDER BY due_date ASC
LIMIT 10;

-- This query should return ONLY items that should appear in the dashboard aging list
-- All returned rows should have outstanding_amount > 0
