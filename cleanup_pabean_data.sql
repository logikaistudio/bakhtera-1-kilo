-- Cleanup script for orphaned and test data in Pabean
-- Run in Supabase SQL Editor

-- Step 1: Check what data exists
SELECT 
    id, 
    quotation_number,
    customer,
    document_status,
    created_at
FROM freight_quotations
ORDER BY created_at DESC;

-- Step 2: Delete specific orphaned quotation if confirmed
-- DELETE FROM freight_quotations WHERE id = 'QT-1768022882532';

-- Step 3: Verify related data was cleaned
-- SELECT COUNT(*) FROM freight_inbound WHERE pengajuan_id = 'QT-1768022882532';
-- SELECT COUNT(*) FROM freight_outbound WHERE pengajuan_id = 'QT-1768022882532';
-- SELECT COUNT(*) FROM warehouse_inventory WHERE pengajuan_id = 'QT-1768022882532';
