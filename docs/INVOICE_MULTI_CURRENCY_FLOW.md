# Invoice Multi-Currency Flow - Blink Module

## 📋 Overview
Implementasi flow invoice multi-currency untuk modul Blink yang memastikan dari satu quotation hanya dapat dibuat maksimal **2 invoice (1 IDR + 1 USD)**.

## 🎯 Business Rules

### 1. **Invoice Limitation per Quotation**
- **Maximum 2 invoices** per quotation
- **1 Invoice dalam IDR**
- **1 Invoice dalam USD**
- Tidak boleh ada duplikasi currency
- Status "cancelled" tidak dihitung sebagai invoice aktif

### 2. **COGS Integration**
Invoice terintegrasi dengan COGS (Cost of Goods Sold) dari shipment:
- **Selling Items** (Revenue) - dari quotation `service_items`
- **Buying Items** (COGS) - dari shipment `buying_items`
- Profit calculation: `Total Selling - Total Buying`

### 3. **Use Cases**

#### Scenario 1: Split Payment by Currency
```
Quotation: USD 10,000
├─→ Invoice IDR: Rp 80,000,000 (partial payment in IDR)
└─→ Invoice USD: $5,000 (remaining in USD)
```

#### Scenario 2: Mixed Currency Components
```
Quotation: IDR 100,000,000
├─→ Invoice IDR: Rp 70,000,000 (domestic freight)
└─→ Invoice USD: $2,000 (international freight component)
```

## 🗄️ Database Schema

### Migration: `060_invoice_currency_constraint.sql`

#### 1. Unique Constraint
```sql
CREATE UNIQUE INDEX idx_blink_invoices_quotation_currency_unique
ON blink_invoices(quotation_id, currency)
WHERE status != 'cancelled' AND quotation_id IS NOT NULL;
```

#### 2. Helper Function
```sql
CREATE FUNCTION get_quotation_invoice_summary(p_quotation_id UUID)
RETURNS TABLE (
    currency VARCHAR(10),
    invoice_count BIGINT,
    total_amount DECIMAL(15,2),
    invoice_numbers TEXT[]
)
```

#### 3. Validation Trigger
```sql
CREATE TRIGGER trg_validate_invoice_currency_limit
BEFORE INSERT OR UPDATE ON blink_invoices
FOR EACH ROW EXECUTE FUNCTION validate_invoice_currency_limit();
```

#### 4. Analytics View
```sql
CREATE VIEW v_invoice_quotation_summary AS
SELECT 
    q.id, q.quotation_number,
    i_idr.invoice_number as idr_invoice_number,
    i_usd.invoice_number as usd_invoice_number,
    CASE 
        WHEN i_idr.id IS NOT NULL AND i_usd.id IS NOT NULL THEN 'BOTH'
        WHEN i_idr.id IS NOT NULL THEN 'IDR_ONLY'
        WHEN i_usd.id IS NOT NULL THEN 'USD_ONLY'
        ELSE 'NONE'
    END as invoice_status_summary
FROM blink_quotations q
LEFT JOIN blink_invoices i_idr ON q.id = i_idr.quotation_id AND i_idr.currency = 'IDR'
LEFT JOIN blink_invoices i_usd ON q.id = i_usd.quotation_id AND i_usd.currency = 'USD'
```

## 💻 Frontend Implementation

### 1. **Validation Logic** (`InvoiceManagement.jsx`)

```javascript
// Check 1: Existing invoice with same currency
const { data: existingInvoices } = await supabase
    .from('blink_invoices')
    .select('id, invoice_number, status, currency')
    .eq('quotation_id', referenceId)
    .eq('currency', selectedCurrency)
    .neq('status', 'cancelled');

if (existingInvoices && existingInvoices.length > 0) {
    alert(`Cannot create invoice: An active ${selectedCurrency} invoice already exists`);
    return;
}

// Check 2: Maximum 2 different currencies
const { data: allInvoices } = await supabase
    .from('blink_invoices')
    .select('currency')
    .eq('quotation_id', referenceId)
    .neq('status', 'cancelled');

const existingCurrencies = [...new Set(allInvoices.map(inv => inv.currency))];

if (existingCurrencies.length >= 2 && !existingCurrencies.includes(selectedCurrency)) {
    alert(`Maximum 2 currencies (IDR and USD) allowed per quotation`);
    return;
}
```

### 2. **UI Indicator Component**

```javascript
<ExistingInvoicesIndicator quotationId={selectedQuotation.id} />
```

**Features:**
- ✅ Shows existing IDR invoice (if any)
- ✅ Shows existing USD invoice (if any)
- ✅ Displays invoice number, amount, and status
- ✅ Indicates which currencies are available to create
- ⚠️ Warning when both currencies are already invoiced

## 📊 Data Flow

```
┌─────────────────┐
│   QUOTATION     │
│  (Approved)     │
│                 │
│ service_items:  │
│ - Ocean Freight │
│ - THC           │
│ - Documentation │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  INVOICE IDR    │  │  INVOICE USD    │
│                 │  │                 │
│ Currency: IDR   │  │ Currency: USD   │
│ Items: Selling  │  │ Items: Selling  │
│ Total: Rp XXX   │  │ Total: $XXX     │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └──────────┬─────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │     SHIPMENT        │
         │                     │
         │ selling_items: []   │
         │ buying_items: []    │
         │                     │
         │ COGS Calculation:   │
         │ Profit = Selling -  │
         │          Buying     │
         └─────────────────────┘
```

## 🔄 Workflow

### Creating Invoice from Quotation

1. **User selects quotation** in Invoice Management
2. **System checks existing invoices** for that quotation
3. **ExistingInvoicesIndicator shows**:
   - ✅ IDR invoice exists: `INV-2026-001` (Rp 50,000,000)
   - ⭕ USD invoice available to create
4. **User selects currency** (USD in this case)
5. **System validates**:
   - ✅ No existing USD invoice
   - ✅ Less than 2 currencies total
6. **Invoice created successfully**
7. **Database constraint enforced** at DB level

### Attempting to Create 3rd Invoice

1. User selects quotation with 2 existing invoices
2. ExistingInvoicesIndicator shows:
   - ✅ IDR invoice: `INV-2026-001`
   - ✅ USD invoice: `INV-2026-002`
   - ⚠️ Warning: Both currencies exist
3. User tries to create another invoice
4. System blocks with error message
5. User must cancel one existing invoice first

## 🧪 Testing Scenarios

### Test 1: Create First Invoice (IDR)
```sql
-- Expected: Success
INSERT INTO blink_invoices (quotation_id, currency, ...) 
VALUES ('quotation-uuid', 'IDR', ...);
```

### Test 2: Create Second Invoice (USD)
```sql
-- Expected: Success
INSERT INTO blink_invoices (quotation_id, currency, ...) 
VALUES ('quotation-uuid', 'USD', ...);
```

### Test 3: Create Duplicate Currency
```sql
-- Expected: Error - Unique constraint violation
INSERT INTO blink_invoices (quotation_id, currency, ...) 
VALUES ('quotation-uuid', 'IDR', ...);
-- ERROR: duplicate key value violates unique constraint
```

### Test 4: Create Third Currency
```sql
-- Expected: Error - Trigger validation
INSERT INTO blink_invoices (quotation_id, currency, ...) 
VALUES ('quotation-uuid', 'EUR', ...);
-- ERROR: Maximum 2 currencies (IDR and USD) allowed per quotation
```

### Test 5: Cancel and Replace
```sql
-- Step 1: Cancel existing invoice
UPDATE blink_invoices SET status = 'cancelled' WHERE id = 'invoice-uuid';

-- Step 2: Create replacement (same currency)
-- Expected: Success (cancelled invoices excluded from constraint)
INSERT INTO blink_invoices (quotation_id, currency, ...) 
VALUES ('quotation-uuid', 'IDR', ...);
```

## 📈 Analytics Queries

### Get Invoice Summary by Quotation
```sql
SELECT * FROM get_quotation_invoice_summary('quotation-uuid');
```

### View All Quotations with Invoice Status
```sql
SELECT 
    quotation_number,
    idr_invoice_number,
    usd_invoice_number,
    invoice_status_summary
FROM v_invoice_quotation_summary
WHERE invoice_status_summary != 'NONE';
```

### Find Quotations Ready for Invoicing
```sql
SELECT q.*
FROM blink_quotations q
LEFT JOIN v_invoice_quotation_summary v ON q.id = v.quotation_id
WHERE q.status = 'approved'
  AND (v.invoice_status_summary IS NULL OR v.invoice_status_summary != 'BOTH');
```

## 🔐 Security & Constraints

### Database Level
- ✅ Unique index prevents duplicate currency per quotation
- ✅ Trigger validates maximum 2 currencies
- ✅ Row Level Security (RLS) enabled
- ✅ Cancelled invoices excluded from constraints

### Application Level
- ✅ Frontend validation before submission
- ✅ Real-time indicator of existing invoices
- ✅ Clear error messages for users
- ✅ Automatic currency detection from quotation

## 🎨 UI/UX Features

### ExistingInvoicesIndicator Component
- **Visual Status**: Green checkmark for existing, gray circle for available
- **Invoice Details**: Shows invoice number, amount, status
- **Warning Message**: Red alert when both currencies exist
- **Responsive Design**: Grid layout for IDR/USD side-by-side

### Error Messages
```
❌ "Cannot create invoice: An active IDR invoice (INV-2026-001) already exists for this quotation.

Note: You can create a maximum of 2 invoices per quotation (1 IDR + 1 USD). 
Please cancel the existing invoice first if you need to create a replacement."
```

## 📝 Migration Steps

1. **Run Database Migration**
   ```bash
   # Apply migration file
   psql $DATABASE_URL -f supabase/migrations/060_invoice_currency_constraint.sql
   ```

2. **Verify Constraints**
   ```sql
   -- Check unique index
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'blink_invoices' 
   AND indexname = 'idx_blink_invoices_quotation_currency_unique';
   
   -- Check trigger
   SELECT tgname, tgtype 
   FROM pg_trigger 
   WHERE tgrelid = 'blink_invoices'::regclass 
   AND tgname = 'trg_validate_invoice_currency_limit';
   ```

3. **Test Frontend**
   - Create invoice from quotation
   - Verify ExistingInvoicesIndicator appears
   - Try creating duplicate currency (should fail)
   - Try creating 3rd currency (should fail)

## 🚀 Future Enhancements

1. **Multi-Currency COGS Tracking**
   - Track buying_items in multiple currencies
   - Automatic currency conversion for profit calculation

2. **Partial Invoice Splitting**
   - Split quotation items across multiple invoices
   - Track which items are invoiced

3. **Invoice Consolidation**
   - Merge multiple quotations into single invoice
   - Cross-currency consolidation

4. **Advanced Analytics**
   - Revenue by currency dashboard
   - Exchange rate impact analysis
   - Multi-currency AR aging report

## 📞 Support

For issues or questions:
- Check database logs for constraint violations
- Review frontend console for validation errors
- Verify quotation has `approved` status
- Ensure currency field is set correctly

---

**Last Updated**: 2026-01-29
**Version**: 1.0
**Module**: Blink - Invoice Management
