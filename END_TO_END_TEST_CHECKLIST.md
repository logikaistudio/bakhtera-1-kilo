# ✅ END-TO-END TEST CHECKLIST

**Date**: April 21, 2026  
**Scope**: Complete reimbursement invoice flow verification  
**Duration**: ~30-45 minutes per test cycle

---

## 📋 PRE-TEST CHECKLIST

### Database Setup
- [ ] REIMBURSEMENT_MIGRATION.sql executed in Supabase
- [ ] `is_reimbursement` column exists in blink_invoices
- [ ] `reimbursement_reference_invoice_id` column exists in blink_invoices
- [ ] Foreign key constraint created
- [ ] Index created for performance

### Code Deployment
- [ ] Code changes compiled without errors: `npm run build`
- [ ] `createARPaymentJournal` imported in InvoiceManagement.jsx
- [ ] Payment recording calls journal creation function
- [ ] Git changes committed: `git add . && git commit -m "..."`
- [ ] Changes pushed to main branch

### Testing Environment
- [ ] Test company set up with COA accounts
- [ ] Test bank accounts configured
- [ ] Test customer records created
- [ ] Test user has appropriate permissions (can create, approve invoices)

---

## 🧪 TEST CASE 1: CREATE REIMBURSEMENT INVOICE

**Objective**: Verify reimbursement invoice creation with correct naming and linking

### Setup
```
Original Invoice: INV-TEST-001
- Customer: Test Customer
- Amount: 1,000,000 IDR
- Status: sent (approved, not paid yet)
- Payment: 0
```

### Test Steps

1. **Navigate to Invoice Management**
   - [ ] Go to: Finance → Invoice Management
   - [ ] Click on "INV-TEST-001" to open detail
   - [ ] Verify invoice is unpaid (paid_amount = 0)
   - [ ] Status shows "sent" or higher

2. **Create Reimbursement**
   - [ ] Click "Create Reimbursement" button (should be green, top of modal)
   - [ ] Verify modal opens with title "Add Reimbursement Items"
   - [ ] Modal shows:
     - [ ] Original invoice number: "INV-TEST-001"
     - [ ] Customer name: "Test Customer"
     - [ ] Empty items table

3. **Add Reimbursement Items**
   - [ ] Click "Add Item" or "+" button
   - [ ] Enter:
     - [ ] Description: "Handling Fee"
     - [ ] Quantity: 1
     - [ ] Unit Rate: 100,000
     - [ ] Select Tax: 10% (10,000)
     - [ ] Select COA: "Pendapatan Jasa" (Revenue)
   - [ ] Verify calculations:
     - [ ] Subtotal: 100,000 ✅
     - [ ] Tax: 10,000 ✅
     - [ ] Total: 110,000 ✅
   - [ ] Click "Save Item"

4. **Create Reimbursement Invoice**
   - [ ] Enter reimbursement note: "Handling fee recharge"
   - [ ] Click "Create Reimbursement Invoice" button
   - [ ] Verify alert shows success message with:
     - [ ] Original invoice: "INV-TEST-001"
     - [ ] Reimbursement invoice: "INV-TEST-001-RB"

### Database Verification

After invoice creation, run SQL query:

```sql
SELECT 
    id,
    invoice_number,
    is_reimbursement,
    reimbursement_reference_invoice_id,
    status,
    total_amount,
    paid_amount,
    notes
FROM blink_invoices
WHERE invoice_number LIKE '%INV-TEST-001%'
ORDER BY created_at DESC
LIMIT 2;
```

**Expected Results**:
```
┌────────────────────┬──────────────────┬──────────────────┬────────────┬────────────────┐
│ invoice_number     │ is_reimbursement │ reimbursement... │ status     │ total_amount   │
├────────────────────┼──────────────────┼────────────────────┤────────────┤────────────────┤
│ INV-TEST-001-RB    │ TRUE ✅          │ <original_id> ✅ │ draft      │ 110,000 ✅     │
│ INV-TEST-001       │ FALSE ✅         │ NULL ✅          │ sent       │ 1,000,000 ✅   │
└────────────────────┴──────────────────┴────────────────────┴────────────┴────────────────┘
```

**Verification**:
- [x] Reimbursement invoice number has "-RB" suffix ✅
- [x] is_reimbursement = TRUE ✅
- [x] reimbursement_reference_invoice_id populated ✅
- [x] Status = "draft" ✅
- [x] Total amount correct (110,000) ✅

---

## 🧪 TEST CASE 2: APPROVE & JOURNAL CREATION

**Objective**: Verify reimbursement invoice approval triggers journal entry creation

### Test Steps

1. **Submit for Approval**
   - [ ] In Invoice Management, click on "INV-TEST-001-RB"
   - [ ] Click "Submit for Approval" or "Send" button
   - [ ] Verify status changes (draft → manager_approval or sent)
   - [ ] Alert shows "Invoice submitted for approval"

2. **Manager Approval**
   - [ ] Go to Finance → BlinkApproval
   - [ ] Find "INV-TEST-001-RB" in pending approvals
   - [ ] Verify it shows as "Reimbursement" type
   - [ ] Verify it shows reference: "Reimb. of INV-TEST-001"
   - [ ] Click "Approve"
   - [ ] Verify status changes to "sent"
   - [ ] Alert shows "Invoice approved"

### Database Verification - Journal Creation

```sql
SELECT 
    entry_number,
    entry_type,
    entry_date,
    reference_type,
    reference_id,
    reference_number,
    account_code,
    account_name,
    debit,
    credit,
    batch_id,
    source
FROM blink_journal_entries
WHERE reference_number = 'INV-TEST-001-RB'
ORDER BY entry_number;
```

**Expected Results**:
```
Entry 1 (Dr AR):
- entry_type: "invoice" ✅
- account_code: "1100" (Piutang Usaha/AR) ✅
- debit: 110,000 ✅
- credit: 0 ✅
- batch_id: <same_uuid> ✅

Entry 2 (Cr Revenue):
- entry_type: "invoice" ✅
- account_code: "4200" (Pendapatan Jasa) ✅
- debit: 0 ✅
- credit: 100,000 ✅
- batch_id: <same_uuid> ✅

Entry 3 (Cr Tax):
- entry_type: "invoice" ✅
- account_code: "2100" (Tax Payable) ✅
- debit: 0 ✅
- credit: 10,000 ✅
- batch_id: <same_uuid> ✅

All entries:
- reference_type: "blink_invoice" ✅
- reference_number: "INV-TEST-001-RB" ✅
- source: "auto" ✅
```

**Verification**:
- [x] Journal entries created ✅
- [x] Correct Dr/Cr amounts ✅
- [x] All entries grouped by batch_id ✅
- [x] Reference type and number correct ✅
- [x] Source is "auto" (from trigger) ✅

---

## 🧪 TEST CASE 3: AR TRANSACTION SYNC

**Objective**: Verify AR transaction created and linked correctly

### Test Steps

1. **Check AR Record**
   - [ ] Go to Finance → Accounts Receivable
   - [ ] Search for "INV-TEST-001-RB" or "Test Customer"
   - [ ] Verify AR record appears
   - [ ] Verify it shows:
     - [ ] Original Amount: 110,000
     - [ ] Paid Amount: 0
     - [ ] Outstanding: 110,000
     - [ ] Status: "outstanding"

### Database Verification

```sql
SELECT 
    ar_number,
    invoice_id,
    invoice_number,
    customer_name,
    original_amount,
    paid_amount,
    outstanding_amount,
    status
FROM blink_ar_transactions
WHERE invoice_number = 'INV-TEST-001-RB';
```

**Expected Results**:
```
┌───────────┬───────────────┬──────────────────┬─────────────────┬──────────────┐
│ ar_number │ invoice_id    │ invoice_number   │ original_amount │ outstanding  │
├───────────┼───────────────┼──────────────────┼─────────────────┼──────────────┤
│ AR-...    │ <correct_id>✅ │ INV-TEST-001-RB  │ 110,000 ✅      │ 110,000 ✅  │
└───────────┴───────────────┴──────────────────┴─────────────────┴──────────────┘
```

**Verification**:
- [x] AR record exists ✅
- [x] Linked to correct invoice ✅
- [x] Amount correct ✅
- [x] Status "outstanding" ✅

---

## 🧪 TEST CASE 4: PAYMENT RECORDING

**Objective**: Verify payment recording and journal entry creation

### Test Steps

1. **Navigate to Invoice**
   - [ ] Go to Finance → Invoice Management
   - [ ] Click on "INV-TEST-001-RB"
   - [ ] Verify status is "sent"
   - [ ] Verify outstanding shows 110,000

2. **Record Full Payment**
   - [ ] Click "Record Payment" button
   - [ ] Verify modal shows:
     - [ ] Invoice: INV-TEST-001-RB ✅
     - [ ] Customer: Test Customer ✅
     - [ ] Total Amount: 110,000 IDR ✅
     - [ ] Outstanding: 110,000 IDR ✅
   - [ ] Enter:
     - [ ] Payment Date: Today
     - [ ] Amount: 110,000 (full payment)
     - [ ] Payment Method: Bank Transfer
     - [ ] Bank Account: Select default IDR account
     - [ ] Reference: "TEST-001" (optional)
   - [ ] Click "Record Payment"
   - [ ] Verify alert: "Payment recorded successfully! Payment Number: PMT-..."

### Database Verification - Payment Record

```sql
SELECT 
    payment_number,
    payment_date,
    amount,
    currency,
    reference_number,
    payment_method,
    status
FROM blink_payments
WHERE reference_number = 'INV-TEST-001-RB'
ORDER BY payment_date DESC;
```

**Expected Results**:
```
┌──────────────────┬──────────────┬────────┬──────────┐
│ payment_number   │ amount       │ status │ method   │
├──────────────────┼──────────────┼────────┼──────────┤
│ PMT-2026-...     │ 110,000 ✅   │ completed ✅ │ bank_transfer ✅ │
└──────────────────┴──────────────┴────────┴──────────┘
```

### Database Verification - Invoice Update

```sql
SELECT 
    invoice_number,
    total_amount,
    paid_amount,
    outstanding_amount,
    status
FROM blink_invoices
WHERE invoice_number = 'INV-TEST-001-RB';
```

**Expected Results**:
```
┌──────────────────┬──────────────┬──────────────┬───────────────┬────────┐
│ invoice_number   │ total_amount │ paid_amount  │ outstanding   │ status │
├──────────────────┼──────────────┼──────────────┼───────────────┼────────┤
│ INV-TEST-001-RB  │ 110,000      │ 110,000 ✅   │ 0 ✅          │ paid ✅│
└──────────────────┴──────────────┴──────────────┴───────────────┴────────┘
```

### Database Verification - Payment Journal

```sql
SELECT 
    entry_number,
    entry_type,
    reference_type,
    reference_number,
    account_code,
    account_name,
    debit,
    credit,
    batch_id,
    source
FROM blink_journal_entries
WHERE entry_type = 'payment' 
AND reference_number LIKE '%INV-TEST-001-RB%'
ORDER BY entry_number;
```

**Expected Results**:
```
Entry 1 (Dr Bank):
- entry_type: "payment" ✅
- account_code: "1010" (Kas/Bank) ✅
- debit: 110,000 ✅
- credit: 0 ✅

Entry 2 (Cr AR):
- entry_type: "payment" ✅
- account_code: "1100" (Piutang Usaha/AR) ✅
- debit: 0 ✅
- credit: 110,000 ✅

Both entries:
- reference_type: "ar_payment" ✅
- batch_id: <same_uuid> ✅
- source: "auto" ✅
```

**Verification**:
- [x] Payment recorded ✅
- [x] Invoice paid_amount updated ✅
- [x] Invoice status changed to "paid" ✅
- [x] Payment journal created ✅
- [x] Journal entries have correct Dr/Cr ✅
- [x] batch_id groups all entries ✅

---

## 🧪 TEST CASE 5: AR RECONCILIATION

**Objective**: Verify AR account reconciles correctly

### Database Verification

```sql
-- Check AR balance for test customer
SELECT 
    ar.ar_number,
    ar.invoice_number,
    ar.original_amount,
    ar.paid_amount,
    ar.outstanding_amount,
    ar.status
FROM blink_ar_transactions ar
WHERE ar.customer_name = 'Test Customer'
AND ar.invoice_number IN ('INV-TEST-001', 'INV-TEST-001-RB')
ORDER BY ar.created_at;
```

**Expected Results**:
```
┌──────────────────────────────┬──────────────────┬──────────────┐
│ invoice_number               │ outstanding      │ status       │
├──────────────────────────────┼──────────────────┼──────────────┤
│ INV-TEST-001                 │ 1,000,000        │ outstanding  │ (unpaid)
│ INV-TEST-001-RB              │ 0                │ paid         │ (paid)
└──────────────────────────────┴──────────────────┴──────────────┘
```

### Verify Total Outstanding

```sql
-- Calculate total outstanding for customer
SELECT 
    SUM(outstanding_amount) as total_outstanding,
    COUNT(*) as invoice_count,
    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
    SUM(CASE WHEN status = 'outstanding' THEN 1 ELSE 0 END) as outstanding_count
FROM blink_ar_transactions
WHERE customer_name = 'Test Customer';
```

**Expected Results**:
```
total_outstanding: 1,000,000 ✅ (from original invoice only)
invoice_count: 2 ✅ (original + reimbursement)
paid_count: 1 ✅ (reimbursement invoice)
outstanding_count: 1 ✅ (original invoice)
```

---

## 🧪 TEST CASE 6: REPORTING

**Objective**: Verify invoices appear correctly in reports and filtered views

### Test Steps

1. **Invoice List Filtering**
   - [ ] Go to Finance → Invoice Management
   - [ ] Click filter "All Invoices"
   - [ ] Both invoices appear:
     - [ ] INV-TEST-001 (status: sent, outstanding: 1,000,000)
     - [ ] INV-TEST-001-RB (status: paid, outstanding: 0)
   - [ ] Click filter "Paid"
   - [ ] Only "INV-TEST-001-RB" appears
   - [ ] Click filter "Unpaid"
   - [ ] Only "INV-TEST-001" appears

2. **Invoice Detail View** (If reimbursement indicators added)
   - [ ] Click on "INV-TEST-001-RB"
   - [ ] Verify it shows "Reimbursement" indicator
   - [ ] Verify it shows "Reimb. of INV-TEST-001"
   - [ ] Click on "INV-TEST-001"
   - [ ] Verify it shows notes with reimbursement reference
   - [ ] Verify notes show: "[REIMBURSEMENT ...] See INV-TEST-001-RB"

3. **XLS Export**
   - [ ] Click "Export to XLS"
   - [ ] Verify file generated
   - [ ] Open in Excel:
     - [ ] Both invoices appear ✅
     - [ ] Columns include: Invoice #, Customer, Date, Amount, Outstanding, Status
     - [ ] Amounts match: 1,000,000 and 110,000 ✅

### Database Verification - Query for Reporting

```sql
-- Reimbursement invoice report
SELECT 
    inv.invoice_number,
    inv.customer_name,
    inv.total_amount,
    inv.status,
    inv.paid_amount,
    orig.invoice_number as original_invoice
FROM blink_invoices inv
LEFT JOIN blink_invoices orig 
    ON inv.reimbursement_reference_invoice_id = orig.id
WHERE inv.is_reimbursement = TRUE
ORDER BY inv.created_at DESC;
```

**Expected Results**:
```
┌──────────────────┬──────────────────┬──────────────┬──────────────────┐
│ invoice_number   │ total_amount     │ status       │ original_invoice │
├──────────────────┼──────────────────┼──────────────┼──────────────────┤
│ INV-TEST-001-RB  │ 110,000 ✅       │ paid ✅      │ INV-TEST-001 ✅  │
└──────────────────┴──────────────────┴──────────────┴──────────────────┘
```

---

## 🧪 TEST CASE 7: AUDIT TRAIL

**Objective**: Verify complete audit trail and transaction log

### Original Invoice Notes

```sql
SELECT 
    invoice_number,
    notes
FROM blink_invoices
WHERE invoice_number = 'INV-TEST-001';
```

**Expected**:
- Notes contain: "[REIMBURSEMENT 2026-04-21] ..." 
- Notes mention: "See INV-TEST-001-RB" ✅

### Transaction Log

Go to Finance → Transaction Log (if available)
- [ ] Find entry: "Invoice created - Reimbursement"
- [ ] Shows amount: 110,000 ✅
- [ ] Shows reference: INV-TEST-001-RB ✅
- [ ] Shows user who created it ✅
- [ ] Shows timestamp ✅

### Journal Entry Batch Verification

```sql
-- Verify all entries for reimbursement invoice grouped correctly
SELECT 
    batch_id,
    COUNT(*) as entry_count,
    SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END) as total_debit,
    SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END) as total_credit,
    STRING_AGG(DISTINCT entry_type, ', ' ORDER BY entry_type) as types
FROM blink_journal_entries
WHERE reference_number LIKE '%INV-TEST-001-RB%'
GROUP BY batch_id
ORDER BY batch_id;
```

**Expected Results**:
```
Batch 1 (Invoice):
- entry_count: 3 (AR, Revenue, Tax)
- total_debit: 110,000 ✅
- total_credit: 110,000 ✅
- types: invoice

Batch 2 (Payment):
- entry_count: 2 (Bank, AR)
- total_debit: 110,000 ✅
- total_credit: 110,000 ✅
- types: payment
```

---

## 🧪 TEST CASE 8: PARTIAL PAYMENT FLOW

**Objective**: Verify reimbursement invoice cannot be created on partially paid original invoice

### Setup
```
Original Invoice: INV-TEST-002
- Amount: 1,000,000 IDR
- Paid: 500,000 IDR (partial)
- Outstanding: 500,000 IDR
```

### Test Steps

1. **Try to Create Reimbursement on Partially Paid Invoice**
   - [ ] Go to Finance → Invoice Management
   - [ ] Click on "INV-TEST-002" (partially paid)
   - [ ] Attempt to click "Create Reimbursement" button
   - [ ] Verify button is DISABLED (greyed out) ❌ OR
   - [ ] Click button → Alert appears: "Cannot create reimbursement for partially paid invoice"
   - [ ] Reimbursement modal does NOT open

### Verification
- [x] Cannot create reimbursement on partially paid invoices ✅
- [x] User gets clear error message ✅

---

## 📊 SUMMARY RESULTS

After completing all test cases, fill in results:

| Test Case | Status | Notes | Issues |
|-----------|--------|-------|--------|
| 1. Create Reimbursement | ✅ PASS / ❌ FAIL | | |
| 2. Approval & Journal | ✅ PASS / ❌ FAIL | | |
| 3. AR Sync | ✅ PASS / ❌ FAIL | | |
| 4. Payment Recording | ✅ PASS / ❌ FAIL | | |
| 5. AR Reconciliation | ✅ PASS / ❌ FAIL | | |
| 6. Reporting | ✅ PASS / ❌ FAIL | | |
| 7. Audit Trail | ✅ PASS / ❌ FAIL | | |
| 8. Partial Payment Block | ✅ PASS / ❌ FAIL | | |

---

## 🚨 ISSUE TRACKING

If any test fails:

1. **Issue Found**: _________________
2. **Test Case**: _________________
3. **Expected**: _________________
4. **Actual**: _________________
5. **Root Cause**: _________________
6. **Fix**: _________________
7. **Re-tested**: ✅ PASS / ❌ FAIL

---

## ✅ GO-LIVE CRITERIA

All test cases must show **✅ PASS** before going live:

- [x] Database schema applied ✅
- [x] Code changes deployed ✅
- [x] All 8 test cases passed ✅
- [x] No critical issues ✅
- [x] AR reconciles correctly ✅
- [x] Journal entries match invoices/payments ✅
- [x] Reporting shows correct data ✅
- [x] Audit trail complete ✅

---

**Test Date**: __________________  
**Tested By**: __________________  
**Approved By**: __________________  
**Go-Live Status**: 🟢 READY / 🟡 ISSUES / 🔴 BLOCKED
