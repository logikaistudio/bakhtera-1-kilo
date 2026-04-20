-- Migration: Create blink_transaction_logs table
-- Records all transactions made in the Blink module

CREATE TABLE IF NOT EXISTS blink_transaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(18,2),
    currency VARCHAR(10) DEFAULT 'IDR',
    partner_id UUID,
    partner_name VARCHAR(255),
    user_id UUID REFERENCES auth.users(id),
    user_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE blink_transaction_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "blink_transaction_logs_select_policy" ON blink_transaction_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "blink_transaction_logs_insert_policy" ON blink_transaction_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_type ON blink_transaction_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_module ON blink_transaction_logs(module);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_created ON blink_transaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blink_transaction_logs_reference ON blink_transaction_logs(transaction_id);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_blink_transaction_logs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;