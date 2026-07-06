import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Download, Trash2, ArrowUpRight, ArrowLeftRight, FileText } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const GoodsMovement = () => {
    const navigate = useNavigate();
    const { canCreate, canEdit, canDelete } = useAuth();
    const hasCreate = canCreate('bridge_movement');
    const hasEdit = canEdit('bridge_movement');
    const hasDelete = canDelete('bridge_movement');
    const { mutationLogs = [], quotations = [], addMutationLog, updateMutationLog, updateInventoryStock, deleteMutationLog, companySettings, bridgeSettings, locations, getExhibitionLocation, isExhibitionLocation } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const debugMode = (typeof window !== 'undefined') && new URLSearchParams(window.location.search).get('debug') === '1';

    // Filter mutation logs based on search
    const filteredLogs = mutationLogs.filter(log =>
        log.pengajuanNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.bcDocumentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.pic?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Split logs into Exhibition (DEFAULT_LOCATION) and Outbound
    const exhibitionLocation = getExhibitionLocation();
    const pameranLogs = filteredLogs.filter(log =>
        (log.origin && (isExhibitionLocation ? isExhibitionLocation(log.origin) : (String(log.origin).toLowerCase().includes(String(exhibitionLocation).toLowerCase())))) ||
        (log.destination && (isExhibitionLocation ? isExhibitionLocation(log.destination) : (String(log.destination).toLowerCase().includes(String(exhibitionLocation).toLowerCase()))))
    );

    // Outbound logs are those that are NOT exhibition location
    const outboundLogs = filteredLogs.filter(log =>
        !((log.origin && (isExhibitionLocation ? isExhibitionLocation(log.origin) : String(log.origin).toLowerCase().includes(String(exhibitionLocation).toLowerCase()))) ||
            (log.destination && (isExhibitionLocation ? isExhibitionLocation(log.destination) : String(log.destination).toLowerCase().includes(String(exhibitionLocation).toLowerCase()))))
    );

    // Format location display
    const formatLocation = (origin, destination) => {
        const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
        return `${capitalize(origin)} → ${capitalize(destination)}`;
    };



    // Delete Handler
    const handleDeleteRow = async (e, id) => {
        e.stopPropagation();
        if (!hasDelete) return;
        if (!window.confirm('Yakin ingin menghapus data mutasi ini secara permanen?\nData yang dihapus tidak dapat dikembalikan.')) return;

        if (deleteMutationLog) {
            try {
                await deleteMutationLog(id);
                setSelectedIds(prev => prev.filter(x => x !== id));
            } catch (err) {
                console.error(err);
                alert("Gagal menghapus data mutasi");
            }
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleDeleteSelected = async () => {
        if (!hasDelete || selectedIds.length === 0) return;
        if (!window.confirm(`Hapus ${selectedIds.length} data mutasi terpilih?`)) return;
        try {
            await Promise.all(selectedIds.map(id => deleteMutationLog(id)));
            setSelectedIds([]);
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus sebagian data mutasi terpilih');
        }
    };

    const handleDeleteAll = async () => {
        if (!hasDelete || mutationLogs.length === 0) return;
        if (!window.confirm(`Hapus semua data mutasi (${mutationLogs.length} baris)?`)) return;
        if (!window.confirm('Konfirmasi terakhir: semua data mutasi akan dihapus permanen. Lanjutkan?')) return;
        try {
            await Promise.all(mutationLogs.map(item => deleteMutationLog(item.id)));
            setSelectedIds([]);
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus semua data mutasi');
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
            { key: 'openingStock', header: 'Stok Awal' },
            { key: 'mutatedQty', header: 'Qty Mutasi' },
            { key: 'calculatedRemaining', header: 'Sisa Stock' },
            { key: 'origin', header: 'Dari' },
            { key: 'destination', header: 'Ke' },
            { key: 'remarks', header: 'Keterangan' }
        ];
        // Export using running calculation so Stok Awal reflects prior remaining stock
        const exportData = calculateRunningStock(data);
        exportToCSV(exportData, filename, columns);
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
            { header: 'Stok Awal', key: 'openingStock', width: 10, align: 'center' },
            { header: 'Mutasi', key: 'mutatedQty', width: 10, align: 'center' },
            { header: 'Sisa', key: 'calculatedRemaining', width: 10, align: 'center' },
            { header: 'Dari', key: 'origin', width: 15 },
            { header: 'Ke', key: 'destination', width: 15 },
            { header: 'Keterangan', key: 'remarks', width: 30 }
        ];

        // Export using running calculation so Stok Awal reflects prior remaining stock
        const exportData = calculateRunningStock(data);
        exportToXLS(exportData, filename, headerRows, xlsColumns);
    };

    // Helper: Calculate Running Stock Balance
    const calculateRunningStock = (logs) => {
        // Calculate running balances per unique item instance (itemCode + packageNumber + serialNumber)
        const sortedLogs = [...logs].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date);
            const dateB = new Date(b.createdAt || b.date);
            return dateA - dateB;
        });

        const balances = {}; // key -> current balance

        const processed = sortedLogs.map(log => {
            const key = `${log.itemCode || 'unknown'}||${log.packageNumber || ''}||${log.serialNumber || ''}`;
            const mutationQty = Number(log.mutatedQty) || 0;

            const isLeavingWarehouse = (log.origin || '').toLowerCase() === 'warehouse' || (log.origin || '').toLowerCase() === 'gudang';
            const isReturningToWarehouse = (log.destination || '').toLowerCase() === 'warehouse' || (log.destination || '').toLowerCase() === 'gudang';

            // If first time seeing this key, initialize from the earliest known totalStock for this log
            if (balances[key] === undefined) {
                balances[key] = Number(log.totalStock) || 0;
            }

            // Opening stock for this log is the balance before applying this mutation
            const openingStock = balances[key];

            // Apply mutation sequentially
            // If it returns to warehouse (remutasi), stock increases
            if (isReturningToWarehouse) {
                balances[key] += mutationQty;
            } 
            // If it leaves warehouse (mutasi to pameran or outbound), stock decreases
            else if (isLeavingWarehouse) {
                balances[key] -= mutationQty;
            }
            // If it's a mutation between two non-warehouse locations (e.g. Hall 1 to Hall 2), 
            // it doesn't affect warehouse stock, but normally we only track warehouse stock here.

            return {
                ...log,
                openingStock,
                calculatedRemaining: balances[key]
            };
        });

        // Return newest-first for display
        return processed.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    };

    // Precompute running balances and opening balances for all mutation logs
    const { runningBalancesMap, openingBalancesMap } = (() => {
        try {
            const processed = calculateRunningStock(mutationLogs || []);
            const runMap = {};
            const openMap = {};
            processed.forEach(p => {
                if (p && p.id) {
                    runMap[p.id] = p.calculatedRemaining;
                    openMap[p.id] = (p.openingStock !== undefined && p.openingStock !== null) ? p.openingStock : Number(p.totalStock) || 0;
                }
            });
            if (debugMode) console.log('Running balances computed for GoodsMovement:', { runMap, openMap });
            return { runningBalancesMap: runMap, openingBalancesMap: openMap };
        } catch (e) {
            console.warn('Failed to compute running balances:', e);
            return { runningBalancesMap: {}, openingBalancesMap: {} };
        }
    })();

    const renderTable = (data, title, icon, colorClass, emptyMessage) => {
        const isAllInTableSelected = data.length > 0 && data.every(log => selectedIds.includes(log.id));

        const toggleSelectAllInTable = () => {
            if (data.length === 0) return;
            if (isAllInTableSelected) {
                setSelectedIds(prev => prev.filter(id => !data.some(log => log.id === id)));
                return;
            }
            setSelectedIds(prev => {
                const merged = new Set(prev);
                data.forEach(log => merged.add(log.id));
                return Array.from(merged);
            });
        };

        return (
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
                                {hasDelete && (
                                    <th className="px-3 py-3 text-center text-xs text-silver">
                                        <input
                                            type="checkbox"
                                            checked={isAllInTableSelected}
                                            onChange={toggleSelectAllInTable}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                )}
                                <th className="px-3 py-3 text-left text-xs text-silver">No. Pengajuan</th>
                                <th className="px-3 py-3 text-left text-xs text-silver">Kode Barang</th>
                                <th className="px-3 py-3 text-left text-xs text-silver">Nama Item</th>
                                <th className="px-3 py-3 text-center text-xs text-silver">Masuk Gudang (Tgl & Jam)</th>
                                <th className="px-3 py-3 text-center text-xs text-silver">Waktu Mutasi (Tgl & Jam)</th>
                                <th className="px-3 py-3 text-left text-xs text-silver">PIC Mutasi</th>
                                <th className="px-3 py-3 text-center text-xs text-accent-blue">Stok Awal</th>
                                <th className="px-3 py-3 text-center text-xs text-accent-orange">Mutasi</th>
                                <th className="px-3 py-3 text-center text-xs text-accent-purple">Sisa Gudang</th>
                                <th className="px-3 py-3 text-left text-xs text-silver">Lokasi</th>
                                <th className="px-3 py-3 text-center text-xs text-silver">Dokumen</th>
                                <th className="px-3 py-3 text-center text-xs text-silver">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {data.map((log, idx) => {
                                const pengajuan = quotations.find(q => q.quotationNumber === log.pengajuanNumber || q.quotation_number === log.pengajuanNumber);
                                const masukDate = pengajuan ? (pengajuan.submissionDate || pengajuan.submission_date || pengajuan.date) : null;
                                const masukTime = pengajuan ? (pengajuan.approvedDate || pengajuan.approved_date) : null;

                                return (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-dark-surface/50 cursor-pointer"
                                        onClick={() => setSelectedLog(log)}
                                        title="Klik untuk melihat rincian mutasi dan dokumen"
                                    >
                                        {hasDelete && (
                                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(log.id)}
                                                    onChange={() => toggleSelectOne(log.id)}
                                                    className="w-4 h-4"
                                                />
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-sm text-silver-light">{log.pengajuanNumber}</td>
                                        <td className="px-3 py-3 text-sm text-silver-light">{log.itemCode || '-'}</td>
                                        <td className="px-3 py-3 text-sm text-silver-light">
                                            <div>{log.itemName}</div>
                                            {log.serialNumber && <div className="text-xs text-silver-dark">SN: {log.serialNumber}</div>}
                                        </td>
                                        <td className="px-3 py-3 text-sm text-silver text-center">
                                            <div>{masukDate ? new Date(masukDate).toLocaleDateString('id-ID') : '-'}</div>
                                            <div className="text-xs text-silver-dark">{masukTime ? new Date(masukTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-silver text-center">
                                            <div>{log.date ? new Date(log.date).toLocaleDateString('id-ID') : '-'}</div>
                                            <div className="text-xs text-silver-dark">{log.time || '-'}</div>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-silver-light">{log.pic || '-'}</td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="text-sm text-accent-blue">{(openingBalancesMap && openingBalancesMap[log.id] !== undefined) ? openingBalancesMap[log.id] : (log.openingStock !== undefined ? log.openingStock : log.totalStock)}</span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="text-sm text-accent-orange">{log.mutatedQty}</span>
                                        </td>

                                        <td className="px-3 py-3 text-center">
                                            <span className="text-sm text-accent-purple" title="Sisa stok di gudang saat transaksi">
                                                {(() => {
                                                    // Prefer runningBalancesMap (calculated from full mutation log history)
                                                    if (runningBalancesMap[log.id] !== undefined) return runningBalancesMap[log.id];

                                                    // Fallbacks (legacy): use explicit remainingStock or naive subtraction
                                                    if (log.remainingStock !== undefined && log.remainingStock !== null) return log.remainingStock;
                                                    const isOutbound = log.destination && !(isExhibitionLocation ? isExhibitionLocation(log.destination) : false) &&
                                                        (log.destination || '').toLowerCase() !== 'warehouse' &&
                                                        (log.destination || '').toLowerCase() !== 'gudang';
                                                    if (isOutbound) return Number(log.totalStock) - Number(log.mutatedQty);
                                                    return '-';
                                                })()}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-silver">
                                            {formatLocation(log.origin, log.destination)}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {log.documents && log.documents.length > 0 ? (
                                                <div className="flex justify-center">
                                                    <span className="bg-sky-100 text-sky-700 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                                        <FileText className="w-3 h-3" /> {log.documents.length}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        {hasDelete && (
                                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleDeleteRow(e, log.id)}
                                                    className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                                                    title="Hapus Data"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
    };

    return (
        <div className="p-6 space-y-6">
            {debugMode && (
                <div style={{position:'fixed',right:12,top:80,zIndex:60,width:420,maxHeight: '60vh',overflow:'auto',background:'#ffffffcc',backdropFilter:'blur(4px)',border:'1px solid #ccc',padding:10,borderRadius:6,fontSize:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <strong>DEBUG: GoodsMovement</strong>
                        <span style={{fontSize:11,color:'#666'}}>{new Date().toLocaleTimeString()}</span>
                    </div>
                    <div><b>mutationLogs.length:</b> {mutationLogs?.length || 0}</div>
                    <div><b>runningBalances (sample):</b></div>
                    <pre style={{whiteSpace:'pre-wrap',maxHeight:200,overflow:'auto',background:'#f7f7f7',padding:6}}>{JSON.stringify(Object.entries(runningBalancesMap).slice(0,10),null,2)}</pre>
                    <div><b>First 8 mutationLogs:</b></div>
                    <pre style={{whiteSpace:'pre-wrap',maxHeight:220,overflow:'auto',background:'#f7f7f7',padding:6}}>{JSON.stringify((mutationLogs||[]).slice(0,8).map(m=>({id:m.id,date:m.date,totalStock:m.totalStock,mutatedQty:m.mutatedQty,origin:m.origin,destination:m.destination})),null,2)}</pre>
                </div>
            )}
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Pergerakan Barang</h1>
                <p className="text-silver-dark mt-1">Riwayat Mutasi & Pergerakan Inventaris Gudang</p>
            </div>

            {hasDelete && (
                <div className="flex gap-2">
                    <Button onClick={handleDeleteSelected} variant="danger" disabled={selectedIds.length === 0} icon={Trash2}>
                        Hapus Terpilih ({selectedIds.length})
                    </Button>
                    <Button onClick={handleDeleteAll} variant="danger" disabled={mutationLogs.length === 0} icon={Trash2}>
                        Bersihkan Semua Data
                    </Button>
                </div>
            )}

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
                `Aktivitas ${exhibitionLocation || 'Pameran'}`,
                <ArrowLeftRight className="w-5 h-5 text-accent-purple" />,
                "bg-accent-purple",
                `Belum ada aktivitas ${exhibitionLocation || 'Pameran'}`
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
                                        ✕ Tutup
                                    </button>
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
                                                <td className="px-3 py-2 border border-gray-200 text-center text-gray-800">
                                                    {selectedLog.date ? new Date(selectedLog.date).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200 text-center text-gray-800">
                                                    {selectedLog.time || '-'}
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">
                                                    {selectedLog.pic || '-'}
                                                </td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800 capitalize">
                                                    {selectedLog.destination || '-'}
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
                                                <th className="px-2 py-2 text-center border-r border-sky-300 font-medium text-purple-200">SISA GUDANG</th>
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
                                                    <span className="text-purple-500 font-medium">{selectedLog.remainingStock || '-'}</span>
                                                </td>
                                                <td className="px-2 py-2 border border-gray-200">
                                                    {selectedLog.remarks || '-'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Documents Section */}
                                <div className="mt-6 border border-gray-200 bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-800 mb-3">Dokumen Pendukung Mutasi</h4>
                                    {(!selectedLog.documents || selectedLog.documents.length === 0) ? (
                                        <p className="text-sm text-gray-500">Tidak ada dokumen pendukung untuk mutasi ini.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {selectedLog.documents.map((doc, idx) => (
                                                <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                                    {doc.type && doc.type.startsWith('image/') ? (
                                                        <div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden flex items-center justify-center">
                                                            <img 
                                                                src={doc.data || doc.url} 
                                                                alt={doc.title || doc.name} 
                                                                className="object-contain w-full h-full cursor-pointer hover:scale-105 transition-transform"
                                                                onClick={() => {
                                                                    const win = window.open();
                                                                    win.document.write(`<iframe src="${doc.data || doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video bg-gray-100 rounded mb-2 flex flex-col items-center justify-center cursor-pointer"
                                                            onClick={() => {
                                                                const win = window.open();
                                                                win.document.write(`<iframe src="${doc.data || doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                            }}
                                                        >
                                                            <div className="w-12 h-12 text-gray-400 border-2 border-gray-300 rounded-lg flex items-center justify-center mb-1">
                                                                <span className="text-xs font-bold uppercase">{doc.type ? doc.type.split('/')[1] : 'PDF'}</span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-500 text-center px-2 underline">Buka Dokumen</span>
                                                        </div>
                                                    )}
                                                    <div className="text-sm font-medium text-gray-800 truncate" title={doc.title || doc.name}>{doc.title || doc.name || `Dokumen ${idx + 1}`}</div>
                                                    <div className="text-xs text-gray-500 truncate" title={doc.name}>{doc.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Status Info */}
                                <div className="mt-4 p-3 rounded-lg border bg-white">
                                    {isOutbound ? (
                                        <p className="text-blue-600 text-sm">ℹ️ Item ini telah dimutasi keluar (Outbound/Pameran)</p>
                                    ) : (
                                        <p className="text-gray-600 text-sm">✓ Item ini adalah remutasi (sudah kembali ke Gudang)</p>
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
