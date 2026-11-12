ALTER TABLE public.blink_quotations
    ADD COLUMN IF NOT EXISTS trade_direction TEXT;

ALTER TABLE public.blink_shipments
    ADD COLUMN IF NOT EXISTS trade_direction TEXT;
