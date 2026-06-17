-- Migration: Add item_date to freight_quotations
-- Run this in Supabase SQL editor or via your migration runner.

ALTER TABLE public.freight_quotations
ADD COLUMN IF NOT EXISTS item_date DATE;

-- Optional: add comment for clarity
COMMENT ON COLUMN public.freight_quotations.item_date IS 'Tanggal masuk/keluar barang (item_date) — optional';
