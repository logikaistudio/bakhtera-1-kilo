import React, { useState } from 'react';
import { ArrowDownCircle, Search, Eye, Package, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { formatCurrency } from '../../utils/currencyFormatter';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const BarangMasuk = () => {
    const { inboundTransactions = [], companySettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    // Flatten transactions into items
    const allItems = inboundTransactions.flatMap(t => {
        if (t.items && t.items.length > 0) {
            return t.items.map((item, itemIdx) => ({
                ...t,
                ...item,
                assetName: item.goodsType || item.assetName, // Map goodsType to assetName
                originalTransaction: t,
                // Ensure sequence number is captured
                noUrut: item.sequenceNumber || item.noUrut || (itemIdx + 1)
            }));
        }
        return [t];
    });

    // Filter transactions
    const filteredTransactions = allItems.filter(item => {
        const matchesSearch = (item.assetName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.customsDocType || '').toLowerCase().includes(searchTerm.toLowerCase());

        const itemDate = new Date(item.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (end) end.setHours(23, 59, 59, 999); // Include the entire end day

        const matchesDate = (!start || itemDate >= start) && (!end || itemDate <= end);

        return matchesSearch && matchesDate;
    });

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'customsDocType', header: 'Jenis Dokumen' },
            { key: 'customsDocNumber', header: 'No. Dokumen (Pabean)' },
            { key: 'customsDocDate', header: 'Tanggal Dokumen' },
            { key: 'receiptNumber', header: 'No. Bukti' },
            { key: 'date', header: 'Tanggal Terima' },
            { key: 'sender', header: 'Pengirim' },
            { key: 'packageNumber', header: 'Kode Box' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'hsCode', header: 'Kode HS' },
            { key: 'noUrut', header: 'Nomor Urut' },
            { key: 'assetName', header: 'Nama Barang' },
            { key: 'quantity', header: 'Quantity' },
            { key: 'unit', header: 'Satuan' },
            { key: 'value', header: 'Nilai' },
            { key: 'currency', header: 'Currency' }
        ];

        // Format data for CSV
        const dataToExport = filteredTransactions.map(item => ({
            ...item,
            date: item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-',
            customsDocDate: item.customsDocDate ? new Date(item.customsDocDate).toLocaleDateString('id-ID') : '-'
        }));

        exportToCSV(dataToExport, 'Barang_Masuk', columns);
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
            { value: 'DATA BARANG MASUK (INBOUND)', style: 'title' },
            { value: `Periode: ${period}`, style: 'normal' },
            { value: '' }, // Spacer
            { value: '' }  // Spacer
        ];

        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 }, // Mapped correctly to pengajuanNumber
            { header: 'Jenis Dokumen', key: 'customsDocType', width: 15, render: (i) => i.customsDocType || 'BC 2.3' },
            { header: 'Tgl. Terima', key: 'date', width: 12, align: 'center', render: (i) => i.date ? new Date(i.date).toLocaleDateString('id-ID') : '-' },
            { header: 'Pengirim', key: 'sender', width: 20, render: (i) => i.sender || i.supplier || '-' },
            { header: 'Kode Package/Box', key: 'packageNumber', width: 15, align: 'center' },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'Kode HS', key: 'hsCode', width: 12 },
            { header: 'No. Urut', key: 'noUrut', width: 8, align: 'center' },
            { header: 'Nama Barang', key: 'assetName', width: 30 },
            { header: 'Jumlah Barang', key: 'quantity', width: 12, align: 'center', render: (i) => Number(i.quantity) || 0 },
            { header: 'Satuan', key: 'unit', width: 8, align: 'center', render: (i) => i.unit || 'pcs' },
            { header: 'Nilai', key: 'value', width: 15, align: 'right', render: (i) => i.value ? formatCurrency(i.value) : '-' }
        ];

        exportToXLS(filteredTransactions, 'Laporan_Barang_Masuk', headerRows, xlsColumns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Barang Masuk</h1>
                <p className="text-silver-dark mt-1">Daftar Transaksi Barang Masuk & BC Inbound</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan nama barang atau nomor BC..."
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
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Transaksi</p>
                    <p className="text-2xl font-bold text-accent-blue">{inboundTransactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Total Item</p>
                    <p className="text-2xl font-bold text-accent-green">
                        {allItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Barang Masuk</h2>
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
                        <thead className="bg-accent-blue/10">
                            <tr>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">No</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Jenis Dok</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">No. Dok Pabean</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Tgl Dok</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Tgl Terima</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Pengirim</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode Box</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode Barang</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode HS</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">No. Urut</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Nama Barang</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Qty</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Satuan</th>
                                <th className="px-2 py-2 text-right text-[10px] font-semibold text-silver whitespace-nowrap">Nilai</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="15" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data barang masuk</p>
                                        <p className="text-sm text-silver-dark mt-2">Transaksi inbound akan muncul di sini</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => setSelectedItem(item)}
                                        className="border-t border-dark-border hover:bg-dark-surface/50 cursor-pointer"
                                    >
                                        <td className="px-2 py-2 text-[11px] text-center text-silver">{idx + 1}</td>
                                        <td className="px-2 py-2 text-[11px] text-silver">{item.customsDocType || 'BC 2.3'}</td>
                                        <td className="px-2 py-2 text-[11px] text-silver">{item.pengajuanNumber || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-accent-blue">{item.customsDocNumber}</td>
                                        <td className="px-2 py-2 text-[11px] text-center text-silver">
                                            {item.customsDocDate ? new Date(item.customsDocDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-2 text-[11px] text-center text-silver">
                                            {new Date(item.date).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-2 py-2 text-[11px] text-silver">{item.sender || item.supplier || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-accent-purple">{item.packageNumber || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-silver font-mono">{item.itemCode || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-silver font-mono">{item.hsCode || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-center text-silver font-mono">{item.noUrut || item.serialNumber || '-'}</td>
                                        <td className="px-2 py-2 text-[11px] text-silver">{item.assetName}</td>
                                        <td className="px-2 py-2 text-[11px] text-center text-accent-blue">{item.quantity}</td>
                                        <td className="px-2 py-2 text-[11px] text-center text-silver">{item.unit}</td>
                                        <td className="px-2 py-2 text-[11px] text-right text-silver">
                                            {formatCurrency(item.value)}
                                        </td>
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
                            <h3 className="text-xl font-bold gradient-text">Detail Barang Masuk</h3>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-dark-border rounded">
                                <span className="text-silver">✕</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {/* Item Photo */}
                            {selectedItem.itemPhoto && (
                                <div className="flex justify-center">
                                    <img
                                        src={selectedItem.itemPhoto}
                                        alt={selectedItem.assetName}
                                        className="max-w-xs max-h-48 rounded-lg object-cover border border-dark-border"
                                    />
                                </div>
                            )}

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-silver-dark">Kode Barang</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.itemCode || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Kode HS</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.hsCode || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Nama Barang</label>
                                    <p className="text-sm text-silver-light font-medium">{selectedItem.assetName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Nomor Urut</label>
                                    <p className="text-sm text-silver-light font-mono">{selectedItem.noUrut || selectedItem.serialNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Tanggal Masuk</label>
                                    <p className="text-sm text-silver-light">{new Date(selectedItem.date).toLocaleDateString('id-ID')}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">PIC</label>
                                    <p className="text-sm text-silver-light">{selectedItem.pic || selectedItem.receivedBy || 'Admin'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Jenis BC</label>
                                    <p className="text-sm text-silver-light">{selectedItem.customsDocType}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">No. Dokumen Pabean</label>
                                    <p className="text-sm text-accent-blue">{selectedItem.customsDocNumber}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Pengirim</label>
                                    <p className="text-sm text-silver-light">{selectedItem.sender || selectedItem.supplier || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">No. Bukti</label>
                                    <p className="text-sm text-silver-light">{selectedItem.receiptNumber || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Jumlah</label>
                                    <p className="text-lg font-bold text-accent-blue">{selectedItem.quantity} {selectedItem.unit}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Nilai</label>
                                    <p className="text-lg font-bold text-accent-green">{formatCurrency(selectedItem.value)}</p>
                                </div>
                            </div>

                            {/* Supporting Documents */}
                            {selectedItem.documents && selectedItem.documents.length > 0 && (
                                <div>
                                    <label className="text-xs text-silver-dark block mb-2">Dokumen Pendukung</label>
                                    <div className="space-y-2">
                                        {selectedItem.documents.map((doc, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 bg-dark-surface rounded border border-dark-border">
                                                <span className="text-sm text-silver-light flex-1">{doc.name || `Dokumen ${idx + 1}`}</span>
                                                {doc.url && (
                                                    <a
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-accent-blue text-xs hover:underline"
                                                    >
                                                        Lihat
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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

export default BarangMasuk;
