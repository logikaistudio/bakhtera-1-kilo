#!/bin/bash
source /Users/hoeltzie/Documents/Apps\ Builder/freight_bakhtera-1-v2/.env
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/blink_invoices" \
-H "apikey: $VITE_SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-H "Prefer: return=representation" \
-d '{
  "invoice_number": "INV-TEST-001",
  "invoice_date": "2026-03-19",
  "due_date": "2026-04-18",
  "payment_terms": "NET 30",
  "job_number": "JOB123",
  "customer_name": "Test Customer",
  "subtotal": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "status": "draft",
  "invoice_items": [],
  "sales_person": "tester",
  "payment_bank_account_id": "1",
  "payment_bank_account": "testing"
}'
