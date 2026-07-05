-- Add offer_type to blink_sales_quotations for sales quotation metadata and print title display
ALTER TABLE public.blink_sales_quotations
    ADD COLUMN IF NOT EXISTS offer_type VARCHAR(255);

COMMENT ON COLUMN public.blink_sales_quotations.offer_type IS 'Jenis penawaran untuk sales quotation, ditampilkan pada dokumen cetak dan dapat dipilih dari UI';
