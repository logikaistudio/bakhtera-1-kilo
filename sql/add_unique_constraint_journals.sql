-- Migration: Add Unique Constraint to Prevent Duplicate Journal Entries (BLINK)
-- Created: 2026-05-25
-- Purpose: Prevent duplicate journal entries with same account, debit, credit, and date

-- =====================================================
-- STEP 1: Delete duplicate entries (keep the oldest)
-- =====================================================
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

-- =====================================================
-- STEP 2: Add unique index to prevent future duplicates
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS unique_blink_journal_entry 
ON public.blink_journal_entries (
    coa_id,
    debit,
    credit,
    DATE(entry_date)
);

-- =====================================================
-- STEP 3: Verify - should return no rows if successful
-- =====================================================
SELECT 
    coa_id, 
    debit, 
    credit, 
    DATE(entry_date) as entry_date,
    COUNT(*) as duplicate_count
FROM public.blink_journal_entries
GROUP BY coa_id, debit, credit, DATE(entry_date)
HAVING COUNT(*) > 1;

-- Total entries summary
SELECT COUNT(*) as total_blink_entries FROM public.blink_journal_entries;

