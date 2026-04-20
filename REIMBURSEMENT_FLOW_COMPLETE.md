# ✅ COMPLETE REIMBURSEMENT INVOICE FLOW - VERIFICATION GUIDE

**Date**: April 21, 2026  
**Status**: In Progress - Flow Definition  
**Scope**: End-to-end transaction, reporting, and record flow

---

## 📊 COMPLETE TRANSACTION FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REIMBURSEMENT INVOICE LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────────────────┘

1️⃣ CREATION PHASE
   │
   ├─ User clicks "Create Reimbursement" on existing invoice
   ├─ Modal opens (validation: no partial payments)
   ├─ User fills: items, qty, rate, tax, COA, notes
   ├─ System calculates: subtotal, tax, total
   │
   └─ INSERT into blink_invoices:
      ├─ invoice_number: "INV-xxxxx-RB" (suffix auto-added)
      ├─ is_reimbursement: TRUE ✅
      ├─ reimbursement_reference_invoice_id: <original_invoice_id> ✅
      ├─ status: "draft"
      ├─ invoice_items: [new items only]
      ├─ cogs_items: [] (empty)
      ├─ total_amount: calculated
      ├─ paid_amount: 0
      ├─ outstanding_amount: total_amount
      └─ notes: user note + amendment reference
      
   RESULT: ✅ New reimbursement invoice created

──────────────────────────────────────────────────────────────────────────────

2️⃣ APPROVAL PHASE
   │
   ├─ Invoice status: draft → manager_approval (via Submit button)
   │
   └─ BlinkApproval.jsx (Manager Review):
      ├─ Manager views reimbursement invoice
      ├─ Checks: is_reimbursement flag, original reference
      ├─ Approves OR rejects
      │
      └─ ON APPROVAL:
         ├─ UPDATE blink_invoices SET status='sent'
         │
         └─ TRIGGER: create_journal_from_blink_invoice()
            ├─ Check: status != 'draft' ✅
            ├─ Check: is_reimbursement != 'draft' ✅
            ├─ Generate: batch_id, entry_number (JE-INV-YYMM-xxxxxxxx)
            │
            └─ INSERT into blink_journal_entries (AR + Revenue):
               ├─ Dr: Piutang Usaha (AR COA) = total_amount
               ├─ Cr: Pendapatan Jasa (Revenue COA) = subtotal
               ├─ Cr: Pajak (Tax COA) = tax_amount (if > 0)
               ├─ reference_type: "blink_invoice"
               ├─ reference_id: reimbursement_invoice_id
               ├─ reference_number: "INV-xxxxx-RB"
               ├─ entry_type: "invoice"
               ├─ batch_id: same UUID (for grouping)
               └─ source: "auto" (from trigger)
            
            RESULT: ✅ Journal entries created automatically

   RESULT: ✅ Reimbursement invoice approved + journalized

──────────────────────────────────────────────────────────────────────────────

3️⃣ AR TRANSACTION SYNC PHASE
   │
   ├─ Trigger: Auto-sync to blink_ar_transactions (if needed)
   │  OR manual sync when first creating AR record
   │
   └─ ensureBlinkARTransaction():
      ├─ Check: AR record doesn't exist for this invoice ✅
      │
      └─ INSERT into blink_ar_transactions:
         ├─ invoice_id: reimbursement_invoice_id
         ├─ invoice_number: "INV-xxxxx-RB"
         ├─ ar_number: auto-generated (AR-2026-0001)
         ├─ customer_id: from invoice
         ├─ customer_name: from invoice
         ├─ transaction_date: invoice_date
         ├─ due_date: from invoice
         ├─ original_amount: total_amount
         ├─ paid_amount: 0
         ├─ outstanding_amount: total_amount
         ├─ currency: from invoice
         ├─ status: "outstanding"
         └─ notes: "Reimbursement for INV-xxxxx"
      
      RESULT: ✅ AR record created for tracking

──────────────────────────────────────────────────────────────────────────────

4️⃣ PAYMENT RECORDING PHASE
   │
   ├─ User clicks "Record Payment" on reimbursement invoice
   ├─ Modal shows: outstanding_amount, bank selection, payment date
   ├─ User enters: amount (must be ≤ outstanding_amount)
   │
   └─ handlePayment() → PaymentRecordModal:
      │
      ├─ STEP 1: INSERT into blink_payments:
      │  ├─ payment_number: "PMT-2026-xxxxxx" (auto-generated)
      │  ├─ invoice_id: reimbursement_invoice_id
      │  ├─ reference_number: "INV-xxxxx-RB"
      │  ├─ payment_date: user input
      │  ├─ amount: user input
      │  ├─ currency: from invoice
      │  ├─ payment_method: user selected
      │  ├─ bank_account: selected bank
      │  ├─ transaction_ref: optional ref number
      │  ├─ status: "completed"
      │  └─ created_at: now()
      │
      ├─ STEP 2: UPDATE blink_invoices:
      │  ├─ paid_amount: previous + payment_amount
      │  ├─ outstanding_amount: total - new_paid_amount
      │  ├─ status: 
      │  │  ├─ "paid" (if outstanding = 0)
      │  │  └─ "partially_paid" (if 0 < outstanding < total) ⚠️ SHOULD NOT HAPPEN
      │  └─ updated_at: now()
      │
      ├─ STEP 3: UPDATE blink_ar_transactions:
      │  ├─ paid_amount: updated
      │  ├─ outstanding_amount: updated
      │  ├─ status: "paid" OR "partial"
      │  └─ updated_at: now()
      │
      └─ STEP 4: CREATE PAYMENT JOURNAL:
         ├─ Function: createARPaymentJournal()
         ├─ Dr: Kas/Bank COA = payment_amount
         ├─ Cr: Piutang Usaha (AR COA) = payment_amount
         ├─ entry_number: "JE-PAY-IN-YYMM-xxxxxxxx"
         ├─ reference_type: "ar_payment"
         ├─ reference_id: reimbursement_invoice_id
         ├─ reference_number: payment_number
         ├─ entry_type: "payment"
         ├─ batch_id: new UUID
         └─ source: "auto"
      
      RESULT: ✅ Payment recorded + journals created

──────────────────────────────────────────────────────────────────────────────

5️⃣ REPORTING & FILTERING PHASE
   │
   ├─ InvoiceManagement.jsx: fetchInvoices()
   │  ├─ Query: SELECT * FROM blink_invoices
   │  ├─ Filter by is_reimbursement: TRUE (optional)
   │  ├─ Filter by reimbursement_reference_invoice_id: <id> (show all reimbursements for original)
   │  └─ Sort by created_at DESC
   │
   ├─ Dashboard Reports:
   │  ├─ Revenue Report: INCLUDE reimbursement invoices
   │  ├─ AR Aging Report: Show "Reimbursement" tag
   │  ├─ Invoice Summary: GROUP BY original invoice + reimbursements
   │  └─ Journal Report: FILTER reference_type = "blink_invoice"
   │
   ├─ Invoice List View:
   │  ├─ Status badge: show "Reimbursement" indicator ✅
   │  ├─ Original ref: show "Reimb. of INV-xxxxx"
   │  ├─ Amount: show only reimbursement amount
   │  └─ Actions: Record Payment, Print, etc.
   │
   └─ Journal Entries Report:
      ├─ Filter: reference_type = "blink_invoice" AND is_reimbursement = TRUE
      ├─ Group by: batch_id (shows complete transaction)
      ├─ Detail: Dr/Cr, COA, amount, customer, date
      └─ Audit: Shows "auto" source

──────────────────────────────────────────────────────────────────────────────

6️⃣ AUDIT TRAIL & LOGGING PHASE
   │
   ├─ Original Invoice Notes (amendment trail):
   │  └─ "[REIMBURSEMENT 2026-04-21] Additional handling. See INV-xxxxx-RB."
   │
   ├─ Reimbursement Invoice:
   │  ├─ notes: user's reimbursement reason
   │  ├─ reimbursement_reference_invoice_id: links back to original
   │  ├─ is_reimbursement: TRUE (flag for identification)
   │  └─ created_at: timestamp
   │
   ├─ Transaction Log (via logTransaction()):
   │  ├─ transactionType: "INVOICE"
   │  ├─ action: "CREATE"
   │  ├─ description: "Invoice created - Reimbursement"
   │  ├─ amount: reimbursement total
   │  ├─ referenceNumber: "INV-xxxxx-RB"
   │  ├─ user: logged-in user
   │  └─ timestamp: auto
   │
   ├─ Journal Entries:
   │  ├─ batch_id: groups all related entries
   │  ├─ entry_number: "JE-INV-YYMM-xxxxxxxx"
   │  ├─ source: "auto" (from trigger)
   │  ├─ created_at: auto
   │  └─ reference_id: reimbursement_invoice_id (traceability)
   │
   └─ AR Transaction Record:
      ├─ ar_number: "AR-2026-0001"
      ├─ notes: "Reimbursement for INV-xxxxx"
      ├─ created_at: auto
      └─ transaction_date: invoice_date

   RESULT: ✅ Complete audit trail maintained

```

---

## 🗄️ DATABASE SCHEMA REQUIREMENTS

### 1️⃣ **blink_invoices** (Add Missing Columns)
```sql
-- MUST RUN IN SUPABASE BEFORE DEPLOYMENT
ALTER TABLE blink_invoices ADD COLUMN IF NOT EXISTS
  is_reimbursement BOOLEAN DEFAULT FALSE;

ALTER TABLE blink_invoices ADD COLUMN IF NOT EXISTS
  reimbursement_reference_invoice_id UUID;

ALTER TABLE blink_invoices ADD CONSTRAINT fk_reimbursement
  FOREIGN KEY (reimbursement_reference_invoice_id)
  REFERENCES blink_invoices(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_reimbursement 
  ON blink_invoices(is_reimbursement, reimbursement_reference_invoice_id)
  WHERE is_reimbursement = TRUE;
```

### 2️⃣ **blink_journal_entries** (Already exists - verify)
```
✅ Required columns:
- entry_number (TEXT) - unique identifier
- entry_date (DATE) - transaction date
- entry_type (TEXT) - 'invoice', 'payment', 'cogs', etc.
- reference_type (TEXT) - 'blink_invoice', 'ar_payment', 'ar', etc.
- reference_id (UUID) - links to source transaction
- reference_number (TEXT) - e.g., invoice number
- account_code (TEXT) - COA code
- account_name (TEXT) - COA name
- debit (NUMERIC) - debit amount
- credit (NUMERIC) - credit amount
- batch_id (UUID) - groups related entries
- source (TEXT) - 'auto' or 'manual'
- coa_id (UUID) - foreign key to finance_coa
```

### 3️⃣ **blink_ar_transactions** (Already exists - verify)
```
✅ Required columns:
- ar_number (TEXT) - unique AR identifier
- invoice_id (UUID) - foreign key to blink_invoices
- invoice_number (TEXT) - for reference
- original_amount (NUMERIC) - invoice total
- paid_amount (NUMERIC) - cumulative payments
- outstanding_amount (NUMERIC) - remaining balance
- status (TEXT) - 'outstanding', 'partial', 'paid'
```

### 4️⃣ **blink_payments** (Already exists - verify)
```
✅ Required columns:
- payment_number (TEXT) - unique payment identifier
- invoice_id (UUID) - foreign key to blink_invoices
- payment_date (DATE) - when paid
- amount (NUMERIC) - payment amount
- payment_method (TEXT) - bank transfer, etc.
- currency (TEXT) - IDR, USD, etc.
- status (TEXT) - 'completed', 'pending', etc.
```

---

## ✅ TRANSACTION FLOW CHECKLIST

### Phase 1: Creation ✅
- [ ] User opens invoice detail
- [ ] Clicks "Create Reimbursement" (green button)
- [ ] Validation: `paid_amount = 0` ✅
- [ ] Modal opens with original invoice info
- [ ] User adds items (qty, rate, tax, COA)
- [ ] System calculates totals
- [ ] User enters reimbursement note
- [ ] Clicks "Create Reimbursement Invoice"
- [ ] **Database Check**: is_reimbursement = TRUE ✅
- [ ] **Database Check**: reimbursement_reference_invoice_id set ✅
- [ ] **Database Check**: invoice_number has "-RB" suffix ✅
- [ ] Alert shows success with both invoice numbers
- [ ] Original invoice notes updated with reference ✅

### Phase 2: Approval ✅
- [ ] Manager sees reimbursement in approval list
- [ ] Shows "Reimbursement" indicator + original reference
- [ ] Manager reviews items & amount
- [ ] Clicks "Approve" button
- [ ] Status changes: draft → manager_approval → sent
- [ ] **Database Check**: blink_invoices.status updated ✅
- [ ] **Trigger Check**: Journal entries created (batch_id grouped) ✅
- [ ] **Journal Check**: Dr AR / Cr Revenue entries exist ✅
- [ ] **Journal Check**: reference_number shows "INV-xxxxx-RB" ✅

### Phase 3: AR Sync ✅
- [ ] AR transaction auto-created (via trigger or manual sync)
- [ ] **Database Check**: blink_ar_transactions.invoice_id = reimbursement_id ✅
- [ ] **Database Check**: ar_number generated ✅
- [ ] **Database Check**: status = "outstanding" ✅
- [ ] **Database Check**: original_amount = invoice total ✅

### Phase 4: Payment Recording ✅
- [ ] User views reimbursement invoice
- [ ] Clicks "Record Payment"
- [ ] Payment modal shows:
  - [ ] Outstanding amount correct
  - [ ] Currency correct
  - [ ] Bank selection available
- [ ] User enters payment amount & date
- [ ] **Validation**: Amount ≤ outstanding_amount ✅
- [ ] Clicks "Record Payment"
- [ ] **Database Check**: blink_payments record created ✅
  - [ ] payment_number unique
  - [ ] amount recorded
  - [ ] reference_number = invoice_number
- [ ] **Database Check**: blink_invoices updated ✅
  - [ ] paid_amount incremented
  - [ ] outstanding_amount decremented
  - [ ] status updated (outstanding → paid)
- [ ] **Database Check**: blink_ar_transactions updated ✅
  - [ ] paid_amount incremented
  - [ ] outstanding_amount decremented
  - [ ] status updated
- [ ] **Trigger Check**: Payment journal created ✅
  - [ ] entry_type = "payment"
  - [ ] reference_type = "ar_payment"
  - [ ] Dr Bank / Cr AR entries exist
  - [ ] batch_id groups entries

### Phase 5: Reporting ✅
- [ ] Invoice list shows reimbursement invoices (filtered)
- [ ] **Report Check**: Reimbursement flag visible ✅
- [ ] **Report Check**: Original reference shown ✅
- [ ] Journal report shows all payment entries grouped by batch
- [ ] **Report Check**: Status badges correct (Draft/Approval/Sent/Paid) ✅
- [ ] AR Aging shows reimbursement invoices with correct amounts
- [ ] **Report Check**: Paid status removes from aging ✅

### Phase 6: Audit Trail ✅
- [ ] Original invoice notes show amendment entry
- [ ] **Audit Check**: "[REIMBURSEMENT DATE] See INV-xxxxx-RB" ✅
- [ ] Reimbursement invoice notes show user's reason ✅
- [ ] Journal entries marked with:
  - [ ] batch_id for grouping
  - [ ] source = "auto" (from trigger)
  - [ ] entry_number for traceability
- [ ] Transaction log shows creation event
- [ ] AR record shows full history

---

## ⚠️ CRITICAL ISSUES & SOLUTIONS

### ISSUE 1: Missing Database Columns
**Status**: ❌ BLOCKING

**Problem**: 
- `is_reimbursement` column doesn't exist
- `reimbursement_reference_invoice_id` column doesn't exist

**Impact**:
- React code will try to set these fields on insert
- Supabase will reject with "column not found" error
- Reimbursement feature will NOT work

**Solution**:
```bash
# Run immediately in Supabase SQL Editor:
1. Copy entire REIMBURSEMENT_MIGRATION.sql
2. Execute in SQL Console
3. Verify columns appear with: \d blink_invoices
```

### ISSUE 2: Journal Entry Trigger Coverage
**Status**: ⚠️ WARNING

**Problem**:
- Database trigger `create_journal_from_blink_invoice()` only fires on INSERT/UPDATE
- Must check: trigger is enabled AND references status='draft' check

**Verification**:
```sql
-- Run in Supabase SQL Editor:
SELECT trigger_schema, trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'blink_invoices';
```

**Solution if trigger missing**:
- Create trigger for auto journal entry on status change
- See: supabase/migrations/066_coa_item_linkage_journal.sql

### ISSUE 3: Payment Recording Without Original Journal
**Status**: ⚠️ WATCH

**Problem**:
- If reimbursement journal NOT created, payment journal will still be created
- Creates orphaned payment entries without matching invoice entries

**Solution**:
- Verify journal creation BEFORE payment can be recorded
- Add check in PaymentRecordModal:
```javascript
// Check if invoice has journal entries
const { data: journals } = await supabase
  .from('blink_journal_entries')
  .select('id')
  .eq('reference_id', invoice.id)
  .eq('reference_type', 'blink_invoice');

if (!journals || journals.length === 0) {
  alert('Cannot record payment: Invoice journal entries not created yet. Contact accounting.');
  return;
}
```

---

## 🔗 DATA RELATIONSHIPS DIAGRAM

```
blink_invoices (Original)
  │
  ├─ invoice_number: "INV-20260420-001"
  ├─ status: "sent" (or higher)
  ├─ paid_amount: 0
  ├─ total_amount: 100,000
  ├─ notes: "[REIMBURSEMENT 2026-04-21] ... See INV-20260420-001-RB"
  │
  └─ ────────────────────────────────────┘
             (linked via notes)
                     │
                     ▼
                     
blink_invoices (Reimbursement)
  ├─ invoice_number: "INV-20260420-001-RB" ✅
  ├─ is_reimbursement: TRUE ✅
  ├─ reimbursement_reference_invoice_id: original_id ✅
  ├─ status: "draft" → "sent" (after approval)
  ├─ total_amount: 50,000
  ├─ invoice_items: [new items only]
  ├─ cogs_items: [] (empty)
  │
  ├─ ────────────────────────────────────┘
  │                  │
  ├─ (1:1) ─────────┼─────────> blink_ar_transactions
  │                  │            ├─ ar_number: "AR-2026-0001"
  │                  │            ├─ invoice_id: reimbursement_id ✅
  │                  │            ├─ original_amount: 50,000
  │                  │            ├─ paid_amount: 0 (initially)
  │                  │            ├─ outstanding_amount: 50,000
  │                  │            └─ status: "outstanding"
  │                  │
  ├─ (1:N) ─────────┼─────────> blink_payments
  │                  │            ├─ payment_number: "PMT-2026-0001"
  │                  │            ├─ invoice_id: reimbursement_id ✅
  │                  │            ├─ amount: 50,000
  │                  │            ├─ payment_date: 2026-04-25
  │                  │            └─ status: "completed"
  │                  │
  └─ (1:N) ─────────┴─────────> blink_journal_entries
                                  ├─ [INVOICE ENTRIES]
                                  │  ├─ entry_number: "JE-INV-0426-12345"
                                  │  ├─ entry_type: "invoice"
                                  │  ├─ reference_type: "blink_invoice"
                                  │  ├─ reference_id: reimbursement_id ✅
                                  │  ├─ reference_number: "INV-20260420-001-RB" ✅
                                  │  ├─ batch_id: "uuid-xxx"
                                  │  ├─ Dr: Piutang Usaha: 50,000
                                  │  └─ Cr: Pendapatan Jasa: 50,000
                                  │
                                  └─ [PAYMENT ENTRIES]
                                     ├─ entry_number: "JE-PAY-IN-0426-54321"
                                     ├─ entry_type: "payment"
                                     ├─ reference_type: "ar_payment"
                                     ├─ reference_id: reimbursement_id ✅
                                     ├─ reference_number: "PMT-2026-0001"
                                     ├─ batch_id: "uuid-yyy"
                                     ├─ Dr: Kas/Bank: 50,000
                                     └─ Cr: Piutang Usaha: 50,000
```

---

## 📋 DEPLOYMENT SEQUENCE

### ✅ Step 1: Database Migration
```bash
# In Supabase Console → SQL Editor
1. Open REIMBURSEMENT_MIGRATION.sql
2. Copy all SQL
3. Paste into SQL Editor
4. Click "Run"
5. Verify: Show columns is_reimbursement, reimbursement_reference_invoice_id
```

### ✅ Step 2: Code Deployment
```bash
git add src/pages/Blink/InvoiceManagement.jsx REIMBURSEMENT_MIGRATION.sql
git commit -m "feat: invoice reimbursement with -RB suffix + db schema"
git push origin main
```

### ✅ Step 3: Verification Tests
```bash
# Test in staging/production:

1. Create Test Invoice
   - Create invoice "INV-TEST-001" for $100
   - Approve it
   - Check: Journal entries created ✅

2. Create Reimbursement
   - Click "Create Reimbursement"
   - Add items: $25 (handling fee)
   - Submit
   - Check: Invoice number "INV-TEST-001-RB" ✅
   - Check: is_reimbursement = TRUE ✅
   - Check: reimbursement_reference_invoice_id populated ✅
   - Check: Original invoice notes updated ✅

3. Approve Reimbursement
   - Go to BlinkApproval
   - Approve "INV-TEST-001-RB"
   - Check: Journal entries created with batch_id ✅
   - Check: status = "sent" ✅

4. Create AR Transaction
   - Check: AR record created with correct amount ✅

5. Record Payment
   - Click "Record Payment"
   - Enter: $25 payment
   - Check: Payment record created ✅
   - Check: Payment journal created ✅
   - Check: Invoice status = "paid" ✅
   - Check: AR status = "paid" ✅

6. Generate Report
   - Run: Invoice Aging Report
   - Filter: is_reimbursement = TRUE
   - Check: Shows "INV-TEST-001-RB" as paid ✅
   - Check: Shows reference to original ✅

7. Audit Trail
   - Open original invoice
   - Check: Notes show "[REIMBURSEMENT ...]" ✅
   - Run: Transaction Log
   - Check: Reimbursement creation logged ✅
```

---

## 🎯 SUCCESS CRITERIA

✅ **All of the following must pass**:

1. **Creation**: Reimbursement invoice created with -RB suffix
2. **Validation**: Cannot create if original has partial payments
3. **Schema**: is_reimbursement & reimbursement_reference_invoice_id columns exist
4. **Linking**: reimbursement_reference_invoice_id points to original
5. **Approval**: Reimbursement invoice can be approved
6. **Journals**: Auto-created on approval with correct Dr/Cr
7. **AR Sync**: AR transaction created with correct amounts
8. **Payment**: Payment can be recorded on reimbursement invoice
9. **Payment Journal**: Payment journal created with correct entries
10. **Reporting**: Reimbursement invoices visible in reports with flags
11. **Audit**: Original invoice notes show reimbursement reference
12. **Audit**: Complete batch_id linking for all related entries
13. **Status**: Invoice status flows correctly (draft→sent→paid)
14. **Outstanding**: Payment properly reduces outstanding amount

---

## 📞 TROUBLESHOOTING

### Issue: "Cannot create reimbursement - button disabled"
**Check**: `invoice.paid_amount > 0`  
**Fix**: Only available on unpaid invoices

### Issue: "Column not found: is_reimbursement"
**Check**: Migration not executed  
**Fix**: Run REIMBURSEMENT_MIGRATION.sql in Supabase

### Issue: "Journal entries not created"
**Check**: Database trigger not firing  
**Fix**: Verify trigger exists: `\d+ blink_invoices` → check triggers

### Issue: "Payment records but amount not deducted"
**Check**: Invoice status might be preventing update  
**Fix**: Verify status not "cancelled" before payment

---

**Status**: READY FOR IMPLEMENTATION  
**Last Updated**: 2026-04-21  
**Next Step**: Execute REIMBURSEMENT_MIGRATION.sql in Supabase
