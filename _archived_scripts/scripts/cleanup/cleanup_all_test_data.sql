-- ================================================================================
-- COMPREHENSIVE CLEANUP SCRIPT FOR FREIGHT_QUOTATIONS & RELATED DATA
-- Run this in Supabase SQL Editor to remove all test/orphaned data
-- ================================================================================

-- Step 1: BACKUP CHECK - View all quotations before deletion
-- (Review this output to make sure you're not deleting production data)
SELECT 
    id,
    quotation_number,
    customer,
    document_status,
    created_at,
    bc_document_number
FROM freight_quotations
ORDER BY created_at DESC;

-- ================================================================================
-- Step 2: DELETE ALL TEST/ORPHANED DATA
-- CAUTION: This will delete ALL quotations and related data
-- If you only want to delete specific records, modify the WHERE clause
-- ================================================================================

-- 2a. Delete from Pabean tables (by pengajuan_id)
DELETE FROM freight_inbound 
WHERE pengajuan_id IN (SELECT id FROM freight_quotations);

DELETE FROM freight_outbound 
WHERE pengajuan_id IN (SELECT id FROM freight_quotations);

DELETE FROM freight_reject 
WHERE pengajuan_id IN (SELECT id FROM freight_quotations);

-- 2b. Delete from warehouse inventory
DELETE FROM warehouse_inventory 
WHERE pengajuan_id IN (SELECT id FROM freight_quotations);

-- 2c. Delete goods movements (by ref_id or quotation_number)
DELETE FROM goods_movements 
WHERE ref_id IN (SELECT id FROM freight_quotations);

-- Also try by quotation_number if needed
DELETE FROM goods_movements 
WHERE quotation_number IN (SELECT quotation_number FROM freight_quotations);

-- 2d. Delete customs documents
DELETE FROM freight_customs 
WHERE quotation_id IN (SELECT id FROM freight_quotations);

-- 2e. Unlink invoices (set quotation_id to null instead of delete)
UPDATE freight_invoices 
SET quotation_id = NULL 
WHERE quotation_id IN (SELECT id FROM freight_quotations);

-- 2f. Unlink purchases (set quotation_id to null instead of delete)
UPDATE freight_purchases 
SET quotation_id = NULL 
WHERE quotation_id IN (SELECT id FROM freight_quotations);

-- 2g. Unlink shipments (set quotation_id to null instead of delete)
UPDATE freight_shipments 
SET quotation_id = NULL 
WHERE quotation_id IN (SELECT id FROM freight_quotations);

-- 2h. FINAL - Delete all quotations
DELETE FROM freight_quotations;

-- ================================================================================
-- Step 3: VERIFICATION - Confirm all data deleted
-- ================================================================================

SELECT 'freight_quotations' as table_name, COUNT(*) as remaining_count FROM freight_quotations
UNION ALL
SELECT 'freight_inbound', COUNT(*) FROM freight_inbound
UNION ALL
SELECT 'freight_outbound', COUNT(*) FROM freight_outbound
UNION ALL
SELECT 'freight_reject', COUNT(*) FROM freight_reject
UNION ALL
SELECT 'warehouse_inventory', COUNT(*) FROM warehouse_inventory
UNION ALL
SELECT 'goods_movements', COUNT(*) FROM goods_movements
UNION ALL
SELECT 'freight_customs', COUNT(*) FROM freight_customs;

-- All counts should be 0 if cleanup was successful
