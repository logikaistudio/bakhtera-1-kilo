-- Migration: Sync role_permissions for newly added menus
-- Date: 2026-07-06
-- Purpose:
-- 1) Ensure newly introduced menu codes exist for all current roles.
-- 2) Backfill big_finance from legacy BIG finance menu codes when possible.

-- Build role list from existing role_permissions rows.
WITH role_list AS (
    SELECT DISTINCT
        rp.role_id,
        COALESCE(NULLIF(TRIM(rp.role_label), ''), INITCAP(REPLACE(rp.role_id, '_', ' '))) AS role_label
    FROM public.role_permissions rp
),
legacy_big_finance AS (
    SELECT
        rp.role_id,
        BOOL_OR(COALESCE(rp.can_access, false)) AS can_access,
        BOOL_OR(COALESCE(rp.can_view, false)) AS can_view,
        BOOL_OR(COALESCE(rp.can_create, false)) AS can_create,
        BOOL_OR(COALESCE(rp.can_edit, false)) AS can_edit,
        BOOL_OR(COALESCE(rp.can_delete, false)) AS can_delete,
        BOOL_OR(COALESCE(rp.can_approve, false)) AS can_approve
    FROM public.role_permissions rp
    WHERE rp.menu_code IN ('big_invoices', 'big_ar', 'big_finance')
    GROUP BY rp.role_id
)
INSERT INTO public.role_permissions (
    role_id,
    role_label,
    menu_code,
    can_access,
    can_view,
    can_create,
    can_edit,
    can_delete,
    can_approve,
    updated_at
)
SELECT
    rl.role_id,
    rl.role_label,
    'big_finance' AS menu_code,
    COALESCE(lbf.can_access, false) AS can_access,
    COALESCE(lbf.can_view, false) AS can_view,
    COALESCE(lbf.can_create, false) AS can_create,
    COALESCE(lbf.can_edit, false) AS can_edit,
    COALESCE(lbf.can_delete, false) AS can_delete,
    COALESCE(lbf.can_approve, false) AS can_approve,
    NOW() AS updated_at
FROM role_list rl
LEFT JOIN legacy_big_finance lbf ON lbf.role_id = rl.role_id
ON CONFLICT (role_id, menu_code) DO NOTHING;

WITH role_list AS (
    SELECT DISTINCT
        rp.role_id,
        COALESCE(NULLIF(TRIM(rp.role_label), ''), INITCAP(REPLACE(rp.role_id, '_', ' '))) AS role_label
    FROM public.role_permissions rp
),
new_menus AS (
    SELECT 'central_vendors' AS menu_code
    UNION ALL SELECT 'central_customers'
    UNION ALL SELECT 'central_finance'
    UNION ALL SELECT 'central_coa'
    UNION ALL SELECT 'central_settings'
)
INSERT INTO public.role_permissions (
    role_id,
    role_label,
    menu_code,
    can_access,
    can_view,
    can_create,
    can_edit,
    can_delete,
    can_approve,
    updated_at
)
SELECT
    rl.role_id,
    rl.role_label,
    nm.menu_code,
    false,
    false,
    false,
    false,
    false,
    false,
    NOW()
FROM role_list rl
CROSS JOIN new_menus nm
ON CONFLICT (role_id, menu_code) DO NOTHING;
