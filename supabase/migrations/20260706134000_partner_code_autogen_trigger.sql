-- Ensure partner_code is always generated server-side when missing.
-- This prevents insert failures on clients that do not send partner_code.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_partner_code_bp()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    prefix text;
    seq int;
    candidate text;
BEGIN
    prefix := 'BP-' || to_char(now(), 'YYMM') || '-';

    LOOP
        SELECT COALESCE(MAX(NULLIF(split_part(partner_code, '-', 3), '')::int), 0) + 1
        INTO seq
        FROM public.blink_business_partners
        WHERE partner_code LIKE prefix || '%'
          AND split_part(partner_code, '-', 3) ~ '^[0-9]+$';

        candidate := prefix || lpad(seq::text, 4, '0');

        EXIT WHEN NOT EXISTS (
            SELECT 1
            FROM public.blink_business_partners
            WHERE partner_code = candidate
        );

        seq := seq + 1;
    END LOOP;

    RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_partner_code_before_insert_bp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.partner_code IS NULL OR btrim(NEW.partner_code) = '' THEN
        NEW.partner_code := public.generate_partner_code_bp();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_partner_code_before_insert ON public.blink_business_partners;

CREATE TRIGGER trg_ensure_partner_code_before_insert
BEFORE INSERT ON public.blink_business_partners
FOR EACH ROW
EXECUTE FUNCTION public.ensure_partner_code_before_insert_bp();

COMMIT;
