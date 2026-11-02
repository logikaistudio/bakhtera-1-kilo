-- Preserve the transaction-currency values used to create each IDR journal line.
ALTER TABLE public.blink_journal_entries
    ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(20, 6),
    ADD COLUMN IF NOT EXISTS foreign_currency TEXT,
    ADD COLUMN IF NOT EXISTS transaction_exchange_rate NUMERIC(20, 8);

ALTER TABLE public.bridge_journal_entries
    ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(20, 6),
    ADD COLUMN IF NOT EXISTS foreign_currency TEXT,
    ADD COLUMN IF NOT EXISTS transaction_exchange_rate NUMERIC(20, 8);

CREATE INDEX IF NOT EXISTS idx_blink_journal_fx_audit
    ON public.blink_journal_entries (entry_date, foreign_currency)
    WHERE foreign_currency IS NOT NULL AND foreign_currency <> 'IDR';

CREATE INDEX IF NOT EXISTS idx_bridge_journal_fx_audit
    ON public.bridge_journal_entries (entry_date, foreign_currency)
    WHERE foreign_currency IS NOT NULL AND foreign_currency <> 'IDR';