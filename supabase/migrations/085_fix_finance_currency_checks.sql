-- Drop restrictive currency checks from finance tables to support multi-currency like SGD, EUR, etc.
ALTER TABLE blink_purchase_orders DROP CONSTRAINT IF EXISTS blink_purchase_orders_currency_check;
ALTER TABLE blink_ap_transactions DROP CONSTRAINT IF EXISTS blink_ap_transactions_currency_check;
ALTER TABLE blink_invoices DROP CONSTRAINT IF EXISTS blink_invoices_currency_check;
ALTER TABLE blink_ar_transactions DROP CONSTRAINT IF EXISTS blink_ar_transactions_currency_check;
ALTER TABLE blink_quotations DROP CONSTRAINT IF EXISTS blink_quotations_currency_check;
ALTER TABLE blink_shipments DROP CONSTRAINT IF EXISTS blink_shipments_currency_check;
