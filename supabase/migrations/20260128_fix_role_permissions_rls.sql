-- Fix RLS Policies for role_permissions table
-- Execute this in Supabase SQL Editor to fix permission errors

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to manage role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to insert role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to update role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Allow super admin to delete role permissions" ON role_permissions;

-- Ensure RLS is enabled
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to SELECT role permissions
CREATE POLICY "Allow authenticated users to read role permissions" ON role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy 2: Allow super admin to INSERT role permissions
CREATE POLICY "Allow super admin to insert role permissions" ON role_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );

-- Policy 3: Allow super admin to UPDATE role permissions
CREATE POLICY "Allow super admin to update role permissions" ON role_permissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );

-- Policy 4: Allow super admin to DELETE role permissions
CREATE POLICY "Allow super admin to delete role permissions" ON role_permissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );
