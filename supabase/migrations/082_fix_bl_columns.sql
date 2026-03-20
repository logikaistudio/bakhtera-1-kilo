-- Migration: Pastikan semua field BL Management tersedia di blink_shipments
-- Jika terjadi error "could not find the X column of blink_shipments in the schema cache", 
-- ini menandakan kolom tersebut belum tercatat di database cache.
-- Menjalankan file ini akan menambahkan dan menyegarkan skema tabel.

ALTER TABLE blink_shipments 
    ADD COLUMN IF NOT EXISTS bl_status VARCHAR(50) DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS bl_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_type VARCHAR(10),
    ADD COLUMN IF NOT EXISTS bl_subject TEXT,
    ADD COLUMN IF NOT EXISTS bl_shipper_name TEXT,
    ADD COLUMN IF NOT EXISTS bl_shipper_address TEXT,
    ADD COLUMN IF NOT EXISTS bl_consignee_name TEXT,
    ADD COLUMN IF NOT EXISTS bl_consignee_address TEXT,
    ADD COLUMN IF NOT EXISTS bl_notify_party_name TEXT,
    ADD COLUMN IF NOT EXISTS bl_notify_party_address TEXT,
    ADD COLUMN IF NOT EXISTS bl_place_of_receipt TEXT,
    ADD COLUMN IF NOT EXISTS bl_place_of_delivery TEXT,
    ADD COLUMN IF NOT EXISTS bl_pre_carriage_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_loading_pier VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_export_references TEXT,
    ADD COLUMN IF NOT EXISTS bl_forwarding_agent_ref TEXT,
    ADD COLUMN IF NOT EXISTS bl_type_of_move VARCHAR(50),
    ADD COLUMN IF NOT EXISTS bl_country_of_origin VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bl_marks_numbers TEXT,
    ADD COLUMN IF NOT EXISTS bl_description_packages TEXT,
    ADD COLUMN IF NOT EXISTS bl_gross_weight_text VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_measurement_text VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_total_packages_text VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bl_freight_payable_at VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bl_number_of_originals VARCHAR(50),
    ADD COLUMN IF NOT EXISTS bl_issued_place VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bl_issued_date DATE,
    ADD COLUMN IF NOT EXISTS bl_freight_charges TEXT,
    ADD COLUMN IF NOT EXISTS bl_prepaid TEXT,
    ADD COLUMN IF NOT EXISTS bl_collect TEXT,
    ADD COLUMN IF NOT EXISTS bl_shipped_on_board_date VARCHAR(50),
    ADD COLUMN IF NOT EXISTS quotation_shipper_name TEXT,
    ADD COLUMN IF NOT EXISTS quotation_consignee_name TEXT;

-- Refresh cache Supabase API dengan memanipulasi kolom statis (trick)
NOTIFY pgrst, 'reload schema';
