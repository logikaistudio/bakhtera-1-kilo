# Module Isolation Architecture
## Bridge, Blink, Big - Completely Separate Systems

---

## 🎯 Core Principle

**Each module (Bridge, Blink, Big) is a COMPLETELY ISOLATED system.**

They share:
- ✅ Same database
- ✅ Same authentication system
- ✅ Same UI framework

They DO NOT share:
- ❌ Data tables (except master/reference tables)
- ❌ Business logic
- ❌ Approval flows
- ❌ Menu structures
- ❌ Workflows

---

## 📋 Module Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BAKHTERA SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    BRIDGE    │  │    BLINK     │  │     BIG      │      │
│  │  WAREHOUSE   │  │   SALES &    │  │   GENERAL    │      │
│  │ MANAGEMENT   │  │ OPERATIONS   │  │   COMMERCE   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              SHARED INFRASTRUCTURE                   │   │
│  │  • Authentication (AuthContext)                      │   │
│  │  • Database (Supabase)                               │   │
│  │  • Master Data (Partners, COA, etc)                  │   │
│  │  • Layout & Navigation                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 BRIDGE MODULE

### Purpose
Warehouse and inventory management for freight operations

### Directory Structure
```
/src/pages/Bridge/
  ├── WarehouseInventory.jsx
  ├── OutboundInventory.jsx
  ├── DeliveryNoteForm.jsx
  ├── ApprovalManager.jsx          ← Bridge-specific approval
  ├── PartnerManagement.jsx
  ├── AssetInventory.jsx
  └── CompanySettings.jsx           ← module='bridge'
```

### Data Tables (Bridge-Specific)
```
bridge_inventory           → Core inventory data
bridge_mutation_logs       → All mutations
bridge_business_partners   → Partners for Bridge
approval_requests          → Bridge approvals (module='bridge')
bridge_transaction_logs    → Audit trail
```

### Menu Path
```
Main Sidebar
  └── Bridge
      ├── Dashboard
      ├── Warehouse Inventory
      ├── Outbound Operations
      ├── Approval Manager         ← Bridge approvals only
      ├── Partner Management
      ├── Asset Inventory
      └── Settings
```

### Approval Flow
```
Warehouse Activity
  ↓
requestApproval('mutation_out', 'bridge', ...)
  ↓
approval_requests (module='bridge')
  ↓
ApprovalManager.jsx (Bridge only)
  ↓
Manager Approval
  ↓
Inventory Updated
```

### Key Features
- ✅ Inventory mutations (in/out)
- ✅ Outbound shipments to Pabean
- ✅ Asset tracking
- ✅ Partner management for warehouse
- ✅ Approval workflow for mutations

---

## 🔄 BLINK MODULE

### Purpose
Sales and operations management for freight services

### Directory Structure
```
/src/pages/Blink/
  ├── BLManagement.jsx
  ├── BlinkApproval.jsx            ← Blink-specific approval
  ├── QuotationManagement.jsx
  ├── PurchaseOrder.jsx
  ├── InvoiceManagement.jsx
  ├── ShipmentManagement.jsx
  └── CompanySettings.jsx           ← module='blink'
```

### Data Tables (Blink-Specific)
```
blink_quotations           → Customer quotations
blink_shipments            → Shipment/SO management
blink_purchase_orders      → Vendor POs
blink_invoices             → Customer invoices
blink_approval_history     → Blink approvals (module='blink_sales' OR 'blink_operations')
blink_business_partners    → Partners for Blink
blink_ar_transactions      → AR from invoices
blink_ap_transactions      → AP from POs
blink_transaction_logs     → Audit trail
```

### Menu Path
```
Main Sidebar
  └── Blink
      ├── Dashboard
      ├── Quotation Management
      ├── Shipment Management
      ├── Purchase Order
      ├── Invoice Management
      ├── Approval Center          ← Blink approvals only
      │   ├── Sales Approvals      (blink_sales)
      │   └── Operations Approvals (blink_operations)
      ├── BL/AWB Management
      ├── Partner Management
      └── Settings
```

### Approval Flow - TWO SEPARATE FLOWS

#### Sales Approval Flow
```
Quotation Created
  ↓
recordApprovalHistory(item, ..., module='blink_sales')
  ↓
blink_approval_history (module='blink_sales')
  ↓
BlinkApproval.jsx - Sales Tab (filter: module='blink_sales')
  ↓
Sales Manager Approval
  ↓
Auto-create Shipment (SO)
  ↓
Route to Operations Approval
```

#### Operations Approval Flow
```
Shipment/PO Created
  ↓
recordApprovalHistory(item, ..., module='blink_operations')
  ↓
blink_approval_history (module='blink_operations')
  ↓
BlinkApproval.jsx - Operations Tab (filter: module='blink_operations')
  ↓
Operations Manager Approval
  ↓
Create AR (invoice) / AP (PO) transactions
  ↓
Shipment Approved
```

### Key Features
- ✅ Sales quotation management
- ✅ Shipment/SO management
- ✅ Purchase order management
- ✅ Invoice management
- ✅ Two-tier approval (Sales + Operations)
- ✅ Auto-create financial transactions (AR/AP)
- ✅ BL/AWB document generation
- ✅ Multi-currency support

---

## 🔄 BIG MODULE

### Purpose
General commerce and additional business operations

### Directory Structure
```
/src/pages/Big/
  ├── (To be implemented)
  └── CompanySettings.jsx           ← module='big'
```

### Data Tables (Big-Specific - When Implemented)
```
big_inventory              → General inventory
big_transactions           → General transactions
big_business_partners      → Partners for Big
big_transaction_logs       → Audit trail
```

### Menu Path
```
Main Sidebar
  └── Big
      ├── Dashboard
      ├── Inventory
      ├── (Additional modules)
      └── Settings
```

### Approval Flow (Future)
```
Activity in Big
  ↓
requestApproval(..., 'big', ...)
  ↓
approval_requests (module='big')
  ↓
(Future: BigApprovalManager or similar)
  ↓
Big Manager Approval
```

---

## 🔐 ISOLATION PATTERNS

### Pattern 1: Separate Approval Tables

```javascript
// BRIDGE - Uses approval_requests table
await supabase.from('approval_requests').insert({
    module: 'bridge',  // ← Key identifier
    type: 'mutation_out',
    ...
});

// BLINK - Uses blink_approval_history table
await supabase.from('blink_approval_history').insert({
    module: 'blink_sales',  // ← Key identifier
    document_type: 'quotation',
    ...
});
```

### Pattern 2: Module-Based Filtering

```javascript
// ApprovalManager.jsx - BRIDGE ONLY
const bridgeApprovals = pendingApprovals.filter(req => 
    (req.module || '').toLowerCase() === 'bridge'
);

// BlinkApproval.jsx - BLINK ONLY
const { data: historyData } = await supabase
    .from('blink_approval_history')
    .select('*')
    .in('module', ['blink_sales', 'blink_operations']);
```

### Pattern 3: Separate Business Partners

```javascript
// Bridge has its own partners table
/blink_business_partners
/bridge_business_partners
/big_business_partners (future)
```

### Pattern 4: Module Settings

```
/src/pages/Bridge/CompanySettings.jsx
  const MODULE = 'bridge';

/src/pages/Blink/CompanySettings.jsx
  const MODULE = 'blink';

/src/pages/Big/CompanySettings.jsx (future)
  const MODULE = 'big';
```

---

## 📊 Data Isolation Matrix

| Feature | Bridge | Blink | Big |
|---------|--------|-------|-----|
| Inventory | bridge_inventory | blink_shipments | big_inventory (future) |
| Approvals | approval_requests | blink_approval_history | approval_requests |
| Partners | bridge_business_partners | blink_business_partners | big_business_partners |
| Transactions | bridge_transaction_logs | blink_ar/ap_transactions | big_transaction_logs |
| Menu Path | /bridge/* | /blink/* | /big/* |
| Settings Module | 'bridge' | 'blink' | 'big' |

---

## ✅ IMPLEMENTATION CHECKLIST

When adding NEW features to any module:

### 1. Data Layer
- [ ] Create module-specific tables (prefix with module name)
- [ ] Add `module` field to shared tables (e.g., approval_requests)
- [ ] Implement module-specific queries

### 2. Business Logic
- [ ] Keep logic inside module-specific files
- [ ] Do NOT access other module's tables directly
- [ ] Use DataContext for cross-module needs (if absolutely necessary)

### 3. Approval Workflow
- [ ] Identify if feature needs approval
- [ ] Determine approval type (sales, operations, warehouse, etc)
- [ ] Implement module-specific approval flow
- [ ] Add `module` identifier to approval records
- [ ] Filter in approval center by module

### 4. UI/Menu
- [ ] Place feature under correct module menu
- [ ] Use module-specific path (/bridge/, /blink/, /big/)
- [ ] Add to module's CompanySettings if configurable

### 5. Documentation
- [ ] Document data flow
- [ ] Document approval workflow
- [ ] Update this architecture document
- [ ] Add inline code comments

---

## 🚀 EXAMPLE: Adding New Bridge Feature

### Step 1: Create Module-Specific Table
```sql
CREATE TABLE bridge_new_feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Bridge-specific fields
    warehouse_id UUID,
    -- Shared fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    module VARCHAR(50) DEFAULT 'bridge'
);
```

### Step 2: Create React Component
```javascript
// /src/pages/Bridge/NewFeature.jsx
const MODULE = 'bridge';

export default function NewFeature() {
    // Bridge-specific logic only
    const handleApprovalNeeded = async (data) => {
        await requestApproval(
            'feature_type',
            MODULE,  // ← Important: Always use module
            'EntityType',
            id,
            name,
            changes,
            details,
            user.name,
            user.id
        );
    };
}
```

### Step 3: Add Menu Item
```javascript
// /src/config/menuConfig.js
{
    code: 'bridge_new_feature',
    label: 'New Feature',
    group: 'Bridge',
    path: '/bridge/new-feature'  // ← Bridge-specific path
}
```

### Step 4: Add to Bridge Menu
```javascript
// /src/components/Layout/Sidebar.jsx - Bridge section
{ path: '/bridge/new-feature', label: 'New Feature', menuCode: 'bridge_new_feature' }
```

### Step 5: Approval Display
```javascript
// ApprovalManager.jsx - Already filters by module='bridge'
// New feature approvals appear automatically!
```

---

## 🚀 EXAMPLE: Adding New Blink Feature

### Step 1: Create Module-Specific Table
```sql
CREATE TABLE blink_new_feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Blink-specific fields
    quotation_id UUID,
    -- Shared fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    module VARCHAR(50) DEFAULT 'blink'
);
```

### Step 2: Create React Component
```javascript
// /src/pages/Blink/NewFeature.jsx
const MODULE = 'blink';

export default function NewFeature() {
    // Blink-specific logic only
    const handleApprovalNeeded = async (data) => {
        // Determine if Sales or Operations
        const approvalModule = ['quotation', 'invoice'].includes(type)
            ? 'blink_sales'
            : 'blink_operations';
        
        await recordApprovalHistory(
            item,
            'pending',
            reason,
            user.name,
            approvalModule  // ← Specify which Blink flow
        );
    };
}
```

### Step 3: Add Menu Item
```javascript
// /src/config/menuConfig.js
{
    code: 'blink_new_feature',
    label: 'New Feature',
    group: 'Blink',
    path: '/blink/new-feature'  // ← Blink-specific path
}
```

### Step 4: Add to Blink Menu
```javascript
// /src/components/Layout/Sidebar.jsx - Blink section
{ path: '/blink/new-feature', label: 'New Feature', menuCode: 'blink_new_feature' }
```

### Step 5: Approval Display
```javascript
// BlinkApproval.jsx - Already filters by module
// New feature approvals appear in correct tab:
// - If blink_sales → Sales Approvals tab
// - If blink_operations → Operations Approvals tab
```

---

## 🎓 KEY LEARNINGS

### ❌ ANTI-PATTERNS (DON'T DO THIS)

1. **Cross-Module Data Access**
```javascript
// ❌ WRONG: Bridge accessing Blink data directly
const { data } = await supabase.from('blink_quotations').select();
```

2. **Shared Approval Handler**
```javascript
// ❌ WRONG: Single approval function for all modules
const handleApprove = (request) => {
    // Try to handle Bridge, Blink, Big in one place
};
```

3. **Mixed Menu Paths**
```javascript
// ❌ WRONG: Putting Bridge feature in Blink menu
path: '/blink/warehouse-inventory'  // Confused!
```

4. **No Module Identifier**
```javascript
// ❌ WRONG: Creating approval without module
await supabase.from('approval_requests').insert({
    type: 'mutation',
    // Missing: module field!
});
```

### ✅ BEST PRACTICES (DO THIS)

1. **Module-Specific Files**
```javascript
// ✅ RIGHT: Separate components per module
/src/pages/Bridge/ApprovalManager.jsx
/src/pages/Blink/BlinkApproval.jsx
/src/pages/Big/ApprovalManager.jsx (future)
```

2. **Module Identifier in Data**
```javascript
// ✅ RIGHT: Always include module field
await supabase.from('approval_requests').insert({
    type: 'mutation',
    module: 'bridge',  // ← Always included
});
```

3. **Module-Based Filtering**
```javascript
// ✅ RIGHT: Filter by module in queries
.where('module', '=', 'bridge')
.in('module', ['blink_sales', 'blink_operations'])
```

4. **Consistent Naming**
```javascript
// ✅ RIGHT: Clear module prefixes
bridge_inventory
blink_quotations
big_transactions
```

---

## 📞 Quick Reference

### Where is X feature?
- **Warehouse/Inventory?** → Bridge
- **Quotations/Sales?** → Blink
- **Shipments?** → Blink
- **Purchase Orders?** → Blink
- **Invoices?** → Blink
- **BL/AWB?** → Blink
- **General Commerce?** → Big (future)

### Where do I find X approval?
- **Warehouse mutations?** → Bridge ApprovalManager
- **Quotations/Invoices?** → Blink Sales Approvals
- **Shipments/POs?** → Blink Operations Approvals

### Which table stores X?
- **Bridge approvals?** → approval_requests (module='bridge')
- **Blink approvals?** → blink_approval_history (module='blink_sales'/'blink_operations')

### Which module for new feature?
- **Ask: Who uses this?**
  - Warehouse team → Bridge
  - Sales/Ops team → Blink
  - General/Admin → Big

---

## 📚 Related Files

- `APPROVAL_SYSTEM_ISOLATION.md` - Detailed approval architecture
- `/src/pages/Bridge/ApprovalManager.jsx` - Bridge approval center
- `/src/pages/Blink/BlinkApproval.jsx` - Blink approval center
- `/src/context/DataContext.jsx` - Shared data management
- `/src/config/menuConfig.js` - Menu structure (shows isolation)

---

**This document is the AUTHORITY on module isolation.**

When in doubt about isolation:
1. Check menu structure (Bridge/Blink/Big)
2. Check data table prefixes (bridge_*, blink_*, big_*)
3. Check file locations (/src/pages/Bridge/, /src/pages/Blink/, etc)
4. Ask: "Which module does this belong to?"

**Last Updated:** April 20, 2026
**Version:** 1.0
