-- Migration: Add Unique Constraint to Prevent Duplicate Journal Entries
-- Created: 2026-05-25
-- Purpose: Prevent duplicate journal entries with same account, debit, credit, and date

-- =====================================================
-- BLINK JOURNAL ENTRIES - Add Unique Constraint
-- =====================================================

-- First, identify and delete existing duplicates (keep the oldest one)
DELETE FROM public.blink_journal_entries
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY coa_id, debit, credit, DATE(entry_date) 
                ORDER BY entry_date ASC
            ) as rn
        FROM public.blink_journal_entries
    ) t
    WHERE rn > 1
);

-- Add unique index to prevent future duplicates
-- Using functional index with DATE for more flexibility with timestamps
CREATE UNIQUE INDEX IF NOT EXISTS unique_blink_journal_entry 
ON public.blink_journal_entries (
    coa_id,
    debit,
    credit,
    DATE(entry_date)
);

-- =====================================================
-- BRIDGE JOURNAL ENTRIES - Add Unique Constraint
-- =====================================================

-- First, identify and delete existing duplicates (keep the oldest one)
DELETE FROM public.bridge_journal_entries
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY coa_id, debit, credit, DATE(entry_date) 
                ORDER BY entry_date ASC
            ) as rn
        FROM public.bridge_journal_entries
    ) t
    WHERE rn > 1
);

-- Add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_bridge_journal_entry 
ON public.bridge_journal_entries (
    coa_id,
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
    debit, 
    credit, 
    DATE(entry_date) as entry_date,
    COUNT(*) as duplicate_count
FROM public.blink_journal_entries
GROUP BY coa_id, debit, credit, DATE(entry_date)
HAVING COUNT(*) > 1;

-- Verify no duplicates remain in Bridge
SELECT 
    coa_id, 
    debit, 
    credit, 
    DATE(entry_date) as entry_date,
    COUNT(*) as duplicate_count
FROM public.bridge_journal_entries
GROUP BY coa_id, debit, credit, DATE(entry_date)
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
