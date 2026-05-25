-- Migration: Add Unique Constraint to Prevent Duplicate Journal Entries
-- Created: 2026-05-25
-- Purpose: Prevent duplicate journal entries with same account, debit, credit, and date

-- =====================================================
-- BLINK JOURNAL ENTRIES - Add Unique Constraint
-- =====================================================

-- First, identify and delete existing duplicates (keep the oldest one)
DELETE FROM public.blink_journal_entries b1
WHERE b1.id IN (
    SELECT b2.id
    FROM public.blink_journal_entries b2
    WHERE b2.id NOT IN (
        SELECT MIN(id)
        FROM public.blink_journal_entries
        WHERE (coa_id, account_code, debit, credit, DATE(entry_date)) IN (
            SELECT coa_id, account_code, debit, credit, DATE(entry_date)
            FROM public.blink_journal_entries
            GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
            HAVING COUNT(*) > 1
        )
        GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
    )
    AND (b2.coa_id, b2.account_code, b2.debit, b2.credit, DATE(b2.entry_date)) IN (
        SELECT coa_id, account_code, debit, credit, DATE(entry_date)
        FROM public.blink_journal_entries
        GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
        HAVING COUNT(*) > 1
    )
);

-- Add unique constraint to prevent future duplicates
-- Using functional index with DATE for more flexibility with timestamps
ALTER TABLE public.blink_journal_entries
ADD CONSTRAINT unique_blink_journal_entry 
UNIQUE (
    COALESCE(coa_id, -1),
    COALESCE(account_code, ''),
    debit,
    credit,
    DATE(entry_date)
);

-- =====================================================
-- BRIDGE JOURNAL ENTRIES - Add Unique Constraint
-- =====================================================

-- First, identify and delete existing duplicates (keep the oldest one)
DELETE FROM public.bridge_journal_entries b1
WHERE b1.id IN (
    SELECT b2.id
    FROM public.bridge_journal_entries b2
    WHERE b2.id NOT IN (
        SELECT MIN(id)
        FROM public.bridge_journal_entries
        WHERE (coa_id, account_code, debit, credit, DATE(entry_date)) IN (
            SELECT coa_id, account_code, debit, credit, DATE(entry_date)
            FROM public.bridge_journal_entries
            GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
            HAVING COUNT(*) > 1
        )
        GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
    )
    AND (b2.coa_id, b2.account_code, b2.debit, b2.credit, DATE(b2.entry_date)) IN (
        SELECT coa_id, account_code, debit, credit, DATE(entry_date)
        FROM public.bridge_journal_entries
        GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
        HAVING COUNT(*) > 1
    )
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.bridge_journal_entries
ADD CONSTRAINT unique_bridge_journal_entry 
UNIQUE (
    COALESCE(coa_id, -1),
    COALESCE(account_code, ''),
    debit,
    credit,
    DATE(entry_date)
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify no duplicates remain in Blink
SELECT 
    coa_id, 
    account_code, 
    debit, 
    credit, 
    DATE(entry_date) as entry_date,
    COUNT(*) as duplicate_count
FROM public.blink_journal_entries
GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
HAVING COUNT(*) > 1;

-- Verify no duplicates remain in Bridge
SELECT 
    coa_id, 
    account_code, 
    debit, 
    credit, 
    DATE(entry_date) as entry_date,
    COUNT(*) as duplicate_count
FROM public.bridge_journal_entries
GROUP BY coa_id, account_code, debit, credit, DATE(entry_date)
HAVING COUNT(*) > 1;

-- Summary
SELECT 
    'Blink' as module,
    COUNT(*) as total_entries
FROM public.blink_journal_entries
UNION ALL
SELECT 
    'Bridge' as module,
    COUNT(*) as total_entries
FROM public.bridge_journal_entries;
