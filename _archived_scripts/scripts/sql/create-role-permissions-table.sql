-- Create role_permissions table
-- This table stores role-based permissions for menu access

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id VARCHAR(50) NOT NULL,
    role_label VARCHAR(100) NOT NULL,
    menu_code VARCHAR(100) NOT NULL,
    can_access BOOLEAN DEFAULT FALSE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite unique constraint to prevent duplicate role-menu combinations
    UNIQUE(role_id, menu_code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_menu_code ON role_permissions(menu_code);

-- Enable Row Level Security
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to SELECT role permissions
DROP POLICY IF EXISTS "Allow authenticated users to read role permissions" ON role_permissions;
CREATE POLICY "Allow authenticated users to read role permissions" ON role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy 2: Allow super admin to INSERT role permissions
DROP POLICY IF EXISTS "Allow super admin to insert role permissions" ON role_permissions;
CREATE POLICY "Allow super admin to insert role permissions" ON role_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );

-- Policy 3: Allow super admin to UPDATE role permissions
DROP POLICY IF EXISTS "Allow super admin to update role permissions" ON role_permissions;
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
DROP POLICY IF EXISTS "Allow super admin to delete role permissions" ON role_permissions;
CREATE POLICY "Allow super admin to delete role permissions" ON role_permissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_role_permissions_updated_at();