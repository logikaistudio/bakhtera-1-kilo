import React, { useState } from 'react';
import { ArrowDownCircle, Search, Eye, Package, Download, FileSpreadsheet, FileText, X, ZoomIn } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import Button from '../../../components/Common/Button';
import { formatCurrency } from '../../../utils/currencyFormatter';
import { exportToCSV } from '../../../utils/exportCSV';
import { exportToXLS } from '../../../utils/exportXLS';
import DocumentPreviewModal from '../../../components/Common/DocumentPreviewModal';
import { useNavigate } from 'react-router-dom';

const BarangMasuk = () => {
    const { inboundTransactions = [], quotations = [], bridgeBusinessPartners = [], companySettings, bridgeSettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const navigate = useNavigate();
    // Document gallery modal state
    const [docModal, setDocModal] = useState(null); // { title, docs[] }
    // Document preview state
    const [previewDoc, setPreviewDoc] = useState(null);

    // Helper: lookup quotation by pengajuanNumber to get BL/AWB info
    const getQuotation = (pengajuanNumber) => quotations.find(
        q => q.pengajuanNumber === pengajuanNumber ||
             q.quotation_number === pengajuanNumber ||
             q.id === pengajuanNumber
    ) || null;

    // Merge: Inbound Transactions (Logs) + Approved Inbound Pengajuan (Plan)
    // This ensures that even if automation fails, approved documents still show in Pabean report
    const mergedTransactions = React.useMemo(() => {
        const transMap = new Map();
        
        // 1. Add all actual transaction logs
        inboundTransactions.forEach(t => {
            const key = t.pengajuanNumber || t.pengajuan_number || t.id;
            transMap.set(key, t);
        });

        // 2. Add approved quotations that don't have transaction logs yet
        quotations.filter(q => q.type === 'inbound' && (q.documentStatus === 'approved' || q.document_status === 'approved')).forEach(q => {
            const key = q.pengajuanNumber || q.quotation_number || q.id;
            if (!transMap.has(key)) {
                transMap.set(key, {
                    ...q,
                    pengajuanNumber: q.pengajuanNumber || q.quotation_number,
                    customsDocType: q.bcDocType || q.bc_document_type || 'BC 2.3',
                    customsDocNumber: q.bcDocumentNumber || q.bc_document_number,
                    customsDocDate: q.bcDocumentDate || q.bc_document_date || q.approvedDate || q.approved_date,
                    date: q.submissionDate || q.submission_date || q.approvedDate || q.approved_date || q.date,
                    sender: q.shipper || q.customer || '-',
                    // items will be handled by the mapping logic
                });
            }
        });

        return Array.from(transMap.values());
    }, [inboundTransactions, quotations]);

    // Filter Transactions
    const filteredTransactions = mergedTransactions.filter(t => {
        const rawDate = t.date || t.created_at || null;
        const docDate = rawDate ? new Date(rawDate) : null;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = docDate ? ((!start || docDate >= start) && (!end || docDate <= end)) : (!start && !end);
        const matchesSearch = (
            (t.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.sender || t.supplier || t.shipper || '').toLowerCase().includes(searchTerm.toLowerCase())
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

    // Flatten: one row per item (with item sequence number from pengajuan)
    const flatRows = filteredTransactions.flatMap((t, tIdx) => {
        const quot = getQuotation(t.pengajuanNumber);
        const blNumber = quot?.blNumber || quot?.bl_number || '-';
        const blDate = quot?.blDate || quot?.bl_date || null;
        const ownerName = getFullPartnerName(t.customer || quot?.customer || t.sender || '-');
        const sender = getFullPartnerName(t.sender || '-');

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
            sender,
            itemCurrency: item.currency || t.currency || t.invoiceCurrency || t.invoice_currency || 'IDR',
            invoiceCurrency: t.invoiceCurrency || t.invoice_currency || t.currency || 'IDR',
            // item-level fields
            itemCode: item.itemCode || item.item_code || '-',
            hsCode: item.hsCode || item.hs_code || '-',
            itemName: item.assetName || item.goodsType || item.itemName || item.name || item.item_name || t.assetName || '-',
            unit: item.unit || t.unit || '-',
            quantity: Number(item.quantity) || 0,
            value: Number(item.value) || 0,
            // nilaiBarang = kolom TOTAL = qty × price (item.totalPrice dari PackageItemManager)
            nilaiBarang: Number(item.totalPrice) || (Number(item.quantity) * Number(item.price)) || Number(item.value) || 0,
            // jumlahBarang = JML = jumlah/qty item (kolom JML di PackageItemManager)
            jumlahBarang: Number(item.quantity) || 0,
            nominalBarang: Number(item.price) || (Number(item.value) / (Number(item.quantity) || 1)) || 0,
        }));
    });

    // Helper: Calculate Total Value
    const getTransactionTotal = (t) => {
        if (t.invoiceValue) return Number(t.invoiceValue);
        return (t.items || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    };

    // Helper: Calculate Total Qty
    const getTransactionQty = (t) => {
        return (t.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    };

    // Helper: open document gallery modal for a transaction
    const handleOpenDocModal = (transaction, pengajuanNumber) => {
        const docs = [
            ...(transaction.documents || []),
            ...(transaction.bcSupportingDocuments || [])
        ];
        setDocModal({
            title: `Dok. Pendukung — ${pengajuanNumber || transaction.pengajuanNumber}`,
            docs
        });
    };

    // Helper: resolve doc src with fileData priority
    const resolveDocSrc = (doc) => {
        const raw = doc.fileData || doc.data || doc.base64 || null;
        if (raw) {
            if (typeof raw === 'string' && raw.startsWith('data:')) return raw;
            if (typeof raw === 'string') {
                const mime = doc.fileType
                    ? (doc.fileType.includes('/') ? doc.fileType : `image/${doc.fileType}`)
                    : (doc.fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
                return `data:${mime};base64,${raw.replace(/\s+/g, '')}`;
            }
        }
        return doc.url || null;
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
            { header: 'No', key: '_submissionSeqNo', width: 5, align: 'center' },
            { header: 'No Urut Item', key: '_itemSeqNo', width: 12, align: 'center' },
            { header: 'No. Bukti Penerimaan (BL/AWB)', key: 'blNumber', width: 28 },
            { header: 'Tgl Bukti Penerimaan', key: 'blDateStr', width: 18, align: 'center' },
            { header: 'Nama Pemilik', key: 'ownerName', width: 28 },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Jenis Dok', key: 'customsDocType', width: 10, align: 'center' },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'Tgl Dokumen Pabean', key: 'customsDocDateStr', width: 16, align: 'center' },
            { header: 'Pengirim', key: 'sender', width: 25 },
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

        exportToXLS(data, 'Laporan_Barang_Masuk', headerRows, xlsColumns);
    };

    // Export Main Table to CSV
    const handleExportCSV = () => {
        const columns = [
            { key: '_submissionSeqNo', header: 'No' },
            { key: '_itemSeqNo', header: 'No Urut Item' },
            { key: 'blNumber', header: 'No. Bukti Penerimaan' },
            { key: 'blDate', header: 'Tgl Bukti' },
            { key: 'ownerName', header: 'Nama Pemilik' },
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'customsDocType', header: 'Jenis Dok' },
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'customsDocDate', header: 'Tgl Dokumen Pabean' },
            { key: 'sender', header: 'Pengirim' },
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
            { header: 'HS', key: 'hsCode', width: 15 },
            { header: 'ITEM', key: 'assetName', width: 30 },
            { header: 'JML', key: 'quantity', width: 8, align: 'center', render: (i) => Number(i.quantity) || 0 },
            { header: 'SAT', key: 'unit', width: 8, align: 'center' },
            { header: 'NOMINAL', key: 'nominal', width: 15, align: 'right', render: (i) => formatCurrency(i.price || (i.quantity ? i.value / i.quantity : 0)) },
            { header: 'TOTAL', key: 'value', width: 15, align: 'right', render: (i) => formatCurrency(i.value) },
            { header: 'KURS', key: 'currency', width: 8, align: 'center' }
        ];

        // Inject currency info to each item
        const itemsWithCurrency = getSyncedItems(selectedTransaction).map(i => ({ ...i, currency: selectedTransaction.invoiceCurrency || selectedTransaction.currency || 'IDR' }));
        exportToXLS(itemsWithCurrency, `Detail_${selectedTransaction.pengajuanNumber}`, headerRows, xlsColumns);
    };

    // Export Detail Modal to CSV
    const handleModalExportCSV = () => {
        if (!selectedTransaction) return;

        const columns = [
            { key: 'hsCode', header: 'HS' },
            { key: 'assetName', header: 'ITEM' },
            { key: 'quantity', header: 'JML' },
            { key: 'unit', header: 'SAT' },
            { key: 'nominal', header: 'NOMINAL' },
            { key: 'value', header: 'TOTAL' },
            { key: 'currency', header: 'KURS' }
        ];
        const itemsWithCurrency = getSyncedItems(selectedTransaction).map(i => ({ 
            ...i, 
            currency: selectedTransaction.invoiceCurrency || selectedTransaction.currency || 'IDR',
            nominal: i.price || (i.quantity ? i.value / i.quantity : 0)
        }));
        exportToCSV(itemsWithCurrency, `Detail_${selectedTransaction.pengajuanNumber}`, columns);
    };

    // Helper: Sinkronisasi nilai item dan kurs dari pengajuan
    const getSyncedItems = (t) => {
        // Jika ada invoiceValue, bagi rata ke semua item (atau gunakan logic lain sesuai kebutuhan)
        if (t.invoiceValue && t.items && t.items.length > 0) {
            const perItemValue = Number(t.invoiceValue) / t.items.length;
            return t.items.map(item => ({
                ...item,
                value: perItemValue,
                currency: t.invoiceCurrency || t.currency || 'IDR',
            }));
        }
        // Jika tidak, tetap gunakan value asli
        return (t.items || []).map(item => ({
            ...item,
            currency: t.invoiceCurrency || t.currency || 'IDR',
        }));
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
                    <table className="w-full text-xs">
                        <thead className="bg-accent-blue/10 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-8">No</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-32">No. Bukti Penerimaan</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-24">Tgl Bukti</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider" style={{ minWidth: '384px' }}>Nama Pemilik</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-28">No. Pengajuan</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-16">Jenis Dok</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider w-24">No. Pabean</th>
                                <th className="px-2 py-2 text-center text-xs font-semibold text-silver uppercase tracking-wider w-22">Tgl Pabean</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-silver uppercase tracking-wider" style={{ minWidth: '384px' }}>Pengirim</th>
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
                                        <td className="px-2 py-1.5 text-accent-blue font-mono font-medium whitespace-nowrap text-xs max-w-[128px] truncate">
                                            {row.blNumber !== '-' ? row.blNumber : <span className="text-silver-dark italic">-</span>}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-silver whitespace-nowrap text-xs">
                                            {row.blDate ? new Date(row.blDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-silver font-medium text-xs">
                                            <div className="line-clamp-2" title={row.ownerName}>{row.ownerName}</div>
                                        </td>
                                        <td className="px-2 py-1.5 text-silver-dark font-mono whitespace-nowrap text-xs">{row.pengajuanNumber || '-'}</td>
                                        <td className="px-2 py-1.5 text-silver whitespace-nowrap text-xs">{row.customsDocType || 'BC 2.3'}</td>
                                        <td className="px-2 py-1.5 text-silver font-mono whitespace-nowrap text-xs">{row.customsDocNumber || '-'}</td>
                                        <td className="px-2 py-1.5 text-center text-silver whitespace-nowrap text-xs">
                                            {row.customsDocDate ? new Date(row.customsDocDate).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-silver text-xs">
                                            <div className="line-clamp-2" title={getFullPartnerName(row.sender)}>{getFullPartnerName(row.sender)}</div>
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
                                        <td className="px-2 py-1.5 text-right text-accent-green font-medium text-xs whitespace-nowrap">
                                            {row.nilaiBarang ? Number(row.nilaiBarang).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <button
                                                onClick={() => navigate(`/bridge/pengajuan?detail=${encodeURIComponent(row.pengajuanNumber)}`)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue transition-colors text-xs font-medium whitespace-nowrap"
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
                                <span className="truncate" title={getFullPartnerName(selectedTransaction.sender || selectedTransaction.supplier)}>{getFullPartnerName(selectedTransaction.sender || selectedTransaction.supplier)}</span>
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
                                            <th className="px-4 py-2 text-left text-xs font-semibold">HS</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold">ITEM</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold">JML</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold">SAT</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold">NOMINAL</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold">TOTAL</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold">KURS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-border bg-white dark:bg-dark-surface">
                                        {getSyncedItems(selectedTransaction).map((item, idx) => {
                                            const nominal = item.price || (item.quantity ? item.value / item.quantity : 0);
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-silver font-mono">{item.hsCode || '-'}</td>
                                                    <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-silver-light">{item.assetName || item.itemName}</td>
                                                    <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-800 dark:text-white">{item.quantity}</td>
                                                    <td className="px-4 py-2.5 text-center text-xs text-gray-600 dark:text-silver">{item.unit || 'pcs'}</td>
                                                    <td className="px-4 py-2.5 text-right text-xs text-gray-800 dark:text-white">
                                                        {formatCurrency(nominal)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-xs text-gray-800 dark:text-white font-medium">
                                                        {formatCurrency(item.value)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center text-xs text-gray-600 dark:text-silver">{item.currency || 'IDR'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-dark-border">
                                        <tr>
                                            <td colSpan="5" className="px-4 py-2 text-right text-xs font-bold text-gray-700 dark:text-silver">GRAND TOTAL:</td>
                                            <td className="px-4 py-2 text-right text-xs font-bold text-accent-green">
                                                {formatCurrency(getTransactionTotal(selectedTransaction))}
                                            </td>
                                            <td className="px-4 py-2 text-center text-xs font-bold text-accent-green">{selectedTransaction.currency || 'IDR'}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Documents Section */}
                        <div className="p-5 border-t border-gray-100 dark:border-dark-border">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-silver-light mb-3">
                                📑 Dokumen Pendukung
                            </h4>
                            {[...(selectedTransaction.documents || []), ...(selectedTransaction.bcSupportingDocuments || [])].length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-silver-dark">Tidak ada dokumen pendukung.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    {[...(selectedTransaction.documents || []), ...(selectedTransaction.bcSupportingDocuments || [])].map((doc, idx) => (
                                        <div key={idx} className="border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface rounded-lg p-3 hover:shadow-md transition-shadow">
                                            {doc.type && doc.type.startsWith('image/') ? (
                                                <div className="aspect-video bg-white dark:bg-dark-card rounded mb-2 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-dark-border">
                                                    <img 
                                                        src={doc.data || doc.url} 
                                                        alt={doc.title || doc.name || doc.fileName} 
                                                        className="object-contain w-full h-full cursor-pointer hover:scale-105 transition-transform"
                                                        onClick={() => {
                                                            const win = window.open();
                                                            win.document.write(`<iframe src="${doc.data || doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="aspect-video bg-white dark:bg-dark-card rounded mb-2 flex flex-col items-center justify-center cursor-pointer border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface/80"
                                                    onClick={() => {
                                                        const win = window.open();
                                                        win.document.write(`<iframe src="${doc.data || doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                    }}
                                                >
                                                    <div className="w-10 h-10 text-gray-400 dark:text-silver-dark border-2 border-gray-200 dark:border-dark-border rounded-lg flex items-center justify-center mb-1 bg-gray-50 dark:bg-dark-surface">
                                                        <span className="text-[10px] font-bold uppercase">{doc.type ? doc.type.split('/')[1] : 'PDF'}</span>
                                                    </div>
                                                    <span className="text-[10px] text-accent-blue text-center px-2 underline">Buka Dokumen</span>
                                                </div>
                                            )}
                                            <div className="text-sm font-medium text-gray-800 dark:text-silver-light truncate" title={doc.title || doc.name || doc.fileName}>{doc.title || doc.name || doc.fileName || `Dokumen ${idx + 1}`}</div>
                                            <div className="text-xs text-gray-500 dark:text-silver-dark truncate">Tgl: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('id-ID') : '-'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-surface/50 flex justify-end">
                            <Button variant="secondary" onClick={() => setSelectedTransaction(null)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== STANDALONE DOCUMENT GALLERY MODAL ===== */}
            {docModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-dark-card rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-dark-border overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-dark-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-accent-blue" />
                                <h3 className="font-semibold text-silver-light text-sm">{docModal.title}</h3>
                                <span className="text-xs bg-accent-blue/20 text-accent-blue px-2 py-0.5 rounded-full font-medium">
                                    {docModal.docs.length} dokumen
                                </span>
                            </div>
                            <button
                                onClick={() => setDocModal(null)}
                                className="p-1.5 rounded-lg hover:bg-dark-surface text-silver-dark hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Document Grid */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {docModal.docs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3 text-silver-dark">
                                    <FileText className="w-10 h-10 opacity-30" />
                                    <p className="text-sm">Tidak ada dokumen pendukung</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {docModal.docs.map((doc, idx) => {
                                        const src = resolveDocSrc(doc);
                                        const mime = doc.fileType || doc.type || '';
                                        const isImage = mime.startsWith('image/') ||
                                            (src && /^data:image\//.test(src)) ||
                                            /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '');
                                        const ext = (doc.fileName || doc.name || '').split('.').pop().toUpperCase() || 'DOC';

                                        return (
                                            <div
                                                key={idx}
                                                className="group flex flex-col rounded-xl border border-dark-border bg-dark-surface hover:border-accent-blue/50 transition-all overflow-hidden cursor-pointer shadow-sm hover:shadow-accent-blue/10 hover:shadow-lg"
                                                onClick={() => setPreviewDoc(doc)}
                                            >
                                                {/* Thumbnail / Type indicator */}
                                                <div className="relative h-28 flex items-center justify-center bg-dark-card border-b border-dark-border overflow-hidden">
                                                    {isImage && src ? (
                                                        <img
                                                            src={src}
                                                            alt={doc.name || doc.fileName}
                                                            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-200"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1.5 text-silver-dark">
                                                            <div className="w-12 h-12 rounded-lg border-2 border-dark-border flex items-center justify-center bg-dark-surface">
                                                                <span className="text-xs font-bold text-silver uppercase">{ext.slice(0, 4)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Overlay on hover */}
                                                    <div className="absolute inset-0 bg-accent-blue/0 group-hover:bg-accent-blue/10 transition-all flex items-center justify-center">
                                                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                                                    </div>
                                                </div>
                                                {/* File info */}
                                                <div className="p-2.5">
                                                    <p className="text-xs font-medium text-silver-light truncate" title={doc.name || doc.fileName || `Dokumen ${idx + 1}`}>
                                                        {doc.name || doc.fileName || `Dokumen ${idx + 1}`}
                                                    </p>
                                                    <p className="text-[10px] text-silver-dark mt-0.5">
                                                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('id-ID') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-dark-border bg-dark-surface/50 flex justify-end">
                            <Button variant="secondary" onClick={() => setDocModal(null)}>Tutup</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DOCUMENT PREVIEW MODAL ===== */}
            <DocumentPreviewModal
                show={!!previewDoc}
                doc={previewDoc}
                onClose={() => setPreviewDoc(null)}
            />
        </div>
    );
};

export default BarangMasuk;
