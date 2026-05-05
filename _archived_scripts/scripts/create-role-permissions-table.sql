-- =============================================
-- CREATE TABLE: role_permissions
-- Jalankan di Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id         TEXT NOT NULL,
    role_label      TEXT,
    menu_code       TEXT NOT NULL,
    can_access      BOOLEAN DEFAULT false,
    can_view        BOOLEAN DEFAULT false,
    can_create      BOOLEAN DEFAULT false,
    can_edit        BOOLEAN DEFAULT false,
    can_delete      BOOLEAN DEFAULT false,
    can_approve     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (role_id, menu_code)
);

-- Enable RLS (Read/Write for authenticated/anon)
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.role_permissions
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
    ON public.role_permissions (role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_code
    ON public.role_permissions (menu_code);
