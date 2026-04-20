-- Migration: Extend blink_transaction_logs for comprehensive transaction logging
-- Adds fields for complete audit trail, device info, payment methods, and submenu context

-- Add new columns to existing table
ALTER TABLE blink_transaction_logs
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
ADD COLUMN IF NOT EXISTS account_id UUID,
ADD COLUMN IF NOT EXISTS account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS source_action VARCHAR(100),
ADD COLUMN IF NOT EXISTS submenu_context VARCHAR(100),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS previous_values JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS audit_trail JSONB DEFAULT '[]'::jsonb;

-- Add indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_submenu ON blink_transaction_logs(submenu_context);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_status ON blink_transaction_logs(status);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_payment_method ON blink_transaction_logs(payment_method);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_account ON blink_transaction_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_updated ON blink_transaction_logs(updated_at DESC);

-- Update trigger for updated_at
DROP TRIGGER IF EXISTS update_blink_transaction_logs_timestamp_trigger ON blink_transaction_logs;
CREATE TRIGGER update_blink_transaction_logs_timestamp_trigger
    BEFORE UPDATE ON blink_transaction_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_blink_transaction_logs_timestamp();

-- Function to update audit trail
CREATE OR REPLACE FUNCTION update_blink_transaction_logs_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- Store previous values in audit_trail
    IF OLD.* IS DISTINCT FROM NEW.* THEN
        NEW.audit_trail = OLD.audit_trail || jsonb_build_object(
            'timestamp', NOW(),
            'user_id', NEW.user_id,
            'changes', jsonb_object(
                SELECT jsonb_object_agg(key, jsonb_build_array(old_value, new_value))
                FROM (
                    SELECT key,
                           CASE WHEN key = 'metadata' THEN OLD.metadata ELSE to_jsonb(OLD.*) -> key END as old_value,
                           CASE WHEN key = 'metadata' THEN NEW.metadata ELSE to_jsonb(NEW.*) -> key END as new_value
                    FROM jsonb_object_keys(to_jsonb(OLD.*)) as key
                    WHERE (to_jsonb(OLD.*) -> key) IS DISTINCT FROM (to_jsonb(NEW.*) -> key)
                ) t
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add audit trail trigger
CREATE TRIGGER update_blink_transaction_logs_audit_trigger
    BEFORE UPDATE ON blink_transaction_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_blink_transaction_logs_audit();

-- Update RLS policies to include new fields
DROP POLICY IF EXISTS "blink_transaction_logs_select_policy" ON blink_transaction_logs;
CREATE POLICY "blink_transaction_logs_select_policy" ON blink_transaction_logs
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "blink_transaction_logs_insert_policy" ON blink_transaction_logs;
CREATE POLICY "blink_transaction_logs_insert_policy" ON blink_transaction_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add policy for updates (for audit trail)
CREATE POLICY "blink_transaction_logs_update_policy" ON blink_transaction_logs
    FOR UPDATE USING (auth.role() = 'authenticated');