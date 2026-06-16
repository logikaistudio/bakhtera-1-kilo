import React, { useState } from 'react';
import { ArrowUpCircle, Search, Eye, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import Button from '../../../components/Common/Button';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { exportToCSV } from '../../../utils/exportCSV';
import { exportToXLS } from '../../../utils/exportXLS';
import { useNavigate } from 'react-router-dom';

const BarangKeluar = () => {
    const { outboundTransactions = [], quotations = [], bridgeBusinessPartners = [], companySettings, bridgeSettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const navigate = useNavigate();

    // Helper: lookup outbound quotation by pengajuanNumber to get BL/AWB info
    const getQuotation = (pengajuanNumber) => quotations.find(
        q => q.pengajuanNumber === pengajuanNumber ||
             q.quotation_number === pengajuanNumber ||
             q.id === pengajuanNumber
    ) || null;

    // Merge: Outbound Transactions (Logs) + Approved Outbound Pengajuan (Plan)
    const mergedTransactions = React.useMemo(() => {
        const transMap = new Map();
        
        // 1. Add actual logs
        outboundTransactions.forEach(t => {
            const key = t.pengajuanNumber || t.pengajuan_number || t.id;
            transMap.set(key, t);
        });

        // 2. Add approved outbound plans
        quotations.filter(q => q.type === 'outbound' && (q.documentStatus === 'approved' || q.document_status === 'approved')).forEach(q => {
            const key = q.pengajuanNumber || q.quotation_number || q.id;
            if (!transMap.has(key)) {
                transMap.set(key, {
                    ...q,
                    pengajuanNumber: q.pengajuanNumber || q.quotation_number,
                    customsDocType: q.bcDocType || q.bc_document_type || 'BC 3.0',
                    customsDocNumber: q.bcDocumentNumber || q.bc_document_number,
                    customsDocDate: q.bcDocumentDate || q.bc_document_date || q.approvedDate || q.approved_date,
                    date: q.submissionDate || q.submission_date || q.approvedDate || q.approved_date || q.date,
                    receiver: q.receiver || q.destination || '-',
                });
            }
        });

        return Array.from(transMap.values());
    }, [outboundTransactions, quotations]);

    // Filter outbound transactions
    const filteredTransactions = mergedTransactions.filter(t => {
        const docDate = new Date(t.date || t.created_at || Date.now());
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || docDate >= start) && (!end || docDate <= end);
        const matchesSearch = (
            (t.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customer || t.destination || t.receiver || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesDate && matchesSearch;
    });

    // Helper: lookup full partner name from bridgeBusinessPartners
    const getFullPartnerName = (input) => {
        if (!input || input === '-') return '-';
        const shortName = String(input).trim();
        if (!shortName) return '-';

        const partner = (bridgeBusinessPartners || []).find(p => {
            const pName = (p.partner_name || p.name || '').trim();
            if (!pName) return false;
            
            const pNameLower = pName.toLowerCase();
            const sNameLower = shortName.toLowerCase();
            
            return pNameLower === sNameLower || 
                   pNameLower.includes(sNameLower) || 
                   sNameLower.includes(pNameLower);
        });
        
        return partner ? (partner.partner_name || partner.name) : shortName;
    };

    // Flatten: one row per item (same pattern as BarangMasuk)
    const flatRows = filteredTransactions.flatMap((t, tIdx) => {
        const quot = getQuotation(t.pengajuanNumber);
        // BL/AWB dari quotation outbound
        const blNumber = quot?.blNumber || quot?.bl_number || '-';
        const blDate = quot?.blDate || quot?.bl_date || null;
        const ownerName = getFullPartnerName(t.customer || quot?.customer || t.destination || t.receiver || '-');
        const receiver = getFullPartnerName(quot?.receiver || t.receiver || t.customer || '-');

        // Recreate flat items from quotation to get "live" data (fixes stale transaction logs)
        const quotItems = (quot?.packages || []).flatMap((pkg) => 
            (pkg.items || []).map(item => ({
                itemCode: item.itemCode || item.item_code,
                hsCode: item.hsCode || item.hs_code,
                assetName: item.name || item.itemName || item.item_name,
                unit: item.unit || item.uom,
                quantity: item.quantity,
                price: item.price,
                currency: item.currency,
                totalPrice: item.totalPrice || (Number(item.quantity) * Number(item.price))
            }))
        );

        // Prioritize quotItems (Live) > t.items (Log) > t (Top-level Log fallback)
        const items = quotItems.length > 0 ? quotItems : (t.items && t.items.length > 0 ? t.items : [{
            itemCode: t.itemCode,
            assetName: t.assetName,
            goodsType: t.assetName,
            unit: t.unit,
            quantity: t.quantity,
            value: t.value,
        }]);

        return items.map((item, itemIdx) => ({
            _transaction: t,
            _submissionSeqNo: itemIdx === 0 ? tIdx + 1 : '',        // Only show for first item
            _itemSeqNo: itemIdx + 1,           // 1-based item sequence number within submission
            blNumber,
            blDate,
            ownerName,
            // transaction fields
            pengajuanNumber: t.pengajuanNumber,
            customsDocType: t.customsDocType,
            customsDocNumber: t.customsDocNumber,
            customsDocDate: t.customsDocDate,
            receiver,
            destination: t.destination || '-',
            itemCurrency: item.currency || t.currency || t.invoiceCurrency || t.invoice_currency || 'IDR',
            invoiceCurrency: t.invoiceCurrency || t.invoice_currency || t.currency || 'IDR',
            // item-level fields
            itemCode: item.itemCode || item.item_code || '-',
            hsCode: item.hsCode || item.hs_code || '-',
            itemName: item.assetName || item.goodsType || item.itemName || item.name || item.item_name || t.assetName || '-',
            unit: item.unit || t.unit || '-',
            quantity: Number(item.quantity) || 0,
            value: Number(item.value) || 0,
            // jumlahBarang = JML = kolom JML di PackageItemManager
            jumlahBarang: Number(item.quantity) || 0,
            nominalBarang: Number(item.price) || (Number(item.value) / (Number(item.quantity) || 1)) || 0,
            // nilaiBarang = TOTAL = qty × price (kolom Total di PackageItemManager)
            nilaiBarang: Number(item.totalPrice) || (Number(item.quantity) * Number(item.price)) || Number(item.value) || 0,
        }));
    });

    // Export Main Table to XLS
    const handleExportXLS = () => {
        const headerRows = [
            { value: bridgeSettings?.company_name || companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: bridgeSettings?.company_address || companySettings?.company_address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: `NPWP: ${bridgeSettings?.company_npwp || companySettings?.company_npwp || '-'}`, style: 'normal' },
            { value: '', style: 'normal' },
            { value: 'DATA BARANG KELUAR (OUTBOUND)', style: 'title' }
        ];

        const xlsColumns = [
            { header: 'No', key: '_submissionSeqNo', width: 5, align: 'center' },
            { header: 'No Urut Item', key: '_itemSeqNo', width: 12, align: 'center' },
            { header: 'No. Bukti Pengeluaran (BL/AWB)', key: 'blNumber', width: 28 },
            { header: 'Tgl Bukti Pengeluaran', key: 'blDateStr', width: 18, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Jenis Dok', key: 'customsDocType', width: 10, align: 'center' },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'Tgl Dokumen Pabean', key: 'customsDocDateStr', width: 16, align: 'center' },
            { header: 'Nama Pemilik', key: 'ownerName', width: 28 },
            { header: 'Penerima', key: 'receiver', width: 25 },
            { header: 'Kode Barang', key: 'itemCode', width: 18 },
            { header: 'Kode HS', key: 'hsCode', width: 18 },
            { header: 'Nama Barang (Item)', key: 'itemName', width: 40 },
            { header: 'Satuan', key: 'unit', width: 12 },
            { header: 'Jml Barang', key: 'jumlahBarang', width: 14, align: 'right', summary: true },
            { header: 'Kurs', key: 'itemCurrency', width: 10, align: 'center' },
            { header: 'Nominal', key: 'nominalBarang', width: 15, align: 'right' },
            { header: 'Nilai Barang', key: 'nilaiBarang', width: 16, align: 'right', summary: true },
        ];

        const data = flatRows.map(r => ({
            ...r,
            blDateStr: r.blDate ? new Date(r.blDate).toLocaleDateString('id-ID') : '-',
            customsDocDateStr: r.customsDocDate ? new Date(r.customsDocDate).toLocaleDateString('id-ID') : '-',
        }));

        exportToXLS(data, 'Laporan_Barang_Keluar', headerRows, xlsColumns);
    };

    // Export Main Table to CSV
    const handleExportCSV = () => {
        const columns = [
            { key: '_submissionSeqNo', header: 'No' },
            { key: '_itemSeqNo', header: 'No Urut Item' },
            { key: 'blNumber', header: 'No. Bukti Pengeluaran' },
            { key: 'blDateStr', header: 'Tgl Bukti' },
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'customsDocType', header: 'Jenis Dok' },
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'customsDocDateStr', header: 'Tgl Pabean' },
            { key: 'ownerName', header: 'Nama Pemilik' },
            { key: 'receiver', header: 'Penerima' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'hsCode', header: 'Kode HS' },
            { key: 'itemName', header: 'Nama Barang (Item)' },
            { key: 'unit', header: 'Satuan' },
            { key: 'jumlahBarang', header: 'Jml Barang' },
            { key: 'itemCurrency', header: 'Kurs' },
            { key: 'nominalBarang', header: 'Nominal' },
            { key: 'nilaiBarang', header: 'Nilai Barang' },
        ];

        const data = flatRows.map(r => ({
            ...r,
            blDateStr: r.blDate ? new Date(r.blDate).toLocaleDateString('id-ID') : '-',
            customsDocDateStr: r.customsDocDate ? new Date(r.customsDocDate).toLocaleDateString('id-ID') : '-',
        }));

        exportToCSV(data, 'Barang_Keluar', columns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Barang Keluar</h1>
                <p className="text-silver-dark mt-1">Laporan Pengajuan Barang Keluar (Per Item)</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari No Pengajuan, No BC, atau Pemilik..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-orange focus:outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-orange focus:outline-none text-sm"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-orange focus:outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-orange">
                    <p className="text-xs text-silver-dark">Total Pengajuan</p>
                    <p className="text-2xl font-bold text-accent-orange">{filteredTransactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-red-500">
                    <p className="text-xs text-silver-dark">Barang Keluar</p>
                    <p className="text-2xl font-bold text-red-500">
                        {flatRows.reduce((sum, r) => sum + (r.jumlahBarang || 0), 0).toLocaleString('id-ID')}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">Jumlah Total</p>
                    <p className="text-xl font-bold text-accent-green">
                        {formatCurrency(flatRows.reduce((sum, r) => sum + (r.nilaiBarang || 0), 0))}
                    </p>
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ArrowUpCircle className="w-5 h-5 text-accent-orange" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Dokumen Barang Keluar</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportXLS} variant="success" icon={FileSpreadsheet} className="!py-1.5 !px-3 !text-xs">XLS</Button>
                        <Button onClick={handleExportCSV} variant="secondary" icon={Download} className="!py-1.5 !px-3 !text-xs">CSV</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-accent-orange/10 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-8">No</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-32">No. Bukti Pengeluaran</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-24">Tgl Bukti</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider" style={{ minWidth: '384px' }}>Nama Pemilik</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-28">No. Pengajuan</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-16">Jenis Dok</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-24">No. Pabean</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-22">Tgl Pabean</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider" style={{ minWidth: '384px' }}>Penerima</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-8">No Urut Item</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-24">Kode Barang</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-24">Kode HS</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-36">Nama Barang</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-14">Satuan</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-silver uppercase tracking-wider w-20">Jml Barang</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-14">Kurs</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-silver uppercase tracking-wider w-24">Nominal</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-silver uppercase tracking-wider w-24">Nilai Barang</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-20">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {flatRows.length === 0 ? (
                                <tr>
                                    <td colSpan="15" className="px-4 py-12 text-center text-silver-dark">
                                        Tidak ada data yang ditemukan
                                    </td>
                                </tr>
                            ) : (
                                flatRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-dark-surface/50 transition-colors">
                                        <td className="px-2 py-1.5 text-center font-bold text-white text-xs">{row._submissionSeqNo}</td>
                                        <td className="px-2 py-1.5 text-accent-orange font-mono font-medium whitespace-nowrap text-xs max-w-[128px] truncate">
                                            {row.blNumber !== '-' ? row.blNumber : <span className="text-silver-dark italic">-</span>}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-silver whitespace-nowrap text-xs">
                                            {row.blDate ? new Date(row.blDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-silver font-medium text-xs">
                                            <div className="line-clamp-2" title={row.ownerName}>{row.ownerName}</div>
                                        </td>
                                        <td className="px-2 py-1.5 text-silver-dark font-mono whitespace-nowrap text-xs">{row.pengajuanNumber || '-'}</td>
                                        <td className="px-2 py-1.5 text-silver whitespace-nowrap text-xs">{row.customsDocType || 'BC 3.0'}</td>
                                        <td className="px-2 py-1.5 text-silver font-mono whitespace-nowrap text-xs">{row.customsDocNumber || '-'}</td>
                                        <td className="px-2 py-1.5 text-center text-silver whitespace-nowrap text-xs">
                                            {row.customsDocDate ? new Date(row.customsDocDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-silver text-xs">
                                            <div className="line-clamp-2" title={getFullPartnerName(row.receiver)}>{getFullPartnerName(row.receiver)}</div>
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-silver text-xs">{row._itemSeqNo}</td>
                                        <td className="px-2 py-1.5 text-silver font-mono whitespace-nowrap text-xs">{row.itemCode || '-'}</td>
                                        <td className="px-2 py-1.5 text-silver font-mono whitespace-nowrap text-xs">{row.hsCode || '-'}</td>
                                        <td className="px-2 py-1.5 text-silver-light text-xs max-w-[144px] truncate whitespace-nowrap">{row.itemName}</td>
                                        <td className="px-2 py-1.5 text-center text-silver text-xs whitespace-nowrap">{row.unit || '-'}</td>
                                        <td className="px-2 py-1.5 text-right text-silver-light font-medium text-xs whitespace-nowrap">
                                            {row.jumlahBarang ? Number(row.jumlahBarang).toLocaleString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-silver text-xs whitespace-nowrap">{row.itemCurrency}</td>
                                        <td className="px-2 py-1.5 text-right text-silver-light font-medium text-xs whitespace-nowrap">
                                            {row.nominalBarang ? Number(row.nominalBarang).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-accent-orange font-medium text-xs whitespace-nowrap">
                                            {row.nilaiBarang ? Number(row.nilaiBarang).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <button
                                                onClick={() => navigate(`/bridge/pengajuan?detail=${encodeURIComponent(row.pengajuanNumber)}`)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-orange/10 hover:bg-accent-orange/20 text-accent-orange transition-colors text-xs font-medium whitespace-nowrap"
                                                title="Lihat Detail Pengajuan"
                                            >
                                                <Eye className="w-3 h-3" />
                                                <span>Detail</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
							)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BarangKeluar;
