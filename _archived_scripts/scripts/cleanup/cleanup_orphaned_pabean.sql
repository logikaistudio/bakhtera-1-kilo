-- Clean up orphaned Pabean data for deleted pengajuan QT-1768022882532
-- Run this in Supabase SQL Editor

-- Delete from Inbound
DELETE FROM freight_inbound WHERE pengajuan_id = 'QT-1768022882532';

-- Delete from Outbound  
DELETE FROM freight_outbound WHERE pengajuan_id = 'QT-1768022882532';

-- Delete from Reject
DELETE FROM freight_reject WHERE pengajuan_id = 'QT-1768022882532';

-- Verify deletion
SELECT 
    (SELECT COUNT(*) FROM freight_inbound WHERE pengajuan_id = 'QT-1768022882532') as inbound_count,
    (SELECT COUNT(*) FROM freight_outbound WHERE pengajuan_id = 'QT-1768022882532') as outbound_count,
    (SELECT COUNT(*) FROM freight_reject WHERE pengajuan_id = 'QT-1768022882532') as reject_count;
