-- =====================================================================
-- Migration 073: Seed COGS / Cost accounts (kepala 5) for Blink module
-- Purpose: Populate finance_coa with freight-related cost accounts
--          so the COGS Breakdown picker has data to display.
-- =====================================================================

-- Upsert kepala 5 accounts (COGS / Cost of Services)
INSERT INTO finance_coa (code, name, type, parent_code, level, group_name, 
    is_trial_balance, is_profit_loss, is_balance_sheet, is_ar, is_ap, is_active)
VALUES
-- Level 1 - Root COGS
('5000', 'HARGA POKOK PENJUALAN (HPP)', 'EXPENSE', NULL, 1, 'Cost of Goods Sold',
    true, true, false, false, false, true),

-- Level 2 - Sub-groups
('5100', 'Biaya Freight & Pengiriman', 'EXPENSE', '5000', 2, 'Cost of Goods Sold',
    true, true, false, false, false, true),
('5200', 'Biaya Kepabeanan & Ekspedisi', 'EXPENSE', '5000', 2, 'Cost of Goods Sold',
    true, true, false, false, false, true),
('5300', 'Biaya Operasional Pelabuhan', 'EXPENSE', '5000', 2, 'Cost of Goods Sold',
    true, true, false, false, false, true),
('5400', 'Biaya Asuransi & Dokumen', 'EXPENSE', '5000', 2, 'Cost of Goods Sold',
    true, true, false, false, false, true),
('5500', 'Biaya Lain-lain COGS', 'EXPENSE', '5000', 2, 'Cost of Goods Sold',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 5100 (Freight)
('5101', 'Ocean Freight', 'EXPENSE', '5100', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5102', 'Air Freight', 'EXPENSE', '5100', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5103', 'Trucking / Darat', 'EXPENSE', '5100', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5104', 'Biaya Inland Transport', 'EXPENSE', '5100', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5105', 'Rail Freight', 'EXPENSE', '5100', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),

-- Level 3 - Detail accounts under 5200 (Customs & Brokerage)
('5201', 'Bea Masuk / Import Duty', 'EXPENSE', '5200', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5202', 'PPN Impor', 'EXPENSE', '5200', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5203', 'Biaya PPJK / Customs Broker', 'EXPENSE', '5200', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5204', 'Biaya Pemeriksaan Fisik', 'EXPENSE', '5200', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5205', 'Biaya Survey / Surveyor', 'EXPENSE', '5200', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),

-- Level 3 - Detail accounts under 5300 (Port / Terminal)
('5301', 'THC (Terminal Handling Charge)', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5302', 'Demurrage', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5303', 'Detention', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5304', 'Biaya Bongkar Muat (B/M)', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5305', 'Storage / Penumpukan', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5306', 'Port Handling Fee', 'EXPENSE', '5300', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),

-- Level 3 - Detail accounts under 5400 (Insurance & Documentation)
('5401', 'Asuransi Cargo', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5402', 'Biaya Dokumentasi / Documentation Fee', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5403', 'Biaya Pengurusan BL / AWB', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5404', 'Biaya Fumigasi', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),

-- Level 3 - Detail accounts under 5500 (Other COGS)
('5501', 'Biaya Lain-lain Pengiriman', 'EXPENSE', '5500', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5502', 'Biaya Penyimpanan / Warehousing', 'EXPENSE', '5500', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5503', 'Bank Charges', 'EXPENSE', '5500', 3, 'Cost of Goods Sold',
    true, true, false, false, false, true),
('5504', 'Charges - Others', 'EXPENSE', '5500', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true)

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    parent_code = EXCLUDED.parent_code,
    level = EXCLUDED.level,
    group_name = EXCLUDED.group_name,
    is_trial_balance = EXCLUDED.is_trial_balance,
    is_profit_loss = EXCLUDED.is_profit_loss,
    is_balance_sheet = EXCLUDED.is_balance_sheet,
    is_ar = EXCLUDED.is_ar,
    is_ap = EXCLUDED.is_ap,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =====================================================================
-- END OF MIGRATION 073
-- =====================================================================
