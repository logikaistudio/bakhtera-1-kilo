# Panduan Implementasi: Enhanced Outbound dengan Edit Selection

## ✅ Yang Sudah Selesai

### 1. OutboundInventory.jsx - UI Compact ✅
**File:** `/src/pages/Bridge/OutboundInventory.jsx`

Tabel sudah diubah menjadi lebih compact:
- Padding: `py-3` → `py-1.5` (50% lebih kecil)
- Font: `text-sm` → `text-[11px]` (21% lebih kecil)
- Headers: `font-semibold` → `font-bold`
- All cells: Added `whitespace-nowrap`
- Shorter column names: "Jml Package" → "Pkg", etc.

### 2. State Management ✅
**File:** `/src/pages/Bridge/PengajuanManagement.jsx`

Ditambahkan state baru:
```javascript
const [showItemEditor, setShowItemEditor] = useState(false);
const [editablePackages, setEditablePackages] = useState([]);
```

### 3. Filter Lokasi Gudang ✅
**File:** `/src/pages/Bridge/PengajuanManagement.jsx`

Modified `calculateAvailableStock`:
```javascript
// Only count items that were moved OUT of warehouse
const outboundMutations = mutationLogs.filter(log =>
    (log.pengajuanId === pengajuanId || log.pengajuanNumber === pengajuanNumber) &&
    log.origin === 'Gudang' && // Must be from warehouse
    (log.destination === 'Pameran' || log.destination === 'Keluar TPB') // Moved out
);
```

**Hasil:** Hanya item yang masih ada di **"Gudang"** yang bisa dipilih untuk keluar.

### 4. Handler Functions ✅
**File:** `/src/pages/Bridge/PengajuanManagement.jsx`

Ditambahkan 4 fungsi baru:
1. `handleEditItemSelection()` - Open editor modal
2. `handleConfirmEditedItems()` - Save edited selections
3. `handleItemQuantityChange(pkgIndex, itemIndex, newQty)` - Update quantity
4. `handleRemoveItem(pkgIndex, itemIndex)` - Remove item (set qty to 0)

## 🔄 Yang Perlu Dilengkapi

### 1. UI Button "Edit Pilihan" 
**Lokasi:** Line ~855-877 di PengajuanManagement.jsx

**Perlu ditambahkan:**
```jsx
{sourcePengajuanId ? (
    <div className="space-y-2">
        <div className="flex items-center justify-between bg-dark-surface/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-green" />
                <span className="text-sm text-silver">
                    Sumber: <span className="font-medium text-accent-green">{formData.sourcePengajuanNumber}</span>
                </span>
                <span className="text-xs text-silver-dark">
                    ({formData.packages?.length || 0} package, {formData.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0} item)
                </span>
            </div>
            <div className="flex gap-2">
                {/* NEW BUTTON */}
                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Edit2}
                    onClick={handleEditItemSelection}
                >
                    Edit Pilihan
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                        setSourcePengajuanId(null);
                        setFormData(prev => ({ ...prev, packages: [], sourcePengajuanId: null, sourcePengajuanNumber: null }));
                    }}
                >
                    Ganti
                </Button>
            </div>
        </div>
        {/* Hint text */}
        <p className="text-xs text-silver-dark italic">
            💡 Klik "Edit Pilihan" untuk menyesuaikan item atau quantity yang akan dikeluarkan
        </p>
    </div>
) : (
    // existing button...
)}
```

### 2. Item Editor Modal
**Lokasi:** Akhir file PengajuanManagement.jsx (sebelum closing div & export)

**Perlu ditambahkan:**
```jsx
{/* Item Editor Modal - NEW */}
{showItemEditor && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
        <div className="glass-card rounded-lg max-w-6xl w-full max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-dark-border bg-accent-purple/10">
                <div>
                    <h2 className="text-xl font-bold text-silver-light flex items-center gap-2">
                        <Edit2 className="w-5 h-5" />
                        Edit Pilihan Barang Keluar
                    </h2>
                    <p className="text-xs text-silver-dark mt-1">
                        Sesuaikan item dan quantity yang akan dikeluarkan dari gudang
                    </p>
                </div>
                <button
                    onClick={() => setShowItemEditor(false)}
                    className="text-silver-dark hover:text-silver p-1"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Body - Scrollable */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
                {editablePackages.map((pkg, pkgIndex) => {
                    const activeItems = pkg.items.filter(item => (item.quantity || 0) > 0);
                    if (activeItems.length === 0) return null;

                    return (
                        <div key={pkgIndex} className="glass-card p-4 rounded-lg border border-dark-border">
                            {/* Package Header */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-border">
                                <div>
                                    <h4 className="font-semibold text-silver flex items-center gap-2">
                                        <Package className="w-4 h-4 text-accent-purple" />
                                        Package: {pkg.packageNumber}
                                    </h4>
                                    <p className="text-xs text-silver-dark mt-1">
                                        {activeItems.length} item dipilih
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-dark-surface">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-xs font-bold text-silver">Item Code</th>
                                            <th className="px-2 py-2 text-left text-xs font-bold text-silver">Nama Item</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-silver">Tersedia</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-silver">Qty Keluar</th>
                                            <th className="px-2 py-2 text-center text-xs font-bold text-silver">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {pkg.items.map((item, itemIndex) => {
                                            if ((item.quantity || 0) === 0) return null;
                                            const maxQty = item.availableQty || item.quantity || 0;

                                            return (
                                                <tr key={itemIndex} className="hover:bg-dark-surface/50">
                                                    <td className="px-2 py-2 text-xs font-mono text-silver">{item.itemCode}</td>
                                                    <td className="px-2 py-2 text-xs text-silver">{item.name || item.itemName}</td>
                                                    <td className="px-2 py-2 text-xs text-center text-accent-green font-bold">{maxQty}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={maxQty}
                                                            value={item.quantity || 0}
                                                            onChange={(e) => handleItemQuantityChange(pkgIndex, itemIndex, e.target.value)}
                                                            className="w-20 px-2 py-1 text-center bg-dark-surface border border-dark-border rounded text-silver text-xs"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(pkgIndex, itemIndex)}
                                                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                                                            title="Hapus item ini"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}

                {/* Summary */}
                <div className="glass-card p-4 bg-accent-purple/10 border-2 border-accent-purple rounded-lg">
                    <h4 className="font-semibold text-silver mb-2">📊 Ringkasan</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-silver-dark">Total Package</p>
                            <p className="text-lg font-bold text-accent-purple">
                                {editablePackages.filter(pkg => pkg.items.some(i => (i.quantity || 0) > 0)).length}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Total Item</p>
                            <p className="text-lg font-bold text-accent-purple">
                                {editablePackages.reduce((sum, pkg) => 
                                    sum + pkg.items.filter(i => (i.quantity || 0) > 0).length, 0
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Total Quantity</p>
                            <p className="text-lg font-bold text-accent-purple">
                                {editablePackages.reduce((sum, pkg) => 
                                    sum + pkg.items.reduce((itemSum, i) => itemSum + (i.quantity || 0), 0), 0
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-dark-border bg-dark-surface">
                <Button 
                    variant="secondary" 
                    onClick={() => setShowItemEditor(false)}
                >
                    Batal
                </Button>
                <Button 
                    variant="primary" 
                    icon={CheckCircle}
                    onClick={handleConfirmEditedItems}
                >
                    Konfirmasi Pilihan
                </Button>
            </div>
        </div>
    </div>
)}
```

## 📝 Cara Manual Update

Karena exact matching sulit, berikut langkah manual:

### Langkah 1: Update Button Section (Line ~855-877)
1. Buka `/src/pages/Bridge/PengajuanManagement.jsx`
2. Cari section `{sourcePengajuanId ? (`
3. Wrap existing div dengan div baru dan tambahkan button "Edit Pilihan"
4. Tambahkan hint text di bawahnya

### Langkah 2: Add Modal (Sebelum line terakhir `</div>` dan `export`)
1. Scroll ke akhir file
2. Sebelum closing `</div>` terakhir (line ~1476)
3. Paste seluruh Item Editor Modal code di atas

## 🎯 Hasil Akhir

Setelah selesai, user akan bisa:
1. ✅ Pilih pengajuan inbound dari gudang
2. ✅ Otomatis terisi dengan semua item yang masih di gudang
3. ✅ Klik "Edit Pilihan" untuk membuka editor
4. ✅ Hapus item yang tidak perlu (klik trash icon)
5. ✅ Adjust quantity per item (max = available qty)
6. ✅ Lihat summary real-time
7. ✅ Konfirmasi pilihan
8. ✅ Submit pengajuan dengan item yang sudah dipilih

## ⚠️ Catatan Penting

- **Filter Lokasi:** Hanya item dengan status lokasi "Gudang" yang bisa dipilih
- **Validasi Qty:** Quantity tidak bisa melebihi available qty
- **Remove Item:** Set quantity ke 0 (tidak dihapus dari array)
- **Empty Check:** Minimal 1 item harus dipilih
