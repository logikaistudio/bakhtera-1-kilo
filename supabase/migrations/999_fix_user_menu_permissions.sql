-- ============================================================
-- FIX: user_menu_permissions table
-- Kolom `created_by` tidak ada di tabel ini → menyebabkan error cache
-- Tambahkan kolom `set_by` (yang dipakai permissionService.js)
-- ============================================================

-- Tambah kolom set_by kalau belum ada
ALTER TABLE public.user_menu_permissions
    ADD COLUMN IF NOT EXISTS set_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Pastikan kolom updated_at ada (untuk upsert)
ALTER TABLE public.user_menu_permissions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Verifikasi struktur tabel
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_menu_permissions'
ORDER BY ordinal_position;
