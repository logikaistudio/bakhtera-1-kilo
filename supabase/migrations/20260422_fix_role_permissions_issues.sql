-- Fix Role Management Issues
-- Migration: Fix RLS policies and query optimization for role_permissions
-- Date: 2026-04-22

-- =============================================================================
-- 1. Fix RLS Policies - Make role_permissions table accessible
-- =============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to read role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to insert role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to update role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to delete role permissions" ON role_permissions;

-- Ensure RLS is enabled
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- New Policy 1: Allow all users to READ role_permissions
-- This is needed for dropdowns in role pickers to show available roles
CREATE POLICY "Allow all to read role permissions" ON role_permissions
    FOR SELECT USING (true);

-- New Policy 2: Allow INSERT for management operations
-- This should allow admin users to create new roles
CREATE POLICY "Allow authenticated users to insert role permissions" ON role_permissions
    FOR INSERT WITH CHECK (true);

-- New Policy 3: Allow UPDATE for management operations
-- This should allow admin users to modify role permissions
CREATE POLICY "Allow authenticated users to update role permissions" ON role_permissions
    FOR UPDATE USING (true) WITH CHECK (true);

-- New Policy 4: Allow DELETE for management operations
-- This should allow admin users to delete roles
CREATE POLICY "Allow authenticated users to delete role permissions" ON role_permissions
    FOR DELETE USING (true);

-- =============================================================================
-- 2. Verify table structure and indexes
-- =============================================================================

-- Ensure indexes exist for optimal query performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_code ON role_permissions(menu_code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id_menu_code ON role_permissions(role_id, menu_code);

-- =============================================================================
-- 3. Seed default roles if missing
-- =============================================================================

-- Ensure default roles exist in role_permissions
-- Get all menu codes that might exist
INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, created_at, updated_at)
SELECT 'direksi', 'Direksi', menu_code, true, true, false, false, false, true, NOW(), NOW()
FROM (
    SELECT DISTINCT menu_code FROM role_permissions
) AS menus
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = 'direksi' AND rp.menu_code = menus.menu_code
)
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- Similarly for other default roles
INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, created_at, updated_at)
SELECT 'chief', 'Chief', menu_code, true, true, false, true, false, true, NOW(), NOW()
FROM (SELECT DISTINCT menu_code FROM role_permissions) AS menus
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'chief' AND rp.menu_code = menus.menu_code)
ON CONFLICT (role_id, menu_code) DO NOTHING;

INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, created_at, updated_at)
SELECT 'manager', 'Manager', menu_code, true, true, true, true, false, false, NOW(), NOW()
FROM (SELECT DISTINCT menu_code FROM role_permissions) AS menus
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'manager' AND rp.menu_code = menus.menu_code)
ON CONFLICT (role_id, menu_code) DO NOTHING;

INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, created_at, updated_at)
SELECT 'staff', 'Staff', menu_code, true, true, true, false, false, false, NOW(), NOW()
FROM (SELECT DISTINCT menu_code FROM role_permissions) AS menus
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'staff' AND rp.menu_code = menus.menu_code)
ON CONFLICT (role_id, menu_code) DO NOTHING;

INSERT INTO role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, created_at, updated_at)
SELECT 'viewer', 'Viewer', menu_code, true, true, false, false, false, false, NOW(), NOW()
FROM (SELECT DISTINCT menu_code FROM role_permissions) AS menus
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 'viewer' AND rp.menu_code = menus.menu_code)
ON CONFLICT (role_id, menu_code) DO NOTHING;

-- =============================================================================
-- 4. Verification queries
-- =============================================================================

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'role_permissions'
ORDER BY policyname;

-- Check role count
SELECT COUNT(DISTINCT role_id) as unique_roles, COUNT(*) as total_entries 
FROM role_permissions;

-- Check if default roles exist
SELECT DISTINCT role_id, role_label 
FROM role_permissions 
ORDER BY role_id;

-- Check menu codes
SELECT COUNT(DISTINCT menu_code) as unique_menus, COUNT(*) as total_entries 
FROM role_permissions;
