-- ============================================================
-- MIGRATION 074: Complete Journal Integrity Repair
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Fungsi SQL ini akan:
-- 1. Menampilkan ringkasan COA yang ada (untuk verifikasi)
-- 2. Backfill coa_id pada journal entries yang masih NULL
-- 3. Menambah index untuk mempercepat laporan keuangan
-- 4. Menampilkan laporan hasil repair
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 0: Lihat COA yang ada (untuk debug / verifikasi)
-- ────────────────────────────────────────────────────────────
SELECT code, name, type, is_active
FROM finance_coa
ORDER BY code;

-- ────────────────────────────────────────────────────────────
-- STEP 1: Backfill coa_id dari account_code (paling akurat)
-- Cocokkan kode akun di journal dengan kode di master COA
-- ────────────────────────────────────────────────────────────
UPDATE blink_journal_entries je
SET coa_id = coa.id
FROM finance_coa coa
WHERE je.coa_id IS NULL
  AND je.account_code IS NOT NULL
  AND je.account_code != ''
  AND coa.code = je.account_code;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Backfill sisa entri berdasarkan type dan entry_type
--
-- Logika mapping:
--   invoice (debit)       → ASSET (Piutang Usaha)
--   invoice (credit)      → REVENUE (Pendapatan)
--   ar_payment (debit)    → ASSET (Bank/Kas — bukan piutang)
--   ar_payment (credit)   → ASSET (Piutang Usaha)
--   bill_payment (debit)  → LIABILITY (Hutang Usaha)
--   bill_payment (credit) → ASSET (Bank/Kas)
--   purchase_order (debit)→ COGS/EXPENSE
--   purchase_order (credit)→ LIABILITY (Hutang Usaha)
--   cogs (debit)          → COGS
--   cogs (credit)         → COGS/EXPENSE
-- ────────────────────────────────────────────────────────────

-- 2A: Invoice DEBIT → Piutang Usaha (ASSET, code starts with 1-03 atau 1-04)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'ASSET'
      AND is_active = true
      AND (
        code LIKE '1-03%' OR
        code LIKE '1-04%' OR
        lower(name) LIKE '%piutang%' OR
        lower(name) LIKE '%receivable%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('invoice', 'ar')
  AND je.debit > 0
  AND je.credit = 0;

-- 2B: Invoice CREDIT → Pendapatan (REVENUE)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'REVENUE'
      AND is_active = true
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('invoice', 'ar')
  AND je.credit > 0
  AND je.debit = 0;

-- 2C: AR Payment DEBIT → Bank/Kas (ASSET, code starts with 1-01 atau 1-02)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'ASSET'
      AND is_active = true
      AND (
        code LIKE '1-01%' OR
        code LIKE '1-02%' OR
        lower(name) LIKE '%bank%' OR
        lower(name) LIKE '%kas%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('payment', 'ar_payment')
  AND je.reference_type = 'ar_payment'
  AND je.debit > 0
  AND je.credit = 0;

-- 2D: AR Payment CREDIT → Piutang Usaha (ASSET)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'ASSET'
      AND is_active = true
      AND (
        code LIKE '1-03%' OR
        code LIKE '1-04%' OR
        lower(name) LIKE '%piutang%' OR
        lower(name) LIKE '%receivable%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('payment', 'ar_payment')
  AND je.reference_type = 'ar_payment'
  AND je.credit > 0
  AND je.debit = 0;

-- 2E: AP Payment DEBIT → Hutang Usaha (LIABILITY)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'LIABILITY'
      AND is_active = true
      AND (
        code LIKE '2%' OR
        lower(name) LIKE '%hutang%' OR
        lower(name) LIKE '%payable%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('bill_payment', 'ap_payment')
  AND je.debit > 0
  AND je.credit = 0;

-- 2F: AP Payment CREDIT → Bank/Kas (ASSET)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'ASSET'
      AND is_active = true
      AND (
        code LIKE '1-01%' OR
        code LIKE '1-02%' OR
        lower(name) LIKE '%bank%' OR
        lower(name) LIKE '%kas%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('bill_payment', 'ap_payment')
  AND je.credit > 0
  AND je.debit = 0;

-- 2G: PO Approval DEBIT → COGS / HPP (code starts with 5)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type IN ('COGS', 'EXPENSE', 'DIRECT_COST')
      AND is_active = true
      AND (
        code LIKE '5%' OR
        code LIKE '6%' OR
        lower(name) LIKE '%hpp%' OR
        lower(name) LIKE '%cogs%' OR
        lower(name) LIKE '%freight%' OR
        lower(name) LIKE '%beban%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('purchase_order', 'po')
  AND je.debit > 0
  AND je.credit = 0;

-- 2H: PO Approval CREDIT → Hutang Usaha (LIABILITY)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type = 'LIABILITY'
      AND is_active = true
      AND (
        code LIKE '2%' OR
        lower(name) LIKE '%hutang%' OR
        lower(name) LIKE '%payable%'
      )
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type IN ('purchase_order', 'po')
  AND je.credit > 0
  AND je.debit = 0;

-- 2I: COGS DEBIT → HPP akun (COGS type)
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type IN ('COGS', 'DIRECT_COST')
      AND is_active = true
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type = 'cogs'
  AND je.debit > 0
  AND je.credit = 0;

-- 2J: COGS CREDIT → HPP/Expense akun
UPDATE blink_journal_entries je
SET coa_id = (
    SELECT id FROM finance_coa
    WHERE type IN ('COGS', 'EXPENSE', 'DIRECT_COST')
      AND is_active = true
    ORDER BY code ASC
    LIMIT 1
)
WHERE je.coa_id IS NULL
  AND je.entry_type = 'cogs'
  AND je.credit > 0
  AND je.debit = 0;

-- ────────────────────────────────────────────────────────────
-- STEP 3: Tambah indexes untuk mempercepat P&L, TB, Ledger
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_blink_journal_coa_id
    ON blink_journal_entries(coa_id);

CREATE INDEX IF NOT EXISTS idx_blink_journal_entry_date
    ON blink_journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_blink_journal_account_code
    ON blink_journal_entries(account_code);

CREATE INDEX IF NOT EXISTS idx_blink_journal_entry_type
    ON blink_journal_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_blink_journal_batch_id
    ON blink_journal_entries(batch_id);

CREATE INDEX IF NOT EXISTS idx_blink_journal_reference_type
    ON blink_journal_entries(reference_type);

-- ────────────────────────────────────────────────────────────
-- STEP 4: LAPORAN HASIL REPAIR
-- ────────────────────────────────────────────────────────────

-- 4A: Total ringkasan
SELECT
    'SUMMARY' AS section,
    COUNT(*) AS total_entries,
    COUNT(coa_id) AS entries_with_coa_id,
    COUNT(*) - COUNT(coa_id) AS entries_still_missing_coa_id
FROM blink_journal_entries;

-- 4B: Breakdown per entry_type
SELECT
    entry_type,
    COUNT(*) AS total,
    COUNT(coa_id) AS with_coa_id,
    COUNT(*) - COUNT(coa_id) AS missing_coa_id
FROM blink_journal_entries
GROUP BY entry_type
ORDER BY missing_coa_id DESC;

-- 4C: Journal entries yang masih tidak punya coa_id (butuh perhatian manual)
SELECT
    entry_number,
    entry_date,
    entry_type,
    account_code,
    account_name,
    debit,
    credit
FROM blink_journal_entries
WHERE coa_id IS NULL
ORDER BY entry_date DESC
LIMIT 50;

-- 4D: Verifikasi P&L akan muncul — akun dengan balance
SELECT
    c.code,
    c.name,
    c.type,
    SUM(CASE
        WHEN c.type IN ('REVENUE', 'OTHER_INCOME') THEN je.credit - je.debit
        WHEN c.type IN ('COGS', 'EXPENSE', 'DIRECT_COST', 'OTHER_EXPENSE') THEN je.debit - je.credit
        ELSE 0
    END) AS balance
FROM finance_coa c
JOIN blink_journal_entries je ON je.coa_id = c.id
GROUP BY c.id, c.code, c.name, c.type
HAVING ABS(SUM(
    CASE
        WHEN c.type IN ('REVENUE', 'OTHER_INCOME') THEN je.credit - je.debit
        WHEN c.type IN ('COGS', 'EXPENSE', 'DIRECT_COST', 'OTHER_EXPENSE') THEN je.debit - je.credit
        ELSE 0
    END
)) > 0
ORDER BY c.type, c.code;
