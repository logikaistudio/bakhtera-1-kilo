import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Download, Trash2, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const GoodsMovement = () => {
    const navigate = useNavigate();
    const { mutationLogs = [], addMutationLog, updateMutationLog, updateInventoryStock, deleteMutationLog, companySettings, bridgeSettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    // Filter mutation logs based on search
    const filteredLogs = mutationLogs.filter(log =>
        log.pengajuanNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.bcDocumentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.pic?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Split logs into Pameran and Outbound
    const pameranLogs = filteredLogs.filter(log =>
        (log.origin && log.origin.toLowerCase().includes('pameran')) ||
        (log.destination && log.destination.toLowerCase().includes('pameran'))
    );

    // Outbound logs are those that are NOT Pameran
    const outboundLogs = filteredLogs.filter(log =>
        !((log.origin && log.origin.toLowerCase().includes('pameran')) ||
            (log.destination && log.destination.toLowerCase().includes('pameran')))
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
            return { totalRemutated: log.mutatedQty, sisaDiLokasi: 0, maxRemutation: 0, lastRemutationLog: log };
        }

        const relatedRemutations = mutationLogs.filter(m =>
            m.pengajuanNumber === log.pengajuanNumber &&
            m.itemCode === log.itemCode &&
            (m.serialNumber || '') === (log.serialNumber || '') &&
            m.id !== log.id &&
            (m.destination?.toLowerCase() === 'warehouse' || m.destination?.toLowerCase() === 'gudang')
        );
        const totalRemutated = relatedRemutations.reduce((sum, r) => sum + (r.mutatedQty || 0), 0);

        const lastRemutationLog = relatedRemutations.length > 0
            ? relatedRemutations.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0]
            : null;

        const cappedRemutated = Math.min(totalRemutated, log.mutatedQty);
        const sisaDiLokasi = Math.max(0, log.mutatedQty - cappedRemutated);
        return { totalRemutated: cappedRemutated, sisaDiLokasi, maxRemutation: sisaDiLokasi, lastRemutationLog };
    };

    // Handle Remutation (Return to Warehouse)
    const handleRemutation = async (log, targetQty, pic, remarks) => {
        const { totalRemutated, maxRemutation: currentMaxRemutation, lastRemutationLog } = getRemutationInfo(log);
        const delta = targetQty - totalRemutated;

        const isOutbound = log.destination &&
            log.destination.toLowerCase() !== 'warehouse' &&
            log.destination.toLowerCase() !== 'gudang';

        const remutationDate = document.getElementById('remutationDate')?.value || new Date().toISOString().split('T')[0];
        const remutationTime = document.getElementById('remutationTime')?.value || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        if (delta === 0) {
            if (!lastRemutationLog) {
                alert('Tidak ada data remutasi yang bisa diedit (belum ada remutasi sebelumnya).');
                return false;
            }
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
                return true;
            } catch (error) {
                console.error('Error updating remutation metadata:', error);
                alert('Gagal mengupdate data: ' + error.message);
                return false;
            }
        }

        if (targetQty < 0 || targetQty > log.mutatedQty) {
            alert(`Total remutasi harus antara 0 dan ${log.mutatedQty}`);
            return false;
        }

        if (!pic.trim()) {
            alert('PIC Remutasi harus diisi');
            return false;
        }

        if (delta < 0) {
            const confirm = window.confirm(`Anda akan mengurangi jumlah remutasi sebanyak ${Math.abs(delta)} unit. Lanjutkan?`);
            if (!confirm) return false;
        }

        try {
            const mutationLocation = document.getElementById('mutationLocationSelect')?.value || (isOutbound ? 'outbound' : 'warehouse');
            const storageLocation = document.getElementById('storageLocationInput')?.value || '';

            const newMutation = {
                pengajuanId: log.pengajuanId,
                pengajuanNumber: log.pengajuanNumber,
                bcDocumentNumber: log.bcDocumentNumber,
                packageNumber: log.packageNumber,
                itemCode: log.itemCode,
                itemName: log.itemName,
                serialNumber: log.serialNumber,
                totalStock: log.totalStock,
                origin: log.destination,
                destination: 'Warehouse',
                mutatedQty: delta,
                remainingStock: (currentMaxRemutation - delta),
                date: remutationDate,
                time: remutationTime,
                pic: pic,
                remarks: remarks || (delta > 0 ? `Remutasi Tambahan: ${delta} unit` : `Koreksi Remutasi: ${delta} unit`),
                condition: 'Baik',
                uom: log.uom || 'pcs',
                mutationLocation: mutationLocation,
                storageLocation: storageLocation
            };

            await addMutationLog(newMutation);

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
            return true;
        } catch (error) {
            console.error('Error processing remutation:', error);
            alert('Gagal memproses remutasi: ' + error.message);
            return false;
        }
    };

    // Delete Handler
    const handleDeleteRow = async (e, id) => {
        e.stopPropagation();
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

    // Generic Export CSV
    const handleExportCSV = (data, filename) => {
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
        exportToCSV(data, filename, columns);
    };

    // Generic Export XLS
    const handleExportXLS = (data, filename, title) => {
        if (data.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        // Calculate date range for header
        const dates = data.map(t => new Date(t.date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        const formatDate = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const period = `${formatDate(minDate)} - ${formatDate(maxDate)}`;

        const headerRows = [
            { value: bridgeSettings?.company_name || companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: bridgeSettings?.company_address || companySettings?.company_address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: `NPWP: ${bridgeSettings?.company_npwp || companySettings?.company_npwp || '-'}`, style: 'normal' },
            { value: '' },
            { value: title.toUpperCase(), style: 'title' },
            { value: `Periode: ${period}`, style: 'normal' },
            { value: '' }
        ];

        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'Nama Item', key: 'itemName', width: 30 },
            { header: 'Serial Number', key: 'serialNumber', width: 15 },
            { header: 'Tanggal', key: 'date', width: 12, align: 'center', render: (i) => new Date(i.date).toLocaleDateString('id-ID') },
            { header: 'Jam', key: 'time', width: 10, align: 'center' },
            { header: 'PIC', key: 'pic', width: 15 },
            { header: 'Stok Awal', key: 'totalStock', width: 10, align: 'center' },
            { header: 'Mutasi', key: 'mutatedQty', width: 10, align: 'center' },
            { header: 'Sisa', key: 'calculatedRemaining', width: 10, align: 'center' },
            { header: 'Dari', key: 'origin', width: 15 },
            { header: 'Ke', key: 'destination', width: 15 },
            { header: 'Keterangan', key: 'remarks', width: 30 }
        ];

        exportToXLS(data, filename, headerRows, xlsColumns);
    };

    // Helper: Calculate Running Stock Balance
    const calculateRunningStock = (logs) => {
        // Deep copy to avoid mutating state directly
        const sortedLogs = [...logs].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date);
            const dateB = new Date(b.createdAt || b.date);
            return dateA - dateB;
        });

        const itemBalances = {}; // { itemCode: currentBalance }
        const itemTotalRef = {}; // { itemCode: lastTotalStock }

        const processedLogs = sortedLogs.map(log => {
            const itemCode = log.itemCode || 'unknown';
            const totalStock = Number(log.totalStock) || 0;
            const mutationQty = Number(log.mutatedQty) || 0;

            const isOutbound = log.destination &&
                log.destination.toLowerCase() !== 'warehouse' &&
                log.destination.toLowerCase() !== 'gudang';

            // Initialize if first time seeing this item
            if (itemBalances[itemCode] === undefined) {
                itemBalances[itemCode] = totalStock;
                itemTotalRef[itemCode] = totalStock;
            } else {
                // Check if Total Stock changed (e.g. Purchase) and adjust balance
                const diff = totalStock - itemTotalRef[itemCode];
                if (diff !== 0) {
                    itemBalances[itemCode] += diff;
                    itemTotalRef[itemCode] = totalStock;
                }
            }

            // Apply mutation
            if (isOutbound) {
                itemBalances[itemCode] -= mutationQty;
            } else {
                // Inbound / Remutation
                itemBalances[itemCode] += mutationQty;
            }

            // Ensure non-negative (safety net)
            // itemBalances[itemCode] = Math.max(0, itemBalances[itemCode]);

            return {
                ...log,
                calculatedRemaining: itemBalances[itemCode]
            };
        });

        // Return re-sorted by descending date for display (Newest First)
        return processedLogs.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date);
            const dateB = new Date(b.createdAt || b.date);
            return dateB - dateA;
        });
    };

    const renderTable = (data, title, icon, colorClass, emptyMessage) => (
        <div className="glass-card rounded-lg overflow-hidden mb-6">
            <div className="p-4 border-b border-dark-border">
                <div className="flex items-center gap-2">
                    {icon}
                    <h2 className="text-lg font-semibold text-silver-light">
                        {title}
                    </h2>
                    <span className="ml-auto text-sm text-silver-dark">
                        {data.length} entri
                    </span>
                    <div className="flex gap-2 ml-2">
                        <Button
                            onClick={() => handleExportXLS(data, `Laporan_${title.replace(/\s+/g, '_')}`, title)}
                            variant="success"
                            icon={null} // Removed Icon to keep it button simple or add FileSpreadsheet
                            className="!py-1.5 !px-3 !text-xs font-bold"
                        >
                            XLS
                        </Button>
                        <Button
                            onClick={() => handleExportCSV(data, `Data_${title.replace(/\s+/g, '_')}`)}
                            variant="secondary"
                            icon={Download}
                            className="!py-1.5 !px-3 !text-xs"
                        >
                            CSV
                        </Button>
                    </div>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="p-12 text-center text-silver-dark">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">{emptyMessage}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={`${colorClass}/10`}>
                            <tr>
                                <th className="px-4 py-3 text-left text-xs text-silver">No. Pengajuan</th>
                                <th className="px-4 py-3 text-left text-xs text-silver">Kode Barang</th>
                                <th className="px-4 py-3 text-left text-xs text-silver">Nama Item</th>
                                <th className="px-4 py-3 text-center text-xs text-silver">Tanggal</th>
                                <th className="px-4 py-3 text-left text-xs text-silver">PIC</th>
                                <th className="px-4 py-3 text-center text-xs text-accent-blue">Stok Awal</th>
                                <th className="px-4 py-3 text-center text-xs text-accent-orange">Mutasi</th>
                                <th className="px-4 py-3 text-center text-xs text-accent-green">Remutasi</th>
                                <th className="px-4 py-3 text-center text-xs text-accent-purple">Sisa Gudang</th>
                                <th className="px-4 py-3 text-left text-xs text-silver">Lokasi</th>
                                <th className="px-4 py-3 text-left text-xs text-silver">Keterangan</th>
                                <th className="px-4 py-3 text-center text-xs text-silver">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {data.map((log, idx) => {
                                const { totalRemutated } = getRemutationInfo(log);
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
                                            <span className="text-sm text-accent-purple" title="Sisa stok di gudang saat transaksi">
                                                {(() => {
                                                    const isOutbound = log.destination &&
                                                        log.destination.toLowerCase() !== 'warehouse' &&
                                                        log.destination.toLowerCase() !== 'gudang';

                                                    if (isOutbound) {
                                                        return Number(log.totalStock) - Number(log.mutatedQty);
                                                    } else {
                                                        return (log.remainingStock !== undefined && log.remainingStock !== null)
                                                            ? log.remainingStock
                                                            : '-';
                                                    }
                                                })()}
                                            </span>
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
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Pergerakan Barang</h1>
                <p className="text-silver-dark mt-1">Riwayat Mutasi & Pergerakan Inventaris Gudang</p>
            </div>

            {/* Search */}
            <div className="glass-card p-4 rounded-lg">
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

            {/* Table 1: Pameran */}
            {renderTable(
                pameranLogs,
                "Aktivitas Pameran",
                <ArrowLeftRight className="w-5 h-5 text-accent-purple" />,
                "bg-accent-purple",
                "Belum ada aktivitas pameran"
            )}

            {/* Table 2: Outbound */}
            {renderTable(
                outboundLogs,
                "Aktivitas Outbound",
                <ArrowUpRight className="w-5 h-5 text-accent-orange" />,
                "bg-accent-orange",
                "Belum ada aktivitas outbound lainnya"
            )}


            {/* Detail Modal - Combined Edit & Mutation */}
            {selectedLog && (() => {
                const { totalRemutated, sisaDiLokasi, maxRemutation, lastRemutationLog } = getRemutationInfo(selectedLog);
                const isOutbound = selectedLog.destination &&
                    selectedLog.destination.toLowerCase() !== 'warehouse' &&
                    selectedLog.destination.toLowerCase() !== 'gudang';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className="bg-sky-500 px-6 py-4 flex justify-between items-center rounded-t-lg">
                                <div>
                                    <h3 className="text-xl text-white font-bold">Mutasi Barang</h3>
                                    <p className="text-sm text-white/90">{selectedLog.pengajuanNumber}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedLog(null)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-1"
                                    >
                                        ✕ Batal
                                    </button>
                                    {isOutbound && (
                                        <button
                                            onClick={() => {
                                                const qty = parseInt(document.getElementById('remutationQty')?.value) || totalRemutated;
                                                const pic = document.getElementById('remutationPIC')?.value || '';
                                                const remarks = document.getElementById('remutationRemarks')?.value || '';
                                                handleRemutation(selectedLog, qty, pic, remarks);
                                            }}
                                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-1"
                                        >
                                            💾 Simpan Mutasi
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)] bg-gray-50">
                                <div className="overflow-x-auto mb-4">
                                    <table className="w-full text-sm border border-gray-300">
                                        <thead>
                                            <tr className="bg-sky-400 text-white">
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">NO. PENGAJUAN</th>
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">NO. PABEAN</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">TGL MASUK</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JAM MASUK</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JML ITEM</th>
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">PIC</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">TGL MUTASI</th>
                                                <th className="px-3 py-2 text-center border-r border-sky-300 font-medium">JAM MUTASI</th>
                                                <th className="px-3 py-2 text-left border-r border-sky-300 font-medium">PIC MUTASI</th>
                                                <th className="px-3 py-2 text-left font-medium">LOKASI MUTASI</th>
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
                                                    <input
                                                        type="date"
                                                        id="remutationDate"
                                                        defaultValue={lastRemutationLog?.date || new Date().toISOString().split('T')[0]}
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200 text-center">
                                                    <input
                                                        type="time"
                                                        id="remutationTime"
                                                        defaultValue={lastRemutationLog?.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        id="remutationPIC"
                                                        defaultValue={lastRemutationLog?.pic || ''}
                                                        placeholder="Nama PIC"
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200">
                                                    <select
                                                        id="mutationLocationSelect"
                                                        defaultValue={selectedLog.mutationLocation || (isOutbound ? 'outbound' : 'warehouse')}
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white capitalize"
                                                    >
                                                        <option value="warehouse">Warehouse</option>
                                                        <option value="pameran">Pameran</option>
                                                        <option value="outbound">Outbound</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-sm text-gray-600 mb-2">Kode Packing: <span className="font-semibold">{selectedLog.packageNumber || 'Box-1'}</span></p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-300">
                                        <thead>
                                            <tr className="bg-sky-400 text-white">
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium w-12">NO.</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">KODE BARANG</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">HS CODE</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">ITEM</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium">JUMLAH</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">SATUAN</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">LOKASI ASAL</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium">KONDISI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-orange-200">JML MUTASI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-green-200">JML REMUTASI</th>
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-purple-200">SISA</th>
                                                <th className="px-2 py-2 text-left border-r border-sky-300 font-medium text-cyan-200">LOKASI PENYIMPANAN</th>
                                                <th className="px-2 py-2 text-left font-medium">KETERANGAN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-sky-50">
                                                <td className="px-2 py-2 border border-gray-200 text-center text-gray-800">1</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-800">{selectedLog.itemCode || '-'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600">{selectedLog.hsCode || '-'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-800">{selectedLog.itemName}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-center text-gray-600">{selectedLog.totalStock}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600">{selectedLog.uom || 'pcs'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600 capitalize">{selectedLog.origin}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-gray-600">{selectedLog.condition || 'Baik'}</td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    <span className="text-orange-500 font-medium">{selectedLog.mutatedQty}</span>
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    {isOutbound ? (
                                                        <input
                                                            type="number"
                                                            id="remutationQty"
                                                            defaultValue={totalRemutated}
                                                            min={0}
                                                            max={selectedLog.mutatedQty}
                                                            className="w-16 px-2 py-1 border border-sky-300 rounded text-sm text-center bg-white"
                                                        />
                                                    ) : (
                                                        <span className="text-green-500 font-medium">{totalRemutated}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200 text-center">
                                                    <span className="text-purple-500 font-medium">{sisaDiLokasi}</span>
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        id="storageLocationInput"
                                                        defaultValue={selectedLog.storageLocation || ''}
                                                        placeholder="Contoh: Rak A-1"
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        id="remutationRemarks"
                                                        defaultValue={lastRemutationLog?.remarks || selectedLog.remarks || ''}
                                                        placeholder="Keterangan"
                                                        className="w-full px-2 py-1 border border-sky-300 rounded text-sm bg-white"
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Status Info */}
                                <div className="mt-4 p-3 rounded-lg border bg-white">
                                    {isOutbound && maxRemutation > 0 && (
                                        <p className="text-blue-600 text-sm">ℹ️ Tersisa <strong>{maxRemutation}</strong> unit yang dapat diremutasi ke Warehouse</p>
                                    )}
                                    {isOutbound && maxRemutation === 0 && (
                                        <p className="text-green-600 text-sm">✓ Semua item sudah diremutasi ke Warehouse</p>
                                    )}
                                    {!isOutbound && (
                                        <p className="text-gray-600 text-sm">✓ Item ini adalah remutasi (sudah kembali ke Warehouse)</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default GoodsMovement;
