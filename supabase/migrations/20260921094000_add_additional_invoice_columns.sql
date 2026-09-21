-- Ensure additional invoice linkage columns exist for Blink and Bridge modules
-- Fixes runtime insert errors when app sends is_additional/parent_invoice_id.

ALTER TABLE IF EXISTS public.blink_invoices
    ADD COLUMN IF NOT EXISTS is_additional BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_invoice_id UUID;

ALTER TABLE IF EXISTS public.bridge_invoices
    ADD COLUMN IF NOT EXISTS is_additional BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_invoice_id UUID;

-- Helpful for querying invoice hierarchies and additional invoices
CREATE INDEX IF NOT EXISTS idx_blink_invoices_parent_invoice_id ON public.blink_invoices(parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_blink_invoices_is_additional ON public.blink_invoices(is_additional);
CREATE INDEX IF NOT EXISTS idx_bridge_invoices_parent_invoice_id ON public.bridge_invoices(parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bridge_invoices_is_additional ON public.bridge_invoices(is_additional);
