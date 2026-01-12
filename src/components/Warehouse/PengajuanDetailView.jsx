import React, { useState } from 'react';
import { X, Package, Edit2, ArrowRightLeft, FileText, Calendar, Clock, User } from 'lucide-react';
import Button from '../Common/Button';
import DocumentUploadManager from '../Common/DocumentUploadManager';

const PengajuanDetailView = ({ pengajuan, onClose, onSubmitMutations, onUpdatePengajuan }) => {
    const [mode, setMode] = useState('view'); // 'view' or 'mutasi'
    const [mutations, setMutations] = useState({});
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        location: {
            room: '',
            rack: '',
            slot: ''
        },
        remarks: ''
    });

    // Initialize mutation data for each item
    const initializeMutation = (itemId) => {
        if (!mutations[itemId]) {
            setMutations(prev => ({
                ...prev,
                [itemId]: {
                    status: 'tetap',
                    origin: 'gudang',
                    destination: 'pameran',
                    quantity: '',
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    pic: '',
                    remarks: '',
                    documents: []
                }
            }));
        }
    };

    const updateMutation = (itemId, field, value) => {
        setMutations(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSubmitMutations = () => {
        const activeMutations = Object.entries(mutations)
            .filter(([_, data]) => data.status === 'mutasi' && data.quantity > 0)
            .map(([itemId, data]) => {
                // Find the actual item to get its details
                const item = allItems.find(i => (i.id || `${i.packageNumber}-${allItems.indexOf(i)}`) === itemId);

                return {
                    itemId,
                    itemName: item?.itemName,
                    serialNumber: item?.serialNumber,
                    ...data
                };
            });

        if (activeMutations.length === 0) {
            alert('⚠️ Tidak ada mutasi yang dipilih');
            return;
        }

        // Validate
        for (const mut of activeMutations) {
            if (!mut.pic.trim()) {
                alert('❌ PIC wajib diisi untuk semua mutasi');
                return;
            }
        }

        console.log('🚀 Submitting mutations:', activeMutations);
        onSubmitMutations(activeMutations);
        alert(`✅ ${activeMutations.length} mutasi berhasil disubmit!`);
        setMode('view');
        setMutations({});
    };

    const handleOpenEditModal = () => {
        // Get first item's location as default (all items should have same warehouse location)
        const firstItem = pengajuan.packages?.[0]?.items?.[0];
        const currentLocation = typeof firstItem?.location === 'object'
            ? firstItem.location
            : { room: '', rack: '', slot: '' };

        setEditForm({
            location: {
                room: currentLocation.room || '',
                rack: currentLocation.rack || '',
                slot: currentLocation.slot || ''
            },
            remarks: pengajuan.remarks || pengajuan.notes || ''
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (onUpdatePengajuan) {
            onUpdatePengajuan({
                location: editForm.location,
                remarks: editForm.remarks
            });
            alert('✅ Perubahan berhasil disimpan!');
            setShowEditModal(false);
        } else {
            alert('⚠️ Fungsi update belum terhubung');
        }
    };

    const locationOptions = [
        { value: 'gudang', label: 'Gudang' },
        { value: 'pameran', label: 'Pameran' },
        { value: 'supplier', label: 'Supplier' },
        { value: 'customer', label: 'Customer' },
        { value: 'barang_habis_rusak', label: 'Barang Habis/Rusak' },
        { value: 'lainnya', label: 'Lainnya' }
    ];

    const allItems = pengajuan.packages?.flatMap(pkg =>
        pkg.items.map(item => ({ ...item, packageNumber: pkg.packageNumber, packageDescription: pkg.description }))
    ) || [];

    // Calculate stock summary
    const totalStock = allItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const mutatedStock = Object.entries(mutations)
        .filter(([_, data]) => data.status === 'mutasi' && data.quantity > 0)
        .reduce((sum, [_, data]) => sum + parseInt(data.quantity || 0), 0);
    const remainingStock = totalStock - mutatedStock;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
            <div className="glass-card rounded-lg max-w-7xl w-full max-h-[95vh] overflow-y-auto my-4">
                {/* Header */}
                <div className="sticky top-0 bg-dark-surface p-6 border-b border-dark-border z-10">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold gradient-text mb-2">Detail Pengajuan</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                <div>
                                    <p className="text-xs text-silver-dark">No. Pengajuan</p>
                                    <p className="text-sm font-semibold text-silver-light">{pengajuan.quotationNumber}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-silver-dark">Tanggal Pengajuan</p>
                                    <p className="text-sm font-semibold text-silver-light">
                                        {new Date(pengajuan.submissionDate || pengajuan.date).toLocaleDateString('id-ID')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-silver-dark">No. Dokumen Pabean</p>
                                    <p className="text-sm font-semibold text-accent-blue">{pengajuan.bcDocumentNumber || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-silver-dark">Tanggal Dokumen</p>
                                    <p className="text-sm font-semibold text-silver-light">
                                        {pengajuan.bcDocumentDate ? new Date(pengajuan.bcDocumentDate).toLocaleDateString('id-ID') : '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-xs text-silver-dark">Judul</p>
                                <p className="text-base font-semibold text-silver-light">{pengajuan.title || pengajuan.customer}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-dark-border rounded ml-4">
                            <X className="w-6 h-6 text-silver" />
                        </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-3 mt-6">
                        <Button
                            variant={mode === 'view' ? 'primary' : 'secondary'}
                            onClick={() => setMode('view')}
                            size="sm"
                        >
                            View Mode
                        </Button>
                        <Button
                            variant={mode === 'mutasi' ? 'primary' : 'secondary'}
                            onClick={() => setMode('mutasi')}
                            icon={ArrowRightLeft}
                            size="sm"
                        >
                            Mutasi Mode
                        </Button>
                        {mode === 'view' && (
                            <Button
                                variant="secondary"
                                icon={Edit2}
                                size="sm"
                                onClick={handleOpenEditModal}
                            >
                                Edit
                            </Button>
                        )}
                        {mode === 'mutasi' && (
                            <Button
                                onClick={handleSubmitMutations}
                                size="sm"
                            >
                                Submit Mutasi
                            </Button>
                        )}
                    </div>

                    {/* Stock Summary - Only in Mutasi Mode */}
                    {mode === 'mutasi' && (
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="glass-card p-4 rounded-lg border border-accent-blue">
                                <p className="text-xs text-silver-dark">Total Barang</p>
                                <p className="text-2xl font-bold text-accent-blue">{totalStock}</p>
                                <p className="text-xs text-silver-dark mt-1">unit</p>
                            </div>
                            <div className="glass-card p-4 rounded-lg border border-accent-orange">
                                <p className="text-xs text-silver-dark">Mutasi Barang</p>
                                <p className="text-2xl font-bold text-accent-orange">{mutatedStock}</p>
                                <p className="text-xs text-silver-dark mt-1">unit akan dimutasi</p>
                            </div>
                            <div className="glass-card p-4 rounded-lg border border-accent-green">
                                <p className="text-xs text-silver-dark">Sisa Barang</p>
                                <p className="text-2xl font-bold text-accent-green">{remainingStock}</p>
                                <p className="text-xs text-silver-dark mt-1">unit tetap di gudang</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {pengajuan.packages?.map((pkg, pkgIdx) => (
                        <div key={pkg.id || pkgIdx} className="glass-card p-6 rounded-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <Package className="w-5 h-5 text-accent-purple" />
                                <div>
                                    <h3 className="text-lg font-semibold text-silver-light">{pkg.packageNumber}</h3>
                                    <p className="text-sm text-silver-dark">{pkg.description}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-dark-surface">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-silver">Nama Item</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-silver">Serial Number</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-silver">Kondisi</th>
                                            {mode === 'mutasi' && (
                                                <>
                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-accent-blue">Total</th>
                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-accent-orange">Mutasi</th>
                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-accent-green">Sisa</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-silver">Status</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-silver">Aksi</th>
                                                </>
                                            )}
                                            {mode === 'view' && (
                                                <th className="px-3 py-2 text-center text-xs font-semibold text-silver">Jumlah</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {pkg.items.map((item, itemIdx) => {
                                            const itemId = item.id || `${pkg.id}-${itemIdx}`;
                                            const mutationData = mutations[itemId] || {};
                                            const mutationQty = parseInt(mutationData.quantity || 0);
                                            const remainingQty = item.quantity - mutationQty;

                                            if (!mutations[itemId]) {
                                                initializeMutation(itemId);
                                            }

                                            return (
                                                <React.Fragment key={itemId}>
                                                    <tr className="hover:bg-dark-surface">
                                                        <td className="px-3 py-3 text-sm text-silver-light font-medium">{item.itemName}</td>
                                                        <td className="px-3 py-3 text-sm text-silver">{item.serialNumber}</td>
                                                        <td className="px-3 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs ${item.condition === 'new' ? 'bg-green-500/20 text-green-400' :
                                                                item.condition === 'used' ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-yellow-500/20 text-yellow-400'
                                                                }`}>
                                                                {item.condition}
                                                            </span>
                                                        </td>

                                                        {mode === 'mutasi' && (
                                                            <>
                                                                {/* Total Stock */}
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className="text-sm font-semibold text-accent-blue">
                                                                        {item.quantity}
                                                                    </span>
                                                                </td>

                                                                {/* Mutasi Quantity */}
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`text-sm font-semibold ${mutationData.status === 'mutasi' && mutationQty > 0
                                                                        ? 'text-accent-orange'
                                                                        : 'text-silver-dark'
                                                                        }`}>
                                                                        {mutationData.status === 'mutasi' ? mutationQty : 0}
                                                                    </span>
                                                                </td>

                                                                {/* Remaining Stock */}
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`text-sm font-semibold ${mutationData.status === 'mutasi' && mutationQty > 0
                                                                        ? 'text-accent-green'
                                                                        : 'text-silver'
                                                                        }`}>
                                                                        {remainingQty}
                                                                    </span>
                                                                </td>

                                                                {/* Status Dropdown */}
                                                                <td className="px-3 py-3">
                                                                    <select
                                                                        value={mutationData.status || 'tetap'}
                                                                        onChange={(e) => updateMutation(itemId, 'status', e.target.value)}
                                                                        className="px-2 py-1 bg-dark-surface border border-dark-border rounded text-sm text-silver-light"
                                                                    >
                                                                        <option value="tetap">Tetap</option>
                                                                        <option value="mutasi">Mutasi</option>
                                                                    </select>
                                                                </td>

                                                                {/* Action Button */}
                                                                <td className="px-3 py-3">
                                                                    {mutationData.status === 'mutasi' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                const currentExpanded = mutationData.expanded;
                                                                                updateMutation(itemId, 'expanded', !currentExpanded);
                                                                            }}
                                                                            className="text-xs text-accent-blue hover:underline"
                                                                        >
                                                                            {mutationData.expanded ? 'Tutup' : 'Atur Mutasi →'}
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </>
                                                        )}

                                                        {mode === 'view' && (
                                                            <td className="px-3 py-3 text-sm text-silver text-center">{item.quantity}</td>
                                                        )}
                                                    </tr>

                                                    {/* Mutation Form Row */}
                                                    {mode === 'mutasi' && mutationData.status === 'mutasi' && mutationData.expanded && (
                                                        <tr>
                                                            <td colSpan="6" className="px-3 py-4 bg-dark-bg">
                                                                <div className="p-4 bg-dark-surface rounded-lg space-y-4">
                                                                    <h4 className="text-sm font-semibold text-silver-light mb-3">Form Mutasi - {item.itemName}</h4>

                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                                        <div>
                                                                            <label className="block text-xs text-silver-dark mb-1">Asal *</label>
                                                                            <select
                                                                                value={mutationData.origin || 'gudang'}
                                                                                onChange={(e) => updateMutation(itemId, 'origin', e.target.value)}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                            >
                                                                                {locationOptions.map(opt => (
                                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-silver-dark mb-1">Tujuan *</label>
                                                                            <select
                                                                                value={mutationData.destination || 'pameran'}
                                                                                onChange={(e) => updateMutation(itemId, 'destination', e.target.value)}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                            >
                                                                                {locationOptions.map(opt => (
                                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-silver-dark mb-1">Jumlah * (Max: {item.quantity})</label>
                                                                            <input
                                                                                type="number"
                                                                                value={mutationData.quantity || ''}
                                                                                onChange={(e) => updateMutation(itemId, 'quantity', Math.min(parseInt(e.target.value) || 0, item.quantity))}
                                                                                max={item.quantity}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                                placeholder="0"
                                                                            />
                                                                            {mutationData.quantity && (
                                                                                <p className="text-xs text-accent-green mt-1">Sisa: {item.quantity - (parseInt(mutationData.quantity) || 0)}</p>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-silver-dark mb-1">Tanggal *</label>
                                                                            <input
                                                                                type="date"
                                                                                value={mutationData.date || ''}
                                                                                onChange={(e) => updateMutation(itemId, 'date', e.target.value)}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs text-silver-dark mb-1">Jam *</label>
                                                                            <input
                                                                                type="time"
                                                                                value={mutationData.time || ''}
                                                                                onChange={(e) => updateMutation(itemId, 'time', e.target.value)}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                            />
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <label className="block text-xs text-silver-dark mb-1">PIC *</label>
                                                                            <input
                                                                                type="text"
                                                                                value={mutationData.pic || ''}
                                                                                onChange={(e) => updateMutation(itemId, 'pic', e.target.value)}
                                                                                className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                                placeholder="Nama PIC"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Keterangan / Remarks */}
                                                                    <div className="mt-3">
                                                                        <label className="block text-xs text-silver-dark mb-1">Keterangan</label>
                                                                        <textarea
                                                                            value={mutationData.remarks || ''}
                                                                            onChange={(e) => updateMutation(itemId, 'remarks', e.target.value)}
                                                                            className="w-full px-2 py-2 bg-dark-bg border border-dark-border rounded text-sm text-silver-light"
                                                                            placeholder="Catatan tambahan untuk mutasi ini..."
                                                                            rows={2}
                                                                        />
                                                                    </div>

                                                                    <div>
                                                                        <DocumentUploadManager
                                                                            documents={mutationData.documents || []}
                                                                            onChange={(docs) => updateMutation(itemId, 'documents', docs)}
                                                                            maxFiles={10}
                                                                            maxSizeKB={100}
                                                                            label="Dokumen Pendukung"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                    <div className="glass-card rounded-lg p-6 max-w-2xl w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold gradient-text">Edit Pengajuan</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-dark-border rounded">
                                <X className="w-5 h-5 text-silver" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Location Edit */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Lokasi Gudang</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Ruangan</label>
                                        <input
                                            type="text"
                                            value={editForm.location.room}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                location: { ...editForm.location, room: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            placeholder="Ruangan A"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Rak</label>
                                        <input
                                            type="text"
                                            value={editForm.location.rack}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                location: { ...editForm.location, rack: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            placeholder="Rak 01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Slot</label>
                                        <input
                                            type="text"
                                            value={editForm.location.slot}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                location: { ...editForm.location, slot: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            placeholder="Slot 01"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-silver-dark mt-2">Lokasi ini akan diterapkan ke semua item dalam pengajuan</p>
                            </div>

                            {/* Remarks Edit */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Keterangan</label>
                                <textarea
                                    value={editForm.remarks}
                                    onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    rows={4}
                                    placeholder="Tambahkan keterangan untuk pengajuan ini..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSaveEdit}>
                                Simpan Perubahan
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PengajuanDetailView;
