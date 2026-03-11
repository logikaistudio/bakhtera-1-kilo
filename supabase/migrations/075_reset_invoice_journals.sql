-- ============================================================
-- MIGRATION 075: Reset Invoice and COGS Journal Entries
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Skrip ini akan menghapus jurnal invoice lama yang "lump-sum"
-- (hanya mencatat 'Ocean Freight' secara total).
-- Setelah menjalankan ini, Anda bisa menekan tombol 
-- "Migrate Auto Journal" di halaman Invoice Management
-- untuk membuat ulang jurnal yang MENDETAIL PER ITEM.
-- ============================================================

DELETE FROM blink_journal_entries
WHERE entry_type IN ('invoice', 'cogs');

-- Verifikasi sisa data (seharusnya invoice/cogs sudah hilang)
SELECT entry_type, COUNT(*) 
FROM blink_journal_entries 
GROUP BY entry_type;
