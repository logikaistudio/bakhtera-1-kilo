-- ⚠️ CLEANUP SCRIPT: Remove illegally inserted sample data from production tables
-- Run this in Supabase SQL Editor to revert the sample data insertion
-- Date: 2026-05-30

-- ============================================
-- STEP 1: Remove sample invoices from AR
-- These had illegal statuses ('partial', 'unpaid') causing extreme 90+ day aging
-- INV-2025-099: due 2025-12-31 → 150 days overdue
-- INV-2026-001: due 2026-02-10 → 109 days overdue
-- ============================================
DELETE FROM blink_invoices
WHERE invoice_number IN ('INV-2026-001', 'INV-2025-099');

-- ============================================
-- STEP 2: Remove sample purchase orders
-- These had illegal statuses ('outstanding', 'overdue') not recognized by app
-- Caused empty status badges in PO list
-- ============================================
DELETE FROM blink_purchase_orders
WHERE po_number IN ('PO-2026-001', 'PO-2026-002', 'PO-2025-098');

-- ============================================
-- STEP 3: Verify cleanup
-- Both counts should be 0 after cleanup
-- ============================================
SELECT 'blink_invoices remaining sample data' AS check, count(*) AS count
FROM blink_invoices
WHERE invoice_number IN ('INV-2026-001', 'INV-2025-099')
UNION ALL
SELECT 'blink_purchase_orders remaining sample data', count(*)
FROM blink_purchase_orders
WHERE po_number IN ('PO-2026-001', 'PO-2026-002', 'PO-2025-098');

-- Expected result: both rows should show count = 0
