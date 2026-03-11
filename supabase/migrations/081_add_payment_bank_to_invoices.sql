-- Add payment_bank_id column to blink_invoices
-- This allows linking invoices to a specific bank account for payment display on printed invoices

ALTER TABLE IF EXISTS public.blink_invoices
    ADD COLUMN IF NOT EXISTS payment_bank_id UUID;

-- Comment for clarity
COMMENT ON COLUMN public.blink_invoices.payment_bank_id IS 'References company_bank_accounts.id - the bank account to display on the printed invoice for payment';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
