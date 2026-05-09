-- Add rejection columns to blink_invoices
-- Run idempotently: use IF NOT EXISTS to avoid errors on re-run

ALTER TABLE IF EXISTS blink_invoices
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejection_date TIMESTAMP WITH TIME ZONE;

-- Optional index to speed up queries filtering by rejection_reason/status
CREATE INDEX IF NOT EXISTS idx_blink_invoices_rejection_date ON blink_invoices(rejection_date);
