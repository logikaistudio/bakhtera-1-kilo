import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Search, Package, ArrowDownCircle, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import Button from '../../../components/Common/Button';
import { exportToCSV } from '../../../utils/exportCSV';
import { exportToXLS } from '../../../utils/exportXLS';

const PergerakanBarang = () => {
    const [searchParams] = useSearchParams();
    const { inboundTransactions = [], quotations = [], mutationLogs = [], companySettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    // FLATTEN OUTBOUND TRANSACTIONS FROM QUOTATIONS (Source of Truth)
    const outboundTransactions = useMemo(() => {
        return quotations
            .filter(q => q.type === 'outbound' && ['submitted', 'approved', 'processed'].includes(q.outbound_status || q.documentStatus || q.document_status))
            .flatMap(q => {
                return (q.packages || []).flatMap(pkg => {
                    return (pkg.items || []).map(item => {
                        const qty = item.outboundQuantity !== undefined ? Number(item.outboundQuantity) : (Number(item.quantity) || 0);
                        if (qty <= 0) return null;

                        return {
                            id: `item-${q.id}-${item.itemCode}`,
                            pengajuanNumber: q.quotationNumber || q.quotation_number,
                            sourcePengajuanNumber: q.sourcePengajuanNumber || q.source_pengajuan_number,
                            itemCode: item.itemCode || item.item_code,
                            quantity: qty,
                            // Ensure date and doc type are mapped for reconciliation table
                            date: q.outbound_date || q.approvedDate || q.approved_date || q.date,
                            // Format BC Doc Type: "BC 2.7 out" (simple format without description)
                            bcDocType: `${(q.bcDocType || q.bc_document_type || 'BC 2.7').split('(')[0].trim()} out`,
                            customsDocNumber: q.bcDocumentNumber || q.bc_document_number,
                            // Add other necessary fields if used by logic
                        };
                    });
                });
            })
            .filter(Boolean); // Remove nulls
    }, [quotations]);

    // Auto-filter based on URL parameter
    useEffect(() => {
        const pengajuanParam = searchParams.get('pengajuan');
        if (pengajuanParam) {
            setSearchTerm(pengajuanParam);
        }
    }, [searchParams]);

    // Format date helper
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };

    // Prepare All Outbound Items (freight_outbound + mutationLogs)
    // Matches logic in BarangKeluar.jsx
    const allOutboundItems = useMemo(() => {
        // 1. From freight_outbound (Primary Source)
        const primaryOutbound = outboundTransactions.map(t => ({
            ...t,
            itemCode: t.itemCode || t.item_code,
            serialNumber: t.serialNumber || t.serial_number,
            mutatedQty: Number(t.quantity) || 0,
            date: t.date,
            destination: t.destination,
            bcDocType: t.bcDocType || t.customsDocType || t.customs_doc_type, // Prefer pre-formatted bcDocType
            source: 'freight_outbound'
        }));

        // 2. From mutationLogs (Secondary - exclude Pameran/Warehouse)
        const secondaryOutbound = mutationLogs.filter(log => {
            const dest = (log.destination || '').toLowerCase();
            return dest && dest !== 'warehouse' && dest !== 'gudang' && dest !== 'pameran';
        }).map(log => ({
            ...log,
            source: 'mutation_log'
        }));

        return [...primaryOutbound, ...secondaryOutbound];
    }, [outboundTransactions, mutationLogs]);

    // Flatten Inbound items if they are grouped
    const allInboundItems = useMemo(() => {
        return inboundTransactions.flatMap(t => {
            if (t.items && t.items.length > 0) {
                return t.items.map((item, itemIdx) => ({
                    ...t,
                    ...item, // Flatten item details
                    // Ensure essential IDs are preserved and fields are prioritized
                    inboundId: t.id,
                    // Strick Mapping: PREFER item level data. Do NOT fallback to 't' (header) easily for multi-item arrays.
                    assetName: item.itemName || item.name || item.assetName || item.description,
                    itemCode: item.itemCode || item.item_code || item.code, // Avoid t.itemCode fallback inside items loop
                    originalQty: Number(item.quantity) || Number(item.qty) || 0,
                    // Use actual sequence number from data
                    noUrut: item.sequenceNumber || item.noUrut || (itemIdx + 1)
                }));
            }
            return [{
                ...t,
                inboundId: t.id,
                originalQty: Number(t.quantity) || 0,
                noUrut: 1
            }];
        });
    }, [inboundTransactions]);

    // Calculation Logic: Map Inbound -> Calculate Outbound -> Result
    // Simple: Mutasi = Barang Masuk - Barang Keluar for the SAME pengajuan
    const reconciliationData = useMemo(() => {
        return allInboundItems.map(inbound => {
            // Find Matching Outbound Items
            // IMPORTANT: Primary match is by pengajuanNumber (source reference)
            // Secondary match is by itemCode within the same pengajuan

            const inboundPengajuan = inbound.pengajuanNumber || inbound.pengajuan_number;
            const inboundItemCode = (inbound.itemCode || '').trim().toLowerCase();

            const relatedOutbound = allOutboundItems.filter(outItem => {
                // Get source pengajuan from outbound (this links back to which inbound it came from)
                const outSourcePengajuan = outItem.sourcePengajuanNumber ||
                    outItem.source_pengajuan_number ||
                    (outItem.documents && (outItem.documents.source_pengajuan_number || outItem.documents.sourcePengajuanNumber));

                const outItemCode = (outItem.itemCode || '').trim().toLowerCase();

                // STRICT MATCHING: Source pengajuan MUST match inbound pengajuan
                // This ensures we only count outbound items that came FROM this specific inbound
                if (outSourcePengajuan) {
                    // If outbound has source reference, it MUST match this inbound's pengajuan number
                    if (outSourcePengajuan !== inboundPengajuan) {
                        return false;
                    }
                } else if (outItem.source === 'mutation_log') {
                    // For mutation logs without source ref, match by pengajuanNumber field
                    const outPengajuan = outItem.pengajuanNumber || outItem.pengajuan_number;
                    if (outPengajuan && outPengajuan !== inboundPengajuan) {
                        return false;
                    }
                }

                // Item code match (within the same pengajuan)
                const matchCode = inboundItemCode && outItemCode && (outItemCode === inboundItemCode);

                return matchCode;
            });

            // Calculate total outbound quantity
            const totalOut = relatedOutbound.reduce((sum, item) => sum + (Number(item.mutatedQty) || 0), 0);

            // Find latest outbound info
            let latestOutboundDate = null;
            let outboundDocTypes = [];

            if (relatedOutbound.length > 0) {
                // Sort by date desc
                const sortedLogs = [...relatedOutbound].sort((a, b) => new Date(b.date) - new Date(a.date));
                latestOutboundDate = sortedLogs[0].date;

                // Collect unique BC types
                outboundDocTypes = [...new Set(relatedOutbound.map(item => item.bcDocType).filter(Boolean))];
            }

            const balance = inbound.originalQty - totalOut;

            return {
                ...inbound,
                qtyMasuk: inbound.originalQty,
                qtyKeluar: totalOut,
                latestOutboundDate: latestOutboundDate,
                qtySisa: balance,
                // Ensure noUrut is preserved
                noUrut: inbound.noUrut,
                // New Fields for BC Types
                inboundDocType: inbound.customsDocType,
                outboundDocType: outboundDocTypes.join(', ')
            };
        });
    }, [allInboundItems, allOutboundItems]);

    // Filtering
    const filteredData = reconciliationData.filter(item => {
        const matchesSearch = (item.assetName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.customsDocNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.itemCode || '').toLowerCase().includes(searchTerm.toLowerCase());

        const itemDate = new Date(item.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (end) end.setHours(23, 59, 59, 999);

        const matchesDate = (!start || itemDate >= start) && (!end || itemDate <= end);

        return matchesSearch && matchesDate;
    });

    // Export Handlers
    const handleExportCSV = () => {
        const columns = [
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'inboundDocType', header: 'Jenis BC Masuk' },
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'noUrut', header: 'No. Urut' },
            { key: 'date', header: 'Tgl. Masuk' },
            { key: 'outboundDocType', header: 'Jenis BC Keluar' },
            { key: 'latestOutboundDate', header: 'Tgl. Keluar' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'assetName', header: 'Nama Barang' },
            { key: 'qtyMasuk', header: 'Jml Masuk' },
            { key: 'qtyKeluar', header: 'Jml Keluar' },
            { key: 'qtySisa', header: 'Saldo Akhir' },
            { key: 'unit', header: 'Satuan' }
        ];

        // Ensure dates are formatted for export
        const exportList = filteredData.map(d => ({
            ...d,
            noUrut: d.noUrut, // Explicitly include
            date: formatDate(d.date),
            latestOutboundDate: formatDate(d.latestOutboundDate)
        }));

        exportToCSV(exportList, 'Laporan_Mutasi_Pabean', columns);
    };

    const handleExportXLS = () => {
        const headerRows = [
            { value: companySettings?.company_name || 'PT. FREIGHT ONE INDONESIA', style: 'company' },
            { value: companySettings?.company_address || 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: `NPWP: ${companySettings?.company_npwp || '-'}`, style: 'normal' },
            { value: '', style: 'normal' },
            { value: 'Pabean - Mutasi Barang', style: 'title' }
        ];
        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Kode BC Masuk', key: 'inboundDocType', width: 15, align: 'center' },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'No. Urut', key: 'noUrut', width: 8, align: 'center' },
            { header: 'Tgl. Masuk', key: 'date', width: 12, align: 'center' },
            { header: 'Kode BC Keluar', key: 'outboundDocType', width: 15, align: 'center' },
            { header: 'Tgl. Keluar', key: 'latestOutboundDate', width: 12, align: 'center' },
            { header: 'Kode Barang', key: 'itemCode', width: 15, align: 'center' },
            { header: 'Nama Barang', key: 'assetName', width: 30 },
            { header: 'Satuan', key: 'unit', width: 8, align: 'center' },
            { header: 'Jml Masuk', key: 'qtyMasuk', width: 12, align: 'center', summary: true },
            { header: 'Jml Keluar', key: 'qtyKeluar', width: 12, align: 'center', summary: true },
            { header: 'Saldo Akhir', key: 'qtySisa', width: 12, align: 'center', summary: true },
        ];

        const exportData = filteredData.map((item, idx) => ({
            ...item,
            no: idx + 1,
            noUrut: item.noUrut, // Explicitly include
            date: formatDate(item.date),
            latestOutboundDate: formatDate(item.latestOutboundDate)
        }));

        exportToXLS(exportData, 'Laporan_Mutasi', headerRows, xlsColumns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Pabean - Mutasi Barang</h1>
                <p className="text-silver-dark mt-1">Laporan Penghitungan Posisi Barang (Masuk - Keluar)</p>
            </div>

            {/* Search & Stats */}
            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan nama barang, nomor Aju, atau kode barang..."
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

                {/* Total Masuk */}
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Barang Masuk</p>
                    <p className="text-2xl font-bold text-accent-blue">
                        {filteredData.reduce((sum, i) => sum + (Number(i.qtyMasuk) || 0), 0)}
                    </p>
                </div>

                {/* Total Keluar - NEW */}
                <div className="glass-card p-4 rounded-lg border border-red-500">
                    <p className="text-xs text-silver-dark">Barang Keluar</p>
                    <p className="text-2xl font-bold text-red-500">
                        {filteredData.reduce((sum, i) => sum + (Number(i.qtyKeluar) || 0), 0)}
                    </p>
                </div>

                {/* Total Saldo Akhir */}
                <div className="glass-card p-4 rounded-lg border border-green-500">
                    <p className="text-xs text-silver-dark">Saldo</p>
                    <p className="text-2xl font-bold text-green-500">
                        {filteredData.reduce((sum, i) => sum + (Number(i.qtySisa) || 0), 0)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Rekonsiliasi Mutasi</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredData.length} entri</span>
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
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">No</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-accent-cyan whitespace-nowrap">Kode BC Masuk</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">No. Pabean</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">No. Urut</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Tgl. Masuk</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-accent-purple whitespace-nowrap">Kode BC Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Tgl. Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Kode Barang</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Nama Barang</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Satuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Jml Masuk</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-orange-400 whitespace-nowrap">Jml Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-green-400 whitespace-nowrap">Saldo Akhir</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="14" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="border-t border-dark-border hover:bg-dark-surface/50">
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{idx + 1}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-medium whitespace-nowrap">{item.pengajuanNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-accent-cyan font-medium whitespace-nowrap">{item.inboundDocType || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light whitespace-nowrap">{item.customsDocNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.noUrut || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {formatDate(item.date)}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-center text-accent-purple font-medium whitespace-nowrap">{item.outboundDocType || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {formatDate(item.latestOutboundDate)}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-mono whitespace-nowrap">{item.itemCode || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light whitespace-nowrap truncate max-w-[200px]">{item.assetName}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.unit || 'pcs'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light font-semibold whitespace-nowrap">{item.qtyMasuk}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-orange-400 font-semibold whitespace-nowrap">{item.qtyKeluar}</td>
                                        <td className={`px-3 py-1 text-[11px] text-center font-bold whitespace-nowrap ${item.qtySisa > 0 ? 'text-green-400' : 'text-silver-dark'}`}>
                                            {item.qtySisa}
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

export default PergerakanBarang;
