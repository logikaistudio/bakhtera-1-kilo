# Business Partner Centralization Plan

## ✅ COMPLETED: Opsi A - Data Migration
- ✅ Created `blink_business_partners` table
- ✅ Migrated 6 customers from `freight_customers`
- ✅ Migrated 5 vendors from `freight_vendors`
- ✅ Total: 11 partners in unified table

---

## 🚧 IN PROGRESS: Opsi B - Code Centralization

### Phase 1: Update DataContext (Core Data Layer)
**File**: `src/context/DataContext.jsx`

**Changes Needed**:
1. ✅ Keep `customers` and `vendors` state for backward compatibility
2. ✅ Add new `businessPartners` state
3. ✅ Update `loadData()`:
   - Load from `blink_business_partners`
   - Filter customers: `WHERE is_customer = true`
   - Filter vendors: `WHERE is_vendor = true`
   - Populate both old state (backward compat) + new state
4. ✅ Update realtime subscriptions:
   - Subscribe to `blink_business_partners` changes
   - Update both old + new state arrays
5. ✅ Add new CRUD functions:
   - `addBusinessPartner()`
   - `updateBusinessPartner()`
   - `deleteBusinessPartner()`
6. ✅ Keep old CRUD but mark as deprecated:
   - `addCustomer()` → calls `addBusinessPartner()` internally
   - `addVendor()` → calls `addBusinessPartner()` internally

---

### Phase 2: Update Portal "Fungsi Terpusat"
**Files**:
- `src/pages/Centralized/VendorManagement.jsx`
- `src/pages/Centralized/CustomerManagement.jsx` (if exists)

**Changes**:
1. Import `businessPartners` from DataContext
2. Filter data:
   - Customers: `businessPartners.filter(p => p.is_customer)`
   - Vendors: `businessPartners.filter(p => p.is_vendor)`
3. Update forms to support multi-role checkboxes:
   - ☑️ Customer
   - ☑️ Vendor
   - ☑️ Agent
   - ☑️ Transporter
4. Update CRUD to use `addBusinessPartner()` etc

---

### Phase 3: Update Portal "Blink"
**Files**:
- `src/pages/Blink/PartnerManagement.jsx` ✅ (already using business_partners)
- `src/pages/Blink/QuotationManagement.jsx` ✅ (already using PartnerPicker)
- `src/pages/Blink/BLManagement.jsx` ✅ (already using PartnerPicker)
- `src/pages/Blink/AWBManagement.jsx` ✅ (already using PartnerPicker)

**Status**: ✅ Already centralized!

---

### Phase 4: Update Portal "BIG Event Organizer"
**Files to check**:
- `src/pages/Big/BigQuotationManagement.jsx`
- `src/pages/Big/BigInvoiceManagement.jsx`
- `src/pages/Big/BigCostManagement.jsx`

**Changes**:
- Replace customer dropdowns with PartnerPicker (filter: is_customer)
- Replace vendor dropdowns with PartnerPicker (filter: is_vendor)

---

### Phase 5: Update Portal "Bridge TPPB"
**Files to check**:
- Any forms that reference customers/vendors

**Changes**:
- Use PartnerPicker component

---

### Phase 6: Deprecate Old Tables (Optional - Future)
**After full verification**:
1. Create views for backward compatibility:
   ```sql
   CREATE VIEW freight_customers AS 
   SELECT * FROM blink_business_partners WHERE is_customer = true;
   
   CREATE VIEW freight_vendors AS
   SELECT * FROM blink_business_partners WHERE is_vendor = true;
   ```
2. Update RLS policies
3. Eventually drop old tables after 100% migration

---

## Testing Checklist
- [ ] Can create new partner from Blink portal
- [ ] Can create new customer from Centralized portal
- [ ] Can create new vendor from Centralized portal
- [ ] Partner appears in all relevant dropdowns
- [ ] Multi-role partner (Customer + Vendor) shows correct badges
- [ ] Realtime updates work across all components
- [ ] No duplicate entries

---

## Rollback Plan
If issues occur:
1. Revert DataContext changes
2. Application will still use old tables
3. New `blink_business_partners` table remains as backup
