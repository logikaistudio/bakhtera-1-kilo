-- Migration: unify partner visibility for Blink/BXPO without duplicating master rows
-- Scope: blink_business_partners only (Bridge remains separate)

ALTER TABLE public.blink_business_partners
    ADD COLUMN IF NOT EXISTS owner_division TEXT NOT NULL DEFAULT 'blink',
    ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS merged_into_partner_id UUID REFERENCES public.blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES public.users(id);

ALTER TABLE public.blink_business_partners
    DROP CONSTRAINT IF EXISTS blink_business_partners_owner_division_check;

ALTER TABLE public.blink_business_partners
    ADD CONSTRAINT blink_business_partners_owner_division_check
    CHECK (owner_division IN ('blink', 'bxpo'));

-- Backfill safety for legacy rows
UPDATE public.blink_business_partners
SET owner_division = 'blink'
WHERE owner_division IS NULL OR owner_division = '';

-- Fast lookup for division-aware partner picker
CREATE INDEX IF NOT EXISTS idx_bp_owner_division
    ON public.blink_business_partners(owner_division);

CREATE INDEX IF NOT EXISTS idx_bp_is_shared
    ON public.blink_business_partners(is_shared)
    WHERE is_shared = true;

-- Keep merged rows out of default pickers/lookups
CREATE INDEX IF NOT EXISTS idx_bp_merged_into
    ON public.blink_business_partners(merged_into_partner_id);

-- Canonical dedupe index (used as guardrail for app-level auto-merge)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_canonical_dedupe
    ON public.blink_business_partners (
        COALESCE(
            NULLIF(lower(trim(tax_id)), ''),
            lower(regexp_replace(trim(partner_name), '\\s+', ' ', 'g')) || '|' ||
            COALESCE(
                NULLIF(lower(trim(email)), ''),
                NULLIF(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), ''),
                'no-contact'
            )
        )
    )
    WHERE merged_into_partner_id IS NULL;

COMMENT ON COLUMN public.blink_business_partners.owner_division IS 'Owning division for this partner master row: blink or bxpo';
COMMENT ON COLUMN public.blink_business_partners.is_shared IS 'When true, partner is visible for both Blink and BXPO users';
COMMENT ON COLUMN public.blink_business_partners.merged_into_partner_id IS 'Auto-merge lineage pointer to canonical partner row';
