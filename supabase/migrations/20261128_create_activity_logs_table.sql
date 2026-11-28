-- Create activity_logs table for comprehensive audit trail
-- This replaces the in-memory activityLogs state with persistent database storage

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT,
    user_id TEXT,
    user_email TEXT,
    user_name TEXT,
    details TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all activity logs
-- (Activity logs are audit data that should be visible to authorized users)
CREATE POLICY "authenticated_users_can_read_activity_logs"
    ON activity_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only authenticated users can insert activity logs
-- (Created by backend/triggers, not directly by users)
CREATE POLICY "authenticated_users_can_insert_activity_logs"
    ON activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Super admins can delete activity logs
-- (For administrative purposes like clearing old audit data)
CREATE POLICY "superadmins_can_delete_activity_logs"
    ON activity_logs
    FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
    );

-- Grant permissions
GRANT SELECT, INSERT ON activity_logs TO authenticated;
GRANT DELETE ON activity_logs TO authenticated; -- Will be restricted by policy

-- Add comments for documentation
COMMENT ON TABLE activity_logs IS 'Comprehensive audit trail for all data modifications across the Bridge application';
COMMENT ON COLUMN activity_logs.id IS 'Unique identifier (timestamp-based)';
COMMENT ON COLUMN activity_logs.module IS 'Module/feature where action occurred (e.g., Warehouse Inventory, Quotations)';
COMMENT ON COLUMN activity_logs.action IS 'Action performed: add, edit, delete, approve, reject, etc.';
COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity modified (e.g., warehouse_stock, quotation, package)';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the entity that was modified';
COMMENT ON COLUMN activity_logs.entity_name IS 'Human-readable name of the entity';
COMMENT ON COLUMN activity_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN activity_logs.user_email IS 'Email of the user (cached for display)';
COMMENT ON COLUMN activity_logs.user_name IS 'Name of the user (cached for display)';
COMMENT ON COLUMN activity_logs.details IS 'Human-readable description of what was changed';
COMMENT ON COLUMN activity_logs.metadata IS 'JSON data for storing additional context (before/after values, etc.)';
