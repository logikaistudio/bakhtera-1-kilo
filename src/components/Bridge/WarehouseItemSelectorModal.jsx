import React, { useState, useMemo, useEffect } from 'react';
import { X, Package, Check, AlertCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../Common/Button';

/**
 * WarehouseItemSelectorModal - Simple table-based modal for selecting items from warehouse
 * 
 * Columns:
 * - Jenis Item (name + code)
 * - Stok Awal (warehouse quantity)
 * - Stok Pameran (exhibition stock from mutations)
 * - Stok Tersedia (available = awal - pameran)
 * - Qty Keluar (input - cannot exceed available)
 * - Sisa Stok (remaining = available - qty keluar)
 * - Keterangan (notes)
 */
const WarehouseItemSelectorModal = ({
    isOpen,
    onClose,
    sourceItems = [],
    selectedItems = [],
    onApply,
    sourcePengajuanNumber = ''
}) => {
    const { mutationLogs = [] } = useData();

    // Local state for items with outbound quantity
    const [itemsData, setItemsData] = useState([]);

    // Initialize items data when modal opens
    useEffect(() => {
        if (isOpen && sourceItems.length > 0) {
            // Flatten packages to items with stock calculations
            const flatItems = [];

            sourceItems.forEach(pkg => {
                (pkg.items || []).forEach(item => {
                    const totalStock = item.quantity || item.initialQuantity || 0;
                    const pameranStock = getPameranStock(item.itemCode, pkg.packageNumber);
                    const availableStock = Math.max(0, totalStock - pameranStock);

                    // Check if item exists in selectedItems
                    const selectedPkg = selectedItems.find(p => p.id === pkg.id);
                    const selectedItem = selectedPkg?.items?.find(i => i.id === item.id);
                    const existingOutboundQty = selectedItem?.outboundQuantity || 0;

                    flatItems.push({
                        ...item,
                        packageId: pkg.id,
                        packageNumber: pkg.packageNumber,
                        totalStock,
                        pameranStock,
                        availableStock,
                        outboundQuantity: existingOutboundQty || availableStock,
                        notes: item.notes || ''
                    });
                });
            });

            setItemsData(flatItems);
        }
    }, [isOpen, sourceItems, selectedItems]);

    // Calculate pameran stock for an item
    const getPameranStock = (itemCode, packageNumber) => {
        if (!sourcePengajuanNumber || !mutationLogs.length) return 0;

        const normalize = (str) => (str || '').toLowerCase().trim();

        const outboundMutations = mutationLogs.filter(m =>
            normalize(m.pengajuanNumber) === normalize(sourcePengajuanNumber) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true) &&
            (m.destination || '').toLowerCase() !== 'warehouse' &&
            (m.destination || '').toLowerCase() !== 'gudang'
        );

        const returnMutations = mutationLogs.filter(m =>
            normalize(m.pengajuanNumber) === normalize(sourcePengajuanNumber) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true) &&
            ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
        );

        const totalOut = outboundMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);
        const totalReturn = returnMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);

        return Math.max(0, totalOut - totalReturn);
    };

    // Update outbound quantity for an item
    const updateOutboundQty = (itemId, qty) => {
        setItemsData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const validQty = Math.min(Math.max(0, qty), item.availableStock);
            return { ...item, outboundQuantity: validQty };
        }));
    };

    // Update notes for an item
    const updateNotes = (itemId, notes) => {
        setItemsData(prev => prev.map(item =>
            item.id === itemId ? { ...item, notes } : item
        ));
    };

    // Calculate summary
    const summary = useMemo(() => {
        const totalItems = itemsData.filter(i => i.outboundQuantity > 0).length;
        const totalQty = itemsData.reduce((sum, i) => sum + (i.outboundQuantity || 0), 0);
        return { totalItems, totalQty };
    }, [itemsData]);

    // Handle apply
    const handleApply = () => {
        // Convert flat items back to packages structure
        const packagesMap = {};

        itemsData.forEach(item => {
            if (item.outboundQuantity > 0) {
                if (!packagesMap[item.packageId]) {
                    packagesMap[item.packageId] = {
                        id: item.packageId,
                        packageNumber: item.packageNumber,
                        items: []
                    };
                }
                packagesMap[item.packageId].items.push({
                    ...item,
                    quantity: item.totalStock, // Keep original quantity
                    outboundQuantity: item.outboundQuantity
                });
            }
        });

        const packages = Object.values(packagesMap);

        if (packages.length === 0) {
            alert('⚠️ Pilih minimal 1 item dengan qty > 0');
            return;
        }

        onApply(packages);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="absolute inset-4 md:inset-8 bg-dark-bg rounded-xl shadow-2xl flex flex-col overflow-hidden border border-dark-border">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-accent-purple to-accent-blue border-b border-dark-border">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-white" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Edit Pilihan Barang Keluar</h2>
                            <p className="text-xs text-white/70">Sumber: {sourcePengajuanNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Info Banner */}
                <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-blue-300">
                        Masukkan jumlah barang yang akan dikeluarkan pada kolom "Qty Keluar".
                        Maksimum = Stok Tersedia (Stok Awal - Stok Pameran)
                    </span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-dark-surface border-b-2 border-accent-purple">
                                <th className="px-3 py-3 text-left text-xs font-bold text-silver-light uppercase">Package</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-silver-light uppercase">Jenis Item</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-silver-light uppercase bg-gray-700/50">Stok Awal</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-orange-400 uppercase bg-orange-500/10">Stok Pameran</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-green-400 uppercase bg-green-500/10">Stok Tersedia</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-accent-purple uppercase bg-accent-purple/10" style={{ minWidth: '100px' }}>Qty Keluar</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-blue-400 uppercase bg-blue-500/10">Sisa Stok</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-silver-light uppercase" style={{ minWidth: '150px' }}>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {itemsData.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-silver-dark">
                                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>Tidak ada item tersedia</p>
                                    </td>
                                </tr>
                            ) : (
                                itemsData.map((item, idx) => {
                                    const sisaStok = item.availableStock - (item.outboundQuantity || 0);
                                    const hasWarning = item.outboundQuantity > item.availableStock;

                                    return (
                                        <tr
                                            key={item.id || idx}
                                            className={`hover:bg-dark-surface/50 transition-colors ${item.availableStock === 0 ? 'opacity-50' : ''}`}
                                        >
                                            {/* Package */}
                                            <td className="px-3 py-2">
                                                <span className="px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded">
                                                    {item.packageNumber}
                                                </span>
                                            </td>

                                            {/* Jenis Item */}
                                            <td className="px-3 py-2">
                                                <div>
                                                    <p className="font-medium text-silver-light">{item.name || item.itemName}</p>
                                                    <p className="text-xs text-silver-dark">{item.itemCode}</p>
                                                </div>
                                            </td>

                                            {/* Stok Awal */}
                                            <td className="px-3 py-2 text-center bg-gray-700/20">
                                                <span className="font-bold text-silver">{item.totalStock}</span>
                                            </td>

                                            {/* Stok Pameran */}
                                            <td className="px-3 py-2 text-center bg-orange-500/5">
                                                <span className={`font-bold ${item.pameranStock > 0 ? 'text-orange-400' : 'text-silver-dark'}`}>
                                                    {item.pameranStock}
                                                </span>
                                            </td>

                                            {/* Stok Tersedia */}
                                            <td className="px-3 py-2 text-center bg-green-500/5">
                                                <span className={`font-bold ${item.availableStock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {item.availableStock}
                                                </span>
                                            </td>

                                            {/* Qty Keluar - INPUT */}
                                            <td className="px-3 py-2 text-center bg-accent-purple/5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.availableStock}
                                                    value={item.outboundQuantity || 0}
                                                    onChange={(e) => updateOutboundQty(item.id, parseInt(e.target.value) || 0)}
                                                    disabled={item.availableStock === 0}
                                                    className={`w-20 px-2 py-1 text-center bg-dark-bg border rounded text-sm font-bold focus:outline-none focus:ring-2 
                                                        ${hasWarning
                                                            ? 'border-red-500 text-red-400 focus:ring-red-500'
                                                            : 'border-accent-purple text-accent-purple focus:ring-accent-purple'
                                                        }
                                                        disabled:opacity-50 disabled:cursor-not-allowed`}
                                                />
                                            </td>

                                            {/* Sisa Stok */}
                                            <td className="px-3 py-2 text-center bg-blue-500/5">
                                                <span className={`font-bold ${sisaStok >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                    {sisaStok}
                                                </span>
                                            </td>

                                            {/* Keterangan */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.notes || ''}
                                                    onChange={(e) => updateNotes(item.id, e.target.value)}
                                                    placeholder="Keterangan..."
                                                    className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs text-silver focus:outline-none focus:border-accent-blue"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Summary */}
                <div className="px-6 py-4 border-t border-dark-border bg-dark-surface/50 flex items-center justify-between">
                    <div className="flex gap-6 text-sm">
                        <span className="text-silver-dark">
                            Total Item Keluar: <span className="text-accent-purple font-bold">{summary.totalItems}</span>
                        </span>
                        <span className="text-silver-dark">
                            Total Qty Keluar: <span className="text-accent-green font-bold">{summary.totalQty}</span>
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose}>
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleApply}
                            disabled={summary.totalItems === 0}
                            icon={Check}
                        >
                            Terapkan Pilihan
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseItemSelectorModal;
