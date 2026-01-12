import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Package, User, ArrowRight, Eye, Download, Trash2 } from 'lucide-react'; // Added Trash2
import { useData } from '../../context/DataContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const GoodsMovement = () => {
    const navigate = useNavigate();
    const { mutationLogs = [], addMutationLog, updateMutationLog, updateInventoryStock, deleteMutationLog } = useData(); // Added deleteMutationLog
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Filter mutation logs based on search
    const filteredLogs = mutationLogs.filter(log =>
        log.pengajuanNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.bcDocumentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.pic?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Format location display
    const formatLocation = (origin, destination) => {
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        return `${capitalize(origin)} → ${capitalize(destination)}`;
    };

    // Calculate remutation for a specific mutation log
    const getRemutationInfo = (log) => {
        const isOutbound = log.destination &&
            log.destination.toLowerCase() !== 'warehouse' &&
            log.destination.toLowerCase() !== 'gudang';

        if (!isOutbound) {
            // This IS a remutation (return to warehouse)
            // If user edits this directly, we treat it as updating THIS log
            return { totalRemutated: log.mutatedQty, sisaDiLokasi: 0, maxRemutation: 0, lastRemutationLog: log };
        }

        // For outbound, find related returns
        const relatedRemutations = mutationLogs.filter(m =>
            m.pengajuanNumber === log.pengajuanNumber &&
            m.itemCode === log.itemCode &&
            (m.serialNumber || '') === (log.serialNumber || '') &&
            m.id !== log.id &&
            (m.destination?.toLowerCase() === 'warehouse' || m.destination?.toLowerCase() === 'gudang')
        );
        const totalRemutated = relatedRemutations.reduce((sum, r) => sum + (r.mutatedQty || 0), 0);

        // Find the most recent remutation log to update if needed
        const lastRemutationLog = relatedRemutations.length > 0
            ? relatedRemutations.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0]
            : null;

        // Cap: remutasi tidak boleh lebih dari mutasi
        const cappedRemutated = Math.min(totalRemutated, log.mutatedQty);
        const sisaDiLokasi = Math.max(0, log.mutatedQty - cappedRemutated);
        return { totalRemutated: cappedRemutated, sisaDiLokasi, maxRemutation: sisaDiLokasi, lastRemutationLog };
    };

    // Handle Remutation (Return to Warehouse)
    const handleRemutation = async (log, targetQty, pic, remarks) => {
        const { totalRemutated, maxRemutation: currentMaxRemutation, lastRemutationLog } = getRemutationInfo(log);

        // Calculate delta (Target - Current Total)
        // If target is 3 and current is 5, delta is -2 (Correction/Reduction)
        // If target is 5 and current is 2, delta is +3 (Addition)
        const delta = targetQty - totalRemutated;

        const remutationDate = document.getElementById('remutationDate')?.value || new Date().toISOString().split('T')[0];
        const remutationTime = document.getElementById('remutationTime')?.value || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        if (delta === 0) {
            // Case: Metadata Update Only (PIC, Date, etc.)
            if (!lastRemutationLog) {
                alert('Tidak ada data remutasi yang bisa diedit (belum ada remutasi sebelumnya).');
                return false;
            }

            // Update the LAST remutation log with new metadata
            try {
                const updates = {
                    pic: pic,
                    date: remutationDate,
                    time: remutationTime,
                    remarks: remarks
                };

                await updateMutationLog(lastRemutationLog.id, updates);

                alert('Data remutasi berhasil diperbarui (Info PIC/Tanggal/Keterangan)');
                setSelectedLog(null);
                setIsEditMode(false);
                return true;
            } catch (error) {
                console.error('Error updating remutation metadata:', error);
                alert('Gagal mengupdate data: ' + error.message);
                return false;
            }
        }

        // Validation: Target cannot depend on current stock, but total remutation cannot exceed initial mutated qty
        // And total remutation cannot be negative
        if (targetQty < 0 || targetQty > log.mutatedQty) {
            alert(`Total remutasi harus antara 0 dan ${log.mutatedQty}`);
            return false;
        }

        if (!pic.trim()) {
            alert('PIC Remutasi harus diisi');
            return false;
        }

        // Confirm if it's a correction (negative delta)
        if (delta < 0) {
            const confirm = window.confirm(`Anda akan mengurangi jumlah remutasi sebanyak ${Math.abs(delta)} unit. Lanjutkan?`);
            if (!confirm) return false;
        }

        try {
            const newMutation = {
                pengajuanId: log.pengajuanId,
                pengajuanNumber: log.pengajuanNumber,
                bcDocumentNumber: log.bcDocumentNumber,
                packageNumber: log.packageNumber,
                itemCode: log.itemCode,
                itemName: log.itemName,
                serialNumber: log.serialNumber,
                totalStock: log.totalStock,
                origin: log.destination, // From Project
                destination: 'Warehouse', // To Warehouse
                mutatedQty: delta, // Log the difference (can be negative)
                remainingStock: (currentMaxRemutation - delta), // This field is less relevant for logs but good for tracking
                date: document.getElementById('remutationDate')?.value || new Date().toISOString().split('T')[0],
                time: document.getElementById('remutationTime')?.value || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                pic: pic,
                remarks: remarks || (delta > 0 ? `Remutasi Tambahan: ${delta} unit` : `Koreksi Remutasi: ${delta} unit`),
                condition: 'Baik',
                uom: log.uom || 'pcs'
            };

            await addMutationLog(newMutation);

            // Update inventory stock (accepts negative for corrections)
            await updateInventoryStock(
                log.itemCode,
                log.itemName,
                delta,
                log.uom || 'pcs',
                delta > 0 ? 'remutation' : 'correction',
                `REM-${Date.now()}`
            );

            alert('Data remutasi berhasil diperbarui!');
            setSelectedLog(null);
            setIsEditMode(false);
            return true;
        } catch (error) {
            console.error('Error processing remutation:', error);
            alert('Gagal memproses remutasi: ' + error.message);
            return false;
        }
    };

    // Delete Handler
    const handleDeleteRow = async (e, id) => {
        e.stopPropagation(); // Prevent row click
        if (!window.confirm('Yakin ingin menghapus data mutasi ini secara permanen?\nData yang dihapus tidak dapat dikembalikan.')) return;

        if (deleteMutationLog) {
            try {
                await deleteMutationLog(id);
            } catch (err) {
                console.error(err);
                alert("Gagal menghapus data mutasi");
            }
        }
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pendaftaran' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'bcDocumentNumber', header: 'No. Dokumen' },
            { key: 'itemName', header: 'Nama Item' },
            { key: 'serialNumber', header: 'Serial Number' },
            { key: 'date', header: 'Tanggal' },
            { key: 'time', header: 'Jam' },
            { key: 'pic', header: 'PIC' },
            { key: 'totalStock', header: 'Total Stock' },
            { key: 'mutatedQty', header: 'Qty Mutasi' },
            { key: 'remainingStock', header: 'Sisa Stock' },
            { key: 'origin', header: 'Dari' },
            { key: 'destination', header: 'Ke' },
            { key: 'remarks', header: 'Keterangan' }
        ];

        exportToCSV(filteredLogs, 'Pergerakan_Barang', columns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Pergerakan Barang</h1>
                <p className="text-silver-dark mt-1">Riwayat Mutasi & Pergerakan Inventaris Gudang</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="md:col-span-2 glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan No. Pendaftaran, Item, atau PIC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Mutasi</p>
                    <p className="text-2xl font-bold text-accent-blue">{mutationLogs.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Hari Ini</p>
                    <p className="text-2xl font-bold text-accent-green">
                        {mutationLogs.filter(log => log.date === new Date().toISOString().split('T')[0]).length}
                    </p>
                </div>
            </div>

            {/* Mutation Logs Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-accent-purple" />
                        <h2 className="text-lg font-semibold text-silver-light">
                            Riwayat Mutasi Barang
                        </h2>
                        <span className="ml-auto text-sm text-silver-dark">
                            {filteredLogs.length} entri
                        </span>
                        <Button
                            onClick={handleExportCSV}
                            variant="secondary"
                            icon={Download}
                            className="ml-2"
                        >
                            Export CSV
                        </Button>
                    </div>
                </div>

                {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-silver-dark">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Belum ada riwayat mutasi</p>
                        <p className="text-sm mt-2">Mutasi barang akan muncul di sini setelah submit dari Inventaris Gudang</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-purple/10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs text-silver">No. Pengajuan</th>
                                    <th className="px-4 py-3 text-left text-xs text-silver">Kode Barang</th>
                                    <th className="px-4 py-3 text-left text-xs text-silver">Nama Item</th>
                                    <th className="px-4 py-3 text-center text-xs text-silver">Tanggal</th>
                                    <th className="px-4 py-3 text-left text-xs text-silver">PIC</th>
                                    <th className="px-4 py-3 text-center text-xs text-accent-blue">Stok Awal</th>
                                    <th className="px-4 py-3 text-center text-xs text-accent-orange">Mutasi</th>
                                    <th className="px-4 py-3 text-center text-xs text-accent-green">Remutasi</th>
                                    <th className="px-4 py-3 text-center text-xs text-accent-purple">Sisa</th>
                                    <th className="px-4 py-3 text-left text-xs text-silver">Lokasi</th>
                                    <th className="px-4 py-3 text-left text-xs text-silver">Keterangan</th>
                                    <th className="px-4 py-3 text-center text-xs text-silver">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredLogs.map((log, idx) => {
                                    const { totalRemutated, sisaDiLokasi } = getRemutationInfo(log);
                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-dark-surface/50 cursor-pointer"
                                            onClick={() => navigate(`/bridge/inventory?pengajuan=${encodeURIComponent(log.pengajuanNumber)}`)}
                                            title="Klik untuk melihat detail inventaris di Gudang"
                                        >
                                            <td className="px-4 py-3 text-sm text-silver-light">{log.pengajuanNumber}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{log.itemCode || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light">
                                                <div>{log.itemName}</div>
                                                {log.serialNumber && <div className="text-xs text-silver-dark">SN: {log.serialNumber}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver text-center">
                                                {new Date(log.date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{log.pic}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm text-accent-blue">{log.totalStock}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm text-accent-orange">{log.mutatedQty}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm text-accent-green">{totalRemutated}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm text-accent-purple">{sisaDiLokasi}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver">
                                                {formatLocation(log.origin, log.destination)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-dark max-w-xs truncate">
                                                {log.remarks || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={(e) => handleDeleteRow(e, log.id)}
                                                    className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                                                    title="Hapus Data"
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
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (() => {
                const { totalRemutated, sisaDiLokasi, maxRemutation, lastRemutationLog } = getRemutationInfo(selectedLog);
                const isOutbound = selectedLog.destination &&
                    selectedLog.destination.toLowerCase() !== 'warehouse' &&
                    selectedLog.destination.toLowerCase() !== 'gudang';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className="bg-sky-500 px-6 py-4 flex justify-between items-center rounded-t-lg">
                                <div>
                                    <h3 className="text-xl text-white font-bold">Mutasi Barang</h3>
                                    <p className="text-sm text-white/90">{selectedLog.pengajuanNumber}</p>
                                </div>
                                <div className="flex gap-2">
                                    {isOutbound && (
                                        <button
                                            onClick={() => setIsEditMode(!isEditMode)}
                                            className={`px-4 py-2 rounded text-sm font-medium ${isEditMode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                                        >
                                            {isEditMode ? '✓ Selesai Edit' : '✎ Edit'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setSelectedLog(null); setIsEditMode(false); }}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium"
                                    >
                                        × Batal
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)] bg-gray-50">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-300">
                                        <thead>
                                            <tr className="bg-sky-400 text-white">
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">NO. PENGAJUAN</th>
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">NO. PABEAN</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">TGL MASUK</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JAM MASUK</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JML ITEM</th>
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">PIC</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">TGL REMUTASI</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JAM</th>
                                                <th className="px-3 py-2 text-left font-medium">PIC REMUTASI</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-sky-50">
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">{selectedLog.pengajuanNumber}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">{selectedLog.bcDocumentNumber}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600 text-center">{new Date(selectedLog.date).toLocaleDateString('id-ID')}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600 text-center">{selectedLog.time}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600 text-center">{selectedLog.mutatedQty}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">{selectedLog.pic}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-center">
                                                    {isEditMode ? (
                                                        <input
                                                            type="date"
                                                            id="remutationDate"
                                                            defaultValue={lastRemutationLog?.date || new Date().toISOString().split('T')[0]}
                                                            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">{lastRemutationLog?.date ? new Date(lastRemutationLog.date).toLocaleDateString('id-ID') : '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200 text-center">
                                                    {isEditMode ? (
                                                        <input
                                                            type="time"
                                                            id="remutationTime"
                                                            defaultValue={lastRemutationLog?.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">{lastRemutationLog?.time || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200">
                                                    {isEditMode ? (
                                                        <input
                                                            type="text"
                                                            id="remutationPIC"
                                                            defaultValue={lastRemutationLog?.pic || ''}
                                                            placeholder="Nama PIC"
                                                            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">{lastRemutationLog?.pic || '-'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Kode Packing Label */}
                                <p className="text-sm text-gray-600 mb-2 mt-6">Kode Packing: {selectedLog.packageNumber || 'Box-1'}</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-300">
                                        <thead>
                                            <tr className="bg-sky-400 text-white">
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">KODE BARANG</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">ITEM</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium">JUMLAH</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">SATUAN</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">LOKASI</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">KONDISI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-orange-200">JML MUTASI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-green-200">REMUTASI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-purple-200">SISA</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">LOKASI REMUTASI</th>
                                                <th className="px-2 py-2 text-left font-medium">KETERANGAN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-sky-50">
                                                <td className="px-2 py-2 border border-gray-200 text-gray-800">{selectedLog.itemCode || '-'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-800">{selectedLog.itemName}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-center text-gray-600">{selectedLog.totalStock}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600">{selectedLog.uom || 'pcs'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600 capitalize">{selectedLog.origin}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600">{selectedLog.condition || 'Baik'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    <span className="text-orange-500 font-medium">{selectedLog.mutatedQty}</span>
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    {isEditMode ? (
                                                        <input
                                                            type="number"
                                                            id="remutationQty"
                                                            defaultValue={maxRemutation > 0 ? maxRemutation : totalRemutated}
                                                            min={0}
                                                            max={selectedLog.mutatedQty}
                                                            className="w-16 px-2 py-1 border border-green-400 rounded text-sm text-center bg-green-50"
                                                        />
                                                    ) : (
                                                        <span className="text-green-500 font-medium">{totalRemutated}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    <span className="text-purple-500 font-medium">{isEditMode ? '-' : sisaDiLokasi}</span>
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200">
                                                    {isEditMode ? (
                                                        <select
                                                            id="remutationLocation"
                                                            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
                                                        >
                                                            <option value="Warehouse">Warehouse</option>
                                                            <option value="Gudang">Gudang</option>
                                                        </select>
                                                    ) : (
                                                        <span className="text-gray-600 capitalize">{isOutbound ? selectedLog.destination : 'Warehouse'}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200">
                                                    {isEditMode ? (
                                                        <input
                                                            type="text"
                                                            id="remutationRemarks"
                                                            defaultValue={lastRemutationLog?.remarks || selectedLog.remarks || ''}
                                                            placeholder="Keterangan"
                                                            className="w-full px-2 py-1 border border-green-400 rounded text-sm bg-green-50"
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">{lastRemutationLog?.remarks || selectedLog.remarks || '-'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Scrollbar indicator */}
                                <div className="w-full h-2 bg-gray-200 rounded-full mt-4 mb-4">
                                    <div className="h-full w-1/3 bg-sky-400 rounded-full"></div>
                                </div>

                                {/* Document Upload Section - Show when edit mode */}
                                {/* Document Upload Section - Show when edit mode */}
                                {isEditMode && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
                                        <h4 className="text-sm font-semibold text-green-700 mb-3">Upload Dokumen Pendukung & Simpan</h4>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-600">Dokumen Pendukung</label>
                                                <input
                                                    type="file"
                                                    id="remutationDoc"
                                                    multiple
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                                                />
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => {
                                                        const qty = parseInt(document.getElementById('remutationQty')?.value) || maxRemutation;
                                                        const pic = document.getElementById('remutationPIC')?.value || '';
                                                        const remarks = document.getElementById('remutationRemarks')?.value || '';
                                                        handleRemutation(selectedLog, qty, pic, remarks);
                                                    }}
                                                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-medium"
                                                >
                                                    💾 Simpan Remutasi
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status Info */}
                                {!isEditMode && isOutbound && maxRemutation === 0 && (
                                    <p className="text-gray-600 text-sm">✓ Semua item sudah diremutasi ke Warehouse</p>
                                )}
                                {!isEditMode && !isOutbound && (
                                    <p className="text-gray-600 text-sm">✓ Item ini adalah remutasi (sudah kembali ke Warehouse)</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default GoodsMovement;
