# 📊 REPORTING & FILTERING IMPROVEMENTS

**Date**: April 21, 2026  
**Status**: Enhancement (not blocking)  
**Scope**: Invoice list filtering, display, and reporting

---

## Current State

### Invoice List Display
- **File**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1600)
- **Query**: Fetches ALL invoices (line 146): `SELECT * FROM blink_invoices`
- **Filtering**: 
  - ✅ Hides draft, manager_approval, cancelled by default
  - ✅ Search by: invoice_number, job_number, customer_name
  - ✅ Status filters: all, unpaid, paid, sent, overdue, cancelled
  - ❌ **Missing**: Filter for reimbursement invoices
  - ❌ **Missing**: Visual indicator showing reimbursement invoices

### Invoice Row Display
- **File**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1600)
- **Columns**: Invoice #, Job #, Customer, Date, Due Date, Tax, Amount, Outstanding, Status
- **Status Badge**: Shows invoice status (draft, sent, paid, etc.)
- ❌ **Missing**: Indicator for reimbursement invoices
- ❌ **Missing**: Link to original invoice (for reimbursements)

### XLS Export
- **File**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1425)
- **Columns**: Invoice #, Job #, Customer, Date, Due Date, Amount, Outstanding, Status
- ❌ **Missing**: Reimbursement flag column
- ❌ **Missing**: Original invoice reference column

---

## Recommended Improvements

### Improvement 1: Add Reimbursement Filter

**Location**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1368)

**Current filter logic** (line 1368-1384):
```javascript
const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchTerm ||
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') {
        return !['draft', 'manager_approval', 'cancelled'].includes(inv.status);
    }

    if (filter === 'unpaid') return inv.status === 'unpaid' || inv.status === 'partially_paid';
    return inv.status === filter;
});
```

**Enhance with**:
```javascript
const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchTerm ||
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // NEW: Filter by reimbursement status if specified
    if (filter === 'reimbursement') {
        return inv.is_reimbursement === true;
    }
    
    if (filter === 'regular') {
        return inv.is_reimbursement !== true;
    }

    if (filter === 'all') {
        return !['draft', 'manager_approval', 'cancelled'].includes(inv.status);
    }

    if (filter === 'unpaid') return inv.status === 'unpaid' || inv.status === 'partially_paid';
    return inv.status === filter;
});
```

**Add filter button**:
```javascript
// In the filter buttons section (around line ~1520):
<button 
    onClick={() => setFilter('regular')}
    className={`px-3 py-1 rounded-full text-xs font-medium smooth-transition ${
        filter === 'regular' 
            ? 'bg-accent-orange text-dark-bg' 
            : 'bg-dark-surface text-silver-light hover:bg-dark-surface/80'
    }`}
>
    Regular Invoices
</button>

<button 
    onClick={() => setFilter('reimbursement')}
    className={`px-3 py-1 rounded-full text-xs font-medium smooth-transition ${
        filter === 'reimbursement' 
            ? 'bg-accent-orange text-dark-bg' 
            : 'bg-dark-surface text-silver-light hover:bg-dark-surface/80'
    }`}
>
    Reimbursement Invoices
</button>
```

---

### Improvement 2: Add Visual Indicator in Invoice Row

**Location**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1610)

**Current invoice number display** (line 1610):
```javascript
<td className="px-3 py-2 whitespace-nowrap">
    <span className="font-medium text-accent-orange">{invoice.invoice_number}</span>
</td>
```

**Enhance with reimbursement indicator**:
```javascript
<td className="px-3 py-2 whitespace-nowrap">
    <div className="flex items-center gap-2">
        <span className="font-medium text-accent-orange">{invoice.invoice_number}</span>
        {invoice.is_reimbursement && (
            <span className="px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple text-[9px] font-bold rounded">
                RB
            </span>
        )}
    </div>
</td>
```

**Add original reference column** (after Customer column):
```javascript
<td className="px-3 py-2 whitespace-nowrap">
    {invoice.is_reimbursement && invoice.reimbursement_reference_invoice_id ? (
        <span className="text-silver-dark text-xs">
            Reimb. of {
                // Find original invoice number
                invoices.find(i => i.id === invoice.reimbursement_reference_invoice_id)?.invoice_number || 'N/A'
            }
        </span>
    ) : (
        <span className="text-silver-dark/50 text-xs">-</span>
    )}
</td>
```

---

### Improvement 3: Add Column to XLS Export

**Location**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L1400)

**Current XLS columns** (line 1390-1413):
```javascript
const xlsColumns = [
    { header: 'No', key: 'no', width: 5, align: 'center' },
    { header: 'Invoice #', key: 'invoice_number', width: 20 },
    { header: 'Job Number', key: 'job_number', width: 20 },
    { header: 'Customer', key: 'customer_name', width: 25 },
    { header: 'Date', key: 'invoice_date', width: 15 },
    { header: 'Due Date', key: 'due_date', width: 15 },
    // ... amount columns
    { header: 'Status', key: 'status', width: 15 }
];
```

**Add reimbursement columns**:
```javascript
const xlsColumns = [
    { header: 'No', key: 'no', width: 5, align: 'center' },
    { header: 'Invoice #', key: 'invoice_number', width: 20 },
    { header: 'Type', key: 'invoice_type', width: 12, align: 'center',
        render: (item) => item.is_reimbursement ? 'Reimbursement' : 'Regular' },
    { header: 'Ref. Invoice', key: 'ref_invoice', width: 20, align: 'center',
        render: (item) => item.is_reimbursement && item.reimbursement_reference_invoice_id
            ? invoices.find(i => i.id === item.reimbursement_reference_invoice_id)?.invoice_number || 'N/A'
            : '-' },
    { header: 'Job Number', key: 'job_number', width: 20 },
    { header: 'Customer', key: 'customer_name', width: 25 },
    { header: 'Date', key: 'invoice_date', width: 15 },
    { header: 'Due Date', key: 'due_date', width: 15 },
    // ... rest of columns
    { header: 'Status', key: 'status', width: 15 }
];
```

---

## Database Query Improvements

### Enhanced Fetch for Reimbursement Details

**File**: [src/pages/Blink/InvoiceManagement.jsx](src/pages/Blink/InvoiceManagement.jsx#L146)

**Current** (line 146):
```javascript
const { data: invoicesData, error: invoicesError } = await supabase
    .from('blink_invoices')
    .select(`*`)
    .order('created_at', { ascending: false });
```

**Could be optimized to include original invoice info**:
```javascript
const { data: invoicesData, error: invoicesError } = await supabase
    .from('blink_invoices')
    .select(`
        *,
        original_invoice:reimbursement_reference_invoice_id(invoice_number, customer_name, total_amount)
    `)
    .order('created_at', { ascending: false });
```

**Usage in display**:
```javascript
{invoice.is_reimbursement && invoice.original_invoice && (
    <span className="text-silver-dark text-xs">
        Reimb. of {invoice.original_invoice.invoice_number}
    </span>
)}
```

---

## Report Queries

### Reimbursement Invoice Report (Suggested)

```sql
-- SQL for separate reimbursement report
SELECT 
    inv.invoice_number,
    inv.created_at,
    inv.total_amount,
    inv.outstanding_amount,
    orig.invoice_number as original_invoice,
    orig.total_amount as original_amount,
    inv.status,
    inv.customer_name
FROM blink_invoices inv
LEFT JOIN blink_invoices orig 
    ON inv.reimbursement_reference_invoice_id = orig.id
WHERE inv.is_reimbursement = TRUE
ORDER BY inv.created_at DESC;
```

### Invoice Aging with Reimbursement Flag

```sql
SELECT 
    invoice_number,
    customer_name,
    total_amount,
    outstanding_amount,
    CASE WHEN is_reimbursement THEN 'Reimbursement' ELSE 'Regular' END as type,
    CASE WHEN is_reimbursement THEN 'Reimb. of ' || 
        (SELECT invoice_number FROM blink_invoices WHERE id = reimbursement_reference_invoice_id)
    ELSE '-' END as reference_invoice,
    status,
    due_date,
    CURRENT_DATE - due_date as days_overdue
FROM blink_invoices
WHERE status IN ('outstanding', 'partially_paid', 'overdue')
ORDER BY due_date ASC;
```

---

## Testing Checklist

- [ ] Reimbursement filter shows only reimbursement invoices
- [ ] Regular filter shows only regular invoices
- [ ] All filter shows both
- [ ] Reimbursement indicator appears in invoice list
- [ ] Original reference shown correctly
- [ ] XLS export includes reimbursement type
- [ ] XLS export includes original reference
- [ ] Search works on reimbursement invoices
- [ ] Status filtering works on reimbursement invoices
- [ ] Export counts match displayed invoices

---

## Summary

| Feature | Current | Needed | Priority |
|---------|---------|--------|----------|
| Invoice list | Shows all | Add reimbursement filter | Medium |
| Visual indicator | None | Show "RB" badge | Medium |
| Original reference | Not shown | Show in column | Medium |
| XLS export | Basic | Add type + reference | Low |
| Separate report | None | Optional | Low |

---

**Priority**: Enhancement (not blocking) - reimbursement feature works without these  
**Effort**: ~1-2 hours  
**Benefit**: Improved usability and reporting clarity
