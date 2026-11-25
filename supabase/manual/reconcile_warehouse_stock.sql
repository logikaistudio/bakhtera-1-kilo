-- Rekonsiliasi saldo freight_warehouse ke jumlah awal pengajuan.
-- Dijalankan MANUAL di Supabase SQL Editor. Jalankan per LANGKAH, bukan sekaligus.
--
-- Saldo target = jumlah awal pada freight_quotations.packages
--                - barang yang sedang di luar gudang (mutasi keluar - mutasi kembali).
-- Hanya baris yang aman yang disentuh:
--   * tepat 1 baris gudang untuk kombinasi pengajuan + paket + kode barang
--   * saldo saat ini berbeda dari target
-- Kombinasi dengan banyak baris atau tanpa pasangan jumlah awal hanya dilaporkan (LANGKAH 1b).

-- ===== LANGKAH 1: PRATINJAU (tidak mengubah data) =====
CREATE TEMP TABLE reconcile_preview AS
WITH awal AS (
    SELECT q.id AS pengajuan_id,
           q.quotation_number AS pengajuan_number,
           pkg ->> 'packageNumber' AS package_number,
           itm ->> 'itemCode' AS item_code,
           SUM(COALESCE(NULLIF(itm ->> 'quantity', '')::numeric, 0)) AS jumlah_awal
    FROM freight_quotations q
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(q.packages, '[]'::jsonb)) pkg
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pkg -> 'items', '[]'::jsonb)) itm
    WHERE COALESCE(q.type, 'inbound') <> 'outbound'
    GROUP BY 1, 2, 3, 4
),
mutasi AS (
    SELECT m.pengajuan_number,
           m.documents ->> 'packageNumber' AS package_number,
           m.item_code,
           SUM(CASE WHEN lower(trim(m.destination)) NOT IN ('warehouse', 'gudang')
                    THEN m.mutated_qty ELSE 0 END)
         - SUM(CASE WHEN lower(trim(m.destination)) IN ('warehouse', 'gudang')
                    THEN m.mutated_qty ELSE 0 END) AS di_luar
    FROM freight_mutation_logs m
    GROUP BY 1, 2, 3
),
gudang AS (
    SELECT w.pengajuan_number, w.package_number, w.item_code,
           COUNT(*) AS jumlah_baris,
           MIN(w.id::text) AS warehouse_id,
           SUM(w.quantity) AS saldo_sekarang
    FROM freight_warehouse w
    GROUP BY 1, 2, 3
)
SELECT g.pengajuan_number, g.package_number, g.item_code,
       g.jumlah_baris, g.warehouse_id, g.saldo_sekarang,
       a.jumlah_awal,
       COALESCE(GREATEST(mu.di_luar, 0), 0) AS di_luar,
       GREATEST(a.jumlah_awal - COALESCE(GREATEST(mu.di_luar, 0), 0), 0) AS saldo_target
FROM gudang g
LEFT JOIN awal a
       ON a.pengajuan_number = g.pengajuan_number
      AND a.package_number = g.package_number
      AND a.item_code = g.item_code
LEFT JOIN mutasi mu
       ON mu.pengajuan_number = g.pengajuan_number
      AND mu.package_number = g.package_number
      AND mu.item_code = g.item_code;

-- 1a. Baris yang akan diubah (periksa dulu dengan teliti)
SELECT pengajuan_number, package_number, item_code,
       saldo_sekarang, jumlah_awal, di_luar, saldo_target
FROM reconcile_preview
WHERE jumlah_baris = 1
  AND jumlah_awal IS NOT NULL
  AND saldo_sekarang IS DISTINCT FROM saldo_target
ORDER BY pengajuan_number, package_number, item_code;

-- 1b. Baris yang TIDAK diubah otomatis (perlu dicek manual)
SELECT pengajuan_number, package_number, item_code,
       jumlah_baris, saldo_sekarang, jumlah_awal,
       CASE WHEN jumlah_awal IS NULL THEN 'jumlah awal tidak ditemukan'
            ELSE 'lebih dari satu baris gudang' END AS alasan
FROM reconcile_preview
WHERE (jumlah_baris > 1 OR jumlah_awal IS NULL)
ORDER BY pengajuan_number, package_number, item_code;

-- ===== LANGKAH 2: BACKUP + UPDATE (jalankan setelah pratinjau benar) =====
-- Backup nilai lama agar bisa dikembalikan.
CREATE TABLE IF NOT EXISTS freight_warehouse_stock_backup AS
SELECT w.id, w.quantity, now() AS backed_up_at
FROM freight_warehouse w
WHERE false;

INSERT INTO freight_warehouse_stock_backup (id, quantity, backed_up_at)
SELECT w.id, w.quantity, now()
FROM freight_warehouse w
JOIN reconcile_preview p ON p.warehouse_id = w.id::text
WHERE p.jumlah_baris = 1
  AND p.jumlah_awal IS NOT NULL
  AND p.saldo_sekarang IS DISTINCT FROM p.saldo_target;

UPDATE freight_warehouse w
SET quantity = p.saldo_target,
    updated_at = now()
FROM reconcile_preview p
WHERE p.warehouse_id = w.id::text
  AND p.jumlah_baris = 1
  AND p.jumlah_awal IS NOT NULL
  AND p.saldo_sekarang IS DISTINCT FROM p.saldo_target;

-- ===== ROLLBACK (jika perlu) =====
-- UPDATE freight_warehouse w
-- SET quantity = b.quantity, updated_at = now()
-- FROM freight_warehouse_stock_backup b
-- WHERE b.id = w.id;
