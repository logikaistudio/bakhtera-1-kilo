// ============================================================================
// ITEM EDITOR MODAL - Add this BEFORE the closing </div> and export statement
// Location: End of PengajuanManagement.jsx (around line 1476)
// ============================================================================

{/* Item Editor Modal - NEW */ }
{
    showItemEditor && (
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
    )
}

// ============================================================================
// END OF ITEM EDITOR MODAL
// ============================================================================
