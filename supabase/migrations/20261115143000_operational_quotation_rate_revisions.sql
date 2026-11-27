ALTER TABLE public.blink_quotations
    ADD COLUMN IF NOT EXISTS revision_previous_status text;

ALTER TABLE public.blink_quotations
    ALTER COLUMN revision_number SET DEFAULT 1;

UPDATE public.blink_quotations
SET revision_number = 1
WHERE revision_number IS NULL;

ALTER TABLE public.blink_quotations
    ALTER COLUMN revision_number SET NOT NULL;

DO $$
DECLARE
    unique_constraint record;
    unique_index record;
BEGIN
    FOR unique_constraint IN
        SELECT constraint_row.conname
        FROM pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.blink_quotations'::regclass
          AND constraint_row.contype = 'u'
          AND cardinality(constraint_row.conkey) = 1
          AND (
              SELECT attribute.attname
              FROM unnest(constraint_row.conkey) AS key_column(attnum)
              JOIN pg_attribute AS attribute
                ON attribute.attrelid = constraint_row.conrelid
               AND attribute.attnum = key_column.attnum
          ) IN ('job_number', 'quotation_number')
    LOOP
        EXECUTE format(
            'ALTER TABLE public.blink_quotations DROP CONSTRAINT %I',
            unique_constraint.conname
        );
    END LOOP;

    FOR unique_index IN
        SELECT index_namespace.nspname, index_class.relname
        FROM pg_index AS index_row
        JOIN pg_class AS index_class ON index_class.oid = index_row.indexrelid
        JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
        JOIN LATERAL unnest(index_row.indkey) WITH ORDINALITY AS key_column(attnum, ordinal) ON true
        JOIN pg_attribute AS attribute
          ON attribute.attrelid = index_row.indrelid
         AND attribute.attnum = key_column.attnum
        WHERE index_row.indrelid = 'public.blink_quotations'::regclass
          AND index_row.indisunique
          AND NOT index_row.indisprimary
          AND index_row.indnkeyatts = 1
          AND key_column.ordinal = 1
          AND attribute.attname IN ('job_number', 'quotation_number')
          AND NOT EXISTS (
              SELECT 1
              FROM pg_constraint AS constraint_row
              WHERE constraint_row.conindid = index_row.indexrelid
          )
    LOOP
        EXECUTE format('DROP INDEX %I.%I', unique_index.nspname, unique_index.relname);
    END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blink_quotations_job_revision_unique
    ON public.blink_quotations (job_number, revision_number);

CREATE INDEX IF NOT EXISTS idx_blink_quotations_job_number
    ON public.blink_quotations (job_number);

CREATE INDEX IF NOT EXISTS idx_blink_quotations_quotation_number
    ON public.blink_quotations (quotation_number);

ALTER TABLE public.blink_journal_entries
    ADD COLUMN IF NOT EXISTS transaction_exchange_rate numeric(20, 8);

CREATE OR REPLACE FUNCTION public.is_blink_operational_invoice_for_job(
    p_invoice_id uuid,
    p_job_number text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.blink_invoices AS invoice
        WHERE invoice.id = p_invoice_id
          AND invoice.job_number = p_job_number
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.blink_quotations AS quotation
                  WHERE quotation.id = invoice.quotation_id
                    AND quotation.job_number = p_job_number
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.blink_shipments AS shipment
                  JOIN public.blink_quotations AS quotation
                    ON quotation.id = shipment.quotation_id
                   AND quotation.job_number = shipment.job_number
                  WHERE shipment.id = invoice.shipment_id
                    AND shipment.job_number = p_job_number
                    AND shipment.sales_quotation_id IS NULL
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.blink_shipments AS shipment
                  JOIN public.blink_quotations AS quotation
                    ON quotation.id = shipment.quotation_id
                   AND quotation.job_number = shipment.job_number
                  WHERE invoice.shipment_id IS NULL
                    AND shipment.id = invoice.quotation_id
                    AND shipment.job_number = p_job_number
                    AND shipment.sales_quotation_id IS NULL
              )
          )
    );
$$;

UPDATE public.blink_journal_entries AS journal
SET transaction_exchange_rate = CASE
    WHEN invoice.currency = 'IDR' THEN 1
    ELSE COALESCE(invoice.exchange_rate, 1)
END
FROM public.blink_invoices AS invoice
WHERE journal.reference_id = invoice.id
  AND journal.reference_type IN ('ar', 'blink_invoice')
  AND journal.entry_type = 'invoice'
  AND journal.transaction_exchange_rate IS NULL
  AND public.is_blink_operational_invoice_for_job(invoice.id, invoice.job_number);

CREATE OR REPLACE FUNCTION public.request_blink_quotation_revision(
    p_source_id uuid,
    p_revision_reason text
)
RETURNS public.blink_quotations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    source_quotation public.blink_quotations%ROWTYPE;
    job_order_number text;
BEGIN
    SELECT job_number
    INTO job_order_number
    FROM public.blink_quotations
    WHERE id = p_source_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % was not found.', p_source_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(job_order_number, 0));

    SELECT *
    INTO source_quotation
    FROM public.blink_quotations
    WHERE id = p_source_id
    FOR UPDATE;

    IF COALESCE(source_quotation.is_superseded, false)
       OR source_quotation.status NOT IN ('rejected', 'sent', 'approved', 'converted') THEN
        RAISE EXCEPTION 'Only an active rejected or issued quotation can be re-quoted.';
    END IF;

    IF NULLIF(BTRIM(p_revision_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A revision reason is required.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_invoices AS invoice
        JOIN public.blink_journal_entries AS journal
          ON journal.reference_id = invoice.id
         AND journal.reference_type IN ('ar', 'blink_invoice')
         AND journal.entry_type = 'invoice'
        WHERE public.is_blink_operational_invoice_for_job(invoice.id, source_quotation.job_number)
    ) THEN
        RAISE EXCEPTION 'This Job Order already has a posted invoice journal; its exchange rate cannot be revised.';
    END IF;

    UPDATE public.blink_quotations
    SET status = 'revision_requested',
        revision_reason = BTRIM(p_revision_reason),
        revision_previous_status = source_quotation.status,
        updated_at = NOW()
    WHERE id = source_quotation.id
    RETURNING * INTO source_quotation;

    RETURN source_quotation;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_blink_quotation_revision(
    p_source_id uuid,
    p_exchange_rate numeric,
    p_revision_reason text,
    p_revised_by text
)
RETURNS public.blink_quotations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    source_quotation public.blink_quotations%ROWTYPE;
    new_quotation public.blink_quotations%ROWTYPE;
    next_revision_number integer;
    revision_payload jsonb;
    resolved_exchange_rate numeric;
    job_order_number text;
BEGIN
    SELECT job_number
    INTO job_order_number
    FROM public.blink_quotations
    WHERE id = p_source_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % was not found.', p_source_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(job_order_number, 0));

    SELECT *
    INTO source_quotation
    FROM public.blink_quotations
    WHERE id = p_source_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % was not found.', p_source_id;
    END IF;

    IF COALESCE(source_quotation.is_superseded, false) THEN
        RAISE EXCEPTION 'A superseded quotation cannot be revised.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_quotations
        WHERE job_number = source_quotation.job_number
          AND id <> source_quotation.id
          AND NOT COALESCE(is_superseded, false)
    ) THEN
        RAISE EXCEPTION 'This Job Order already has another active quotation revision.';
    END IF;

    IF source_quotation.status <> 'revision_requested' THEN
        RAISE EXCEPTION 'Only quotations with a requested revision can be re-quoted.';
    END IF;

    IF NULLIF(BTRIM(p_revision_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A revision reason is required.';
    END IF;

    IF source_quotation.currency = 'IDR' THEN
        resolved_exchange_rate := 1;
    ELSE
        IF p_exchange_rate IS NULL
           OR p_exchange_rate <= 0
           OR p_exchange_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
            RAISE EXCEPTION 'A positive exchange rate is required for non-IDR quotations.';
        END IF;
        resolved_exchange_rate := p_exchange_rate;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_invoices AS invoice
        JOIN public.blink_journal_entries AS journal
          ON journal.reference_id = invoice.id
         AND journal.reference_type IN ('ar', 'blink_invoice')
         AND journal.entry_type = 'invoice'
        WHERE public.is_blink_operational_invoice_for_job(invoice.id, source_quotation.job_number)
    ) THEN
        RAISE EXCEPTION 'This Job Order already has a posted invoice journal; its exchange rate cannot be revised.';
    END IF;

    SELECT COALESCE(MAX(revision_number), 1) + 1
    INTO next_revision_number
    FROM public.blink_quotations
    WHERE job_number = source_quotation.job_number;

    revision_payload := to_jsonb(source_quotation) || jsonb_build_object(
        'id', gen_random_uuid(),
        'created_at', NOW(),
        'updated_at', NOW(),
        'quotation_date', CURRENT_DATE,
        'valid_until', CURRENT_DATE + 30,
        'exchange_rate', resolved_exchange_rate,
        'revision_number', next_revision_number,
        'parent_quotation_id', COALESCE(source_quotation.parent_quotation_id, source_quotation.id),
        'revision_reason', BTRIM(p_revision_reason),
        'revised_at', NOW(),
        'revised_by', COALESCE(NULLIF(BTRIM(p_revised_by), ''), 'User'),
        'revision_previous_status', source_quotation.revision_previous_status,
        'status', 'manager_approval',
        'is_superseded', false,
        'superseded_by_id', NULL
    );

    INSERT INTO public.blink_quotations
    SELECT (JSONB_POPULATE_RECORD(NULL::public.blink_quotations, revision_payload)).*
    RETURNING * INTO new_quotation;

    UPDATE public.blink_quotations
    SET is_superseded = true,
        superseded_by_id = new_quotation.id,
        updated_at = NOW()
    WHERE id = source_quotation.id;

    RETURN new_quotation;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_blink_quotation_revision(
    p_quotation_id uuid
)
RETURNS public.blink_quotations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    quotation public.blink_quotations%ROWTYPE;
    job_order_number text;
BEGIN
    SELECT job_number
    INTO job_order_number
    FROM public.blink_quotations
    WHERE id = p_quotation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % was not found.', p_quotation_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(job_order_number, 0));

    SELECT *
    INTO quotation
    FROM public.blink_quotations
    WHERE id = p_quotation_id
    FOR UPDATE;

    IF quotation.status <> 'manager_approval' OR COALESCE(quotation.is_superseded, false) THEN
        RAISE EXCEPTION 'Only the active quotation awaiting manager approval can be finalized.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_invoices AS invoice
        JOIN public.blink_journal_entries AS journal
          ON journal.reference_id = invoice.id
         AND journal.reference_type IN ('ar', 'blink_invoice')
         AND journal.entry_type = 'invoice'
        WHERE public.is_blink_operational_invoice_for_job(invoice.id, quotation.job_number)
    ) THEN
        RAISE EXCEPTION 'An invoice journal was posted before this revision was approved.';
    END IF;

    UPDATE public.blink_shipments
    SET quotation_id = quotation.id,
        exchange_rate = CASE WHEN quotation.currency = 'IDR' THEN 1 ELSE quotation.exchange_rate END,
        updated_at = NOW()
    WHERE job_number = quotation.job_number
      AND COALESCE(status, '') <> 'cancelled'
      AND sales_quotation_id IS NULL
      AND EXISTS (
          SELECT 1
          FROM public.blink_quotations AS source_quotation
          WHERE source_quotation.id = public.blink_shipments.quotation_id
            AND source_quotation.job_number = quotation.job_number
      );

    UPDATE public.blink_invoices
    SET quotation_id = quotation.id,
        exchange_rate = CASE WHEN currency = 'IDR' THEN 1 ELSE quotation.exchange_rate END,
        updated_at = NOW()
    WHERE job_number = quotation.job_number
      AND COALESCE(status, '') <> 'cancelled'
      AND public.is_blink_operational_invoice_for_job(
          public.blink_invoices.id,
          quotation.job_number
      );

    UPDATE public.blink_quotations
    SET status = 'converted',
        updated_at = NOW()
    WHERE id = quotation.id
    RETURNING * INTO quotation;

    RETURN quotation;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_blink_quotation_revision(
    p_quotation_id uuid,
    p_rejection_reason text
)
RETURNS public.blink_quotations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    rejected_quotation public.blink_quotations%ROWTYPE;
    restored_quotation public.blink_quotations%ROWTYPE;
    job_order_number text;
BEGIN
    SELECT job_number
    INTO job_order_number
    FROM public.blink_quotations
    WHERE id = p_quotation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation % was not found.', p_quotation_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(job_order_number, 0));

    SELECT *
    INTO rejected_quotation
    FROM public.blink_quotations
    WHERE id = p_quotation_id
    FOR UPDATE;

    IF rejected_quotation.status <> 'manager_approval'
       OR rejected_quotation.revision_number <= 1
       OR COALESCE(rejected_quotation.is_superseded, false) THEN
        RAISE EXCEPTION 'Only an active revised quotation awaiting approval can be rejected.';
    END IF;

    UPDATE public.blink_quotations
    SET status = 'rejected',
        rejection_reason = NULLIF(BTRIM(p_rejection_reason), ''),
        is_superseded = true,
        updated_at = NOW()
    WHERE id = rejected_quotation.id
    RETURNING * INTO rejected_quotation;

    UPDATE public.blink_quotations
    SET is_superseded = false,
        superseded_by_id = NULL,
        status = COALESCE(
            rejected_quotation.revision_previous_status,
            CASE WHEN EXISTS (
                SELECT 1
                FROM public.blink_shipments
                WHERE job_number = rejected_quotation.job_number
                  AND COALESCE(status, '') <> 'cancelled'
            ) THEN 'converted' ELSE 'sent' END
        ),
        updated_at = NOW()
    WHERE superseded_by_id = rejected_quotation.id
    RETURNING * INTO restored_quotation;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The source quotation for revision % could not be restored.', p_quotation_id;
    END IF;

    RETURN rejected_quotation;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_blink_invoice_journal_during_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    job_order_number text;
    source_quotation_id uuid;
BEGIN
    IF NEW.entry_type <> 'invoice'
       OR NEW.reference_type NOT IN ('ar', 'blink_invoice')
       OR NEW.reference_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT invoice.job_number, CASE
        WHEN EXISTS (
            SELECT 1
            FROM public.blink_quotations AS quotation
            WHERE quotation.id = invoice.quotation_id
              AND quotation.job_number = invoice.job_number
        ) THEN invoice.quotation_id
        ELSE shipment.quotation_id
    END
    INTO job_order_number, source_quotation_id
    FROM public.blink_invoices AS invoice
    LEFT JOIN public.blink_shipments AS shipment
      ON (
          shipment.id = invoice.shipment_id
          OR (invoice.shipment_id IS NULL AND shipment.id = invoice.quotation_id)
      )
     AND shipment.sales_quotation_id IS NULL
    WHERE invoice.id = NEW.reference_id;

    IF NOT FOUND OR job_order_number IS NULL OR source_quotation_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(job_order_number, 0));

    IF NOT EXISTS (
        SELECT 1
        FROM public.blink_quotations
        WHERE id = source_quotation_id
          AND job_number = job_order_number
    ) THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.blink_quotations
        WHERE job_number = job_order_number
          AND NOT COALESCE(is_superseded, false)
          AND status IN ('revision_requested', 'manager_approval')
    ) OR EXISTS (
        SELECT 1
        FROM public.blink_quotations
        WHERE id = source_quotation_id
          AND COALESCE(is_superseded, false)
    ) THEN
        RAISE EXCEPTION 'Invoice journal cannot be posted while its Job Order has a pending quotation revision.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_blink_invoice_journal_during_revision
    ON public.blink_journal_entries;

CREATE TRIGGER trg_guard_blink_invoice_journal_during_revision
    BEFORE INSERT ON public.blink_journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_blink_invoice_journal_during_revision();

REVOKE ALL ON FUNCTION public.create_blink_quotation_revision(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_blink_quotation_revision(uuid, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.request_blink_quotation_revision(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_blink_quotation_revision(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_blink_operational_invoice_for_job(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blink_operational_invoice_for_job(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_blink_quotation_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_blink_quotation_revision(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_blink_quotation_revision(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_blink_quotation_revision(uuid, text) TO authenticated;
