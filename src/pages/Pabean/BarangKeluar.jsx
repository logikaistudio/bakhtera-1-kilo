import React, { useState, useMemo } from 'react';
import { ArrowUpCircle, Search, Package, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { formatCurrency } from '../../utils/currencyFormatter';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const BarangKeluar = () => {
    const {
        inboundTransactions = [],
        quotations = [], // Add quotations for source of truth
        companySettings
    } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Create a lookup map for inbound item UNIT PRICES
    // Key: pengajuanNumber -> { itemsByCode: { itemCode: unitPrice } }
    // Unit price = value / quantity (atau value jika quantity = 0 atau 1)
    const inboundUnitPriceLookup = useMemo(() => {
        const lookup = {};
        inboundTransactions.forEach(t => {
            const pengajuan = t.pengajuanNumber || t.pengajuan_number;
            if (pengajuan) {
                if (!lookup[pengajuan]) {
                    lookup[pengajuan] = {
                        itemsByCode: {}
                    };
                }

                // If transaction has items array
                if (t.items && Array.isArray(t.items)) {
                    t.items.forEach(item => {
                        const code = item.itemCode || item.item_code;
                        const qty = parseFloat(item.quantity) || 1;
                        const val = parseFloat(item.value) || 0;
                        if (code && qty > 0) {
                            lookup[pengajuan].itemsByCode[code] = val / qty;
                        }
                    });
                } else {
                    // Single item transaction
                    const code = t.itemCode || t.item_code;
                    const qty = parseFloat(t.quantity) || 1;
                    const val = parseFloat(t.value) || 0;
                    if (code && qty > 0) {
                        lookup[pengajuan].itemsByCode[code] = val / qty;
                    }
                }
            }
        });
        return lookup;
    }, [inboundTransactions]);

    // Group transactions by pengajuanNumber - USING QUOTATIONS AS SOURCE
    const groupedTransactions = useMemo(() => {
        // Filter valid outbound quotations
        // Status: submitted, approved, processed
        const validQuotations = quotations.filter(q =>
            q.type === 'outbound' &&
            ['submitted', 'approved', 'processed'].includes(q.outbound_status || q.documentStatus || q.document_status)
        );

        return validQuotations.map(q => {
            const key = q.quotationNumber || q.quotation_number;
            const sourcePengajuan = q.sourcePengajuanNumber || q.source_pengajuan_number;
            const inboundData = sourcePengajuan ? inboundUnitPriceLookup[sourcePengajuan] : null;

            // Flatten items from packages
            const flatItems = [];
            let totalValue = 0;

            (q.packages || []).forEach(pkg => {
                (pkg.items || []).forEach(item => {
                    const itemCode = item.itemCode || item.item_code;

                    // FIX: Determine correct outbound quantity
                    // Priority: outboundQuantity > outboundQty > quantity
                    // If source is inventory, 'quantity' is often Initial Stock, so we must prioritize outboundQuantity
                    let outboundQty = 0;
                    if (item.outboundQuantity !== undefined && item.outboundQuantity !== null) {
                        outboundQty = parseFloat(item.outboundQuantity);
                    } else if (item.outboundQty !== undefined && item.outboundQty !== null) {
                        outboundQty = parseFloat(item.outboundQty);
                    } else {
                        outboundQty = parseFloat(item.quantity) || 0;
                    }

                    // Skip if quantity is effectively 0
                    if (outboundQty <= 0) return;

                    const unitPrice = inboundData?.itemsByCode?.[itemCode] || 0;
                    const itemValue = unitPrice * outboundQty;

                    totalValue += itemValue;

                    flatItems.push({
                        itemCode: itemCode,
                        hsCode: item.hsCode || item.hs_code,
                        assetName: item.name || item.itemName || item.item_name,
                        goodsType: item.goodsType || item.goods_type || 'Barang Jadi',
                        quantity: outboundQty,
                        unit: item.uom || item.unit || 'pcs',
                        value: itemValue,
                        sequenceNumber: item.serialNumber || item.serial_number,
                        packageNumber: pkg.packageNumber || pkg.package_number,
                        originalQuantity: item.quantity // Keep track of original stock for reference
                    });
                });
            });

            return {
                id: q.id,
                pengajuanNumber: key,
                customsDocNumber: q.bcDocumentNumber || q.bc_document_number || '-',
                customsDocType: q.bcDocType || q.bc_document_type || 'BC 2.7', // Default for outbound
                customsDocDate: q.bcDocumentDate || q.bc_document_date,
                date: q.outbound_date || q.approvedDate || q.approved_date || q.date,
                destination: q.destination,
                receiver: q.customer || q.receiver, // Use customer as receiver
                sourcePengajuanNumber: sourcePengajuan,
                items: flatItems,
                totalValue: totalValue
            };
        });
    }, [quotations, inboundUnitPriceLookup]); // Removed outboundTransactions dependency

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        return groupedTransactions.filter(t => {
            const matchesSearch = (t.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.customsDocType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.destination || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.receiver || '').toLowerCase().includes(searchTerm.toLowerCase());

            const tDate = new Date(t.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (end) end.setHours(23, 59, 59, 999);

            const matchesDate = (!start || tDate >= start) && (!end || tDate <= end);

            return matchesSearch && matchesDate;
        });
    }, [groupedTransactions, searchTerm, startDate, endDate]);

    // Helper to calc total value of a transaction
    const getTransactionTotal = (t) => {
        // Use pre-calculated totalValue from grouping if available
        if (t.totalValue !== undefined && t.totalValue > 0) return t.totalValue;
        if (!t.items || t.items.length === 0) return parseFloat(t.value) || 0;
        return t.items.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const allItems = filteredTransactions.flatMap(t => {
            return (t.items || []).map((item, idx) => ({
                ...t,
                ...item,
                noUrut: item.sequenceNumber || item.noUrut || (idx + 1),
                totalValue: getTransactionTotal(t)
            }));
        });

        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'customsDocType', header: 'Jenis Dokumen' },
            { key: 'customsDocNumber', header: 'No. Dokumen (Pabean)' },
            { key: 'customsDocDate', header: 'Tanggal Dokumen' },
            { key: 'date', header: 'Tanggal Keluar' },
            { key: 'destination', header: 'Tujuan' },
            { key: 'receiver', header: 'Penerima' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'assetName', header: 'Nama Barang' },
            { key: 'quantity', header: 'Quantity' },
            { key: 'unit', header: 'Satuan' },
            { key: 'value', header: 'Nilai Item' },
            { key: 'totalValue', header: 'Total Nilai Pengajuan' }
        ];

        const dataToExport = allItems.map(item => ({
            ...item,
            date: item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-',
            customsDocDate: item.customsDocDate ? new Date(item.customsDocDate).toLocaleDateString('id-ID') : '-'
        }));

        exportToCSV(dataToExport, 'Barang_Keluar', columns);
    };

    // Export to XLS handler
    const handleExportXLS = () => {
        if (filteredTransactions.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        const allItems = filteredTransactions.flatMap(t => {
            return (t.items || []).map((item, idx) => ({
                ...t,
                ...item,
                noUrut: item.sequenceNumber || item.noUrut || (idx + 1)
            }));
        });

        const headerRows = [
            { value: companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: companySettings?.address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: 'DATA BARANG KELUAR (OUTBOUND)', style: 'title' }
        ];

        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Jenis Dokumen', key: 'customsDocType', width: 15 },
            { header: 'No Pabean', key: 'customsDocNumber', width: 15 },
            { header: 'Tujuan', key: 'destination', width: 20 },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'Nama Barang', key: 'assetName', width: 30 },
            { header: 'Jumlah', key: 'quantity', width: 10, align: 'center', render: (i) => Number(i.quantity) || 0 },
            { header: 'Nilai', key: 'value', width: 15, align: 'right', render: (i) => formatCurrency(i.value) }
        ];

        exportToXLS(allItems, 'Laporan_Barang_Keluar', headerRows, xlsColumns);
    };

    // Modal Specific Exports
    const handleModalExportCSV = () => {
        if (!selectedTransaction) return;
        const items = selectedTransaction.items || [];
        const columns = [
            { key: 'noUrut', header: 'No' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'hsCode', header: 'HS Code' },
            { key: 'assetName', header: 'Uraian Barang' },
            { key: 'quantity', header: 'Jumlah' },
            { key: 'unit', header: 'Satuan' },
            { key: 'value', header: 'Nilai Satuan' },
            { key: 'totalValue', header: 'Total Nilai' }
        ];

        const data = items.map((item, idx) => ({
            ...item,
            noUrut: idx + 1,
            totalValue: parseFloat(item.value || 0) * 1
        }));

        exportToCSV(data, `Detail_Outbound_${selectedTransaction.pengajuanNumber}`, columns);
    };

    const handleModalExportXLS = () => {
        if (!selectedTransaction) return;

        const headerRows = [
            { value: companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: `DETAIL OUTBOUND: ${selectedTransaction.pengajuanNumber}`, style: 'title' },
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

        exportToXLS(selectedTransaction.items || [], `Detail_Outbound_${selectedTransaction.pengajuanNumber}`, headerRows, xlsColumns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Barang Keluar</h1>
                <p className="text-silver-dark mt-1">Daftar Pengajuan Barang Keluar (Per Dokumen)</p>
            </div>

            {/* Search & Stats */}
            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari No Pengajuan, No BC, atau Tujuan..."
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
                <div className="glass-card p-4 rounded-lg border border-accent-orange">
                    <p className="text-xs text-silver-dark">Total Pengajuan</p>
                    <p className="text-2xl font-bold text-accent-orange">{filteredTransactions.length}</p>
                </div>
                {/* NEW: Barang Keluar Summary Box */}
                <div className="glass-card p-4 rounded-lg border border-red-500">
                    <p className="text-xs text-silver-dark">Barang Keluar</p>
                    <p className="text-2xl font-bold text-red-500">
                        {filteredTransactions.reduce((sum, t) => {
                            // Calculate total quantity for each transaction
                            const tQty = (t.items || []).reduce((iq, item) => iq + (Number(item.quantity) || 0), 0);
                            return sum + tQty;
                        }, 0)}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Total Nilai (Filtered)</p>
                    <p className="text-xl font-bold text-accent-green">
                        {formatCurrency(filteredTransactions.reduce((sum, t) => sum + getTransactionTotal(t), 0))}
                    </p>
                </div>
            </div>

            {/* Main Table - Grouped by Pengajuan */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-accent-orange" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Dokumen Keluar</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportXLS} variant="success" icon={FileSpreadsheet} className="!py-1.5 !px-3 !text-xs">XLS</Button>
                        <Button onClick={handleExportCSV} variant="secondary" icon={Download} className="!py-1.5 !px-3 !text-xs">CSV</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-orange/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">No. Pengajuan</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">Jenis Dok</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">No. Pabean</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase tracking-wider">Tgl Dok</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider">Tujuan</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase tracking-wider">Jml Item</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver uppercase tracking-wider">Total Nilai</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-12 text-center text-silver-dark">
                                        Tidak ada data yang ditemukan
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t, idx) => (
                                    <tr key={idx} className="hover:bg-dark-surface/50 transition-colors cursor-pointer" onClick={() => setSelectedTransaction(t)}>
                                        <td className="px-4 py-3 text-sm text-accent-orange font-medium">{t.pengajuanNumber || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-silver">{t.customsDocType || 'BC 3.0'}</td>
                                        <td className="px-4 py-3 text-sm text-silver font-mono">{t.customsDocNumber || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-silver text-center">
                                            {t.customsDocDate ? new Date(t.customsDocDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver">{t.destination || t.receiver || '-'}</td>
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

            {/* Detail Modal - Clean White Style (Same as BarangMasuk) */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex justify-between items-start bg-white dark:bg-dark-card">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Detail Barang Keluar</h3>
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
                                <Package className="w-4 h-4" /> Data Dokumen
                            </h4>
                            <div className="bg-accent-orange text-white rounded-t-lg px-4 py-3 grid grid-cols-7 gap-4 text-xs font-semibold">
                                <span className="col-span-2">NO. PENGAJUAN</span>
                                <span>NO. PABEAN</span>
                                <span>TGL DOKUMEN</span>
                                <span>TGL KELUAR</span>
                                <span className="text-center">JML ITEM</span>
                                <span>TUJUAN</span>
                            </div>
                            <div className="bg-white dark:bg-dark-surface border border-t-0 border-gray-200 dark:border-dark-border rounded-b-lg px-4 py-3 grid grid-cols-7 gap-4 text-xs items-center text-gray-600 dark:text-silver">
                                <span className="col-span-2 font-medium text-accent-orange">{selectedTransaction.pengajuanNumber}</span>
                                <span>{selectedTransaction.customsDocNumber || '-'}</span>
                                <span>{selectedTransaction.customsDocDate ? new Date(selectedTransaction.customsDocDate).toLocaleDateString('id-ID') : '-'}</span>
                                <span>{selectedTransaction.date ? new Date(selectedTransaction.date).toLocaleDateString('id-ID') : '-'}</span>
                                <span className="text-center font-bold">{selectedTransaction.items ? selectedTransaction.items.length : 0}</span>
                                <span className="truncate">{selectedTransaction.destination || selectedTransaction.receiver || '-'}</span>
                            </div>
                        </div>

                        {/* Detail Items Table */}
                        <div className="flex-1 overflow-y-auto p-5">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-silver-light mb-3">
                                📝 Detail Item
                            </h4>
                            <div className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-accent-orange text-white">
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
                                                <td className="px-4 py-2.5 text-center text-xs text-gray-600 dark:text-silver">{idx + 1}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-silver-light font-medium">{item.itemCode || '-'}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-silver font-mono">{item.hsCode || '-'}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-silver-light">{item.assetName || item.itemName || item.goodsType || '-'}</td>
                                                <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-800 dark:text-white">{item.quantity || 0}</td>
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

export default BarangKeluar;
