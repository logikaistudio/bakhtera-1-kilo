# Implementation Plan: Enhanced Outbound Barang Keluar

## Objective
Menyempurnakan sistem Barang Keluar dengan kemampuan:
1. ✅ Pilih barang per-item (tidak harus semua) dengan checkbox
2. ✅ Auto-populate data saat pilih no. pengajuan atau package code
3. ✅ Tampilan tabel yang lebih compact

## Components

### 1. OutboundInventory.jsx - UI Improvements ✅ DONE
- ✅ Reduced padding: py-3 → py-1.5
- ✅ Smaller font: text-sm → text-[11px]
- ✅ Bold headers: font-semibold → font-bold
- ✅ Single-line text: Added whitespace-nowrap to all cells
- ✅ Shorter column names: "Jml Package" → "Pkg", "Jml Item" → "Items", "Tgl Keluar Gudang" → "Tgl Keluar"
- ✅ Smaller icon: 14px (was 16px)
- ✅ Compact button padding

### 2. PengajuanManagement.jsx - Per-Item Selection
**New Feature: Item Selection Modal**

When user clicks "Pilih dari Gudang", show modal with:
- List of approved inbound pengajuan
- Click pengajuan → Shows detailed item selection modal
- Checkbox per item with:
  - Package info
  - Item code, name, HS code
  - Available quantity
  - Input field for outbound quantity
- Submit button to confirm selection

**Implementation Steps:**

A. Add new state:
```javascript
const [showItemSelector, setShowItemSelector] = useState(false);
const [selectedPengajuanForItems, setSelectedPengajuanForItems] = useState(null);
const [selectedItems, setSelectedItems] = useState([]);
```

B. Modify handleSelectSourcePengajuan:
- Instead of auto-selecting all items
- Open item selection modal
- Let user choose which items and quantities

C. New function: handleConfirmItemSelection
- Process selected items
- Create packages structure
- Auto-populate form

D. New modal component: ItemSelectionModal
- Shows all packages and items from source pengajuan
- Checkbox for each item
- Quantity input (max = available qty)
- Package-level selection
- Search/filter capability

### 3. Auto-populate Features
- ✅ Customer name from source
- ✅ Shipper from source  
- ✅ Package codes from source
- ✅ Item details (code, name, HS code)
- NEW: Searchable dropdown for pengajuan number
- NEW: Package code quick filter

## Implementation Priority

### Phase 1: COMPLETED ✅
- OutboundInventory table UI improvements

### Phase 2: IN PROGRESS 🔄
 - Modify warehouse selector to show item selection modal
- Implement per-item checkbox selection
- Add quantity input per item
- Implement selection confirmation

### Phase 3: NEXT
- Add search/filter in item selector
- Add "Select All" checkbox per package
- Add visual feedback for selected items
- Add quantity validation

## Files to Modify

1. `/src/pages/Bridge/OutboundInventory.jsx` ✅ DONE
2. `/src/pages/Bridge/PengajuanManagement.jsx` - IN PROGRESS
3. No database changes needed (existing structure supports this)

## Testing Checklist

- [ ] Table compact UI displays correctly
- [ ] Can open item selection modal
- [ ] Can select/deselect individual items
- [ ] Can input custom quantities
- [ ] Validation prevents exceeding available qty
- [ ] Selected items populate form correctly
- [ ] Can change selection before submit
- [ ] Search/filter works in modal
- [ ] Package-level select all works
- [ ] Form submission with selected items works
