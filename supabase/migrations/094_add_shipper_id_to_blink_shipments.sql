-- Fix: "Could not find the 'shipper_id' column of 'blink_shipments' in the schema cache"
-- The app inserts/updates blink_shipments.shipper_id (SO creation, shipment detail modal),
-- but no earlier migration ever created this column (only shipper_partner_id exists).
ALTER TABLE IF EXISTS public.blink_shipments
    ADD COLUMN IF NOT EXISTS shipper_id UUID REFERENCES public.blink_business_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blink_shipments_shipper_id ON public.blink_shipments(shipper_id);

COMMENT ON COLUMN public.blink_shipments.shipper_id IS 'Shipper business partner reference';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
