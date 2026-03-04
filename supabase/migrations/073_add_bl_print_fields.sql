-- Migration: Add missing BL document fields to blink_shipments
-- These fields are used in the BL print template but previously had no form fields

-- 1. Type of Move (e.g. FCL/FCL, LCL/LCL, CY/CY)
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_type_of_move VARCHAR(50);

-- 2. Country of Origin (previously hardcoded as INDONESIA)
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_country_of_origin VARCHAR(255);

-- 3. Freight & Charges text
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_freight_charges TEXT;

-- 4. Prepaid amount/text
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_prepaid TEXT;

-- 5. Collect amount/text
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_collect TEXT;

-- 6. Shipped on Board Date
ALTER TABLE blink_shipments ADD COLUMN IF NOT EXISTS bl_shipped_on_board_date VARCHAR(50);

-- Comments
COMMENT ON COLUMN blink_shipments.bl_type_of_move IS 'Type of move for BL print, e.g. FCL/FCL, LCL/LCL';
COMMENT ON COLUMN blink_shipments.bl_country_of_origin IS 'Point and country of origin for BL print';
COMMENT ON COLUMN blink_shipments.bl_freight_charges IS 'Freight & charges description for BL print';
COMMENT ON COLUMN blink_shipments.bl_prepaid IS 'Prepaid freight value for BL print';
COMMENT ON COLUMN blink_shipments.bl_collect IS 'Collect freight value for BL print';
COMMENT ON COLUMN blink_shipments.bl_shipped_on_board_date IS 'Shipped on board date for BL print';
