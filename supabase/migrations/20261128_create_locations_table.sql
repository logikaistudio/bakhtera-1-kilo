-- Create locations table for warehouse/storage location management
-- This table stores different warehouse or storage locations that can be used in various modules

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    value TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_exhibition BOOLEAN DEFAULT false,
    location_type TEXT DEFAULT 'warehouse',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_value ON locations(value);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_locations_is_default ON locations(is_default);

-- Enable RLS (Row Level Security)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all locations
CREATE POLICY "authenticated_users_can_read_locations"
    ON locations
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Authenticated users can create locations (admin-only in app)
CREATE POLICY "authenticated_users_can_create_locations"
    ON locations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Authenticated users can update locations (admin-only in app)
CREATE POLICY "authenticated_users_can_update_locations"
    ON locations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: Super admins can delete locations
CREATE POLICY "superadmins_can_delete_locations"
    ON locations
    FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON locations TO authenticated;
GRANT DELETE ON locations TO authenticated; -- Will be restricted by policy

-- Add comments for documentation
COMMENT ON TABLE locations IS 'Storage and warehouse location master data for inventory management';
COMMENT ON COLUMN locations.id IS 'Unique identifier for location';
COMMENT ON COLUMN locations.value IS 'Location code or identifier (e.g., WH-01, HALL-A)';
COMMENT ON COLUMN locations.label IS 'Human-readable location name';
COMMENT ON COLUMN locations.description IS 'Detailed description of the location';
COMMENT ON COLUMN locations.is_default IS 'Mark default location for automatic selection';
COMMENT ON COLUMN locations.is_exhibition IS 'Mark if this is an exhibition or event location';
COMMENT ON COLUMN locations.location_type IS 'Type of location: warehouse, exhibition, storage, etc.';
COMMENT ON COLUMN locations.status IS 'active or inactive status';

-- Insert sample data (default locations)
INSERT INTO locations (id, value, label, description, is_default, is_exhibition, location_type) VALUES
    ('loc-001', 'WH-01', 'Main Warehouse', 'Primary warehouse location', true, false, 'warehouse'),
    ('loc-002', 'HALL-A', 'Exhibition Hall A', 'Hall A for events and exhibitions', false, true, 'exhibition'),
    ('loc-003', 'STORAGE-01', 'Storage Room 1', 'Secondary storage area', false, false, 'storage'),
    ('loc-004', 'TEMP-01', 'Temporary Storage', 'Temporary storage for incoming goods', false, false, 'storage')
ON CONFLICT (id) DO NOTHING;
