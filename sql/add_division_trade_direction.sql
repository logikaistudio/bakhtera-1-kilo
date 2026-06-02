-- Migration: Tambah kolom division ke blink_sales_targets
--             dan trade_direction ke blink_shipments
-- Jalankan di Supabase SQL Editor (sudah dieksekusi pada 2026-06-02)

-- 1. Divisi per sales person (1 sales = 1 divisi)
ALTER TABLE blink_sales_targets
  ADD COLUMN IF NOT EXISTS division text NOT NULL DEFAULT 'Umum';

-- 2. Arah pengiriman per shipment (import / export / domestic)
--    Nullable — data lama tidak wajib diisi
ALTER TABLE blink_shipments
  ADD COLUMN IF NOT EXISTS trade_direction text
  CHECK (trade_direction IN ('import', 'export', 'domestic'));

-- Verifikasi
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('blink_sales_targets', 'blink_shipments')
  AND column_name IN ('division', 'trade_direction')
ORDER BY table_name, column_name;
