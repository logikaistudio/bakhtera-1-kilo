-- Perbaikan menyeluruh saldo gudang & log mutasi Bridge.
-- Jalankan di Supabase SQL Editor, PER BLOK, berurutan. Setiap blok berdiri sendiri.
-- Semua perubahan dicadangkan lebih dulu; perintah rollback ada di akhir file.

-- ===== BLOK 0: view bantu (tidak mengubah data) =====
CREATE OR REPLACE VIEW v_wr AS
WITH awal AS (
    SELECT q.quotation_number AS pengajuan_number,
           pkg ->> 'packageNumber' AS package_number,
           itm ->> 'itemCode' AS item_code,
           SUM(COALESCE(NULLIF(itm ->> 'quantity', '')::numeric, 0)) AS jumlah_awal
    FROM freight_quotations q
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(q.packages, '[]'::jsonb)) pkg
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pkg -> 'items', '[]'::jsonb)) itm
    WHERE COALESCE(q.type, 'inbound') <> 'outbound'
    GROUP BY 1, 2, 3
),
awal_item AS (
    SELECT pengajuan_number, item_code, SUM(jumlah_awal) AS jumlah_awal, COUNT(*) AS n
    FROM awal GROUP BY 1, 2
),
mut AS (
    SELECT pengajuan_number, documents ->> 'packageNumber' AS package_number, item_code,
           SUM(CASE WHEN lower(trim(destination)) IN ('warehouse', 'gudang') THEN -mutated_qty ELSE mutated_qty END) AS out_net
    FROM freight_mutation_logs GROUP BY 1, 2, 3
),
mut_item AS (
    SELECT pengajuan_number, item_code,
           SUM(CASE WHEN lower(trim(destination)) IN ('warehouse', 'gudang') THEN -mutated_qty ELSE mutated_qty END) AS out_net
    FROM freight_mutation_logs GROUP BY 1, 2
),
gudang AS (
    SELECT pengajuan_number, package_number, item_code,
           COUNT(*) AS jumlah_baris, MIN(id::text) AS first_id, SUM(quantity) AS saldo
    FROM freight_warehouse GROUP BY 1, 2, 3
),
gudang_item AS (
    SELECT pengajuan_number, item_code, COUNT(*) AS n FROM gudang GROUP BY 1, 2
)
SELECT g.pengajuan_number, g.package_number, g.item_code,
       g.jumlah_baris, g.first_id, g.saldo,
       (a.jumlah_awal IS NULL) AS pakai_fallback,
       COALESCE(a.jumlah_awal, CASE WHEN ai.n = 1 AND gi.n = 1 THEN ai.jumlah_awal END) AS awal,
       CASE WHEN a.jumlah_awal IS NOT NULL THEN COALESCE(mu.out_net, 0)
            ELSE COALESCE(mi.out_net, 0) END AS out_net
FROM gudang g
LEFT JOIN awal a ON a.pengajuan_number = g.pengajuan_number
                AND a.package_number = g.package_number AND a.item_code = g.item_code
LEFT JOIN awal_item ai ON ai.pengajuan_number = g.pengajuan_number AND ai.item_code = g.item_code
LEFT JOIN gudang_item gi ON gi.pengajuan_number = g.pengajuan_number AND gi.item_code = g.item_code
LEFT JOIN mut mu ON mu.pengajuan_number = g.pengajuan_number
                AND mu.package_number = g.package_number AND mu.item_code = g.item_code
LEFT JOIN mut_item mi ON mi.pengajuan_number = g.pengajuan_number AND mi.item_code = g.item_code;

-- ===== BLOK 1: PRATINJAU log mutasi dobel (SELECT saja) =====
-- Log dobel = pengajuan, paket, kode barang, asal, tujuan, jumlah, tanggal, jam sama.
-- Hanya dihitung pada barang yang tercatat keluar lebih banyak dari jumlah awalnya.
WITH over_key AS (
    SELECT pengajuan_number, package_number, item_code FROM v_wr
    WHERE NOT pakai_fallback AND awal IS NOT NULL AND out_net > awal
),
ranked AS (
    SELECT m.id, m.pengajuan_number, m.documents ->> 'packageNumber' AS package_number,
           m.item_code, m.destination, m.mutated_qty, m.date, m.time,
           ROW_NUMBER() OVER (
               PARTITION BY m.pengajuan_number, m.documents ->> 'packageNumber', m.item_code,
                            m.origin, m.destination, m.mutated_qty, m.date, m.time
               ORDER BY m.created_at, m.id) AS rn
    FROM freight_mutation_logs m
    JOIN over_key o ON o.pengajuan_number = m.pengajuan_number
                   AND o.package_number = m.documents ->> 'packageNumber'
                   AND o.item_code = m.item_code
)
SELECT pengajuan_number, package_number, item_code, destination, mutated_qty, date, time, COUNT(*) AS log_dobel_akan_dihapus
FROM ranked WHERE rn > 1
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY 1, 2, 3;

-- ===== BLOK 2: HAPUS log dobel (dengan cadangan) =====
CREATE TABLE IF NOT EXISTS freight_mutation_logs_dedupe_backup AS
SELECT * FROM freight_mutation_logs WHERE false;

CREATE TEMP TABLE log_dobel AS
WITH over_key AS (
    SELECT pengajuan_number, package_number, item_code FROM v_wr
    WHERE NOT pakai_fallback AND awal IS NOT NULL AND out_net > awal
),
ranked AS (
    SELECT m.id,
           ROW_NUMBER() OVER (
               PARTITION BY m.pengajuan_number, m.documents ->> 'packageNumber', m.item_code,
                            m.origin, m.destination, m.mutated_qty, m.date, m.time
               ORDER BY m.created_at, m.id) AS rn
    FROM freight_mutation_logs m
    JOIN over_key o ON o.pengajuan_number = m.pengajuan_number
                   AND o.package_number = m.documents ->> 'packageNumber'
                   AND o.item_code = m.item_code
)
SELECT id FROM ranked WHERE rn > 1;

INSERT INTO freight_mutation_logs_dedupe_backup
SELECT m.* FROM freight_mutation_logs m JOIN log_dobel d ON d.id = m.id;

DELETE FROM freight_mutation_logs m USING log_dobel d WHERE d.id = m.id;

SELECT COUNT(*) AS log_dobel_dihapus FROM log_dobel;

-- ===== BLOK 3: PRATINJAU koreksi saldo gudang (SELECT saja) =====
-- saldo target = jumlah awal - barang di luar gudang (maks. sebesar jumlah awal).
-- Baris terpecah (lebih dari 1 baris gudang): saldo digabung ke baris pertama, sisanya 0.
-- Kode barang kosong/'-' dengan banyak baris TIDAK diubah (dianggap barang berbeda).
SELECT pengajuan_number, package_number, item_code, jumlah_baris, saldo AS saldo_sekarang, awal,
       GREATEST(out_net, 0) AS di_luar,
       GREATEST(awal - LEAST(GREATEST(out_net, 0), awal), 0) AS saldo_target,
       CASE WHEN pakai_fallback THEN 'cocok via kode barang' ELSE 'cocok via paket+kode' END AS cara_cocok
FROM v_wr
WHERE awal IS NOT NULL
  AND (jumlah_baris = 1 OR item_code NOT IN ('', '-'))
  AND (saldo IS DISTINCT FROM GREATEST(awal - LEAST(GREATEST(out_net, 0), awal), 0)
       OR (jumlah_baris > 1 AND EXISTS (
            SELECT 1 FROM freight_warehouse w
            WHERE w.pengajuan_number = v_wr.pengajuan_number
              AND w.package_number = v_wr.package_number AND w.item_code = v_wr.item_code
              AND w.id::text <> v_wr.first_id AND w.quantity <> 0)))
ORDER BY 1, 2, 3;

-- ===== BLOK 4: UPDATE saldo gudang (dengan cadangan) =====
CREATE TABLE IF NOT EXISTS freight_warehouse_stock_backup (
    id text, quantity numeric, backed_up_at timestamptz DEFAULT now()
);

CREATE TEMP TABLE saldo_baru AS
SELECT w.id::text AS id, w.quantity AS lama,
       CASE WHEN w.id::text = v.first_id
            THEN GREATEST(v.awal - LEAST(GREATEST(v.out_net, 0), v.awal), 0)
            ELSE 0 END AS baru
FROM v_wr v
JOIN freight_warehouse w
  ON w.pengajuan_number = v.pengajuan_number
 AND w.package_number = v.package_number
 AND w.item_code = v.item_code
WHERE v.awal IS NOT NULL
  AND (v.jumlah_baris = 1 OR v.item_code NOT IN ('', '-'));

INSERT INTO freight_warehouse_stock_backup (id, quantity)
SELECT id, lama FROM saldo_baru WHERE lama IS DISTINCT FROM baru;

UPDATE freight_warehouse w
SET quantity = s.baru, updated_at = now()
FROM saldo_baru s
WHERE s.id = w.id::text AND s.lama IS DISTINCT FROM s.baru;

SELECT COUNT(*) AS baris_diubah FROM saldo_baru WHERE lama IS DISTINCT FROM baru;

-- ===== BLOK 5: VERIFIKASI =====
SELECT COUNT(*) FILTER (WHERE quantity < 0) AS saldo_minus,
       COUNT(*) FILTER (WHERE quantity = 0) AS saldo_nol,
       COUNT(*) FILTER (WHERE quantity > 0) AS saldo_ada
FROM freight_warehouse;

-- ===== ROLLBACK (jika perlu) =====
-- UPDATE freight_warehouse w SET quantity = b.quantity, updated_at = now()
-- FROM freight_warehouse_stock_backup b WHERE b.id = w.id::text;
-- INSERT INTO freight_mutation_logs SELECT * FROM freight_mutation_logs_dedupe_backup
-- ON CONFLICT (id) DO NOTHING;
-- DROP VIEW IF EXISTS v_wr;  -- bersihkan view bantu setelah selesai
