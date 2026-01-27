-- Migration to add comprehensive BL/AWB document columns to blink_shipments
-- These columns allow for static document generation independent of master data changes

-- 1. Parties Details
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS bl_shipper_name TEXT,
ADD COLUMN IF NOT EXISTS bl_shipper_address TEXT,
ADD COLUMN IF NOT EXISTS bl_consignee_name TEXT,
ADD COLUMN IF NOT EXISTS bl_consignee_address TEXT,
ADD COLUMN IF NOT EXISTS bl_notify_party_name TEXT,
ADD COLUMN IF NOT EXISTS bl_notify_party_address TEXT;

-- 2. Routing & References
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS bl_export_references TEXT,
ADD COLUMN IF NOT EXISTS bl_forwarding_agent_ref TEXT,
ADD COLUMN IF NOT EXISTS bl_point_of_origin TEXT,
ADD COLUMN IF NOT EXISTS bl_pre_carriage_by TEXT,
ADD COLUMN IF NOT EXISTS bl_place_of_receipt TEXT,
ADD COLUMN IF NOT EXISTS bl_place_of_delivery TEXT,
ADD COLUMN IF NOT EXISTS bl_loading_pier TEXT;

-- 3. Cargo Particulars (Print Specifics)
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS bl_marks_numbers TEXT,
ADD COLUMN IF NOT EXISTS bl_description_packages TEXT,
ADD COLUMN IF NOT EXISTS bl_gross_weight_text TEXT,
ADD COLUMN IF NOT EXISTS bl_measurement_text TEXT,
ADD COLUMN IF NOT EXISTS bl_total_packages_text TEXT;

-- 4. Footer & Issuance Details
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS bl_freight_payable_at TEXT,
ADD COLUMN IF NOT EXISTS bl_number_of_originals TEXT,
ADD COLUMN IF NOT EXISTS bl_issued_place TEXT,
ADD COLUMN IF NOT EXISTS bl_issued_date DATE;

-- Comments for documentation
COMMENT ON COLUMN blink_shipments.bl_shipper_address IS 'Calculated static address string for Shipper on BL';
COMMENT ON COLUMN blink_shipments.bl_consignee_address IS 'Calculated static address string for Consignee on BL';
COMMENT ON COLUMN blink_shipments.bl_notify_party_address IS 'Address for Notify Party';
COMMENT ON COLUMN blink_shipments.bl_export_references IS 'Exporter references (e.g. Invoice No)';
COMMENT ON COLUMN blink_shipments.bl_marks_numbers IS 'Marks and Numbers text area';
COMMENT ON COLUMN blink_shipments.bl_description_packages IS 'Full cargo description text area';
COMMENT ON COLUMN blink_shipments.bl_total_packages_text IS 'Total packages in words (e.g. ONE PALLET ONLY)';
