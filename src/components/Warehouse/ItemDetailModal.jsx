import React, { useState } from 'react';
import { X, Package, TrendingUp, TrendingDown, Plus, FileText } from 'lucide-react';
import Button from '../Common/Button';
import DocumentUploadManager from '../Common/DocumentUploadManager';
import { LOCATION_OPTIONS, DEFAULT_LOCATION } from '../../constants/locationOptions';

const ItemDetailModal = ({ item, onClose, onAddMovement }) => {
    const [showAddMovement, setShowAddMovement] = useState(false);
    const [movementForm, setMovementForm] = useState({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        quantity: '',
        movementType: 'out',
        origin: 'Gudang',
        destination: DEFAULT_LOCATION,
        condition: item.condition || 'new',
        pic: '',
        notes: '',
        documents: []
    });
    const locationOptions = LOCATION_OPTIONS;

    const handleAddMovement = (e) => {
        e.preventDefault();

        const quantity = parseInt(movementForm.quantity);

        // Validation
        if (!quantity || quantity <= 0) {
            alert('❌ Quantity harus lebih dari 0');
            return;
        }

        if (!movementForm.pic.trim()) {
            alert('❌ PIC wajib diisi');
            return;
        }

        // Validate quantity doesn't exceed available stock
        if (movementForm.movementType === 'out' && quantity > (item.currentStock || 0)) {
            alert(`❌ Quantity melebihi stock tersedia!\n\nStock tersedia: ${item.currentStock || 0}\nYang diminta: ${quantity}`);
            return;
        }

        // Calculate remaining stock
        const previousStock = item.currentStock || 0;
        const remainingStock = movementForm.movementType === 'in'
            ? previousStock + quantity
            : previousStock - quantity;

        // Submit movement
        onAddMovement(item.id, {
            ...movementForm,
            quantity: quantity,
            position: movementForm.destination // Use destination as final position
        });

        // Reset form
        setMovementForm({
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            quantity: '',
            movementType: 'out',
            origin: 'Gudang',
            destination: DEFAULT_LOCATION,
            condition: item.condition || 'new',
            pic: '',
            notes: '',
            documents: []
        });
        setShowAddMovement(false);

        alert(`✅ Movement berhasil ditambahkan!\n\n📊 Detail:\nStock sebelumnya: ${previousStock}\nMutasi: ${movementForm.movementType === 'in' ? '+' : '-'}${quantity}\nSisa stock: ${remainingStock}\nDari: ${movementForm.origin}\nKe: ${movementForm.destination}`);
    };

    const movements = item.movements || [];
    const totalValue = (item.value || 0) * (item.currentStock || item.quantity || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="glass-card rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
                {/* Header */}
                <div className="sticky top-0 bg-dark-surface p-6 border-b border-dark-border z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">{item.itemName || item.assetName}</h2>
                        <p className="text-sm text-silver-dark mt-1">
                            SN: {item.serialNumber} | Package: {item.packageNumber}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-dark-border rounded">
                        <X className="w-6 h-6 text-silver" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Item Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-sm text-silver-dark">Stock Saat Ini</p>
                            <p className="text-2xl font-bold text-accent-blue">{item.currentStock || item.quantity || 0}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-sm text-silver-dark">Nilai Satuan</p>
                            <p className="text-lg font-semibold text-accent-green">Rp {(item.value || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-sm text-silver-dark">Total Nilai</p>
                            <p className="text-lg font-semibold text-accent-green">Rp {totalValue.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-sm text-silver-dark">Kondisi</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${item.condition === 'new' ? 'bg-green-500/20 text-green-400' :
                                    item.condition === 'used' ? 'bg-blue-500/20 text-blue-400' :
                                        item.condition === 'damaged' ? 'bg-red-500/20 text-red-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                {item.condition || 'new'}
                            </span>
                        </div>
                    </div>

                    {/* Movement History */}
                    <div className="glass-card p-6 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-silver-light">Riwayat Mutasi Barang</h3>
                            <Button size="sm" icon={Plus} onClick={() => setShowAddMovement(!showAddMovement)}>
                                Tambah Mutasi
                            </Button>
                        </div>

                        {/* Add Movement Form */}
                        {showAddMovement && (
                            <form onSubmit={handleAddMovement} className="mb-6 p-4 bg-dark-surface rounded-lg space-y-4">
                                <h4 className="font-semibold text-silver-light mb-3">Tambah Mutasi Barang</h4>

                                {/* Stock Info */}
                                <div className="p-3 bg-accent-blue bg-opacity-10 border border-accent-blue rounded-lg">
                                    <p className="text-sm text-silver">
                                        <span className="font-semibold">Stock Tersedia:</span> {item.currentStock || 0} unit
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Date */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Tanggal *</label>
                                        <input
                                            type="date"
                                            value={movementForm.date}
                                            onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            required
                                        />
                                    </div>

                                    {/* Time */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Jam *</label>
                                        <input
                                            type="time"
                                            value={movementForm.time}
                                            onChange={(e) => setMovementForm({ ...movementForm, time: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            required
                                        />
                                    </div>

                                    {/* Movement Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Jenis Mutasi *</label>
                                        <select
                                            value={movementForm.movementType}
                                            onChange={(e) => setMovementForm({ ...movementForm, movementType: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        >
                                            <option value="in">Masuk</option>
                                            <option value="out">Keluar</option>
                                        </select>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Jumlah *</label>
                                        <input
                                            type="number"
                                            value={movementForm.quantity}
                                            onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            min="1"
                                            max={movementForm.movementType === 'out' ? item.currentStock || 0 : undefined}
                                            required
                                        />
                                        {movementForm.quantity && movementForm.movementType === 'out' && parseInt(movementForm.quantity) > (item.currentStock || 0) && (
                                            <p className="text-xs text-red-400 mt-1">⚠️ Melebihi stock tersedia!</p>
                                        )}
                                    </div>

                                    {/* Origin */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Asal *</label>
                                        <select
                                            value={movementForm.origin}
                                            onChange={(e) => setMovementForm({ ...movementForm, origin: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        >
                                            {locationOptions.map(opt => (
                                                <option key={`origin-${opt.value}`} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Destination */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Tujuan *</label>
                                        <select
                                            value={movementForm.destination}
                                            onChange={(e) => setMovementForm({ ...movementForm, destination: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        >
                                            {locationOptions.map(opt => (
                                                <option key={`dest-${opt.value}`} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Condition */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">Kondisi</label>
                                        <select
                                            value={movementForm.condition}
                                            onChange={(e) => setMovementForm({ ...movementForm, condition: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        >
                                            <option value="new">New</option>
                                            <option value="used">Used</option>
                                            <option value="refurbished">Refurbished</option>
                                            <option value="damaged">Damaged</option>
                                        </select>
                                    </div>

                                    {/* PIC */}
                                    <div>
                                        <label className="block text-sm font-medium text-silver mb-2">PIC *</label>
                                        <input
                                            type="text"
                                            value={movementForm.pic}
                                            onChange={(e) => setMovementForm({ ...movementForm, pic: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                            placeholder="Nama PIC"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Remaining Stock Preview */}
                                {movementForm.quantity && (
                                    <div className="p-3 bg-accent-green bg-opacity-10 border border-accent-green rounded-lg">
                                        <p className="text-sm text-silver">
                                            <span className="font-semibold">Sisa Stock Setelah Mutasi:</span>{' '}
                                            <span className="text-accent-green font-bold text-lg">
                                                {movementForm.movementType === 'in'
                                                    ? (item.currentStock || 0) + parseInt(movementForm.quantity || 0)
                                                    : (item.currentStock || 0) - parseInt(movementForm.quantity || 0)
                                                } unit
                                            </span>
                                        </p>
                                        <p className="text-xs text-silver-dark mt-1">
                                            Dari: <span className="capitalize">{movementForm.origin}</span> → Ke: <span className="capitalize">{movementForm.destination}</span>
                                        </p>
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Keterangan</label>
                                    <textarea
                                        value={movementForm.notes}
                                        onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        rows={2}
                                        placeholder="Keterangan mutasi..."
                                    />
                                </div>

                                <DocumentUploadManager
                                    documents={movementForm.documents}
                                    onChange={(docs) => setMovementForm({ ...movementForm, documents: docs })}
                                    maxFiles={5}
                                    maxSizeKB={100}
                                    label="Dokumen Pendukung"
                                />

                                <div className="flex justify-end gap-3">
                                    <Button type="button" variant="secondary" onClick={() => setShowAddMovement(false)}>
                                        Batal
                                    </Button>
                                    <Button type="submit" icon={Plus}>
                                        Tambah Mutasi
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Movement Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-accent-blue">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Tanggal</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Jam</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Jenis</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Jumlah</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Asal</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Tujuan</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Kondisi</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Sisa Stock</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">PIC</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-white">Ket.</th>
                                        <th className="px-3 py-2 text-center text-xs font-semibold text-white">Dok</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {movements.map((mov, idx) => (
                                        <tr key={mov.id || idx} className="hover:bg-dark-surface">
                                            <td className="px-3 py-2 text-xs text-silver">
                                                {new Date(mov.date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-silver">{mov.time}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    {mov.movementType === 'in' ? (
                                                        <TrendingUp className="w-3 h-3 text-green-400" />
                                                    ) : (
                                                        <TrendingDown className="w-3 h-3 text-red-400" />
                                                    )}
                                                    <span className="text-xs text-silver">
                                                        {mov.movementType === 'in' ? 'Masuk' : 'Keluar'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-xs font-medium text-accent-blue">
                                                {mov.movementType === 'in' ? '+' : '-'}{mov.quantity}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-silver capitalize">{mov.origin || mov.position || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-silver capitalize">{mov.destination || mov.position || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-silver capitalize">{mov.condition}</td>
                                            <td className="px-3 py-2 text-xs font-bold text-accent-green">{mov.remainingStock}</td>
                                            <td className="px-3 py-2 text-xs text-silver">{mov.pic}</td>
                                            <td className="px-3 py-2 text-xs text-silver-dark max-w-xs truncate">{mov.notes}</td>
                                            <td className="px-3 py-2 text-center">
                                                {mov.documents && mov.documents.length > 0 && (
                                                    <span className="text-xs text-accent-purple">
                                                        <FileText className="w-3 h-3 inline" /> {mov.documents.length}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {movements.length === 0 && (
                            <div className="text-center py-8">
                                <Package className="w-12 h-12 text-silver-dark mx-auto mb-2" />
                                <p className="text-silver-dark text-sm">Belum ada mutasi barang</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemDetailModal;
