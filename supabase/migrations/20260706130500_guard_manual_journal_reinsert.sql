-- Guard against re-inserting known bad manual journal batches.
-- This is intentionally narrow: only blocks explicit reference numbers listed in guard table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.blink_journal_entry_insert_guard (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    division text NOT NULL,
    reference_number text NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text NOT NULL DEFAULT current_user,
    UNIQUE (division, reference_number)
);

CREATE OR REPLACE FUNCTION public.prevent_blocked_blink_journal_reinsert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.reference_number IS NULL OR NEW.division IS NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_journal_entry_insert_guard g
        WHERE lower(g.division) = lower(NEW.division)
          AND g.reference_number = NEW.reference_number
    ) THEN
        RAISE EXCEPTION 'Insert/update blocked for guarded journal reference_number: % (division: %)', NEW.reference_number, NEW.division
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_blink_journal_reinsert ON public.blink_journal_entries;

CREATE TRIGGER trg_prevent_blocked_blink_journal_reinsert
BEFORE INSERT OR UPDATE ON public.blink_journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_blocked_blink_journal_reinsert();

INSERT INTO public.blink_journal_entry_insert_guard (division, reference_number, reason)
VALUES
    ('blink', 'JE-2604-0001', 'Blocked after manual cleanup 2026-07-06'),
    ('blink', 'JE-2604-0002', 'Blocked after manual cleanup 2026-07-06'),
    ('blink', 'JE-2605-0001', 'Blocked after manual cleanup 2026-07-06'),
    ('blink', 'JE-2605-0002', 'Blocked after manual cleanup 2026-07-06')
ON CONFLICT (division, reference_number) DO UPDATE
SET reason = EXCLUDED.reason;

COMMIT;
