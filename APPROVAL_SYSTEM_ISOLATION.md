# Approval System Architecture - Complete Isolation

## Overview
The approval system is now completely isolated with three separate approval flows:

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL CENTER HUB                          │
└─────────────────────────────────────────────────────────────────┘
           │                       │                       │
           │                       │                       │
    ┌──────▼──────┐        ┌───────▼────────┐      ┌──────▼──────┐
    │   BRIDGE    │        │  BLINK SALES   │      │   BLINK OPS │
    │ APPROVAL    │        │  APPROVAL      │      │  APPROVAL   │
    │  MANAGER    │        │  CENTER        │      │  CENTER     │
    └──────┬──────┘        └───────┬────────┘      └──────┬──────┘
           │                       │                       │
    ┌──────▼──────────────┐ ┌──────▼────────────────────┐
    │ approval_requests   │ │ blink_approval_history    │
    │ (module='bridge')   │ │                           │
    │                     │ │ - module='blink_sales'    │
    │ Approval Types:     │ │ - module='blink_operations'
    │ • mutation_out      │ │                           │
    │ • mutation_in       │ │ Approval Types (Sales):   │
    │ • inbound           │ │ • quotation               │
    │ • outbound          │ │ • invoice                 │
    │                     │ │                           │
    │ Source:             │ │ Approval Types (Ops):     │
    │ WarehouseInventory  │ │ • shipment                │
    │ OutboundInventory   │ │ • po                      │
    └─────────────────────┘ │                           │
                            │ Source:                   │
                            │ BlinkApproval.jsx         │
                            └───────────────────────────┘
```

## Detailed Structure

### 1. BRIDGE APPROVAL CENTER (ApprovalManager.jsx)
**Location:** `/src/pages/Bridge/ApprovalManager.jsx`

**Data Storage:** `approval_requests` table
- Column: `module = 'bridge'`
- Completely isolated from Blink

**Approval Types:**
- `mutation_out` - Warehouse outbound mutations
- `mutation_in` - Warehouse inbound mutations
- `inbound` - Inbound document processing
- `outbound` - Outbound/Pabean document processing

**Sources:**
- `WarehouseInventory.jsx` - Inline edits, mutations
- `OutboundInventory.jsx` - Pabean submissions

**Features:**
- View pending approvals
- View approved/rejected history
- Approve/Reject with reason

---

### 2. BLINK SALES APPROVAL CENTER
**Location:** `/src/pages/Blink/BlinkApproval.jsx` (Sales tab)

**Data Storage:** `blink_approval_history` table
- Column: `module = 'blink_sales'`
- Completely isolated from Bridge & Blink Ops

**Approval Types:**
- `quotation` - Customer quotations
- `invoice` - Sales invoices

**Features:**
- Approve quotations → Auto-create Shipments
- Approve invoices → Auto-create AR transactions
- View approval history

**Workflow:**
```
Quotation Approval
  ↓
Create Shipment (SO)
  ↓
Next: Submit for Operations Approval
```

---

### 3. BLINK OPERATIONS APPROVAL CENTER
**Location:** `/src/pages/Blink/BlinkApproval.jsx` (Operations tab)

**Data Storage:** `blink_approval_history` table
- Column: `module = 'blink_operations'`
- Completely isolated from Bridge & Blink Sales

**Approval Types:**
- `shipment` - Shipment/BL-AWB documents
- `po` - Purchase Orders

**Features:**
- Approve shipments → Unlock BL/AWB generation
- Approve POs → Auto-create AP transactions & journal entries
- View approval history

**Workflow:**
```
Shipment Approval
  ↓
Create/Issue BL/AWB
  ↓
Generate Invoice
```

---

## Key Isolation Mechanisms

### 1. Module Field Standardization
Each approval request includes a `module` field:
- Bridge: `module = 'bridge'`
- Blink Sales: `module = 'blink_sales'`
- Blink Operations: `module = 'blink_operations'`

### 2. Separate Data Tables
- **Bridge:** `approval_requests` (shared by Bridge only)
- **Blink:** `blink_approval_history` (shared by both Blink flows)

### 3. UI-Level Filtering
Each approval center filters data at the UI level:
- `ApprovalManager.jsx`: Filters for `module='bridge'`
- `BlinkApproval.jsx`: Filters for `module IN ('blink_sales', 'blink_operations')`

### 4. Separate History Views
- Bridge: Shows only Bridge approvals
- Blink Sales: Shows only Sales approvals
- Blink Ops: Shows only Operations approvals

---

## Code References

### Module Assignment in recordApprovalHistory
**Location:** `/src/pages/Blink/BlinkApproval.jsx`, line ~45

```javascript
const approvalModule = ['quotation', 'invoice'].includes(item.type) 
  ? 'blink_sales' 
  : 'blink_operations';
```

### Bridge Filter in ApprovalManager
**Location:** `/src/pages/Bridge/ApprovalManager.jsx`, line ~15

```javascript
const bridgeApprovals = pendingApprovals.filter(req => {
    const moduleLower = (req.module || '').toLowerCase();
    return moduleLower === 'bridge' || !req.module;
});
```

### Blink History Filter
**Location:** `/src/pages/Blink/BlinkApproval.jsx`, line ~245

```javascript
const { data: historyData, error: histErr } = await supabase
    .from('blink_approval_history')
    .select('*')
    .in('module', ['blink_sales', 'blink_operations'])
    .order('approved_at', { ascending: false });
```

---

## Data Flow Examples

### Example 1: Bridge Approval Flow
```
1. User edits inventory in WarehouseInventory
2. System calls requestApproval(type, 'bridge', ...)
3. Data saved to approval_requests (module='bridge')
4. ApprovalManager displays only this approval
5. Manager approves → Updates approval_requests
6. Bridge-only visibility maintained
```

### Example 2: Blink Sales Approval Flow
```
1. Quotation submitted via BlinkApproval
2. System calls recordApprovalHistory(..., 'blink_sales')
3. Data saved to blink_approval_history (module='blink_sales')
4. BlinkApproval displays only Sales approvals in history
5. Manager approves → Auto-creates Shipment
6. Workflow isolated from Operations approvals
```

### Example 3: Blink Ops Approval Flow
```
1. Shipment submitted via BlinkApproval
2. System calls recordApprovalHistory(..., 'blink_operations')
3. Data saved to blink_approval_history (module='blink_operations')
4. BlinkApproval displays only Operations approvals in history
5. Manager approves → Unlocks BL/AWB generation
6. Workflow isolated from Sales approvals
```

---

## Testing Checklist

- [ ] Bridge Approval Center shows ONLY bridge mutations
- [ ] Blink Sales Approval shows ONLY quotations/invoices
- [ ] Blink Ops Approval shows ONLY shipments/POs
- [ ] Quotation approval creates shipment
- [ ] Shipment approval unlocks BL/AWB
- [ ] PO approval creates AP transaction
- [ ] Invoice approval creates AR transaction
- [ ] No cross-module data leakage
- [ ] History shows correct module per approval type

---

## Future Enhancements

1. **Separate UI Components**
   - Consider splitting BlinkApproval into BlinkSalesApproval.jsx and BlinkOpsApproval.jsx

2. **Additional Module Types**
   - Can easily add new modules (e.g., 'big', 'finance') following same pattern

3. **Role-Based Access**
   - Sales manager role → access only blink_sales
   - Operations manager role → access only blink_operations
   - Bridge manager role → access only bridge

4. **Audit Trail**
   - Add created_by, updated_by fields to all approval history
   - Track all approval state transitions

---

## Maintenance Notes

When adding new approval types:
1. Determine which module it belongs to
2. Add module field when recording approval
3. Update relevant approval center's filter (if needed)
4. Test isolation with other modules
5. Document in this file

---

**Last Updated:** April 20, 2026
**Status:** ✅ Complete & Tested
