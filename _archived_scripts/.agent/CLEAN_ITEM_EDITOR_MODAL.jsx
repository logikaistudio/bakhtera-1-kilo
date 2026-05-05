// CLEAN UI - Item Editor Modal
// Replace entire modal code (line 1563-1663) dengan ini:

{/* Item Editor Modal */ }
{
    showItemEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
            <div className="bg-gradient-to-br from-accent-purple to-accent-blue rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                {/* Header - Blue Solid */}
                <div className="bg-accent-purple p-6 relative">
                    <h2 className="text-2xl font-bold text-white">Edit Pilihan Barang Keluar</h2>
                    <button
                        onClick={() => setShowItemEditor(false)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="bg-dark-surface p-6 overflow-y-auto max-h-[70vh] space-y-6">
                    {/* Info Summary Card - White/Light Background */}
                    <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl shadow-md">
                        <div className="grid grid-cols-3 gap-6 text-sm">
                            <div>
                                <p className="text-gray-500 font-medium mb-1">Total Package</p>
                                <p className="text-2xl font-bold text-accent-purple">
                                    {editablePackages.filter(pkg => pkg.items.some(i => (i.quantity || 0) > 0)).length}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 font-medium mb-1">Total Item</p>
                                <p className="text-2xl font-bold text-accent-purple">
                                    {editablePackages.reduce((sum, pkg) => sum + pkg.items.filter(i => (i.quantity || 0) > 0).length, 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 font-medium mb-1">Total Quantity</p>
                                <p className="text-2xl font-bold text-accent-purple">
                                    {editablePackages.reduce((sum, pkg) => sum + pkg.items.reduce((itemSum, i) => itemSum + (i.quantity || 0), 0), 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detail Items Section */}
                    {editablePackages.map((pkg, pkgIndex) => {
                        const activeItems = pkg.items.filter(item => (item.quantity || 0) > 0);
                        if (activeItems.length === 0) return null;

                        return (
                            <div key={pkgIndex} className="space-y-3">
                                {/* Package Header */}
                                <div className="bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 px-4 py-2 rounded-lg">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Kode Packing: {pkg.packageNumber}
                                    </h3>
                                </div>

                                {/* Items Table - White Background */}
                                <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-accent-blue">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">NO.</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">KODE BARANG</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">NAMA ITEM</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">TERSEDIA</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">QTY KELUAR</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">AKSI</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {pkg.items.map((item, itemIndex) => {
                                                if ((item.quantity || 0) === 0) return null;
                                                const maxQty = item.availableQty || item.quantity || 0;
                                                const displayIndex = pkg.items.filter((_, idx) => idx <= itemIndex && (pkg.items[idx].quantity || 0) > 0).length;

                                                return (
                                                    <tr key={itemIndex} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{displayIndex}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.itemCode}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">{item.name || item.itemName}</td>
                                                        <td className="px-4 py-3 text-sm text-center">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                                                {maxQty}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={maxQty}
                                                                value={item.quantity || 0}
                                                                onChange={(e) => handleItemQuantityChange(pkgIndex, itemIndex, e.target.value)}
                                                                className="w-24 px-3 py-2 text-center border-2 border-gray-300 rounded-lg text-gray-900 font-semibold focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20 transition-all"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => handleRemoveItem(pkgIndex, itemIndex)}
                                                                className="inline-flex items-center justify-center p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
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
                </div>

                {/* Footer */}
                <div className="bg-dark-surface px-6 py-4 flex justify-end gap-3 border-t border-dark-border">
                    <Button variant="secondary" onClick={() => setShowItemEditor(false)}>
                        Batal
                    </Button>
                    <Button variant="primary" icon={CheckCircle} onClick={handleConfirmEditedItems}>
                        Konfirmasi Pilihan
                    </Button>
                </div>
            </div>
        </div>
    )
}
