-- ============================================================
-- FIX FINAL: Role Permissions RLS & Table Structure
-- Date: 2026-04-23
-- Problem: App uses custom auth (not Supabase Auth), so auth.uid()
--          is always NULL → all RLS policies that check auth.uid()
--          or auth.role() = 'authenticated' always FAIL.
-- Solution: Disable RLS on role_permissions table, OR use permissive
--           policies that allow all operations (anon + authenticated).
-- ============================================================

-- Step 1: Drop ALL existing policies on role_permissions
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'role_permissions' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON role_permissions', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Disable RLS entirely for role_permissions
-- This table only stores UI permission config — not sensitive user data
-- Access is already controlled by the application layer (admin-only UI)
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

-- Step 3: Ensure table structure is correct
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id VARCHAR(50) NOT NULL,
    role_label VARCHAR(100) NOT NULL DEFAULT '',
    menu_code VARCHAR(100) NOT NULL,
    can_access BOOLEAN DEFAULT FALSE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, menu_code)
);

-- Step 4: Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id 
    ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_code 
    ON role_permissions(menu_code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id_menu_code 
    ON role_permissions(role_id, menu_code);

-- Step 5: Ensure role_label column exists (in case of old schema)
ALTER TABLE role_permissions 
    ADD COLUMN IF NOT EXISTS role_label VARCHAR(100) NOT NULL DEFAULT '';

-- Step 6: Seed DEFAULT roles if the table is completely empty
-- (Only insert if there are NO rows at all)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM role_permissions LIMIT 1) THEN
        -- Insert placeholder rows for default roles so dropdown works
        -- These are dummy menu codes; real codes will be synced from app via "Sync DB" button
        INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, updated_at)
        VALUES
            ('direksi',   'Direksi',  'dashboard_blink', true,  true,  true,  true,  true,  true,  NOW()),
            ('chief',     'Chief',    'dashboard_blink', true,  true,  true,  true,  false, true,  NOW()),
            ('manager',   'Manager',  'dashboard_blink', true,  true,  true,  true,  false, false, NOW()),
            ('staff',     'Staff',    'dashboard_blink', true,  true,  true,  false, false, false, NOW()),
            ('viewer',    'Viewer',   'dashboard_blink', true,  true,  false, false, false, false, NOW())
        ON CONFLICT (role_id, menu_code) DO NOTHING;
    END IF;
END $$;

-- Step 7: Update empty role_label values
UPDATE role_permissions SET role_label = 'Direksi'  WHERE role_id = 'direksi'  AND (role_label IS NULL OR role_label = '');
UPDATE role_permissions SET role_label = 'Chief'    WHERE role_id = 'chief'    AND (role_label IS NULL OR role_label = '');
UPDATE role_permissions SET role_label = 'Manager'  WHERE role_id = 'manager'  AND (role_label IS NULL OR role_label = '');
UPDATE role_permissions SET role_label = 'Staff'    WHERE role_id = 'staff'    AND (role_label IS NULL OR role_label = '');
UPDATE role_permissions SET role_label = 'Viewer'   WHERE role_id = 'viewer'   AND (role_label IS NULL OR role_label = '');

-- Step 8: Verification
SELECT 
    'RLS Status' as check_name,
    CASE WHEN rowsecurity THEN 'ENABLED (BAD - should be disabled)' 
         ELSE 'DISABLED (GOOD)' END as status
FROM pg_tables 
WHERE tablename = 'role_permissions';

SELECT 
    'Existing Policies' as check_name,
    COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'role_permissions';

SELECT 
    'Distinct Roles' as check_name,
    COUNT(DISTINCT role_id) as count
FROM role_permissions;

SELECT DISTINCT role_id, role_label 
FROM role_permissions 
ORDER BY role_id;
