ALTER TABLE public.blink_invoices
    ADD COLUMN IF NOT EXISTS ar_coa_id UUID
    REFERENCES public.finance_coa(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
