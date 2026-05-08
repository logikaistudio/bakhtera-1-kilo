-- =============================================================
-- CLEANUP: Hapus Reversal Journal yang Salah
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================================

-- LANGKAH 1: AUDIT (wajib jalankan dulu, lihat hasilnya)
-- ─────────────────────────────────────────────────────────────
SELECT 
    id,
    entry_number,
    entry_date,
    reference_type,
    reference_number,
    account_code,
    account_name,
    debit,
    credit,
    batch_id
FROM blink_journal_entries
WHERE 
    entry_type = 'reversal'
    AND reference_type IN ('ar_reversal', 'ap_reversal')
ORDER BY entry_date DESC;

-- =============================================================
-- LANGKAH 2: RINGKASAN (untuk konfirmasi jumlah data)
-- =============================================================

SELECT 
    reference_type,
    COUNT(*) as jumlah_entri,
    COUNT(DISTINCT batch_id) as jumlah_transaksi,
    SUM(debit) as total_debit,
    SUM(credit) as total_credit
FROM blink_journal_entries
WHERE 
    entry_type = 'reversal'
    AND reference_type IN ('ar_reversal', 'ap_reversal')
GROUP BY reference_type;

-- =============================================================
-- LANGKAH 3: DELETE (jalankan SETELAH mengkonfirmasi data di atas)
-- ⚠️ Tidak bisa di-undo! Pastikan Langkah 1 sudah di-review.
-- =============================================================

DELETE FROM blink_journal_entries
WHERE 
    entry_type = 'reversal'
    AND reference_type IN ('ar_reversal', 'ap_reversal');

-- =============================================================
-- LANGKAH 4: VERIFIKASI (pastikan hasilnya 0)
-- =============================================================

SELECT COUNT(*) as sisa_reversal_salah
FROM blink_journal_entries
WHERE 
    entry_type = 'reversal'
    AND reference_type IN ('ar_reversal', 'ap_reversal');

-- Harusnya: sisa_reversal_salah = 0

-- =============================================================
-- BONUS: Cek akun OTHER ASSETS / OTHER PAYABLES setelah hapus
-- =============================================================

SELECT 
    account_code,
    account_name,
    SUM(debit) as total_debit,
    SUM(credit) as total_credit,
    SUM(debit) - SUM(credit) as balance
FROM blink_journal_entries
WHERE account_name ILIKE '%other%'
GROUP BY account_code, account_name
ORDER BY account_code;
