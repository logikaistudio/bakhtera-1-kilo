-- ================================================================================
-- TARGETED CLEANUP: Only delete ORPHANED data (data without valid pengajuan)
-- Safe script that preserves current valid data
-- ================================================================================

-- Step 1: IDENTIFY orphaned Pabean data (data where pengajuan no longer exists)
-- This query shows what WILL BE DELETED
SELECT 'freight_inbound' as source_table, 
       i.id, 
       i.pengajuan_id, 
       i.customer,
       i.bc_document_number
FROM freight_inbound i
WHERE i.pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR i.pengajuan_id IS NULL

UNION ALL

SELECT 'freight_outbound' as source_table,
       o.id,
       o.pengajuan_id,
       o.customer,
       o.bc_document_number
FROM freight_outbound o
WHERE o.pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR o.pengajuan_id IS NULL

UNION ALL

SELECT 'freight_reject' as source_table,
       r.id,
       r.pengajuan_id,
       r.customer,
       NULL as bc_document_number
FROM freight_reject r
WHERE r.pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR r.pengajuan_id IS NULL;

-- ================================================================================
-- Step 2: DELETE orphaned Pabean data
-- Only deletes records that don't have matching pengajuan
-- ================================================================================

-- Delete orphaned inbound records
DELETE FROM freight_inbound
WHERE pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR pengajuan_id IS NULL;

-- Delete orphaned outbound records
DELETE FROM freight_outbound
WHERE pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR pengajuan_id IS NULL;

-- Delete orphaned reject records
DELETE FROM freight_reject
WHERE pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR pengajuan_id IS NULL;

-- ================================================================================
-- Step 3: Also clean orphaned warehouse inventory
-- ================================================================================

-- Delete orphaned inventory records
DELETE FROM warehouse_inventory
WHERE pengajuan_id NOT IN (SELECT id FROM freight_quotations)
   OR pengajuan_id IS NULL;

-- ================================================================================
-- Step 4: VERIFICATION - Show remaining valid data
-- ================================================================================

-- Count remaining valid records (should only show data with valid pengajuan)
SELECT 'Valid Records Remaining' as status,
       (SELECT COUNT(*) FROM freight_inbound WHERE pengajuan_id IN (SELECT id FROM freight_quotations)) as inbound,
       (SELECT COUNT(*) FROM freight_outbound WHERE pengajuan_id IN (SELECT id FROM freight_quotations)) as outbound,
       (SELECT COUNT(*) FROM freight_reject WHERE pengajuan_id IN (SELECT id FROM freight_quotations)) as reject,
       (SELECT COUNT(*) FROM warehouse_inventory WHERE pengajuan_id IN (SELECT id FROM freight_quotations)) as inventory;

-- All orphaned data should be gone, only valid linked data remains
