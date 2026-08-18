-- Migration: Seed Cabang menu entries
-- Purpose: Ensure cabang_* menu codes exist in menu_registry so RolePermissions can sync
-- Created: 2026-08-18

INSERT INTO public.menu_registry (menu_code, menu_name, category, has_approval, order_index)
VALUES
  ('cabang_dashboard', 'Cabang Dashboard', 'Cabang', true, 700),
  ('cabang_sales_quotations', 'Cabang — Sales Quotation', 'Cabang', true, 710),
  ('cabang_sales', 'Cabang — Sales Achievement', 'Cabang', false, 715),
  ('cabang_sales_approval', 'Cabang — Sales Approval', 'Cabang', true, 716),
  ('cabang_flow_monitor', 'Cabang — Flow Monitor', 'Cabang', false, 720),

  ('cabang_quotations', 'Cabang — Quotation', 'Cabang', false, 730),
  ('cabang_shipments', 'Cabang — Shipments', 'Cabang', false, 740),
  ('cabang_bl', 'Cabang — BL/AWB', 'Cabang', false, 745),
  ('cabang_approval', 'Cabang — Approval Center', 'Cabang', true, 750),

  ('cabang_invoices', 'Cabang — Invoice', 'Cabang', true, 760),
  ('cabang_purchase_order', 'Cabang — Purchase Order', 'Cabang', true, 765),
  ('cabang_ar', 'Cabang — Accounts Receivable', 'Cabang', true, 770),
  ('cabang_ap', 'Cabang — Accounts Payable', 'Cabang', true, 775),
  ('cabang_auto_journal', 'Cabang — Auto Journal', 'Cabang', false, 780),
  ('cabang_reversing_journal', 'Cabang — Reversing Journal', 'Cabang', false, 785),
  ('cabang_journal', 'Cabang — General Journal', 'Cabang', false, 790),
  ('cabang_noted_journal', 'Cabang — Noted Journal', 'Cabang', false, 795),
  ('cabang_ledger', 'Cabang — General Ledger', 'Cabang', false, 800),
  ('cabang_trial_balance', 'Cabang — Trial Balance', 'Cabang', false, 805),
  ('cabang_pnl', 'Cabang — Profit & Loss', 'Cabang', false, 810),
  ('cabang_balance_sheet', 'Cabang — Balance Sheet', 'Cabang', false, 815),
  ('cabang_exchange_rates', 'Cabang — Exchange Rates', 'Cabang', false, 820),

  ('cabang_partners', 'Cabang — Business Partners', 'Cabang', false, 830),
  ('cabang_management', 'Cabang — Management', 'Cabang', false, 840),
  ('cabang_create', 'Cabang — Create (Admin HQ)', 'Cabang', false, 845)
ON CONFLICT (menu_code) DO UPDATE
  SET menu_name = EXCLUDED.menu_name,
      category = EXCLUDED.category,
      has_approval = EXCLUDED.has_approval,
      order_index = EXCLUDED.order_index;
