-- ⚠️  WARNING: DO NOT RUN ON PRODUCTION DATABASE ⚠️
-- This file inserts FAKE/TEST data directly into production tables.
-- Running this will cause:
--   1. Extreme AR aging (150+ days overdue) from backdated invoices
--   2. Illegal PO status values ('outstanding','overdue') not recognized by app
--   3. Corrupt AR/AP dashboard metrics
--
-- If accidentally run, use: supabase/sample_data/cleanup_sample_data.sql
-- =========================================================================
-- Sample Data for BLINK Module: AR/AP Dashboard Testing
-- Run this ONLY on a staging/local environment

-- ============================================
-- INVOICES (AR) - Direct insert without FK deps
-- ============================================
INSERT INTO blink_invoices (
    invoice_number, job_number, customer_name,
    invoice_date, due_date, currency,
    invoice_items,
    subtotal, tax_rate, tax_amount,
    total_amount, paid_amount, outstanding_amount,
    status, notes, payment_terms
) VALUES
(
    'INV-2026-001', 'JOB-2026-001', 'PT Sejahtera Logistik',
    '2026-01-11', '2026-02-10', 'IDR',
    '[{"description":"Sea Freight FCL Jakarta-Singapore","quantity":1,"unit_price":85000000,"amount":85000000}]',
    85000000.00, 11.00, 9350000.00,
    94350000.00, 50000000.00, 44350000.00,
    'partial', 'Partial payment received - 50M IDR', 'NET 30'
),
(
    'INV-2025-099', 'JOB-2025-099', 'CV Maju Bersama',
    '2025-12-17', '2025-12-31', 'IDR',
    '[{"description":"Air Freight Surabaya-Hong Kong","quantity":1,"unit_price":12500000,"amount":12500000}]',
    12500000.00, 11.00, 1375000.00,
    13875000.00, 0.00, 13875000.00,
    'unpaid', 'OVERDUE - Payment reminder sent 3x', 'NET 14'
)
ON CONFLICT (invoice_number) DO NOTHING;

-- ============================================
-- PURCHASE ORDERS (AP) - Mixed currency
-- ============================================
INSERT INTO blink_purchase_orders (
    po_number, vendor_name, po_date, payment_terms,
    total_amount, paid_amount, outstanding_amount,
    currency, exchange_rate, status
) VALUES
('PO-2026-001', 'PT Cargo Indonesia',   '2026-04-15', 'NET 30', 85000000.00, 25000000.00, 60000000.00, 'IDR', 1.0,     'outstanding'),
('PO-2026-002', 'Global Shipping Inc',  '2026-03-20', 'NET 15', 8500.00,     4250.00,     4250.00,     'USD', 16000.0, 'outstanding'),
('PO-2025-098', 'PT Logistics Utama',   '2025-11-20', 'NET 30', 125000000.00,0.00,         125000000.00,'IDR', 1.0,     'overdue')
ON CONFLICT (po_number) DO NOTHING;

-- ============================================
-- VERIFY
-- ============================================
SELECT 'invoices' as tbl, count(*) FROM blink_invoices WHERE invoice_number IN ('INV-2026-001','INV-2025-099')
UNION ALL
SELECT 'purchase_orders', count(*) FROM blink_purchase_orders WHERE po_number IN ('PO-2026-001','PO-2026-002','PO-2025-098');
