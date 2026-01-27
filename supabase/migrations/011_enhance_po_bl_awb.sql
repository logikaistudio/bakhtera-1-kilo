-- =====================================================
-- Migration 011: Enhance PO, BL, and AWB Documents
-- =====================================================
-- 
-- CARA MENJALANKAN:
-- 1. Copy SELURUH isi file ini
-- 2. Buka Supabase Dashboard: https://supabase.com/dashboard
-- 3. Pilih project FreightOne Anda
-- 4. Klik "SQL Editor" di sidebar kiri
-- 5. Klik "New Query"
-- 6. Paste semua SQL di bawah ini
-- 7. Klik tombol "Run" (atau tekan Ctrl/Cmd + Enter)
-- 8. Tunggu sampai muncul pesan success ✅
-- =====================================================

-- 1. Add shipper/consignee details to PO
ALTER TABLE blink_purchase_orders
ADD COLUMN IF NOT EXISTS shipper_id UUID REFERENCES blink_business_partners(id),
ADD COLUMN IF NOT EXISTS shipper_name TEXT,
ADD COLUMN IF NOT EXISTS shipper_address TEXT,
ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES blink_business_partners(id),
ADD COLUMN IF NOT EXISTS consignee_name TEXT,
ADD COLUMN IF NOT EXISTS consignee_address TEXT,
ADD COLUMN IF NOT EXISTS approval_signature TEXT,
ADD COLUMN IF NOT EXISTS approval_signature_date TIMESTAMP;

-- 2. Add subject column and quotation linkage to blink_shipments (for BL/AWB)
ALTER TABLE blink_shipments
ADD COLUMN IF NOT EXISTS bl_subject TEXT,
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES blink_quotations(id),
ADD COLUMN IF NOT EXISTS quotation_shipper_name TEXT,
ADD COLUMN IF NOT EXISTS quotation_consignee_name TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_po_shipper ON blink_purchase_orders(shipper_id);
CREATE INDEX IF NOT EXISTS idx_po_consignee ON blink_purchase_orders(consignee_id);
CREATE INDEX IF NOT EXISTS idx_shipment_quotation ON blink_shipments(quotation_id);

-- Add comments for documentation
COMMENT ON COLUMN blink_purchase_orders.shipper_id IS 'Reference to business partner acting as shipper';
COMMENT ON COLUMN blink_purchase_orders.consignee_id IS 'Reference to business partner acting as consignee';
COMMENT ON COLUMN blink_purchase_orders.approval_signature IS 'Digital signature for PO approval (base64 or URL)';
COMMENT ON COLUMN blink_shipments.bl_subject IS 'Subject/description of the BL/AWB shipment';
COMMENT ON COLUMN blink_shipments.quotation_id IS 'Reference to quotation used to auto-populate BL/AWB data';
COMMENT ON COLUMN blink_shipments.quotation_shipper_name IS 'Shipper name from linked quotation - for data consistency';
COMMENT ON COLUMN blink_shipments.quotation_consignee_name IS 'Consignee name from linked quotation - for data consistency';

-- Verification query (optional - uncomment to check)
-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'blink_shipments' 
--   AND column_name IN ('bl_subject', 'quotation_id', 'quotation_shipper_name', 'quotation_consignee_name')
-- ORDER BY column_name;
