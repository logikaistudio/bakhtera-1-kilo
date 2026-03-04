-- =============================================
-- Migration 066: COA Item Linkage & Granular Journal Entries
-- Purpose: Link AR invoice items and AP PO items to specific COA codes
--          and generate per-item double-entry journal entries for
--          accurate Trial Balance and financial reporting.
-- =============================================

-- =============================================
-- PART 1: Add COA columns to finance_coa if missing
-- =============================================

-- Ensure level column exists on finance_coa (some older migrations may not have it)
ALTER TABLE finance_coa ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE finance_coa ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Update existing COA levels if needed
UPDATE finance_coa SET level = 1 WHERE code ~ '^\d{4}$' AND level IS NULL;
UPDATE finance_coa SET level = 2 WHERE code ~ '^\d{4}-\d{3}$' AND level IS NULL;

-- =============================================
-- PART 2: Create function to generate journal entries
--         from blink_invoices (AR) per line item
-- =============================================
CREATE OR REPLACE FUNCTION create_journal_from_blink_invoice()
RETURNS TRIGGER AS $$
DECLARE
    batch_uuid UUID := uuid_generate_v4();
    entry_num  TEXT;
    ar_coa_id  UUID;
    item       JSONB;
    item_revenue_coa_id UUID;
    item_amount NUMERIC;
    item_desc   TEXT;
    line_counter INTEGER := 0;
BEGIN
    -- Only create journal for new invoices (not drafts)
    IF TG_OP = 'INSERT' AND NEW.status NOT IN ('draft', 'cancelled') THEN
        entry_num := 'JE-INV-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 8, '0');

        -- Get default AR COA (Piutang Usaha)
        SELECT id INTO ar_coa_id FROM finance_coa WHERE type = 'ASSET' AND (code LIKE '120%' OR code LIKE '1200%') LIMIT 1;

        -- DEBIT: Accounts Receivable (full invoice amount)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name, party_id
        ) VALUES (
            entry_num || '-D',
            NEW.invoice_date,
            'invoice',
            'blink_invoice',
            NEW.id,
            NEW.invoice_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = ar_coa_id), '1200'),
            'Piutang Usaha - ' || NEW.customer_name,
            NEW.total_amount,
            0,
            NEW.currency,
            'Invoice ' || NEW.invoice_number || ' kepada ' || NEW.customer_name,
            batch_uuid,
            'auto',
            ar_coa_id,
            NEW.customer_name,
            NEW.customer_id::TEXT
        );

        -- CREDIT: Revenue per line item (use item's coa_id if set, else default revenue COA)
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.invoice_items)
        LOOP
            line_counter := line_counter + 1;
            item_amount := COALESCE((item->>'amount')::NUMERIC, 0);
            item_desc   := COALESCE(item->>'description', 'Item ' || line_counter);

            -- Get item-level COA if assigned
            IF item->>'coa_id' IS NOT NULL AND item->>'coa_id' != '' THEN
                SELECT id INTO item_revenue_coa_id FROM finance_coa WHERE id = (item->>'coa_id')::UUID LIMIT 1;
            ELSE
                item_revenue_coa_id := NULL;
            END IF;

            -- Fallback to default Revenue COA
            IF item_revenue_coa_id IS NULL THEN
                SELECT id INTO item_revenue_coa_id FROM finance_coa WHERE type = 'REVENUE' AND (code LIKE '400%' OR code LIKE '4000%' OR code LIKE '4100%') ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO blink_journal_entries (
                entry_number, entry_date, entry_type,
                reference_type, reference_id, reference_number,
                account_code, account_name,
                debit, credit,
                currency, description,
                batch_id, source, coa_id,
                party_name, party_id
            ) VALUES (
                entry_num || '-C-' || line_counter,
                NEW.invoice_date,
                'invoice',
                'blink_invoice',
                NEW.id,
                NEW.invoice_number,
                COALESCE((SELECT code FROM finance_coa WHERE id = item_revenue_coa_id), '4100'),
                COALESCE((SELECT name FROM finance_coa WHERE id = item_revenue_coa_id), 'Pendapatan Jasa') || ' - ' || item_desc,
                0,
                item_amount,
                NEW.currency,
                'Invoice ' || NEW.invoice_number || ' - ' || item_desc,
                batch_uuid,
                'auto',
                item_revenue_coa_id,
                NEW.customer_name,
                NEW.customer_id::TEXT
            );
        END LOOP;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PART 3: Function for AR payment journal (blink_payments incoming)
-- Double-entry: Dr. Bank, Cr. Piutang Usaha
-- =============================================
CREATE OR REPLACE FUNCTION create_journal_from_ar_payment_v2()
RETURNS TRIGGER AS $$
DECLARE
    batch_uuid  UUID := uuid_generate_v4();
    entry_num   TEXT;
    bank_coa_id UUID;
    ar_coa_id   UUID;
    inv_rec     RECORD;
BEGIN
    -- Only for incoming payments
    IF NEW.payment_type = 'incoming' THEN
        entry_num := 'JE-PAY-IN-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 8, '0');

        -- Get invoice details
        SELECT * INTO inv_rec FROM blink_invoices WHERE id = NEW.reference_id LIMIT 1;

        -- Get bank/cash COA
        SELECT id INTO bank_coa_id FROM finance_coa WHERE type = 'ASSET' AND (code LIKE '110%' OR code LIKE '1100%' OR code LIKE '1101%' OR code LIKE '1102%') ORDER BY code LIMIT 1;
        -- Get AR COA
        SELECT id INTO ar_coa_id FROM finance_coa WHERE type = 'ASSET' AND (code LIKE '120%' OR code LIKE '1200%') LIMIT 1;

        -- DEBIT: Bank / Kas (uang masuk)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name
        ) VALUES (
            entry_num || '-D',
            NEW.payment_date,
            'payment',
            'ar_payment',
            NEW.id,
            NEW.payment_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = bank_coa_id), '1101'),
            COALESCE(NEW.bank_account, 'Kas/Bank'),
            NEW.amount,
            0,
            NEW.currency,
            'Terima pembayaran ' || COALESCE(inv_rec.invoice_number, NEW.reference_number) || ' dari ' || COALESCE(inv_rec.customer_name, 'Customer'),
            batch_uuid,
            'auto',
            bank_coa_id,
            COALESCE(inv_rec.customer_name, 'Customer')
        );

        -- CREDIT: Piutang Usaha (AR berkurang)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name
        ) VALUES (
            entry_num || '-C',
            NEW.payment_date,
            'payment',
            'ar_payment',
            NEW.id,
            NEW.payment_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = ar_coa_id), '1200'),
            'Piutang Usaha',
            0,
            NEW.amount,
            NEW.currency,
            'Terima pembayaran ' || COALESCE(inv_rec.invoice_number, NEW.reference_number) || ' dari ' || COALESCE(inv_rec.customer_name, 'Customer'),
            batch_uuid,
            'auto',
            ar_coa_id,
            COALESCE(inv_rec.customer_name, 'Customer')
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PART 4: Function for AP payment journal (blink_payments outgoing)
-- Double-entry: Dr. Hutang Usaha, Cr. Bank
-- =============================================
CREATE OR REPLACE FUNCTION create_journal_from_ap_payment_v2()
RETURNS TRIGGER AS $$
DECLARE
    batch_uuid  UUID := uuid_generate_v4();
    entry_num   TEXT;
    bank_coa_id UUID;
    ap_coa_id   UUID;
    po_rec      RECORD;
BEGIN
    -- Only for outgoing payments
    IF NEW.payment_type = 'outgoing' THEN
        entry_num := 'JE-PAY-OUT-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 8, '0');

        -- Get PO details for vendor name
        SELECT * INTO po_rec FROM blink_purchase_orders WHERE id = NEW.reference_id LIMIT 1;

        -- Get bank/cash COA
        SELECT id INTO bank_coa_id FROM finance_coa WHERE type = 'ASSET' AND (code LIKE '110%' OR code LIKE '1100%' OR code LIKE '1101%' OR code LIKE '1102%') ORDER BY code LIMIT 1;
        -- Get AP COA
        SELECT id INTO ap_coa_id FROM finance_coa WHERE type = 'LIABILITY' AND (code LIKE '210%' OR code LIKE '2100%') LIMIT 1;

        -- DEBIT: Hutang Usaha (AP berkurang)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name
        ) VALUES (
            entry_num || '-D',
            NEW.payment_date,
            'bill_payment',
            'ap_payment',
            NEW.id,
            NEW.payment_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = ap_coa_id), '2100'),
            'Hutang Usaha',
            NEW.amount,
            0,
            NEW.currency,
            'Bayar ' || COALESCE(po_rec.po_number, NEW.reference_number) || ' ke ' || COALESCE(po_rec.vendor_name, 'Vendor'),
            batch_uuid,
            'auto',
            ap_coa_id,
            COALESCE(po_rec.vendor_name, 'Vendor')
        );

        -- CREDIT: Bank / Kas (uang keluar)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name
        ) VALUES (
            entry_num || '-C',
            NEW.payment_date,
            'bill_payment',
            'ap_payment',
            NEW.id,
            NEW.payment_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = bank_coa_id), '1101'),
            COALESCE(NEW.bank_account, 'Kas/Bank'),
            0,
            NEW.amount,
            NEW.currency,
            'Bayar ' || COALESCE(po_rec.po_number, NEW.reference_number) || ' ke ' || COALESCE(po_rec.vendor_name, 'Vendor'),
            batch_uuid,
            'auto',
            bank_coa_id,
            COALESCE(po_rec.vendor_name, 'Vendor')
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PART 5: Function for AP PO journal (per item)
-- Double-entry: Dr. Expense (per item COA), Cr. Hutang Usaha
-- Triggered when PO is approved
-- =============================================
CREATE OR REPLACE FUNCTION create_journal_from_blink_po()
RETURNS TRIGGER AS $$
DECLARE
    batch_uuid   UUID := uuid_generate_v4();
    entry_num    TEXT;
    ap_coa_id    UUID;
    item         JSONB;
    item_expense_coa_id UUID;
    item_amount  NUMERIC;
    item_desc    TEXT;
    line_counter INTEGER := 0;
BEGIN
    -- Create journal only when PO moves to 'approved' status
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Skip if journal already exists for this PO
        IF EXISTS (SELECT 1 FROM blink_journal_entries WHERE reference_id = NEW.id AND reference_type = 'blink_po') THEN
            RETURN NEW;
        END IF;

        entry_num := 'JE-PO-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT, 8, '0');

        -- Get AP COA (Hutang Usaha)
        SELECT id INTO ap_coa_id FROM finance_coa WHERE type = 'LIABILITY' AND (code LIKE '210%' OR code LIKE '2100%') LIMIT 1;

        -- CREDIT: Accounts Payable (total PO amount)
        INSERT INTO blink_journal_entries (
            entry_number, entry_date, entry_type,
            reference_type, reference_id, reference_number,
            account_code, account_name,
            debit, credit,
            currency, description,
            batch_id, source, coa_id,
            party_name, party_id
        ) VALUES (
            entry_num || '-C',
            NEW.po_date,
            'po',
            'blink_po',
            NEW.id,
            NEW.po_number,
            COALESCE((SELECT code FROM finance_coa WHERE id = ap_coa_id), '2100'),
            'Hutang Usaha - ' || NEW.vendor_name,
            0,
            NEW.total_amount,
            NEW.currency,
            'PO ' || NEW.po_number || ' dari ' || NEW.vendor_name,
            batch_uuid,
            'auto',
            ap_coa_id,
            NEW.vendor_name,
            NEW.vendor_id
        );

        -- DEBIT: Expense per line item
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.po_items)
        LOOP
            line_counter := line_counter + 1;
            item_amount := COALESCE((item->>'amount')::NUMERIC, 0);
            item_desc   := COALESCE(item->>'description', item->>'item_name', 'Item ' || line_counter);

            -- Get item-level COA if assigned
            IF item->>'coa_id' IS NOT NULL AND item->>'coa_id' != '' THEN
                SELECT id INTO item_expense_coa_id FROM finance_coa WHERE id = (item->>'coa_id')::UUID LIMIT 1;
            ELSE
                item_expense_coa_id := NULL;
            END IF;

            -- Fallback to default Expense COA
            IF item_expense_coa_id IS NULL THEN
                SELECT id INTO item_expense_coa_id FROM finance_coa WHERE type = 'EXPENSE' AND (code LIKE '500%' OR code LIKE '5000%' OR code LIKE '5100%') ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO blink_journal_entries (
                entry_number, entry_date, entry_type,
                reference_type, reference_id, reference_number,
                account_code, account_name,
                debit, credit,
                currency, description,
                batch_id, source, coa_id,
                party_name, party_id
            ) VALUES (
                entry_num || '-D-' || line_counter,
                NEW.po_date,
                'po',
                'blink_po',
                NEW.id,
                NEW.po_number,
                COALESCE((SELECT code FROM finance_coa WHERE id = item_expense_coa_id), '5100'),
                COALESCE((SELECT name FROM finance_coa WHERE id = item_expense_coa_id), 'Beban Operasional') || ' - ' || item_desc,
                item_amount,
                0,
                NEW.currency,
                'PO ' || NEW.po_number || ' - ' || item_desc,
                batch_uuid,
                'auto',
                item_expense_coa_id,
                NEW.vendor_name,
                NEW.vendor_id
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PART 6: Add bank_account column to blink_payments if not exist
-- (needed for journal entry lookup)
-- =============================================
ALTER TABLE blink_payments ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE blink_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'incoming'
    CHECK (payment_type IN ('incoming', 'outgoing'));

-- =============================================
-- PART 7: Attach triggers
-- =============================================

-- Drop old triggers if exist (replaced by new ones)
DROP TRIGGER IF EXISTS trigger_journal_from_blink_invoice ON blink_invoices;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_in ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_payment_out ON blink_payments;
DROP TRIGGER IF EXISTS trigger_journal_from_blink_po ON blink_purchase_orders;

-- AR: Invoice created → journal entries per item
CREATE TRIGGER trigger_journal_from_blink_invoice
    AFTER INSERT ON blink_invoices
    FOR EACH ROW EXECUTE FUNCTION create_journal_from_blink_invoice();

-- AR Payment received → journal entries
CREATE TRIGGER trigger_journal_from_blink_payment_in
    AFTER INSERT ON blink_payments
    FOR EACH ROW WHEN (NEW.payment_type = 'incoming')
    EXECUTE FUNCTION create_journal_from_ar_payment_v2();

-- AP Payment sent → journal entries
CREATE TRIGGER trigger_journal_from_blink_payment_out
    AFTER INSERT ON blink_payments
    FOR EACH ROW WHEN (NEW.payment_type = 'outgoing')
    EXECUTE FUNCTION create_journal_from_ap_payment_v2();

-- AP: PO approved → journal entries per item
CREATE TRIGGER trigger_journal_from_blink_po
    AFTER INSERT OR UPDATE OF status ON blink_purchase_orders
    FOR EACH ROW EXECUTE FUNCTION create_journal_from_blink_po();

-- =============================================
-- PART 8: Index for journal queries
-- =============================================
CREATE INDEX IF NOT EXISTS idx_journal_reference_type ON blink_journal_entries(reference_type);
CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON blink_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_coa_id ON blink_journal_entries(coa_id);
CREATE INDEX IF NOT EXISTS idx_journal_batch_id ON blink_journal_entries(batch_id);

-- =============================================
-- END OF MIGRATION 066
-- =============================================
COMMENT ON FUNCTION create_journal_from_blink_invoice IS 'Auto-creates double-entry journal: Dr AR / Cr Revenue per item when invoice is inserted';
COMMENT ON FUNCTION create_journal_from_ar_payment_v2 IS 'Auto-creates double-entry journal: Dr Bank / Cr AR when incoming payment is recorded';
COMMENT ON FUNCTION create_journal_from_ap_payment_v2 IS 'Auto-creates double-entry journal: Dr AP / Cr Bank when outgoing payment is recorded';
COMMENT ON FUNCTION create_journal_from_blink_po IS 'Auto-creates double-entry journal: Dr Expense per item / Cr AP when PO is approved';
