# Perbaikan Flow Pengajuan Barang Keluar

## 📋 Ringkasan Perubahan

Implementasi perbaikan telah selesai dilakukan untuk memisahkan flow approval dari processing barang keluar ke Pabean.

## ✅ File yang Diubah

### 1. **PengajuanManagement.jsx** - Approval Logic
**Lokasi:** `/src/pages/Bridge/PengajuanManagement.jsx`

**Perubahan:**
- ❌ HAPUS auto-call `addOutboundTransaction()` saat approval outbound
- ✅ Approval outbound sekarang HANYA update status di `freight_quotations`
- ✅ Alert message memberikan instruksi jelas untuk proses selanjutnya
- ✅ Inbound flow TIDAK BERUBAH (tetap auto-sync ke warehouse)

**Baris yang diubah:** 284-328

---

### 2. **OutboundInventory.jsx** - Processing Logic  
**Lokasi:** `/src/pages/Bridge/OutboundInventory.jsx`

**Perubahan:**
- ✅ Filter updated: hanya tampilkan outbound dengan `!outbound_status` (belum diproses)
- ✅ Handler baru: `handleProcessOutbound` (menggantikan `handleSubmitToPabean`)
- ✅ Button text: "Proses ke Pabean" (dengan loading state)
- ✅ Logic baru:
  1. Insert record ke `freight_outbound`
  2. Update stock di `freight_warehouse` (kurangi quantity)
  3. Set `outbound_status = 'processed'` di `freight_quotations`

**Import baru:** `import { createProcessOutboundHandler } from './handlers/processOutbound';`

---

### 3. **handlers/processOutbound.js** - Helper Handler (NEW)
**Lokasi:** `/src/pages/Bridge/handlers/processOutbound.js`

**Deskripsi:**
- File baru untuk memproses outbound ke Pabean
- Insert ke `freight_outbound`
- Update `freight_warehouse` (kurangi stok)
- Set status `processed` di `freight_quotations`
- Error handling yang robust

---

### 4. **DataContext.jsx** - Normalization
**Lokasi:** `/src/context/DataContext.jsx`

**Perubahan:**
- ✅ Tambah mapping `outboundStatus` dan `outboundDate` di `normalizeQuotation()`
- ✅ Tambah mapping di `mapQuotationToState()` helper

**Baris yang diubah:**
- Line 106-110
- Line 228-232

---

### 5. **Database Migration**
**Lokasi:** `/supabase/migrations/003_add_outbound_status.sql`

**Schema changes:**
```sql
ALTER TABLE freight_quotations 
ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS outbound_date TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_freight_quotations_outbound_status 
ON freight_quotations(outbound_status) 
WHERE outbound_status IS NOT NULL;
```

**Status:** ✅ Sudah ada di database

---

### 6. **OutboundManagement.jsx** - DEPRECATED
**Lokasi:** `/src/pages/Bridge/OutboundManagement.jsx.deprecated`

**Action:** File di-rename menjadi `.deprecated` karena duplikasi dengan flow `PengajuanManagement`

---

## 🔄 Flow Baru

### **Flow Lengkap Pengajuan Barang Keluar:**

```
1. PengajuanManagement.jsx
   │
   ├─→ User buat pengajuan outbound
   ├─→ Submit → Tersimpan di freight_quotations (status: pengajuan)
   │
2. PengajuanManagement.jsx (Edit Modal)
   │
   ├─→ Admin approve pengajuan
   ├─→ Update document_status = 'approved'
   ├─→ ❌ TIDAK auto-insert ke freight_outbound
   ├─→ Alert: "Silakan proses di Inventaris Gudang"
   │
3. OutboundInventory.jsx (Laporan Barang Keluar)
   │
   ├─→ Tampilkan outbound approved yang !outbound_status
   ├─→ Admin klik "Proses ke Pabean"
   ├─→ Handler: handleProcessOutbound()
   │   ├─→ Insert ke freight_outbound
   │   ├─→ Update freight_warehouse (kurangi stok)
   │   └─→ Set outbound_status = 'processed'
   │
4. Warehouse & Pabean
   │
   ├─→ Data tercatat di freight_outbound
   ├─→ Stok berkurang di freight_warehouse
   └─→ Item hilang dari list OutboundInventory (sudah processed)
```

---

## 📊 Tabel Database yang Terlibat

| Tabel | Perubahan | Kapan Diisi |
|-------|-----------|-------------|
| `freight_quotations` | + `outbound_status`<br>+ `outbound_date` | Step 1: Pengajuan dibuat<br>Step 2: Approval<br>Step 3: Set 'processed' |
| `freight_outbound` | - | Step 3: Proses ke Pabean |
| `freight_warehouse` | - | Step 3: Stock dikurangi |

---

## 🧪 Testing Checklist

### Test 1: Approval Outbound
- [ ] Buat pengajuan outbound baru
- [ ] Approve pengajuan
- [ ] Verify: TIDAK ada insert ke `freight_outbound`
- [ ] Verify: TIDAK ada perubahan di `freight_warehouse`
- [ ] Verify: Alert muncul dengan instruksi

### Test 2: Process ke Pabean
- [ ] Buka "Inventaris Gudang" → Filter "Barang Keluar"
- [ ] Verify: Pengajuan approved muncul
- [ ] Klik "Proses ke Pabean"
- [ ] Verify: Success message muncul
- [ ] Verify: Record ter-insert di `freight_outbound`
- [ ] Verify: Stock berkurang di `freight_warehouse`
- [ ] Verify: `outbound_status = 'processed'` di `freight_quotations`
- [ ] Verify: Item hilang dari list (sudah diproses)

### Test 3: Inbound (Unchanged)
- [ ] Buat pengajuan inbound
- [ ] Approve pengajuan
- [ ] Verify: Auto-insert ke `freight_inbound`
- [ ] Verify: Auto-update `freight_warehouse`
- [ ] Verify: Semua berfungsi seperti sebelumnya

---

## 📝 Notes

- Inbound flow TIDAK BERUBAH - tetap auto-sync ke warehouse saat approval
- Outbound sekarang 2-step process: Approve → Process
- Filter `!outbound_status` memastikan hanya pending yang ditampilkanuntuk diproses
- Error handling dengan feedback yang jelas untuk user
- Duplikasi dengan `OutboundManagement.jsx` telah dihapus (deprecated)

---

## 🔧 Troubleshooting

### Issue: "Item tidak ditemukan di warehouse"
**Solusi:** Pastikan `sourcePengajuanId` benar dan item sudah ada di `freight_warehouse`

### Issue: "Stok tidak cukup"
**Solusi:** Cek stock di `freight_warehouse` untuk item tersebut

### Issue: Filter tidak menampilkan approved outbound
**Solusi:** 
1. Cek `document_status = 'approved'`
2. Cek `type = 'outbound'`
3. Cek `outbound_status IS NULL` (belum diproses)

---

**Tanggal Implementasi:** 2026-01-18  
**Versi:** 1.0  
**Status:** ✅ SELESAI
