-- =====================================================================
-- Migration 076: Seed Detailed REVENUE accounts (kepala 4) 
-- Purpose: Provide matching revenue accounts for every detailed COGS item.
--          This enables detailed logging in Profit & Loss for Income.
-- =====================================================================

INSERT INTO finance_coa (code, name, type, parent_code, level, group_name, 
    is_trial_balance, is_profit_loss, is_balance_sheet, is_ar, is_ap, is_active)
VALUES
-- Level 1 - Root Revenue
('4000', 'PENDAPATAN JASA (REVENUE)', 'REVENUE', NULL, 1, 'Revenue',
    true, true, false, false, false, true),

-- Level 2 - Sub-groups (Matches COGS Groups)
('4100', 'Pendapatan Freight & Pengiriman', 'REVENUE', '4000', 2, 'Revenue',
    true, true, false, false, false, true),
('4200', 'Pendapatan Kepabeanan & Ekspedisi', 'REVENUE', '4000', 2, 'Revenue',
    true, true, false, false, false, true),
('4300', 'Pendapatan Operasional Pelabuhan', 'REVENUE', '4000', 2, 'Revenue',
    true, true, false, false, false, true),
('4400', 'Pendapatan Asuransi & Dokumen', 'REVENUE', '4000', 2, 'Revenue',
    true, true, false, false, false, true),
('4500', 'Pendapatan Lain-lain', 'REVENUE', '4000', 2, 'Revenue',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 4100 (Freight)
('4101', 'Ocean Freight', 'REVENUE', '4100', 3, 'Revenue',
    true, true, false, false, false, true),
('4102', 'Air Freight', 'REVENUE', '4100', 3, 'Revenue',
    true, true, false, false, false, true),
('4103', 'Trucking / Darat', 'REVENUE', '4100', 3, 'Revenue',
    true, true, false, false, false, true),
('4104', 'Inland Transport', 'REVENUE', '4100', 3, 'Revenue',
    true, true, false, false, false, true),
('4105', 'Rail Freight', 'REVENUE', '4100', 3, 'Revenue',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 4200 (Customs & Brokerage)
('4201', 'Bea Masuk / Import Duty', 'REVENUE', '4200', 3, 'Revenue',
    true, true, false, false, false, true),
('4202', 'PPN Impor', 'REVENUE', '4200', 3, 'Revenue',
    true, true, false, false, false, true),
('4203', 'Biaya PPJK / Customs Broker', 'REVENUE', '4200', 3, 'Revenue',
    true, true, false, false, false, true),
('4204', 'Biaya Pemeriksaan Fisik', 'REVENUE', '4200', 3, 'Revenue',
    true, true, false, false, false, true),
('4205', 'Biaya Survey / Surveyor', 'REVENUE', '4200', 3, 'Revenue',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 4300 (Port / Terminal)
('4301', 'THC (Terminal Handling Charge)', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),
('4302', 'Demurrage', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),
('4303', 'Detention', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),
('4304', 'Biaya Bongkar Muat (B/M)', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),
('4305', 'Storage / Penumpukan', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),
('4306', 'Port Handling Fee', 'REVENUE', '4300', 3, 'Revenue',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 4400 (Insurance & Documentation)
('4401', 'Asuransi Cargo', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4402', 'Biaya Dokumentasi / Documentation Fee', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4403', 'Biaya Pengurusan BL / AWB', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4404', 'Biaya Fumigasi', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4405', 'Air Waybill Fee', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4406', 'Handling', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),
('4407', 'Document', 'REVENUE', '4400', 3, 'Revenue',
    true, true, false, false, false, true),

-- Level 3 - Detail accounts under 4500 (Other COGS)
('4501', 'Biaya Lain-lain Pengiriman', 'REVENUE', '4500', 3, 'Revenue',
    true, true, false, false, false, true),
('4502', 'Biaya Penyimpanan / Warehousing', 'REVENUE', '4500', 3, 'Revenue',
    true, true, false, false, false, true),
('4503', 'Bank Charges', 'REVENUE', '4500', 3, 'Revenue',
    true, true, false, false, false, true),
('4504', 'Charges - Others', 'REVENUE', '4500', 3, 'Revenue',
    true, true, false, false, false, true)

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

-- Also ensure COGS has Air Waybill Fee, Handling, and Document to match user screenshot accurately
INSERT INTO finance_coa (code, name, type, parent_code, level, group_name, 
    is_trial_balance, is_profit_loss, is_balance_sheet, is_ar, is_ap, is_active)
VALUES
('5405', 'Air Waybill Fee', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5406', 'Handling', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true),
('5407', 'Document', 'EXPENSE', '5400', 3, 'Cost of Goods Sold',
    true, true, false, false, true, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
