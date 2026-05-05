# Quick Outbound Button Implementation Guide

## ✅ Yang Sudah Ditambahkan Otomatis:

### 1. Import Icon ✅
```javascript
import { ..., ArrowRight } from 'lucide-react';
```

### 2. Handler Function ✅
```javascript
const handleQuickOutbound = (inboundPengajuan, e) => { ... }
```

**Fungsi ini akan:**
- Calculate available stock
- Auto-populate form outbound
- Set source pengajuan
- Buka form pengajuan baru

---

## 🔧 Perlu Update Manual (2 Steps):

### **STEP 1: Add "Aksi" Column Header**

**Location:** Line ~997 (Inbound table header)

**FIND THIS:**
```javascript
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Pengajuan</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Pemilik Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Dokumen BC</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Jumlah Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Dokumen Pabean</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tgl Approval</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Status Dokumen</th>
                                </tr>
```

**REPLACE WITH (ADD "Aksi" column at the end):**
```javascript
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Pengajuan</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Pemilik Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Dokumen BC</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Jumlah Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Dokumen Pabean</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tgl Approval</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Status Dokumen</th>
                                    <th className="px-4 py-2 text-center text-sm font-bold text-white whitespace-nowrap">Aksi</th>
                                </tr>
```

---

### **STEP 2: Add Action Button in Table Row**

**Location:** Line ~1042 (before closing `</tr>` of inbound table row)

**FIND THIS (the closing of inbound table row):**
```javascript
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${docStatusBadge.color}`}>
                                                    {docStatusBadge.label}
                                                </span>
                                            </td>
                                        </tr>
```

**REPLACE WITH (ADD action button before </tr>):**
```javascript
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${docStatusBadge.color}`}>
                                                    {docStatusBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {docStatus === 'approved' && (
                                                    <button
                                                        onClick={(e) => handleQuickOutbound(quot, e)}
                                                        className="flex items-center gap-1 px-3 py-1 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-lg text-xs font-medium transition-colors"
                                                        title="Buat pengajuan barang keluar dari pengajuan ini"
                                                    >
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                        Ajukan Keluar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
```

**Key Points:**
- Button only shows for **approved** pengajuan (sudah disetujui)
- Uses purple theme (outbound color)
- Compact size with icon
- Hover effect for better UX
- `e.stopPropagation()` prevents row click

---

## 📍 Exact Locations:

**File:** `/src/pages/Bridge/PengajuanManagement.jsx`

### Step 1: Header (Line ~988-997)
- Inside `<thead className="bg-accent-blue">` 
- Inbound table header row
- Add "Aksi" as last `<th>`

### Step 2: Row Data (Line ~1038-1043)
- Inside inbound table `<tbody>`
- After Status Dokumen `<td>`
- Before closing `</tr>`
- Add action button `<td>`

---

## 🎯 Result:

### Before:
```
┌──────────────────────────────────────────────────────────┐
│ No. │ Tgl│ Pemilik │ BC │ Jml │ No.Pabean │ Tgl │ Status │
├──────────────────────────────────────────────────────────┤
│ BR… │ …  │ Cust A  │…   │ 10  │ BC27-…    │ …   │Approved│
└──────────────────────────────────────────────────────────┘
```

### After:
```
┌────────────────────────────────────────────────────────────────────┐
│ No. │ Tgl│ Pemilik │ BC │ Jml│No.Pabean│ Tgl │ Status │    Aksi   │
├────────────────────────────────────────────────────────────────────┤
│ BR… │ …  │ Cust A  │ …  │ 10 │ BC27-…  │ …   │Approved│[→Ajukan…]│
└────────────────────────────────────────────────────────────────────┘
```

---

## 💡 User Flow:

### OLD WAY (Long):
1. Klik "Buat Pengajuan Baru"
2. Pilih Type "Outbound"
3. Klik "Pilih dari Gudang"
4. Pilih pengajuan inbound
5. Review items
6. Submit

### NEW WAY (Quick): ⚡
1. Klik "Ajukan Keluar" di row pengajuan inbound
2. Form auto-populate lengkap!
3. Submit (atau edit jika perlu)

**Saves 4 clicks!** 🎉

---

## 🔍 What Gets Auto-Populated:

When user clicks "Ajukan Keluar":

✅ **Customer** - from inbound  
✅ **Shipper** - from inbound  
✅ **BC Document Type** - from inbound  
✅ **Origin** - "Gudang TPPB"  
✅ **Packages & Items** - only available stock  
✅ **Source Pengajuan** - linked to inbound  
✅ **Notes** - auto-filled with source info  

User only needs to fill:
- **Destination** (Keluar TPB / Pameran)
- **Documents** (if any)
- Adjust items (via "Edit Pilihan" if needed)

---

## ⚠️ Important Notes:

- Button **hanya muncul** untuk pengajuan yang sudah **approved**
- Stock calculation sudah otomatis (hanya barang di gudang)
- Jika tidak ada stock → alert warning
- Form langsung terbuka dalam mode outbound
- User bisa langsung edit atau submit

---

## 🧪 Testing:

After implementation:
- [ ] Button only shows for approved inbound
- [ ] Click button → Form opens
- [ ] Form type = 'outbound'
- [ ] Customer pre-filled correctly
- [ ] Packages show correct items
- [ ] Source pengajuan number displayed
- [ ] Can edit items via "Edit Pilihan"
- [ ] Can submit directly

---

## 📂 Files:

- **Main File:** `/src/pages/Bridge/PengajuanManagement.jsx`
- **This Guide:** `/.agent/QUICK_OUTBOUND_GUIDE.md`
- **Code Snippet:** See Step 1 & Step 2 above
