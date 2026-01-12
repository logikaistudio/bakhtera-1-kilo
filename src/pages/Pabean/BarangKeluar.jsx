import React, { useState } from 'react';
import { ArrowUpCircle, Search, Eye, Package, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const BarangKeluar = () => {
    // SWITCH TO goodsMovements (Mutation Logs) instead of outboundTransactions
    // 'goodsMovements' comes from freight_movements view or freight_mutation_logs table via DataContext
    const { goodsMovements = [], mutationLogs = [], companySettings } = useData();

    // Prefer mutationLogs if available as it's the raw source, otherwise fall back to goodsMovements
    // Filter for OUTBOUND transactions (Destination is NOT Warehouse, OR explicitly 'Keluar'/'Outbound')
    // Also include entries where origin is 'Warehouse' and destination is external
    const outboundLogs = (mutationLogs.length > 0 ? mutationLogs : goodsMovements).filter(log =>
        (log.destination && log.destination.toLowerCase() !== 'warehouse') ||
        (log.origin && log.origin.toLowerCase() === 'warehouse' && log.destination)
    );

    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    // Filter transactions
    const filteredTransactions = outboundLogs.filter(item => {
        const matchesSearch = (item.itemName || item.assetName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.bcDocumentNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

        const itemDate = new Date(item.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || itemDate >= start) && (!end || itemDate <= end);

        return matchesSearch && matchesDate;
    });

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'bcDocumentNumber', header: 'No. Dokumen (Pabean)' },
            { key: 'date', header: 'Tanggal Keluar' },
            { key: 'time', header: 'Jam' },
            { key: 'destination', header: 'Tujuan' },
            { key: 'packageNumber', header: 'Kode Box' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'itemName', header: 'Nama Barang' },
            { key: 'quantity', header: 'Quantity' }, // Mapped from mutatedQty or totalStock
            { key: 'uom', header: 'Satuan' },
            { key: 'condition', header: 'Kondisi' },
            { key: 'pic', header: 'PIC' }
        ];

        // Map data for export
        const dataToExport = filteredTransactions.map(item => ({
            ...item,
            quantity: item.mutatedQty || item.quantity || item.totalStock,
            date: item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-'
        }));

        exportToCSV(dataToExport, 'Barang_Keluar_Log', columns);
    };

    // Export to XLS handler
    const handleExportXLS = () => {
        if (filteredTransactions.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        // Calculate date range for header
        const dates = filteredTransactions.map(t => new Date(t.date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        const formatDate = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const period = `${formatDate(minDate)} - ${formatDate(maxDate)}`;

        const headerRows = [
            { value: companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: companySettings?.address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: '' },
            { value: 'DATA BARANG KELUAR (OUTBOUND)', style: 'title' },
            { value: `Periode: ${period}`, style: 'normal' },
            { value: '' },
            { value: '' }
        ];

        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'No. Pabean', key: 'bcDocumentNumber', width: 20 },
            { header: 'Tgl. Keluar', key: 'date', width: 12, align: 'center', render: (i) => i.date ? new Date(i.date).toLocaleDateString('id-ID') : '-' },
            { header: 'Tujuan', key: 'destination', width: 20, render: (i) => i.destination || '-' },
            { header: 'Kode Box', key: 'packageNumber', width: 15, align: 'center' },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'Nama Barang', key: 'itemName', width: 30, render: (i) => i.itemName || i.assetName },
            { header: 'Qty', key: 'quantity', width: 8, align: 'center', render: (i) => Number(i.mutatedQty || i.quantity || i.totalStock) || 0 },
            { header: 'Satuan', key: 'uom', width: 8, align: 'center', render: (i) => i.uom || 'pcs' },
            { header: 'Kondisi', key: 'condition', width: 10, align: 'center' }
        ];

        exportToXLS(filteredTransactions, 'Laporan_Barang_Keluar', headerRows, xlsColumns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Barang Keluar</h1>
                <p className="text-silver-dark mt-1">Daftar Transaksi Barang Keluar & Mutasi Keluar (Log Pabean)</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan nama barang, nomor Aju, atau nomor BC..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none text-sm"
                                placeholder="Dari Tanggal"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none text-sm"
                                placeholder="Sampai Tanggal"
                            />
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-orange">
                    <p className="text-xs text-silver-dark">Total Transaksi</p>
                    <p className="text-2xl font-bold text-accent-orange">{filteredTransactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Total Item</p>
                    <p className="text-2xl font-bold text-accent-green">
                        {filteredTransactions.reduce((sum, item) => sum + (Number(item.mutatedQty || item.quantity || item.totalStock) || 0), 0)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-accent-orange" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Barang Keluar</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredTransactions.length} entri</span>
                        <div className="flex gap-2 ml-2">
                            <Button
                                onClick={handleExportXLS}
                                variant="success"
                                icon={FileSpreadsheet}
                                className="!py-1.5 !px-3 !text-xs"
                            >
                                XLS
                            </Button>
                            <Button
                                onClick={handleExportCSV}
                                variant="secondary"
                                icon={Download}
                                className="!py-1.5 !px-3 !text-xs"
                            >
                                CSV
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-orange/10">
                            <tr>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">No</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">No. Pabean</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Tanggal Keluar</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Tujuan</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Kode Box</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Kode Barang</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Nama Barang</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Qty</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Satuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Kondisi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data barang keluar</p>
                                        <p className="text-sm text-silver-dark mt-2">Gunakan tombol "Kirim" di Inventaris Barang Keluar untuk mengirim data ke sini.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => setSelectedItem(item)}
                                        className="border-t border-dark-border hover:bg-dark-surface/50 cursor-pointer"
                                    >
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{idx + 1}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-medium whitespace-nowrap">{item.pengajuanNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-accent-orange whitespace-nowrap">{item.bcDocumentNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-'} {item.time ? item.time.substring(0, 5) : ''}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light capitalize whitespace-nowrap truncate max-w-[150px]">{item.destination || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-accent-purple font-medium whitespace-nowrap">{item.packageNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-mono whitespace-nowrap">{item.itemCode || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light whitespace-nowrap truncate max-w-[200px]">{item.itemName || item.assetName}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-accent-orange font-semibold whitespace-nowrap">{item.mutatedQty || item.quantity || item.totalStock}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.uom || 'pcs'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.condition || 'Baik'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="glass-card rounded-lg p-6 max-w-2xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold gradient-text">Detail Log Barang Keluar</h3>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-dark-border rounded">
                                <span className="text-silver">✕</span>
                            </button>
                        </div>
                        <div className="space-y-4">

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-silver-dark">No. Pengajuan</label>
                                    <p className="text-sm text-silver-light font-medium">{selectedItem.pengajuanNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">No. Pabean (BC)</label>
                                    <p className="text-sm text-accent-orange">{selectedItem.bcDocumentNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Kode Barang</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.itemCode || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Nama Barang</label>
                                    <p className="text-sm text-silver-light font-medium">{selectedItem.itemName || selectedItem.assetName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Kode Box</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.packageNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Serial Number</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.serialNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Tanggal Keluar</label>
                                    <p className="text-sm text-silver-light">
                                        {selectedItem.date ? new Date(selectedItem.date).toLocaleDateString('id-ID') : '-'} {selectedItem.time}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">PIC Penanggung Jawab</label>
                                    <p className="text-sm text-silver-light">{selectedItem.pic || 'Admin'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Tujuan / Penerima</label>
                                    <p className="text-sm text-silver-light capitalize">{selectedItem.destination || selectedItem.receiver || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Jumlah</label>
                                    <p className="text-lg font-bold text-accent-orange">
                                        {selectedItem.mutatedQty || selectedItem.quantity || selectedItem.totalStock} {selectedItem.uom || 'pcs'}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-silver-dark">Keterangan / Remarks</label>
                                    <p className="text-sm text-silver-light italic">{selectedItem.remarks || '-'}</p>
                                </div>
                            </div>

                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button variant="secondary" onClick={() => setSelectedItem(null)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarangKeluar;
