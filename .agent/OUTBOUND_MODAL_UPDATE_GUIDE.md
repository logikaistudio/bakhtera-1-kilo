# Update Outbound Inventory Modal - Clean UI

## Step 1: Update Import (Line 2)

**FIND:**
```javascript
import { Search, Download, Package, TrendingUp, Calendar, FileText, Eye } from 'lucide-react';
```

**REPLACE WITH:**
```javascript
import { Search, Download, Package, TrendingUp, Calendar, FileText, Eye, X, Edit, Trash2, RefreshCw } from 'lucide-react';
```

---

## Step 2: Replace Modal (Line 244-339)

**File:** `/src/pages/Bridge/OutboundInventory.jsx`

Hapus dari line 244 sampai 339 (entire modal block), lalu paste kode dari:
`.agent/CLEAN_OUTBOUND_MODAL.jsx`

---

## Visual Changes:

### BEFORE:
- Dark modal dengan purple accents
- Simple header with close button
- Dark background cards
- Basic table layout

### AFTER (Matching Screenshot):
- ✅ **White background** (clean & bright)
- ✅ **Action buttons** di header: Mutasi, Hapus Mutasi, Edit, Close
- ✅ **Blue table headers** (`bg-blue-600`)
- ✅  **Two sections**: Data Inventaris + Detail Item
- ✅ **Checkbox column** di Detail Item
- ✅ **Complete columns**: CHECKOUT, NO. URUT, KODE BARANG, HS CODE, ITEM, JUMLAH, SATUAN, STATUS, LOKASI, KONDISI, KETERANGAN
- ✅ **Gray background** untuk body (`bg-gray-50`)
- ✅ **Green status badges**

---

## Key Features:

1. **Header dengan Actions**: Mutasi (red), Hapus Mutasi (blue), Edit (blue), Close
2. **Data Inventaris Table**: Overview data dengan 7 kolom
3. **Detail Item Table**: Per-package dengan 11 kolom termasuk checkbox
4. **Clean White Theme**: Modern & professional
5. **Blue Headers**: Konsisten dengan screenshot
6. **Responsive Layout**: Max 6xl width, scrollable content

---

Ready to apply! 🎯
