-- Migration 105: Add prepared_by (Nama Pembuat) to blink_sales_quotations
-- This stores the manually entered name of the person who prepared the quotation

ALTER TABLE public.blink_sales_quotations
    ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(255);

COMMENT ON COLUMN public.blink_sales_quotations.prepared_by IS 'Nama pembuat quotation (diisi manual, tampil di dokumen cetak)';
