import React, { useState } from 'react';
import { ArrowDownCircle, Search, Eye, Package, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import Button from '../../../components/Common/Button';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { exportToCSV } from '../../../utils/exportCSV';
import { exportToXLS } from '../../../utils/exportXLS';

const BarangMasuk = () => {
    const { inboundTransactions = [], companySettings, bridgeSettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Filter Transactions
    const filteredTransactions = inboundTransactions.filter(t => {
        const docDate = new Date(t.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || docDate >= start) && (!end || docDate <= end);
        const matchesSearch = (
            (t.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.sender || t.supplier || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        return matchesDate && matchesSearch;
    });

    // Helper: Calculate Total Value
    const getTransactionTotal = (t) => {
        return (t.items || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    };

    // Helper: Calculate Total Qty
    const getTransactionQty = (t) => {
        return (t.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    };

    // Export Main Table to XLS
    const handleExportXLS = () => {
        const headerRows = [
            { value: bridgeSettings?.company_name || companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: bridgeSettings?.company_address || companySettings?.company_address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: `NPWP: ${bridgeSettings?.company_npwp || companySettings?.company_npwp || '-'}`, style: 'normal' },
            { value: '', style: 'normal' },
            { value: 'DATA BARANG MASUK (INBOUND)', style: 'title' }
        ];

        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Jenis Dok', key: 'customsDocType', width: 10, align: 'center' },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'Tgl Dokumen', key: 'customsDocDate', width: 12, align: 'center' },
            { header: 'Pengirim', key: 'sender', width: 25 },
            { header: 'Jml Item', key: 'itemCount', width: 10, align: 'center' },
            { header: 'Total Nilai', key: 'totalValue', width: 15, align: 'right' }
        ];

        const data = filteredTransactions.map((t, idx) => ({
            ...t,
            no: idx + 1,
            customsDocDate: t.customsDocDate ? new Date(t.customsDocDate).toLocaleDateString('id-ID') : '-',
            itemCount: t.items ? t.items.length : 0,
            totalValue: formatCurrency(getTransactionTotal(t))
        }));

        exportToXLS(data, 'Laporan_Barang_Masuk', headerRows, xlsColumns);
    };

    // Export Main Table to CSV
    const handleExportCSV = () => {
        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'customsDocType', header: 'Jenis Dok' },
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'date', header: 'Tgl Masuk' },
            { key: 'sender', header: 'Pengirim' },
            { key: 'totalItems', header: 'Jml Item' },
            { key: 'totalValue', header: 'Total Nilai' }
        ];

        const data = filteredTransactions.map(t => ({
            ...t,
            date: new Date(t.date).toLocaleDateString('id-ID'),
            totalItems: t.items?.length || 0,
            totalValue: getTransactionTotal(t)
        }));

        exportToCSV(data, 'Barang_Masuk', columns);
    };

    // Export Detail Modal to XLS
    const handleModalExportXLS = () => {
        if (!selectedTransaction) return;

        const headerRows = [
            { value: bridgeSettings?.company_name || companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: bridgeSettings?.company_address || companySettings?.company_address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: `NPWP: ${bridgeSettings?.company_npwp || companySettings?.company_npwp || '-'}`, style: 'normal' },
            { value: '', style: 'normal' },
            { value: `DETAIL PENGAJUAN: ${selectedTransaction.pengajuanNumber}`, style: 'title' },
            { value: `No Pabean: ${selectedTransaction.customsDocNumber} | Tgl: ${selectedTransaction.customsDocDate ? new Date(selectedTransaction.customsDocDate).toLocaleDateString() : '-'}`, style: 'normal' }
        ];

        const xlsColumns = [
            { header: 'No', key: 'noUrut', width: 5, align: 'center', render: (_, idx) => idx + 1 },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'HS Code', key: 'hsCode', width: 15 },
            { header: 'Uraian Barang', key: 'assetName', width: 30 },
            { header: 'Jml', key: 'quantity', width: 8, align: 'center', render: (i) => Number(i.quantity) || 0 },
            { header: 'Sat', key: 'unit', width: 8, align: 'center' },
            { header: 'Nilai Satuan', key: 'value', width: 15, align: 'right', render: (i) => formatCurrency(i.value) },
            { header: 'Total Nilai', key: 'total', width: 15, align: 'right', render: (i) => formatCurrency(i.value) }
        ];

        exportToXLS(selectedTransaction.items || [], `Detail_${selectedTransaction.pengajuanNumber}`, headerRows, xlsColumns);
    };

    // Export Detail Modal to CSV
    const handleModalExportCSV = () => {
        if (!selectedTransaction) return;

        const columns = [
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'hsCode', header: 'HS Code' },
            { key: 'assetName', header: 'Uraian Barang' },
            { key: 'quantity', header: 'Jumlah' },
            { key: 'unit', header: 'Satuan' },
            { key: 'value', header: 'Nilai' }
        ];

        exportToCSV(selectedTransaction.items || [], `Detail_${selectedTransaction.pengajuanNumber}`, columns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Barang Masuk</h1>
                <p className="text-silver-dark mt-1">Daftar Pengajuan Barang Masuk (Per Dokumen)</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari No Pengajuan, No BC, atau Pengirim..."
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
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Pengajuan</p>
                    <p className="text-2xl font-bold text-accent-blue">{filteredTransactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-orange-500">
                    <p className="text-xs text-silver-dark">Barang Masuk</p>
                    <p className="text-2xl font-bold text-orange-500">
                        {filteredTransactions.reduce((sum, t) => sum + getTransactionQty(t), 0)}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Total Nilai (Filtered)</p>
                    <p className="text-xl font-bold text-accent-green">
                        {formatCurrency(filteredTransactions.reduce((sum, t) => sum + getTransactionTotal(t), 0))}
                    </p>
                </div>
            </div>

            {/* Main Table - By Transaction */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Dokumen Masuk</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportXLS} variant="success" icon={FileSpreadsheet} className="!py-1.5 !px-3 !text-xs">XLS</Button>
                        <Button onClick={handleExportCSV} variant="secondary" icon={Download} className="!py-1.5 !px-3 !text-xs">CSV</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">No. Pengajuan</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">Jenis Dok</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">No. Pabean</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase tracking-wider">Tgl Dok</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">Pengirim</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase tracking-wider">Jml Item</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver uppercase tracking-wider">Total Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-12 text-center text-silver-dark">
                                        Tidak ada data yang ditemukan
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t, idx) => (
                                    <tr key={idx} className="hover:bg-dark-surface/50 transition-colors cursor-pointer" onClick={() => setSelectedTransaction(t)}>
                                        <td className="px-4 py-3 text-sm text-accent-blue font-medium">{t.pengajuanNumber || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-silver">{t.customsDocType || 'BC 2.3'}</td>
                                        <td className="px-4 py-3 text-sm text-silver font-mono">{t.customsDocNumber || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-silver text-center">
                                            {t.customsDocDate ? new Date(t.customsDocDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver">{t.sender || t.supplier || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-silver text-center font-bold">{t.items ? t.items.length : 0}</td>
                                        <td className="px-4 py-3 text-sm text-accent-green text-right font-medium">
                                            {formatCurrency(getTransactionTotal(t))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal - Clean White Style */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex justify-between items-start bg-white dark:bg-dark-card">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Detail Inventaris</h3>
                                <p className="text-sm text-gray-500 dark:text-silver-dark mt-1">{selectedTransaction.pengajuanNumber}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={handleModalExportXLS} variant="success" icon={FileSpreadsheet} className="text-xs">XLS</Button>
                                <Button onClick={handleModalExportCSV} variant="secondary" icon={Download} className="text-xs">CSV</Button>
                                <button onClick={() => setSelectedTransaction(null)} className="ml-2 p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-full transition-colors">
                                    <span className="text-gray-400 hover:text-gray-600 text-xl">✕</span>
                                </button>
                            </div>
                        </div>

                        {/* Data Info Card */}
                        <div className="p-5 pb-0">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-silver-light mb-3">
                                <Package className="w-4 h-4" /> Data Inventaris
                            </h4>
                            <div className="bg-accent-blue text-white rounded-t-lg px-4 py-3 grid grid-cols-7 gap-4 text-xs font-semibold">
                                <span className="col-span-2">NO. PENGAJUAN</span>
                                <span>NO. PABEAN</span>
                                <span>TGL DOKUMEN</span>
                                <span>TGL DITERIMA</span>
                                <span className="text-center">JML ITEM</span>
                                <span>PENGIRIM</span>
                            </div>
                            <div className="bg-white dark:bg-dark-surface border border-t-0 border-gray-200 dark:border-dark-border rounded-b-lg px-4 py-3 grid grid-cols-7 gap-4 text-xs items-center text-gray-600 dark:text-silver">
                                <span className="col-span-2 font-medium text-accent-blue">{selectedTransaction.pengajuanNumber}</span>
                                <span>{selectedTransaction.customsDocNumber}</span>
                                <span>{selectedTransaction.customsDocDate ? new Date(selectedTransaction.customsDocDate).toLocaleDateString('id-ID') : '-'}</span>
                                <span>{new Date(selectedTransaction.date).toLocaleDateString('id-ID')}</span>
                                <span className="text-center font-bold">{selectedTransaction.items ? selectedTransaction.items.length : 0}</span>
                                <span className="truncate">{selectedTransaction.sender || selectedTransaction.supplier || '-'}</span>
                            </div>
                        </div>

                        {/* Detail Items Table */}
                        <div className="flex-1 overflow-y-auto p-5">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-silver-light mb-3">
                                📝 Detail Item
                            </h4>
                            <div className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-accent-blue text-white">
                                        <tr>
                                            <th className="px-4 py-2 text-center text-xs font-semibold w-12">NO.</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold">KODE BRG</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold">HS CODE</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold">URAIAN BARANG</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold">JUMLAH</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold">SATUAN</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold">NILAI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-border bg-white dark:bg-dark-surface">
                                        {(selectedTransaction.items || []).map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-2.5 text-center text-xs text-gray-60:dark:text-silver">{item.sequenceNumber || item.noUrut || idx + 1}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-silver-light font-medium">{item.itemCode || '-'}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-silver font-mono">{item.hsCode || '-'}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-silver-light">{item.assetName || item.itemName}</td>
                                                <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-800 dark:text-white">{item.quantity}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-gray-600 dark:text-silver">{item.unit || 'pcs'}</td>
                                                <td className="px-4 py-2.5 text-right text-xs text-gray-800 dark:text-white font-medium">
                                                    {formatCurrency(item.value)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-dark-border">
                                        <tr>
                                            <td colSpan="6" className="px-4 py-2 text-right text-xs font-bold text-gray-700 dark:text-silver">GRAND TOTAL:</td>
                                            <td className="px-4 py-2 text-right text-xs font-bold text-accent-green">
                                                {formatCurrency(getTransactionTotal(selectedTransaction))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-surface/50 flex justify-end">
                            <Button variant="secondary" onClick={() => setSelectedTransaction(null)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarangMasuk;
