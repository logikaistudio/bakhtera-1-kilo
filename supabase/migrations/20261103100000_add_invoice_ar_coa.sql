-- Store the receivable account selected for each invoice.
-- These nullable columns intentionally have no backfill to preserve existing postings.
ALTER TABLE public.blink_invoices
    ADD COLUMN IF NOT EXISTS ar_coa_id UUID
    REFERENCES public.finance_coa(id) ON DELETE SET NULL;

ALTER TABLE public.bridge_invoices
    ADD COLUMN IF NOT EXISTS ar_coa_id UUID
    REFERENCES public.bridge_coa(id) ON DELETE SET NULL;
