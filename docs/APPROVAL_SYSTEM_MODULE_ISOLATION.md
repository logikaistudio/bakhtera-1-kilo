# Approval System - Module Isolation Reference Implementation

## Overview
The Approval System is the BEST EXAMPLE of proper module isolation in Bakhtera.

Each module has its own:
- ✅ Approval component
- ✅ Approval data storage
- ✅ Approval workflow
- ✅ Approval history
- ✅ Manager/Approver role

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    APPROVAL SYSTEM OVERVIEW                   │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────┐
│  BRIDGE APPROVALS   │    │  BLINK APPROVALS     │    │ BIG (Future)│
└─────────────────────┘    └──────────────────────┘    └─────────────┘
         │                           │                        │
    ┌────▼──────┐            ┌──────▼──────┐          ┌──────▼───┐
    │ Component │            │ Component   │          │Component │
    │Approval   │            │BlinkApproval│          │Approval  │
    │Manager    │            │.jsx         │          │Manager   │
    └────┬──────┘            └──────┬──────┘          └──────┬───┘
         │                           │                        │
    ┌────▼──────────┐        ┌───────▼────────┐       ┌───────▼─────┐
    │ Data Storage  │        │ Data Storage   │       │Data Storage │
    │approval_      │        │blink_approval_ │       │approval_    │
    │requests       │        │history         │       │requests     │
    │(module=       │        │(module=        │       │(module=     │
    │'bridge')      │        │'blink_sales',  │       │'big')       │
    │               │        │'blink_ops')    │       │             │
    └────┬──────────┘        └───────┬────────┘       └───────┬─────┘
         │                           │                        │
    ┌────▼──────────┐        ┌───────▼────────┐       ┌───────▼─────┐
    │ Menu Path     │        │ Menu Path      │       │ Menu Path   │
    │/bridge/*      │        │/blink/*        │       │/big/*       │
    └───────────────┘        └────────────────┘       └─────────────┘
```

---

## 📦 BRIDGE APPROVAL SYSTEM

### Component Location
`/src/pages/Bridge/ApprovalManager.jsx`

### Data Storage
**Table:** `approval_requests`
**Module Filter:** `module = 'bridge'`

### Code Example - Isolation in Action
```javascript
// ApprovalManager.jsx - ONLY shows Bridge approvals

const ApprovalManager = () => {
    const { pendingApprovals = [] } = useData();
    
    // ✅ KEY: Module-based filtering
    const bridgeApprovals = pendingApprovals.filter(req => {
        const moduleLower = (req.module || '').toLowerCase();
        return moduleLower === 'bridge' || !req.module;
    });
    
    // Rest of component only uses bridgeApprovals
    const pendingCount = bridgeApprovals.filter(r => r.status === 'pending').length;
    const approvedCount = bridgeApprovals.filter(r => r.status === 'approved').length;
    
    return (
        // Render only Bridge approvals
        {bridgeApprovals.map(req => (...))}
    );
};
```

### Data Creation Flow
```javascript
// WarehouseInventory.jsx / OutboundInventory.jsx

await requestApproval(
    type,           // 'mutation_out', 'mutation_in', 'outbound', etc
    'bridge',       // ← KEY: Module identifier
    entityType,
    entityId,
    entityName,
    changes,
    details,
    requestedBy,
    requestedById
);

// This creates record in approval_requests with:
// {
//     type: 'mutation_out',
//     module: 'bridge',      ← Isolation key
//     status: 'pending',
//     ...
// }
```

### Approval History
- Shows ONLY Bridge approvals
- Automatically filtered by `module='bridge'`
- No Blink or Big data visible

### Menu Separation
```
Main Menu
  └── Bridge (ISOLATED AREA)
      ├── Dashboard
      ├── Warehouse Inventory
      ├── Outbound Operations
      ├── Approval Manager           ← Only shows Bridge
      └── Settings (module='bridge')
```

---

## 📦 BLINK APPROVAL SYSTEM

### Component Location
`/src/pages/Blink/BlinkApproval.jsx`

### Data Storage
**Table:** `blink_approval_history`
**Module Filters:** 
- `module = 'blink_sales'` (Quotations, Invoices)
- `module = 'blink_operations'` (Shipments, POs)

### Code Example - Isolation in Action
```javascript
// BlinkApproval.jsx - ONLY shows Blink approvals (Sales + Ops)

const BlinkApproval = () => {
    const [activeTab, setActiveTab] = useState('pending');
    const [historyLogs, setHistoryLogs] = useState([]);
    
    // ✅ KEY: Fetch ONLY Blink approvals
    const { data: historyData } = await supabase
        .from('blink_approval_history')
        .select('*')
        .in('module', ['blink_sales', 'blink_operations'])
        .order('approved_at', { ascending: false });
    
    setHistoryLogs(historyData || []);
    
    return (
        <>
            {/* Sales Tab - blink_sales only */}
            <button onClick={() => setActiveTab('sales')}>Sales Approvals</button>
            
            {/* Operations Tab - blink_operations only */}
            <button onClick={() => setActiveTab('operations')}>Operations Approvals</button>
            
            {/* Render filtered history */}
            {historyLogs.map(log => (...))}
        </>
    );
};
```

### Data Creation Flow - Sales
```javascript
// BlinkApproval.jsx - When approving Quotation

await recordApprovalHistory(
    item,              // quotation object
    'approved',        // action
    null,              // reason
    user.name,         // approver
    'blink_sales'      // ← KEY: Module identifier
);

// This creates record in blink_approval_history with:
// {
//     document_type: 'quotation',
//     module: 'blink_sales',     ← Isolation key (Sales)
//     status: 'approved',
//     ...
// }
```

### Data Creation Flow - Operations
```javascript
// BlinkApproval.jsx - When approving Shipment

await recordApprovalHistory(
    item,              // shipment object
    'approved',        // action
    null,              // reason
    user.name,         // approver
    'blink_operations' // ← KEY: Module identifier
);

// This creates record in blink_approval_history with:
// {
//     document_type: 'shipment',
//     module: 'blink_operations',  ← Isolation key (Operations)
//     status: 'approved',
//     ...
// }
```

### Implementation Details
```javascript
// In recordApprovalHistory function:

const approvalModule = ['quotation', 'invoice'].includes(item.type) 
    ? 'blink_sales'           // Quotations, Invoices
    : 'blink_operations';     // Shipments, POs

const payload = {
    document_number: item.refNumber || item.jobNumber,
    document_type: item.type,
    module: approvalModule,    // ← Automatic module assignment
    approved_at: new Date().toISOString(),
    approver: approverName,
    status: action,
    reason: reason || ''
};

await supabase.from('blink_approval_history').insert([payload]);
```

### Two-Tab Isolation
```javascript
// When displaying history:

// Tab 1: Sales Approvals (blink_sales)
const salesHistoryLogs = historyLogs.filter(log => log.module === 'blink_sales');

// Tab 2: Operations Approvals (blink_operations)
const opsHistoryLogs = historyLogs.filter(log => log.module === 'blink_operations');

// Render in separate tabs with no overlap
```

### Approval History
- Sales Tab: Shows ONLY quotations and invoices
- Operations Tab: Shows ONLY shipments and POs
- Completely separated by `module` field
- No Bridge or Big data visible

### Menu Separation
```
Main Menu
  └── Blink (ISOLATED AREA)
      ├── Dashboard
      ├── Quotation Management
      ├── Shipment Management
      ├── Purchase Order
      ├── Invoice Management
      ├── Approval Center                ← BLINK ONLY
      │   ├── Sales Approvals            (blink_sales)
      │   └── Operations Approvals       (blink_operations)
      ├── BL/AWB Management
      └── Settings (module='blink')
```

---

## 🏛️ BIG MODULE (Future Template)

### Planned Component Location
`/src/pages/Big/ApprovalManager.jsx` (to be created)

### Planned Data Storage
**Table:** `approval_requests`
**Module Filter:** `module = 'big'`

### Template Implementation
```javascript
// /src/pages/Big/ApprovalManager.jsx (future)

const ApprovalManager = () => {
    const { pendingApprovals = [] } = useData();
    
    // ✅ Same pattern as Bridge
    const bigApprovals = pendingApprovals.filter(req => {
        const moduleLower = (req.module || '').toLowerCase();
        return moduleLower === 'big' || !req.module;
    });
    
    return (
        // Render only Big approvals
        {bigApprovals.map(req => (...))}
    );
};
```

### Menu Template
```
Main Menu
  └── Big (ISOLATED AREA)
      ├── Dashboard
      ├── (Big-specific features)
      ├── Approval Manager               ← Big ONLY
      └── Settings (module='big')
```

---

## 🔑 Key Isolation Mechanisms

### 1. Module Identifier Field
```
approval_requests table:
  - module = 'bridge'

blink_approval_history table:
  - module = 'blink_sales'
  - module = 'blink_operations'

(Future Big table):
  - module = 'big'
```

### 2. Component-Level Filtering
```javascript
// Bridge
const bridgeApprovals = pendingApprovals.filter(req => req.module === 'bridge');

// Blink
const { data } = await supabase
    .from('blink_approval_history')
    .select('*')
    .in('module', ['blink_sales', 'blink_operations']);

// Big (future)
const bigApprovals = pendingApprovals.filter(req => req.module === 'big');
```

### 3. Separate Data Tables
```
Bridge uses:          approval_requests (generic)
Blink uses:           blink_approval_history (specialized)
Big uses (future):    approval_requests (generic)
```

### 4. Menu Path Separation
```
/bridge/approval-manager     → Bridge only
/blink/approval-center       → Blink only
/big/approval-manager        → Big only (future)
```

---

## ✅ ISOLATION CHECKLIST

### For Bridge Features
- [ ] Create approval in `approval_requests` with `module='bridge'`
- [ ] Display in `ApprovalManager.jsx` (auto-filtered)
- [ ] Put feature under `/bridge/*` menu path
- [ ] Use `bridge_*` table prefix
- [ ] No access to Blink or Big data

### For Blink Features
- [ ] Create approval in `blink_approval_history` with correct module
- [ ] Determine: `blink_sales` or `blink_operations`?
- [ ] Display in `BlinkApproval.jsx` (auto-filtered to correct tab)
- [ ] Put feature under `/blink/*` menu path
- [ ] Use `blink_*` table prefix
- [ ] No access to Bridge or Big data

### For Big Features (Future)
- [ ] Create approval in `approval_requests` with `module='big'`
- [ ] Display in `BigApprovalManager.jsx` (to be created)
- [ ] Put feature under `/big/*` menu path
- [ ] Use `big_*` table prefix
- [ ] No access to Bridge or Blink data

---

## 🎓 Learning Path

### Level 1: Understand Module Separation
1. Open sidebar - see Bridge, Blink, Big as separate
2. Each has its own menu items
3. Each has its own database tables
4. Result: No data confusion

### Level 2: Understand Approval Isolation
1. Bridge ApprovalManager shows ONLY Bridge approvals
2. Blink ApprovalCenter shows ONLY Blink approvals
3. Filtering by `module` field
4. Result: Clean approval workflows per module

### Level 3: Implement New Feature
1. Decide which module it belongs to
2. Create module-specific tables
3. Create module-specific component
4. Add to correct menu path
5. Implement approval with correct module identifier
6. Done - automatic isolation!

### Level 4: Add New Module
1. Create `/src/pages/NewModule/` directory
2. Implement approval component
3. Add `module='newmodule'` filter
4. Add menu items
5. Create `NewModuleApprovalManager.jsx`
6. Result: Full isolation just like Bridge/Blink

---

## 🚀 Copy-Paste Templates

### Template 1: Add Feature to Bridge

```javascript
// 1. Data creation (your component)
await requestApproval(
    'feature_type',
    'bridge',  // ← Always 'bridge'
    'EntityType',
    entityId,
    entityName,
    changes,
    details,
    user.name,
    user.id
);

// 2. Approval display - NO CHANGES NEEDED!
// ApprovalManager.jsx already filters by module='bridge'
// Your approval automatically appears in Bridge Approval Manager
```

### Template 2: Add Feature to Blink (Sales)

```javascript
// 1. Data creation (your component)
await recordApprovalHistory(
    item,
    'pending',
    null,
    user.name,
    'blink_sales'  // ← Always 'blink_sales' for sales features
);

// 2. Approval display - NO CHANGES NEEDED!
// BlinkApproval.jsx already filters by module='blink_sales'
// Your approval automatically appears in Sales Approvals tab
```

### Template 3: Add Feature to Blink (Operations)

```javascript
// 1. Data creation (your component)
await recordApprovalHistory(
    item,
    'pending',
    null,
    user.name,
    'blink_operations'  // ← Always 'blink_operations' for ops features
);

// 2. Approval display - NO CHANGES NEEDED!
// BlinkApproval.jsx already filters by module='blink_operations'
// Your approval automatically appears in Operations Approvals tab
```

---

## 📊 Comparison Matrix

| Aspect | Bridge | Blink Sales | Blink Ops | Big (Future) |
|--------|--------|-------------|-----------|--------------|
| Component | ApprovalManager | BlinkApproval | BlinkApproval | BigApprovalManager |
| Data Table | approval_requests | blink_approval_history | blink_approval_history | approval_requests |
| Module ID | 'bridge' | 'blink_sales' | 'blink_operations' | 'big' |
| Menu Path | /bridge/* | /blink/* | /blink/* | /big/* |
| Data Prefix | bridge_* | blink_* | blink_* | big_* |
| Isolation | Complete ✅ | Complete ✅ | Complete ✅ | Planned ✅ |

---

## 🎯 Why This Matters

### Without Isolation
❌ All approvals mixed together
❌ Warehouse staff sees sales data
❌ Sales staff sees warehouse data
❌ Data confusion & errors
❌ Approval bottlenecks

### With Module Isolation (Current)
✅ Each module sees ONLY its data
✅ Clear responsibility boundaries
✅ Faster approvals
✅ No accidental data access
✅ Easy to add new modules
✅ Scales to multiple offices/departments

---

## 📚 Related Files

- `MODULE_ISOLATION_ARCHITECTURE.md` - Overall module structure
- `/src/pages/Bridge/ApprovalManager.jsx` - Bridge approval example
- `/src/pages/Blink/BlinkApproval.jsx` - Blink approval example
- `/src/context/DataContext.jsx` - Shared infrastructure

---

## 🏆 Best Practices Summary

1. **Always include module identifier** when creating approvals
2. **Use consistent naming** for module values ('bridge', 'blink_sales', etc)
3. **Filter by module** in queries and components
4. **Keep features in their module** - don't cross boundaries
5. **Use as template** when adding new modules

---

**This document IS the approval system best practice guide.**

Follow these patterns and you maintain perfect isolation.

**Last Updated:** April 20, 2026
**Version:** 1.0
