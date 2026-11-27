-- Phase 3: Database Backup & Recovery System
-- Created: 2024-12-27
-- Purpose: Add automatic backup, snapshot management, and restore capabilities

-- ============================================================
-- 1. CREATE SNAPSHOTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS snapshots (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  snapshot_name VARCHAR(255) NOT NULL UNIQUE,
  
  -- Type & Status
  backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Metadata
  snapshot_date TIMESTAMP NOT NULL DEFAULT now(),
  record_counts JSONB,
  total_records INTEGER,
  data_hash VARCHAR(255),
  
  -- Storage Information
  backup_location VARCHAR(500),
  backup_size_bytes BIGINT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  scheduled_at TIMESTAMP,
  
  -- Audit Trail
  created_by VARCHAR(255),
  restored_by VARCHAR(255),
  restored_at TIMESTAMP,
  
  -- Additional Info
  description TEXT,
  notes TEXT,
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT valid_backup_type CHECK (backup_type IN ('manual', 'auto')),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'in_progress', 'completed', 'failed', 'restored')
  ),
  CONSTRAINT valid_expires CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT valid_size CHECK (backup_size_bytes IS NULL OR backup_size_bytes > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_date 
  ON snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_expires 
  ON snapshots(expires_at);

CREATE INDEX IF NOT EXISTS idx_snapshots_status 
  ON snapshots(status);

CREATE INDEX IF NOT EXISTS idx_snapshots_type 
  ON snapshots(backup_type);

COMMENT ON TABLE snapshots IS 'Backup snapshot metadata and references';
COMMENT ON COLUMN snapshots.snapshot_name IS 'Unique identifier for snapshot';
COMMENT ON COLUMN snapshots.record_counts IS 'JSON object with record counts per table';
COMMENT ON COLUMN snapshots.backup_location IS 'File path in Supabase Storage';
COMMENT ON COLUMN snapshots.expires_at IS 'Automatic expiration (30 days)';

-- ============================================================
-- 2. CREATE SNAPSHOT_DATA TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS snapshot_data (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key
  snapshot_id UUID NOT NULL UNIQUE 
    REFERENCES snapshots(id) ON DELETE CASCADE,
  
  -- Compressed Backup Data (JSONB)
  backup_data JSONB NOT NULL,
  
  -- Flags
  compressed BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshot_data_snapshot_id 
  ON snapshot_data(snapshot_id);

COMMENT ON TABLE snapshot_data IS 'Actual backup data for snapshots';
COMMENT ON COLUMN snapshot_data.backup_data IS 'Full database export as JSONB';
COMMENT ON COLUMN snapshot_data.compressed IS 'Whether data is gzip compressed';

-- ============================================================
-- 3. CREATE BACKUP_LOGS TABLE (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  snapshot_id UUID REFERENCES snapshots(id) ON DELETE SET NULL,
  
  -- Operation Info
  operation VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  
  -- Details
  details JSONB,
  error_message TEXT,
  
  -- User Info
  initiated_by VARCHAR(255),
  
  -- Timing
  created_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_operation CHECK (
    operation IN ('backup', 'restore', 'delete', 'verify', 'cleanup')
  ),
  CONSTRAINT valid_log_status CHECK (
    status IN ('started', 'completed', 'failed')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backup_logs_snapshot_id 
  ON backup_logs(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_backup_logs_operation 
  ON backup_logs(operation);

CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at 
  ON backup_logs(created_at DESC);

COMMENT ON TABLE backup_logs IS 'Audit trail for backup operations';
COMMENT ON COLUMN backup_logs.operation IS 'Type of operation: backup, restore, delete, verify, cleanup';
COMMENT ON COLUMN backup_logs.initiated_by IS 'User ID or system identifier who initiated the operation';

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. CREATE RLS POLICIES (Admin Only Access)
-- ============================================================

-- Snapshots policies
DROP POLICY IF EXISTS "Admins can view all snapshots" ON snapshots;
DROP POLICY IF EXISTS "Admins can create snapshots" ON snapshots;
DROP POLICY IF EXISTS "Admins can update snapshots" ON snapshots;
DROP POLICY IF EXISTS "Admins can delete snapshots" ON snapshots;

CREATE POLICY "Admins can view all snapshots"
  ON snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create snapshots"
  ON snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update snapshots"
  ON snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete snapshots"
  ON snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Snapshot data policies
DROP POLICY IF EXISTS "Admins can view snapshot data" ON snapshot_data;
DROP POLICY IF EXISTS "Admins can create snapshot data" ON snapshot_data;
DROP POLICY IF EXISTS "Admins can delete snapshot data" ON snapshot_data;

CREATE POLICY "Admins can view snapshot data"
  ON snapshot_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create snapshot data"
  ON snapshot_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete snapshot data"
  ON snapshot_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Backup logs policies
DROP POLICY IF EXISTS "Admins can view backup logs" ON backup_logs;
DROP POLICY IF EXISTS "Admins can create backup logs" ON backup_logs;

CREATE POLICY "Admins can view backup logs"
  ON backup_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create backup logs"
  ON backup_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- 6. PHASE 3 COMPLETION
-- ============================================================
-- Migration complete: 3 tables created, 8 indexes created, RLS policies enabled
-- Next: Deploy backend service (backupService.js)
-- Then: Deploy frontend components
