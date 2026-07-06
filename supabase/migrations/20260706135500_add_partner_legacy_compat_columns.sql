-- Compatibility columns for older frontend bundles that still send legacy partner fields.

BEGIN;

ALTER TABLE public.blink_business_partners
  ADD COLUMN IF NOT EXISTS owner_division text DEFAULT 'blink',
  ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_into_partner_id uuid;

UPDATE public.blink_business_partners
SET owner_division = 'blink'
WHERE owner_division IS NULL;

UPDATE public.blink_business_partners
SET is_shared = false
WHERE is_shared IS NULL;

COMMIT;
