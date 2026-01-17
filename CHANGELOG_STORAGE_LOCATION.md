# Dokumentasi: Penambahan Kolom Lokasi Mutasi dan Lokasi Penyimpanan

## 📋 Ringkasan Perubahan

Telah dilakukan penyempurnaan pada Bridge - Modal Mutasi Barang dengan menambahkan:
1. **Kolom Lokasi Mutasi** - Dropdown dengan opsi: warehouse, pameran, outbound
2. **Kolom Lokasi Penyimpanan** - Input text untuk lokasi penyimpanan

## 🔧 File yang Diubah

### 1. Database Migration
**File**: `supabase/migrations/044_add_storage_location_to_mutation.sql`

**Perubahan**:
- Menambahkan kolom `mutation_location` (TEXT) dengan constraint CHECK
- Menambahkan kolom `storage_location` (TEXT)
- Mengisi nilai default untuk data existing berdasarkan kolom `destination`

**SQL**:
```sql
ALTER TABLE freight_mutation_logs 
ADD COLUMN IF NOT EXISTS mutation_location TEXT CHECK (mutation_location IN ('warehouse', 'pameran', 'outbound')),
ADD COLUMN IF NOT EXISTS storage_location TEXT;
```

### 2. Frontend - Modal Mutasi
**File**: `src/pages/Bridge/GoodsMovement.jsx`

**Perubahan pada Tabel Detail Barang**:

#### Header Tabel (Baris 574-587):
Ditambahkan 2 kolom header baru:
- `NO. URUT` - Urutan item
- `HS CODE` - Kode HS
- `LOKASI MUTASI` - Dropdown lokasi mutasi (highlighted dengan `text-yellow-200`)
- `LOKASI PENYIMPANAN` - Input lokasi penyimpanan (highlighted dengan `text-cyan-200`)

#### Body Tabel (Baris 589-643):
Ditambahkan implementasi kolom:

**Kolom Lokasi Mutasi**:
```jsx
<td className="px-2 py-2 border border-gray-200">
    {isEditMode ? (
        <select
            id="mutationLocationSelect"
            defaultValue={selectedLog.mutationLocation || (isOutbound ? 'outbound' : 'warehouse')}
            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50 capitalize"
        >
            <option value="warehouse">Warehouse</option>
            <option value="pameran">Pameran</option>
            <option value="outbound">Outbound</option>
        </select>
    ) : (
        <span className="text-gray-600 capitalize">
            {selectedLog.mutationLocation || (isOutbound ? 'outbound' : 'warehouse')}
        </span>
    )}
</td>
```

**Kolom Lokasi Penyimpanan**:
```jsx
<td className="px-2 py-2 border border-gray-200">
    {isEditMode ? (
        <input
            type="text"
            id="storageLocationInput"
            defaultValue={selectedLog.storageLocation || ''}
            placeholder="Lokasi penyimpanan"
            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
        />
    ) : (
        <span className="text-gray-500">{selectedLog.storageLocation || '-'}</span>
    )}
</td>
```

#### Handler Function (Baris 117-139):
Diupdate untuk mengambil nilai dari form:
```jsx
const mutationLocation = document.getElementById('mutationLocationSelect')?.value || (isOutbound ? 'outbound' : 'warehouse');
const storageLocation = document.getElementById('storageLocationInput')?.value || '';

const newMutation = {
    // ... existing fields
    mutationLocation: mutationLocation,
    storageLocation: storageLocation
};
```

### 3. Backend - Data Context
**File**: `src/context/DataContext.jsx`

**Perubahan pada `addMutationLog` (Baris 1337-1339)**:
Insert ke Supabase dengan field baru:
```jsx
uom: mutationData.uom || 'pcs',
mutation_location: mutationData.mutationLocation || null,
storage_location: mutationData.storageLocation || null
```

**Perubahan pada Formatting (Baris 1377-1378)**:
Mapping data dari database ke state:
```jsx
uom: savedLog.uom,
mutationLocation: savedLog.mutation_location,
storageLocation: savedLog.storage_location,
createdAt: savedLog.created_at
```

**Perubahan pada Data Loading (Baris 356-357)**:
Mapping saat load data dari database:
```jsx
uom: log.uom || 'pcs',
mutationLocation: log.mutation_location,
storageLocation: log.storage_location,
createdAt: log.created_at
```

## 🎯 Cara Menggunakan

### 1. Apply Migration Database
Jalankan migration SQL di Supabase Dashboard:
```bash
# Buka Supabase Dashboard > SQL Editor
# Copy-paste SQL dari file 044_add_storage_location_to_mutation.sql
# Klik Run
```

### 2. Restart Aplikasi
```bash
npm run dev
```

### 3. Menggunakan Fitur Baru

**Melihat Mutasi**:
1. Buka menu Bridge > Pergerakan Barang
2. Klik pada salah satu baris mutasi
3. Modal akan terbuka menampilkan detail barang
4. Kolom baru "Lokasi Mutasi" dan "Lokasi Penyimpanan" akan terlihat di tabel

**Edit Mutasi** (Mode Edit):
1. Klik tombol "✎ Edit" di header modal
2. Field "Lokasi Mutasi" akan berubah menjadi dropdown
3. Field "Lokasi Penyimpanan" akan berubah menjadi input text
4. Pilih lokasi mutasi dari dropdown:
   - **Warehouse** - Untuk barang di gudang
   - **Pameran** - Untuk barang di pameran
   - **Outbound** - Untuk barang keluar
5. Masukkan lokasi penyimpanan (contoh: "Rak A-1", "Zona B", dll)
6. Klik "💾 Simpan Remutasi"

## 📊 Struktur Database

### Tabel: freight_mutation_logs

| Kolom | Tipe | Constraint | Keterangan |
|-------|------|------------|------------|
| mutation_location | TEXT | CHECK (mutation_location IN ('warehouse', 'pameran', 'outbound')) | Lokasi mutasi barang |
| storage_location | TEXT | - | Lokasi penyimpanan detail |

### Default Values untuk Data Existing:
- Jika `destination = 'warehouse'` atau `'gudang'` → `mutation_location = 'warehouse'`
- Jika `destination LIKE '%pameran%'` → `mutation_location = 'pameran'`
- Lainnya → `mutation_location = 'outbound'`

## 🔄 Flow Supabase

### Create/Update Flow:
```
User Input (Modal Form)
    ↓
handleRemutation() - Extract form values
    ↓
addMutationLog() - Save to state and Supabase
    ↓
Supabase Insert/Update
    ↓
Real-time Sync (if enabled)
    ↓
UI Update
```

### Data Flow:
```
Frontend (camelCase)           Database (snake_case)
--------------------          ---------------------
mutationLocation      →       mutation_location
storageLocation       →       storage_location
```

### Read Flow:
```
Supabase Query
    ↓
Data Mapping (snake_case → camelCase)
    ↓
State Update (setMutationLogs)
    ↓
UI Render
```

## ✅ Testing

### Test Case 1: Create New Mutation
1. Buat mutasi baru dari Warehouse Inventory
2. Pastikan dropdown "Lokasi Mutasi" muncul
3. Pilih lokasi dan isi lokasi penyimpanan
4. Save dan verify data tersimpan di database

### Test Case 2: Edit Existing Mutation
1. Buka modal mutasi existing
2. Klik Edit
3. Ubah lokasi mutasi dan lokasi penyimpanan
4. Save dan verify perubahan

### Test Case 3: View Mode
1. Buka modal mutasi (tanpa edit)
2. Pastikan lokasi mutasi dan lokasi penyimpanan ditampilkan dengan benar
3. Nilai default harus sesuai dengan data di database

### SQL Verification:
```sql
-- Check new columns
SELECT 
    pengajuan_number,
    item_name,
    mutation_location,
    storage_location,
    destination
FROM freight_mutation_logs
ORDER BY created_at DESC
LIMIT 10;
```

## 🐛 Troubleshooting

### Error: Column does not exist
**Solution**: Run migration SQL di Supabase Dashboard

### Error: Check constraint violated
**Solution**: Pastikan nilai mutation_location adalah salah satu dari: 'warehouse', 'pameran', 'outbound'

### UI tidak update setelah save
**Solution**: 
1. Check browser console untuk error
2. Verify Supabase insert berhasil
3. Check data mapping di DataContext.jsx

## 📝 Notes

- Kolom ini bersifat **optional** (nullable)
- Dropdown lokasi mutasi memiliki constraint untuk memastikan data konsisten
- Lokasi penyimpanan adalah free text untuk fleksibilitas
- Data existing akan di-update secara otomatis saat migration dijalankan

## 🔗 Related Files

- Migration: `supabase/migrations/044_add_storage_location_to_mutation.sql`
- Frontend: `src/pages/Bridge/GoodsMovement.jsx`
- Context: `src/context/DataContext.jsx`
- Guide: `supabase/migrations/044_MIGRATION_GUIDE.md`
