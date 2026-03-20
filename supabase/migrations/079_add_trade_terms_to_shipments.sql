-- Migration: Add incoterm, payment_terms, and notes to blink_shipments
-- These fields carry over from the Quotation when an SO is created
-- Run this in Supabase SQL Editor

ALTER TABLE blink_shipments
    ADD COLUMN IF NOT EXISTS incoterm TEXT,              -- e.g. FOB, CIF, EXW, DDP
    ADD COLUMN IF NOT EXISTS payment_terms TEXT,         -- e.g. Net 30 Days
    ADD COLUMN IF NOT EXISTS notes TEXT;                 -- General notes / remarks

COMMENT ON COLUMN blink_shipments.incoterm IS 'International Commercial Terms e.g. FOB, CIF, EXW';
COMMENT ON COLUMN blink_shipments.payment_terms IS 'Payment terms e.g. Net 30 Days';
COMMENT ON COLUMN blink_shipments.notes IS 'General notes and remarks';
