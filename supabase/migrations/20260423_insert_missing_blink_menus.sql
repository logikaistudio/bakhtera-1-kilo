-- ============================================================
-- INSERT MISSING BLINK MENU CODES INTO role_permissions
-- Date: 2026-04-23
-- Problem: beberapa menu code ada di Sidebar/App.jsx tapi TIDAK ADA
--          di menuConfig.js → tidak pernah di-sync ke DB → permission
--          tidak bisa dikonfigurasi → akses selalu denied.
--
-- Missing codes: blink_sales_approval, blink_auto_journal,
--   blink_reversing_journal, blink_noted_journal, blink_routes
-- ============================================================

-- Insert missing menus untuk SEMUA role yang sudah ada di DB
-- Default: semua permission = false (admin bisa ubah via UI)
INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, updated_at)
SELECT
    r.role_id,
    r.role_label,
    m.menu_code,
    false, false, false, false, false, false,
    NOW()
FROM
    -- Cross join: semua role × semua menu baru
    (SELECT DISTINCT role_id, role_label FROM role_permissions) r
    CROSS JOIN (
        VALUES
            ('blink_sales_approval'),
            ('blink_auto_journal'),
            ('blink_reversing_journal'),
            ('blink_noted_journal'),
            ('blink_routes')
    ) AS m(menu_code)
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.role_id AND rp.menu_code = m.menu_code
)
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Verifikasi: tampilkan semua menu code baru yang telah diinsert
SELECT role_id, role_label, menu_code, can_access
FROM role_permissions
WHERE menu_code IN (
    'blink_sales_approval',
    'blink_auto_journal',
    'blink_reversing_journal',
    'blink_noted_journal',
    'blink_routes'
)
ORDER BY role_id, menu_code;
