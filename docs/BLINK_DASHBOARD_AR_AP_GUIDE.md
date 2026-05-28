# Blink Dashboard - AR/AP Aging Status Guide

## 📑 TABLE OF CONTENTS
1. [Lokasi File dan Komponen](#lokasi-file-dan-komponen)
2. [Database Schema](#database-schema)
3. [Logic Aging Status](#logic-aging-status)
4. [File Structure Overview](#file-structure-overview)
5. [Data Flow dan Relationship](#data-flow-dan-relationship)
6. [Query Examples](#query-examples)

---

## 1. LOKASI FILE DAN KOMPONEN DASHBOARD BLINK

### 📍 Main Dashboard Pages
```
src/pages/Blink/
├── BlinkDashboard.jsx          ← Main dashboard dengan aging monitoring
├── AccountsReceivable.jsx      ← Detail AR (Piutang/Tagihan)
└── AccountsPayable.jsx         ← Detail AP (Hutang/Pembayaran ke vendor)

src/components/Blink/
├── InvoiceProfitSummary.jsx    ← Summary komponen
├── SellingBuyingDetailModal.jsx
└── ShipmentDetailModalEnhanced.jsx
```

### 📋 BlinkDashboard.jsx - Aging Monitoring Section
```jsx
// Location: src/pages/Blink/BlinkDashboard.jsx

// Bagian 1: Fetch data
const [agingData, setAgingData] = useState([]); // Menyimpan daftar aging

// Bagian 2: Data collection (lines 492-547)
const fetchDashboardData = async () => {
    // Fetch unpaid invoices
    const unpaidInvoices = await supabase
        .from('blink_invoices')
        .select('*')
        .neq('status', 'paid');

    // Fetch unpaid POs
    const unpaidPOs = await supabase
        .from('blink_purchase_orders')
        .select('*')
        .neq('status', 'paid');

    // Build aging list
    agingList = [];
    unpaidInvoices.forEach(inv => {
        let due = new Date(inv.due_date || inv.invoice_date);
        let days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
        agingList.push({
            id: inv.id,
            type: 'AR',              // Accounts Receivable
            doc_number: inv.invoice_number,
            partner: inv.customer_name,
            due_date: inv.due_date,
            amount: inv.outstanding_amount || inv.total_amount,
            days_overdue: days,
            status: inv.status
        });
    });
};

// Bagian 3: Display (lines 740-780)
<div className="Monitoring Aging AR/AP">
    <table>
        <thead>Tipe | No. Dokumen | Klien/Vendor | Jumlah | Jatuh Tempo | Status Aging</thead>
        <tbody>
            {agingData.map((item) => {
                const isOverdue = item.days_overdue > 0;
                const isAR = item.type === 'AR';  // True = Piutang, False = Hutang
                return (
                    <tr key={item.id}>
                        <td>{item.type}</td>
                        <td>{item.doc_number}</td>
                        <td>{item.partner}</td>
                        <td>{formatCurrency(item.amount)}</td>
                        <td>{item.due_date}</td>
                        <td>{item.days_overdue} hari</td>
                    </tr>
                );
            })}
        </tbody>
    </table>
</div>
```

---

## 2. DATABASE SCHEMA UNTUK AR/AP

### 🗄️ Tabel Utama - blink_ar_transactions (ACCOUNTS RECEIVABLE / PIUTANG)

**File:** `supabase/migrations/011_blink_finance_module.sql` (lines 48-96)

```sql
CREATE TABLE blink_ar_transactions (
    -- Primary Key & Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ar_number TEXT UNIQUE NOT NULL,
    
    -- References
    invoice_id UUID REFERENCES blink_invoices(id) ON DELETE CASCADE,
    invoice_number TEXT,
    customer_id UUID,
    customer_name TEXT NOT NULL,
    
    -- Transaction Details
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    -- Amounts (Multi-currency support)
    currency TEXT DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD')),
    original_amount NUMERIC(15,2) NOT NULL,          -- Jumlah awal invoice
    paid_amount NUMERIC(15,2) DEFAULT 0,             -- Sudah dibayar
    outstanding_amount NUMERIC(15,2) NOT NULL,       -- Sisa belum dibayar
    
    -- AUTO-GENERATED AGING FIELDS
    days_outstanding INTEGER GENERATED ALWAYS AS (
        CURRENT_DATE - transaction_date
    ) STORED,
    
    aging_bucket TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN CURRENT_DATE - transaction_date <= 30 THEN '0-30'
            WHEN CURRENT_DATE - transaction_date <= 60 THEN '31-60'
            WHEN CURRENT_DATE - transaction_date <= 90 THEN '61-90'
            ELSE '90+'
        END
    ) STORED,
    
    -- Status
    status TEXT DEFAULT 'outstanding' CHECK (
        status IN ('outstanding', 'partial', 'paid', 'overdue', 'written_off')
    ),
    
    -- Payment Tracking
    last_payment_date DATE,
    last_payment_amount NUMERIC(15,2),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Penjelasan Kolom:**
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `original_amount` | NUMERIC | Jumlah tagihan awal (misal: 100,000,000 IDR) |
| `paid_amount` | NUMERIC | Jumlah yang sudah dibayar customer (misal: 30,000,000) |
| `outstanding_amount` | NUMERIC | Sisa belum dibayar (100M - 30M = 70M) |
| `aging_bucket` | TEXT | **OTOMATIS dihitung** - kategori umur invoice |
| `days_outstanding` | INTEGER | Jumlah hari sejak invoice dibuat |
| `status` | TEXT | Status pembayaran: `paid`, `partial`, `overdue`, dll |

---

### 🗄️ Tabel Utama - blink_ap_transactions (ACCOUNTS PAYABLE / HUTANG)

**File:** `supabase/migrations/011_blink_finance_module.sql` (lines 98-150)

```sql
CREATE TABLE blink_ap_transactions (
    -- Primary Key & Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ap_number TEXT UNIQUE NOT NULL,
    
    -- References
    po_id UUID REFERENCES blink_purchase_orders(id) ON DELETE CASCADE,
    po_number TEXT,
    vendor_id TEXT REFERENCES freight_vendors(id) ON DELETE SET NULL,
    vendor_name TEXT NOT NULL,
    
    -- Bill Details
    bill_number TEXT,
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    
    -- Amounts (Multi-currency support)
    currency TEXT DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD')),
    original_amount NUMERIC(15,2) NOT NULL,          -- Jumlah tagihan awal dari vendor
    paid_amount NUMERIC(15,2) DEFAULT 0,             -- Sudah dibayar ke vendor
    outstanding_amount NUMERIC(15,2) NOT NULL,       -- Sisa belum dibayar ke vendor
    
    -- AUTO-GENERATED AGING FIELDS
    days_outstanding INTEGER GENERATED ALWAYS AS (
        CURRENT_DATE - bill_date
    ) STORED,
    
    aging_bucket TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN CURRENT_DATE - bill_date <= 30 THEN '0-30'
            WHEN CURRENT_DATE - bill_date <= 60 THEN '31-60'
            WHEN CURRENT_DATE - bill_date <= 90 THEN '61-90'
            ELSE '90+'
        END
    ) STORED,
    
    -- Status
    status TEXT DEFAULT 'outstanding' CHECK (
        status IN ('outstanding', 'partial', 'paid', 'overdue')
    ),
    
    -- Payment Tracking
    last_payment_date DATE,
    last_payment_amount NUMERIC(15,2),
    payment_method TEXT,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 📊 Related Tables

#### 1. `blink_invoices` (SALES INVOICES - Fallback untuk AR)
- `id`, `invoice_number`, `customer_id`, `customer_name`
- `invoice_date`, `due_date`
- `total_amount`, `paid_amount`, `outstanding_amount`
- `currency`, `status`
- **Relationship:** AR dapat dibuat otomatis dari invoice yang dibuat

#### 2. `blink_purchase_orders` (PURCHASE ORDERS - Fallback untuk AP)
- `id`, `po_number`, `vendor_id`, `vendor_name`
- `po_date`, `delivery_date`, `payment_terms`
- `total_amount`, `paid_amount`
- `currency`, `status`
- **Relationship:** AP dapat dibuat otomatis ketika PO di-approve

#### 3. `blink_payments` (PAYMENT RECORDS)
- `id`, `reference_id`, `reference_type` (invoice/po/ar/ap)
- `payment_date`, `amount`, `payment_method`
- `created_at`
- **Relationship:** Mencatat setiap pembayaran yang dilakukan

#### 4. `finance_coa` (CHART OF ACCOUNTS)
- `id`, `code`, `name`, `type` (ASSET, LIABILITY, REVENUE, EXPENSE)
- **Relationship:** Untuk jurnal entry ketika pembayaran dicatat

---

## 3. LOGIC AGING STATUS

### 📈 Cara Penghitungan Aging Bucket

Aging bucket adalah **kategori umur dokumen** (invoice/bill) yang digunakan untuk menganalisis likuiditas:

#### Formula PostgreSQL (Otomatis di Database)
```sql
aging_bucket = CASE 
    WHEN (hari sejak invoice) <= 30     THEN '0-30'
    WHEN (hari sejak invoice) <= 60     THEN '31-60'
    WHEN (hari sejak invoice) <= 90     THEN '61-90'
    ELSE '90+'
END
```

#### Formula JavaScript (Di Frontend)
```javascript
const calculateAgingBucket = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysPastDue = Math.floor((today - due) / (1000 * 60 * 60 * 24));

    if (daysPastDue < 0) return '0-30';      // Belum jatuh tempo
    if (daysPastDue <= 30) return '0-30';    // Jatuh tempo 0-30 hari lalu
    if (daysPastDue <= 60) return '31-60';   // Jatuh tempo 31-60 hari lalu
    if (daysPastDue <= 90) return '61-90';   // Jatuh tempo 61-90 hari lalu
    return '90+';                             // Jatuh tempo lebih dari 90 hari
};
```

### 📌 Status Payment Logic

#### For AR (Accounts Receivable)
```javascript
const deriveStatus = (paidAmount, totalAmount, dueDate) => {
    // Jika sudah lunas
    if (paidAmount >= totalAmount) return 'paid';
    
    // Jika sebagian dibayar
    if (paidAmount > 0) return 'partial';
    
    // Jika belum dibayar tapi sudah melewati due date
    const today = new Date();
    const due = new Date(dueDate);
    if (today > due) return 'overdue';
    
    // Jika belum dibayar dan belum jatuh tempo
    return 'current';
};
```

#### For AP (Accounts Payable)
```javascript
const deriveAPStatus = (paidAmount, totalAmount, dueDate) => {
    // Jika sudah lunas
    if (paidAmount >= totalAmount) return 'paid';
    
    // Jika sebagian dibayar
    if (paidAmount > 0) return 'partial';
    
    // Jika belum dibayar tapi sudah melewati due date
    const today = new Date();
    const due = new Date(dueDate);
    if (today > due) return 'overdue';
    
    // Jika belum dibayar dan belum jatuh tempo
    return 'outstanding';
};
```

### 💰 Outstanding Amount Calculation
```javascript
outstanding_amount = original_amount - paid_amount

Contoh:
- Jika invoice Rp 100 juta
- Customer sudah bayar Rp 30 juta
- Outstanding = Rp 100 juta - Rp 30 juta = Rp 70 juta
```

### 🎨 Visual Status Indicators
```javascript
const STATUS_COLORS = {
    '0-30': 'bg-blue-500/20 text-blue-400',      // Biru - Fresh/Current
    '31-60': 'bg-yellow-500/20 text-yellow-400', // Kuning - Aging
    '61-90': 'bg-orange-500/20 text-orange-400', // Orange - Overaging
    '90+': 'bg-red-500/20 text-red-400',         // Merah - Critical
};

const PAYMENT_STATUS_COLORS = {
    'paid': 'bg-green-500/20 text-green-400',         // Hijau
    'partial': 'bg-yellow-500/20 text-yellow-400',   // Kuning
    'overdue': 'bg-red-500/20 text-red-400',         // Merah
    'current': 'bg-blue-500/20 text-blue-400',       // Biru
    'outstanding': 'bg-blue-500/20 text-blue-400',   // Biru
};
```

---

## 4. FILE STRUCTURE OVERVIEW

### 📁 Complete Directory Layout

```
src/pages/Blink/
├── BlinkDashboard.jsx
│   └── Main dashboard showing:
│       - Aging AR/AP monitoring table (lines 740-780)
│       - KPI metrics
│       - Revenue trends
│
├── AccountsReceivable.jsx (1200+ lines)
│   ├── useState hooks
│   │   ├── arTransactions - List of AR records
│   │   ├── selectedAR - For detail modal
│   │   ├── showPaymentModal - Payment recording
│   │   └── searchTerm, filter
│   │
│   ├── fetchARTransactions() - Fetch from DB (lines 52-130)
│   │   ├── Primary source: blink_ar_transactions table
│   │   └── Fallback source: blink_invoices (if AR table empty)
│   │
│   ├── calculateAgingBucket() - Compute aging (lines 22-32)
│   │   └── Returns '0-30', '31-60', '61-90', '90+'
│   │
│   ├── deriveStatus() - Compute payment status (lines 34-46)
│   │   └── Returns 'paid', 'partial', 'current', 'overdue'
│   │
│   ├── formatCurrency() - Format amounts (lines 131-140)
│   │   └── Supports IDR and USD
│   │
│   ├── ARPaymentRecordModal - Component for recording payments (lines 178-410)
│   │
│   ├── ARDetailModal - Component showing AR details (lines 412-730)
│   │   ├── Display invoice items
│   │   ├── Payment history
│   │   └── COA assignment
│   │
│   └── Main JSX rendering (lines 732-1170)
│       ├── Metrics Summary section
│       ├── Aging Analysis section
│       ├── AR Transactions table with filter/search
│       └── Action buttons
│
└── AccountsPayable.jsx (1300+ lines)
    ├── useState hooks
    │   ├── apTransactions - List of AP records
    │   ├── selectedAP - For detail modal
    │   ├── showPaymentModal
    │   └── filter (aging bucket or status)
    │
    ├── fetchAPTransactions() (lines 840-935)
    │   ├── Primary source: blink_ap_transactions
    │   └── Fallback: blink_purchase_orders
    │
    ├── calculateAgingBucket() - Similar to AR
    │
    ├── APPaymentRecordModal - Record AP payment (lines 10-410)
    │   └── Creates journal entry for AP payment
    │
    ├── APDetailModal - Show AP details (lines 413-750)
    │   ├── Payment history from blink_payments
    │   ├── PO items with COA assignment
    │   └── Expense allocation
    │
    └── Main JSX rendering (lines 750-1300)
        ├── Payment KPIs
        ├── Aging Analysis grid
        ├── AP Transactions table
        └── Action buttons

src/components/Blink/
├── InvoiceProfitSummary.jsx
├── SellingBuyingDetailModal.jsx
└── ShipmentDetailModalEnhanced.jsx

supabase/migrations/
└── 011_blink_finance_module.sql
    ├── blink_purchase_orders (lines 5-43)
    ├── blink_ar_transactions (lines 48-96)
    ├── blink_ap_transactions (lines 98-150)
    ├── blink_journal_entries (lines 152-176)
    ├── Indexes (lines 178-195)
    ├── RLS Policies (lines 197-207)
    ├── Triggers (lines 209-235)
    ├── create_ar_from_invoice() trigger (lines 238-265)
    ├── create_ap_from_po() trigger (lines 267-295)
    └── Comments (lines 355-370)
```

---

## 5. DATA FLOW DAN RELATIONSHIP

### 🔄 AR (Accounts Receivable) Data Flow

```
Step 1: Invoice Creation
┌─────────────────────────┐
│   blink_invoices        │
│   - invoice_number      │
│   - total_amount        │
│   - paid_amount         │
│   - outstanding_amount  │
└─────────────────────────┘
            ↓
Step 2: Automatic AR Creation (Database Trigger)
┌─────────────────────────┐
│  create_ar_from_invoice │ (lines 238-265 in migration)
│  Trigger on invoice     │
│  INSERT or UPDATE       │
└─────────────────────────┘
            ↓
Step 3: AR Record Created
┌─────────────────────────┐
│ blink_ar_transactions   │
│ - ar_number = AR-INV123 │
│ - invoice_id = ref      │
│ - aging_bucket = '0-30' │ (AUTO-GENERATED)
│ - outstanding_amount    │
└─────────────────────────┘
            ↓
Step 4: Frontend Display
┌─────────────────────────┐
│ AccountsReceivable.jsx  │
│ - Fetch from AR table   │
│ - Calculate aging       │
│ - Show in table/modal   │
└─────────────────────────┘
            ↓
Step 5: Payment Recording
┌─────────────────────────┐
│  ARPaymentRecordModal   │
│  - Record payment       │
│  - Update paid_amount   │
│  - Create journal entry │
│  - Update AR status     │
└─────────────────────────┘
```

### 🔄 AP (Accounts Payable) Data Flow

```
Step 1: PO Creation
┌─────────────────────────┐
│ blink_purchase_orders   │
│ - po_number             │
│ - total_amount          │
│ - paid_amount = 0       │
│ - status = 'draft'      │
└─────────────────────────┘
            ↓
Step 2: PO Approved
┌─────────────────────────┐
│  Update PO status       │
│  status = 'approved'    │
└─────────────────────────┘
            ↓
Step 3: Automatic AP Creation (Database Trigger)
┌─────────────────────────┐
│   create_ap_from_po     │ (lines 267-295 in migration)
│  Trigger on PO UPDATE   │
└─────────────────────────┘
            ↓
Step 4: AP Record Created
┌─────────────────────────┐
│ blink_ap_transactions   │
│ - ap_number = AP-PO123  │
│ - po_id = ref           │
│ - bill_date = PO date   │
│ - due_date = +30 days   │
│ - aging_bucket = '0-30' │
│ - outstanding_amount    │
└─────────────────────────┘
            ↓
Step 5: Frontend Display
┌─────────────────────────┐
│ AccountsPayable.jsx     │
│ - Fetch from AP table   │
│ - Calculate aging       │
│ - Filter by aging/status│
└─────────────────────────┘
            ↓
Step 6: Payment Recording
┌─────────────────────────┐
│ APPaymentRecordModal    │
│ - Record payment        │
│ - Update paid_amount    │
│ - Create journal entry  │
│ - Update AP status      │
└─────────────────────────┘
```

### 🔗 Relationship Diagram

```
blink_invoices
    ├─ invoice_id (PK)
    ├─ customer_id → freight_customers
    └─ paid_amount, outstanding_amount
         ↓ [Trigger: create_ar_from_invoice()]
         ↓
blink_ar_transactions (Ledger/History)
    ├─ ar_id (PK)
    ├─ invoice_id (FK) → blink_invoices
    ├─ paid_amount, outstanding_amount
    ├─ aging_bucket (AUTO-GENERATED)
    └─ status
         ↓ [Payment recorded]
         ↓
blink_payments
    ├─ payment_id (PK)
    ├─ reference_id (FK) → blink_ar_transactions
    ├─ payment_amount
    └─ payment_date
         ↓ [Updates]
         ↓
blink_journal_entries
    ├─ journal_id (PK)
    ├─ reference_id (FK)
    ├─ account_code → finance_coa
    ├─ debit, credit
    └─ entry_date


blink_purchase_orders
    ├─ po_id (PK)
    ├─ vendor_id → freight_vendors
    ├─ total_amount
    └─ status
         ↓ [When status = 'approved']
         ↓
         ↓ [Trigger: create_ap_from_po()]
         ↓
blink_ap_transactions (Ledger/History)
    ├─ ap_id (PK)
    ├─ po_id (FK) → blink_purchase_orders
    ├─ vendor_id (FK) → freight_vendors
    ├─ paid_amount, outstanding_amount
    ├─ aging_bucket (AUTO-GENERATED)
    └─ status
         ↓ [Payment recorded]
         ↓
blink_payments
    ├─ payment_id (PK)
    ├─ reference_id (FK)
    ├─ reference_type = 'ap_transaction'
    └─ payment_date
         ↓ [Updates]
         ↓
blink_journal_entries
    ├─ journal_id (PK)
    ├─ account_code → finance_coa
    ├─ debit (payment account), credit (AP liability)
    └─ entry_date
```

---

## 6. QUERY EXAMPLES

### 📊 Query 1: Get AR Aging Summary

```sql
-- Get total outstanding by aging bucket
SELECT 
    aging_bucket,
    COUNT(*) as invoice_count,
    SUM(outstanding_amount) as total_outstanding,
    AVG(outstanding_amount) as avg_amount
FROM blink_ar_transactions
WHERE outstanding_amount > 0
    AND status != 'written_off'
GROUP BY aging_bucket
ORDER BY 
    CASE aging_bucket
        WHEN '0-30' THEN 1
        WHEN '31-60' THEN 2
        WHEN '61-90' THEN 3
        WHEN '90+' THEN 4
    END;
```

**Expected Output:**
```
aging_bucket | invoice_count | total_outstanding | avg_amount
─────────────┼───────────────┼──────────────────┼───────────
0-30         | 45            | 2,500,000,000    | 55,555,556
31-60        | 12            | 750,000,000      | 62,500,000
61-90        | 8             | 400,000,000      | 50,000,000
90+          | 5             | 500,000,000      | 100,000,000
```

### 📊 Query 2: Get AP Overdue Summary

```sql
-- Get overdue AP with details
SELECT 
    ap_number,
    po_number,
    vendor_name,
    original_amount,
    paid_amount,
    outstanding_amount,
    due_date,
    CURRENT_DATE - due_date as days_overdue,
    aging_bucket,
    status,
    currency
FROM blink_ap_transactions
WHERE outstanding_amount > 0
    AND due_date < CURRENT_DATE
    AND status IN ('outstanding', 'overdue', 'partial')
ORDER BY due_date ASC;
```

**Expected Output:**
```
ap_number | po_number | vendor_name | outstanding_amount | days_overdue | aging_bucket
──────────┼───────────┼─────────────┼──────────────────┼──────────────┼─────────────
AP-PO001  | PO-001    | Vendor A    | 100,000,000      | 45           | 31-60
AP-PO002  | PO-002    | Vendor B    | 50,000,000       | 95           | 90+
```

### 📊 Query 3: AR with Payment History

```sql
-- Get AR with latest payment info
SELECT 
    ar.ar_number,
    ar.invoice_number,
    ar.customer_name,
    ar.original_amount,
    ar.paid_amount,
    ar.outstanding_amount,
    ar.aging_bucket,
    ar.status,
    p.payment_date,
    p.amount as last_payment_amount
FROM blink_ar_transactions ar
LEFT JOIN blink_payments p ON p.reference_id = ar.id 
    AND p.reference_type = 'invoice'
WHERE ar.outstanding_amount > 0
ORDER BY ar.due_date ASC;
```

### 📊 Query 4: Dashboard - Aging Table

```sql
-- Used in BlinkDashboard.jsx agingData
SELECT 
    'AR' as type,
    ar.ar_number as doc_number,
    ar.customer_name as partner,
    ar.outstanding_amount as amount,
    ar.due_date,
    CURRENT_DATE - ar.due_date as days_overdue,
    ar.aging_bucket as status,
    ar.id
FROM blink_ar_transactions ar
WHERE ar.outstanding_amount > 0

UNION ALL

SELECT 
    'AP' as type,
    ap.ap_number as doc_number,
    ap.vendor_name as partner,
    ap.outstanding_amount as amount,
    ap.due_date,
    CURRENT_DATE - ap.due_date as days_overdue,
    ap.aging_bucket as status,
    ap.id
FROM blink_ap_transactions ap
WHERE ap.outstanding_amount > 0

ORDER BY days_overdue DESC;
```

### 💻 Query 5: JavaScript - Calculate Metrics

```javascript
// From AccountsReceivable.jsx (lines 140-156)
const totalARAmount = arTransactions.reduce((sum, ar) => sum + (ar.original_amount || 0), 0);
const totalPaidAmount = arTransactions.reduce((sum, ar) => sum + (ar.paid_amount || 0), 0);
const totalReceivables = arTransactions.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);

const paidCount = arTransactions.filter(ar => ar.status === 'paid').length;
const outstandingCount = arTransactions.filter(ar => ar.outstanding_amount > 0).length;
const overdueCount = arTransactions.filter(ar => ar.status === 'overdue').length;

const agingSummary = {
    '0-30': arTransactions
        .filter(ar => ar.aging_bucket === '0-30')
        .reduce((sum, ar) => sum + ar.outstanding_amount, 0),
    '31-60': arTransactions
        .filter(ar => ar.aging_bucket === '31-60')
        .reduce((sum, ar) => sum + ar.outstanding_amount, 0),
    '61-90': arTransactions
        .filter(ar => ar.aging_bucket === '61-90')
        .reduce((sum, ar) => sum + ar.outstanding_amount, 0),
    '90+': arTransactions
        .filter(ar => ar.aging_bucket === '90+')
        .reduce((sum, ar) => sum + ar.outstanding_amount, 0),
};
```

---

## 📝 SUMMARY

| Aspek | Deskripsi |
|-------|-----------|
| **Main Dashboard** | `BlinkDashboard.jsx` - Monitoring aging table |
| **AR Detail Page** | `AccountsReceivable.jsx` - Piutang dari customer |
| **AP Detail Page** | `AccountsPayable.jsx` - Hutang ke vendor |
| **AR Table** | `blink_ar_transactions` - 96 lines schema |
| **AP Table** | `blink_ap_transactions` - 150 lines schema |
| **Aging Calculation** | Auto-generated column in database |
| **Status Logic** | Derived from paid_amount vs outstanding_amount |
| **Payment Recording** | Modal component dengan journal entry creation |
| **Key Relationship** | Invoice/PO → AR/AP (via triggers) → Payments → Journals |

