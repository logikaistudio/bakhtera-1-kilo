-- ============================================================
-- FIX: Hapus CHECK constraint pada users.user_level
-- Constraint lama membatasi hanya 5 role bawaan.
-- Sekarang role dinamis (bisa ditambah dari halaman Manajemen Role),
-- jadi constraint harus dihapus agar role custom bisa dipakai.
-- ============================================================

-- Hapus constraint lama
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_level_check;

-- Verifikasi
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'user_level';
