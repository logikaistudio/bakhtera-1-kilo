INSERT INTO public.blink_ar_transactions (
    ar_number,
    invoice_id,
    invoice_number,
    customer_id,
    customer_name,
    transaction_date,
    due_date,
    currency,
    original_amount,
    paid_amount,
    outstanding_amount,
    status,
    division,
    notes
)
SELECT
    'AR-RECON-' || replace(inv.id::text, '-', ''),
    inv.id,
    inv.invoice_number,
    inv.customer_id,
    COALESCE(NULLIF(inv.customer_name, ''), inv.customer_company, 'Unknown'),
    COALESCE(inv.invoice_date, CURRENT_DATE),
    COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE),
    CASE
        WHEN upper(COALESCE(inv.currency, 'IDR')) IN ('IDR', 'USD') THEN upper(COALESCE(inv.currency, 'IDR'))
        ELSE 'IDR'
    END,
    amounts.original_amount,
    amounts.paid_amount,
    amounts.outstanding_amount,
    CASE
        WHEN amounts.outstanding_amount <= 0 THEN 'paid'
        WHEN amounts.paid_amount > 0 THEN 'partial'
        WHEN lower(inv.status) = 'overdue' THEN 'overdue'
        ELSE 'outstanding'
    END,
    COALESCE(NULLIF(inv.division, ''), 'blink'),
    'Backfilled from approved invoice ' || COALESCE(inv.invoice_number, inv.id::text)
FROM public.blink_invoices AS inv
CROSS JOIN LATERAL (
    SELECT
        COALESCE(NULLIF(inv.total_amount, 0), inv.subtotal, 0)::numeric AS original_amount,
        COALESCE(inv.paid_amount, 0)::numeric AS paid_amount,
        GREATEST(
            0,
            COALESCE(NULLIF(inv.total_amount, 0), inv.subtotal, 0) - COALESCE(inv.paid_amount, 0)
        )::numeric AS outstanding_amount
) AS amounts
WHERE lower(COALESCE(inv.status, '')) IN ('approved', 'unpaid', 'partially_paid', 'paid', 'overdue')
  AND NOT EXISTS (
      SELECT 1
      FROM public.blink_ar_transactions AS ar
      WHERE ar.invoice_id = inv.id
  );
