-- ============================================================
-- BAKHTERA-1 DATABASE SETUP
-- Jalankan SELURUH script ini di Supabase SQL Editor
-- https://supabase.com/dashboard/project/nkyoszmtyrpdwfjxggmb/sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLE: users (jika belum ada)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username                TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    full_name               TEXT,
    email                   TEXT,
    user_level              TEXT NOT NULL DEFAULT 'staff',
    portal_access           BOOLEAN DEFAULT true,
    is_active               BOOLEAN DEFAULT true,
    requires_password_change BOOLEAN DEFAULT true,
    last_login              TIMESTAMPTZ,
    created_by              UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. TABLE: user_sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. TABLE: user_audit_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_audit_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type     TEXT NOT NULL,
    target_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    performed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    old_value       JSONB,
    new_value       JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. TABLE: menu_registry
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_registry (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    menu_code       TEXT NOT NULL UNIQUE,
    menu_name       TEXT NOT NULL,
    category        TEXT NOT NULL,
    order_index     INT DEFAULT 0,
    has_approval    BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. TABLE: role_permissions
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.role_permissions;
CREATE TABLE public.role_permissions (
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
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_code ON public.role_permissions(menu_code);

-- ─────────────────────────────────────────────────────────────
-- 6. TABLE: user_menu_permissions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
    id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    menu_code                   TEXT NOT NULL,
    can_access                  BOOLEAN DEFAULT false,
    can_view                    BOOLEAN DEFAULT false,
    can_create                  BOOLEAN DEFAULT false,
    can_edit                    BOOLEAN DEFAULT false,
    can_delete                  BOOLEAN DEFAULT false,
    can_approve                 BOOLEAN DEFAULT false,
    requires_approval_for_edit  BOOLEAN DEFAULT false,
    requires_approval_for_delete BOOLEAN DEFAULT false,
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, menu_code)
);

-- ─────────────────────────────────────────────────────────────
-- 7. Enable RLS + Policies (allow anon for now)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "anon_all_users" ON public.users;
DROP POLICY IF EXISTS "anon_all_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "anon_all_audit" ON public.user_audit_log;
DROP POLICY IF EXISTS "anon_all_menus" ON public.menu_registry;
DROP POLICY IF EXISTS "anon_all_role_perms" ON public.role_permissions;
DROP POLICY IF EXISTS "anon_all_user_perms" ON public.user_menu_permissions;

-- Create open policies (untuk development)
CREATE POLICY "anon_all_users" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_sessions" ON public.user_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_audit" ON public.user_audit_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_menus" ON public.menu_registry FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_role_perms" ON public.role_permissions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_user_perms" ON public.user_menu_permissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 8. Seed menu_registry - Bridge menus
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.menu_registry (menu_code, menu_name, category, order_index) VALUES
  ('bridge_dashboard',        'Dashboard Bridge',        'Bridge', 10),
  ('bridge_pengajuan',        'Pengajuan',               'Bridge', 11),
  ('bridge_ata_carnet',       'ATA Carnet',              'Bridge', 12),
  ('bridge_inventory',        'Inventaris Gudang',       'Bridge', 13),
  ('bridge_outbound',         'Laporan Barang Keluar',   'Bridge', 14),
  ('bridge_movement',         'Pergerakan Barang',       'Bridge', 15),
  ('bridge_delivery',         'Delivery Notes',          'Bridge', 16),
  ('bridge_approval',         'Approval Manager',        'Bridge', 17),
  ('bridge_activity',         'Activity Logger',         'Bridge', 18),
  ('bridge_finance',          'Keuangan Bridge',         'Bridge', 19),
  ('bridge_coa',              'Kode Akun',               'Bridge', 20),
  ('bridge_partners',         'Mitra Bisnis',            'Bridge', 21),
  ('bridge_bc_master',        'BC Master',               'Bridge', 22),
  ('bridge_item_master',      'Item Master',             'Bridge', 23),
  ('bridge_hs_master',        'HS Master',               'Bridge', 24),
  ('bridge_pabean',           'Pabean Dashboard',        'Bridge', 25),
  ('bridge_barang_masuk',     'Pabean - Barang Masuk',   'Bridge', 26),
  ('bridge_barang_keluar',    'Pabean - Barang Keluar',  'Bridge', 27),
  ('bridge_barang_reject',    'Pabean - Barang Reject',  'Bridge', 28),
  ('bridge_pabean_movement',  'Pabean - Pergerakan',     'Bridge', 29),
  ('bridge_settings',         'Pengaturan Modul',        'Bridge', 30)
ON CONFLICT (menu_code) DO UPDATE SET menu_name = EXCLUDED.menu_name, category = EXCLUDED.category;

-- Blink menus
INSERT INTO public.menu_registry (menu_code, menu_name, category, order_index) VALUES
  ('blink_dashboard',         'Dashboard Blink',         'Blink', 40),
  ('blink_quotations',        'Quotation',               'Blink', 41),
  ('blink_shipments',         'Shipment',                'Blink', 42),
  ('blink_flow_monitor',      'Flow Monitor',            'Blink', 43),
  ('blink_sales',             'Sales Achievement',       'Blink', 44),
  ('blink_tracking',          'Tracking & Monitoring',   'Blink', 45),
  ('blink_awb',               'AWB Management',          'Blink', 46),
  ('blink_bl',                'BL Management',           'Blink', 47),
  ('blink_invoices',          'Invoice',                 'Blink', 48),
  ('blink_purchase_order',    'Purchase Order',          'Blink', 49),
  ('blink_journal',           'Jurnal Umum',             'Blink', 50),
  ('blink_ledger',            'Buku Besar',              'Blink', 51),
  ('blink_trial_balance',     'Trial Balance',           'Blink', 52),
  ('blink_ar',                'Piutang (AR)',            'Blink', 53),
  ('blink_ap',                'Hutang (AP)',             'Blink', 54),
  ('blink_pnl',               'Laba Rugi',               'Blink', 55),
  ('blink_balance_sheet',     'Neraca',                  'Blink', 56),
  ('blink_selling_buying',    'Selling vs Buying',       'Blink', 57),
  ('blink_routes',            'Master Rute',             'Blink', 58),
  ('blink_partners',          'Mitra Bisnis',            'Blink', 59),
  ('blink_settings',          'Pengaturan Modul',        'Blink', 60)
ON CONFLICT (menu_code) DO UPDATE SET menu_name = EXCLUDED.menu_name, category = EXCLUDED.category;

-- Big menus
INSERT INTO public.menu_registry (menu_code, menu_name, category, order_index) VALUES
  ('big_dashboard',           'Dashboard BIG',           'Big', 70),
  ('big_events',              'Event Management',        'Big', 71),
  ('big_costs',               'Event Costs',             'Big', 72),
  ('big_quotations',          'Quotation',               'Big', 73),
  ('big_invoices',            'Invoice',                 'Big', 74),
  ('big_ar',                  'Piutang (AR)',            'Big', 75),
  ('big_settings',            'Pengaturan Modul',        'Big', 76)
ON CONFLICT (menu_code) DO UPDATE SET menu_name = EXCLUDED.menu_name, category = EXCLUDED.category;

-- ─────────────────────────────────────────────────────────────
-- 9. Seed role_permissions (default rules)
-- ─────────────────────────────────────────────────────────────
-- Direksi: akses + lihat + approve (view only, no CRUD)
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'direksi', 'Direksi', menu_code, true, true, false, false, false, true
FROM public.menu_registry
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Chief: akses + lihat + edit + approve
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'chief', 'Chief', menu_code, true, true, false, true, false, true
FROM public.menu_registry
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Manager: akses + lihat + buat + edit
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'manager', 'Manager', menu_code, true, true, true, true, false, false
FROM public.menu_registry
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Staff: akses + lihat + buat
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'staff', 'Staff', menu_code, true, true, true, false, false, false
FROM public.menu_registry
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Viewer: akses + lihat saja
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'viewer', 'Viewer', menu_code, true, true, false, false, false, false
FROM public.menu_registry
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 10. Verifikasi hasil
-- ─────────────────────────────────────────────────────────────
SELECT 'users' as tabel, COUNT(*) as jumlah FROM public.users
UNION ALL
SELECT 'menu_registry', COUNT(*) FROM public.menu_registry
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM public.role_permissions
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM public.user_sessions
UNION ALL
SELECT 'user_audit_log', COUNT(*) FROM public.user_audit_log
UNION ALL
SELECT 'user_menu_permissions', COUNT(*) FROM public.user_menu_permissions;
