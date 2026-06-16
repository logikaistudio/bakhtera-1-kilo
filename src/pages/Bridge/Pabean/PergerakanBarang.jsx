import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Search, Package, ArrowDownCircle, Download, FileSpreadsheet, Edit2, Save, XCircle } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import Button from '../../../components/Common/Button';
import { DEFAULT_LOCATION } from '../../../constants/locationOptions';
import { exportToCSV } from '../../../utils/exportCSV';
import { exportToXLS } from '../../../utils/exportXLS';

const PergerakanBarang = () => {
    const [searchParams] = useSearchParams();
    const { inboundTransactions = [], outboundTransactions = [], quotations = [], mutationLogs = [], companySettings, updateInboundItem } = useData();

    // Approved INBOUND quotations (source of truth for Barang Masuk)
    const inboundQuotations = useMemo(() => {
        return quotations.filter(q =>
            q.type === 'inbound' &&
            (q.documentStatus === 'approved' || q.document_status === 'approved')
        );
    }, [quotations]);

    // Approved OUTBOUND quotations (source of truth for Barang Keluar)
    const outboundQuotationsAll = useMemo(() => {
        return quotations.filter(q =>
            q.type === 'outbound' &&
            (q.documentStatus === 'approved' || q.document_status === 'approved')
        );
    }, [quotations]);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    
    // Edit state
    const [editingRow, setEditingRow] = useState(null); // 'inboundId-itemIdx'
    const [editForm, setEditForm] = useState({ adjustment: 0, notes: '' });

    // FLATTEN items from ALL approved OUTBOUND quotations
    const outboundQuotations = useMemo(() => {
        return outboundQuotationsAll.flatMap(q => {
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
                        date: q.outbound_date || q.approvedDate || q.approved_date || q.date,
                        bcDocType: `${(q.bcDocType || q.bc_document_type || 'BC 2.7').split('(')[0].trim()} out`,
                        customsDocNumber: q.bcDocumentNumber || q.bc_document_number,
                    };
                });
            });
        }).filter(Boolean);
    }, [outboundQuotationsAll]);

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

    // Prepare All Outbound Items (freight_outbound + quotations + mutationLogs)
    // Matches logic in BarangKeluar.jsx to prevent double counting
    const allOutboundItems = useMemo(() => {
        const outMap = new Map();

        // 1. From freight_outbound (Actual Outbound - Primary Source)
        outboundTransactions.forEach((t, tIdx) => {
            const items = Array.isArray(t.items) && t.items.length > 0 ? t.items : [{
                itemCode: t.itemCode || t.item_code,
                quantity: t.quantity || 0,
            }];
            if (Array.isArray(items)) {
                items.forEach((item, itemIdx) => {
                    const key = `${t.pengajuanNumber || t.pengajuan_number}-${item.itemCode || item.item_code || t.itemCode}-${tIdx}-${itemIdx}`;
                    outMap.set(key, {
                        ...t,
                        itemCode: item.itemCode || item.item_code || t.itemCode || t.item_code,
                        serialNumber: t.serialNumber || t.serial_number,
                        mutatedQty: Number(item.quantity) || Number(t.quantity) || 0,
                        date: t.date || t.created_at,
                        destination: t.destination || t.receiver,
                        bcDocType: t.bcDocType || t.customsDocType || t.customs_doc_type,
                        source: 'freight_outbound'
                    });
                });
            }
        });

        // 2. From Quotations (Planned Outbound)
        outboundQuotations.forEach((t, idx) => {
            const pengajuanKey = t.pengajuanNumber || t.pengajuan_number;
            // Prevent double counting if actual outbound already exists for this pengajuan
            const hasActual = outboundTransactions.some(actual => (actual.pengajuanNumber || actual.pengajuan_number) === pengajuanKey);
            
            if (!hasActual) {
                const key = `${pengajuanKey}-${t.itemCode || t.item_code}-plan-${idx}`;
                outMap.set(key, {
                    ...t,
                    itemCode: t.itemCode || t.item_code,
                    serialNumber: t.serialNumber || t.serial_number,
                    mutatedQty: Number(t.quantity) || 0,
                    date: t.date,
                    destination: t.destination,
                    bcDocType: t.bcDocType || t.customsDocType || t.customs_doc_type,
                    source: 'freight_quotation'
                });
            }
        });

        return Array.from(outMap.values());
    }, [outboundTransactions, outboundQuotations]);

    // Flatten Inbound items from QUOTATIONS (Pengajuan Masuk yang approved)
    // This is the source of truth: Barang Masuk = item dari Pengajuan Masuk approved
    const allInboundItems = useMemo(() => {
        return inboundQuotations.flatMap((q, qIdx) => {
            const pengajuanNumber = q.quotationNumber || q.quotation_number;
            return (q.packages || []).flatMap((pkg) =>
                (pkg.items || []).map((item, itemIdx) => ({
                    inboundId: q.id,
                    submissionSeqNo: qIdx + 1,
                    itemIdx: itemIdx,
                    pengajuanNumber: pengajuanNumber,
                    customsDocNumber: q.bcDocumentNumber || q.bc_document_number,
                    customsDocType: q.bcDocType || q.bc_document_type,
                    date: q.date || q.approvedDate || q.approved_date,
                    assetName: item.itemName || item.name || item.assetName || item.description,
                    itemCode: item.itemCode || item.item_code || item.code,
                    originalQty: Number(item.quantity) || 0,
                    unit: item.uom || item.unit || 'pcs',
                    noUrut: itemIdx + 1,
                    notes: item.notes || q.notes,
                    customer: q.customer,
                }))
            );
        });
    }, [inboundQuotations]);

    // Calculation Logic: Map Inbound -> Calculate Outbound -> Result
    // RECONCILIATION: Mutasi = Barang Masuk (Pengajuan Inbound) - Barang Keluar (Pengajuan Outbound)
    // Match outbound to inbound by: 1) sourcePengajuanNumber (explicit link) OR 2) matching itemCode
    const reconciliationData = useMemo(() => {
        // Pre-build a map: itemCode -> list of outbound items (qty summed per outbound quotation)
        // This allows us to match any inbound item to outbound items by itemCode
        const outboundByItemCode = new Map();
        allOutboundItems.forEach(outItem => {
            const code = (outItem.itemCode || '').trim().toLowerCase();
            if (!code) return;
            if (!outboundByItemCode.has(code)) outboundByItemCode.set(code, []);
            outboundByItemCode.get(code).push(outItem);
        });

        return allInboundItems.map(inbound => {
            const inboundPengajuan = inbound.pengajuanNumber || inbound.pengajuan_number;
            const inboundItemCode = (inbound.itemCode || '').trim().toLowerCase();

            // Find all outbound records that match this inbound item
            const candidateOutbound = outboundByItemCode.get(inboundItemCode) || [];

            const relatedOutbound = candidateOutbound.filter(outItem => {
                const outSourcePengajuan = outItem.sourcePengajuanNumber ||
                    outItem.source_pengajuan_number ||
                    (outItem.documents && (outItem.documents.source_pengajuan_number || outItem.documents.sourcePengajuanNumber));

                // If outbound explicitly references this inbound pengajuan → match
                if (outSourcePengajuan) {
                    return outSourcePengajuan === inboundPengajuan;
                }
                // Otherwise: match by itemCode (already guaranteed by the map key)
                return true;
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

            const adjustment = Number(inbound.adjustment) || 0;
            const balance = inbound.originalQty - totalOut + adjustment;

            return {
                ...inbound,
                qtyMasuk: inbound.originalQty,
                qtyKeluar: totalOut,
                qtyAdjustment: adjustment,
                latestOutboundDate: latestOutboundDate,
                qtySisa: balance,
                keterangan: inbound.notes || inbound.remarks || '-',
                // Ensure noUrut is preserved
                noUrut: inbound.noUrut,
                // New Fields for BC Types
                inboundDocType: inbound.customsDocType,
                outboundDocType: outboundDocTypes.join(', ')
            };
        });
    }, [allInboundItems, allOutboundItems]);

    // Edit Handlers
    const handleEdit = (item) => {
        setEditingRow(`${item.inboundId}-${item.itemIdx}`);
        setEditForm({
            adjustment: item.qtyAdjustment || 0,
            notes: item.keterangan === '-' ? '' : item.keterangan
        });
    };

    const handleCancel = () => {
        setEditingRow(null);
        setEditForm({ adjustment: 0, notes: '' });
    };

    const handleSave = async (item) => {
        const res = await updateInboundItem(item.inboundId, item.itemIdx, {
            adjustment: Number(editForm.adjustment) || 0,
            notes: editForm.notes
        });

        if (res.success) {
            setEditingRow(null);
        } else {
            alert('Gagal menyimpan perubahan');
        }
    };

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
            { key: 'submissionSeqNo', header: 'No' },
            { key: 'pengajuanNumber', header: 'No. Pengajuan' },
            { key: 'inboundDocType', header: 'Jenis BC Masuk' },
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'noUrut', header: 'No. Urut Item' },
            { key: 'date', header: 'Tgl. Masuk' },
            { key: 'outboundDocType', header: 'Jenis BC Keluar' },
            { key: 'latestOutboundDate', header: 'Tgl. Keluar' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'assetName', header: 'Nama Barang' },
            { key: 'qtyMasuk', header: 'Jml Masuk' },
            { key: 'qtyKeluar', header: 'Jml Keluar' },
            { key: 'qtyAdjustment', header: 'Penyesuaian' },
            { key: 'qtySisa', header: 'Saldo Akhir' },
            { key: 'unit', header: 'Satuan' },
            { key: 'keterangan', header: 'Keterangan' }
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
            { header: 'No', key: 'submissionSeqNo', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'Kode BC Masuk', key: 'inboundDocType', width: 15, align: 'center' },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'No. Urut Item', key: 'noUrut', width: 12, align: 'center' },
            { header: 'Tgl. Masuk', key: 'date', width: 12, align: 'center' },
            { header: 'Kode BC Keluar', key: 'outboundDocType', width: 15, align: 'center' },
            { header: 'Tgl. Keluar', key: 'latestOutboundDate', width: 12, align: 'center' },
            { header: 'Kode Barang', key: 'itemCode', width: 15, align: 'center' },
            { header: 'Nama Barang', key: 'assetName', width: 30 },
            { header: 'Satuan', key: 'unit', width: 8, align: 'center' },
            { header: 'Jml Masuk', key: 'qtyMasuk', width: 12, align: 'center', summary: true },
            { header: 'Jml Keluar', key: 'qtyKeluar', width: 12, align: 'center', summary: true },
            { header: 'Penyesuaian', key: 'qtyAdjustment', width: 12, align: 'center', summary: true },
            { header: 'Saldo Akhir', key: 'qtySisa', width: 12, align: 'center', summary: true },
            { header: 'Keterangan', key: 'keterangan', width: 25 },
        ];

        const exportData = filteredData.map(item => ({
            ...item,
            submissionSeqNo: item.submissionSeqNo,
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

                {/* Total Keluar */}
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
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Tgl. Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">No. Urut Item</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Kode Barang</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Nama Barang</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Satuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Jml Masuk</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-orange-400 whitespace-nowrap">Jml Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-yellow-400 whitespace-nowrap">Penyesuaian</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-green-400 whitespace-nowrap">Saldo Akhir</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">Keterangan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="15" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="border-t border-dark-border hover:bg-dark-surface/50">
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.submissionSeqNo}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-medium whitespace-nowrap">{item.pengajuanNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-accent-cyan font-medium whitespace-nowrap">{item.inboundDocType || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light whitespace-nowrap">{item.customsDocNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {formatDate(item.latestOutboundDate)}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.noUrut || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-mono whitespace-nowrap">{item.itemCode || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light whitespace-nowrap truncate max-w-[200px]">{item.assetName}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.unit || 'pcs'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light font-semibold whitespace-nowrap">{item.qtyMasuk}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-orange-400 font-semibold whitespace-nowrap">{item.qtyKeluar}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-yellow-400 font-semibold whitespace-nowrap">
                                            {editingRow === `${item.inboundId}-${item.itemIdx}` ? (
                                                <input
                                                    type="number"
                                                    value={editForm.adjustment}
                                                    onChange={(e) => setEditForm({ ...editForm, adjustment: e.target.value })}
                                                    className="w-16 px-1 py-0.5 bg-dark-bg border border-accent-blue rounded text-center text-xs"
                                                />
                                            ) : (
                                                item.qtyAdjustment || 0
                                            )}
                                        </td>
                                        <td className={`px-3 py-1 text-[11px] text-center font-bold whitespace-nowrap ${item.qtySisa > 0 ? 'text-green-400' : 'text-silver-dark'}`}>
                                            {item.qtySisa}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-left text-silver-dark whitespace-nowrap">
                                            {editingRow === `${item.inboundId}-${item.itemIdx}` ? (
                                                <input
                                                    type="text"
                                                    value={editForm.notes}
                                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                                    className="w-full px-2 py-0.5 bg-dark-bg border border-accent-blue rounded text-xs"
                                                    placeholder="Catatan..."
                                                 />
                                            ) : (
                                                <div className="truncate max-w-[150px]" title={item.keterangan}>
                                                    {item.keterangan}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-1 text-center">
                                            {editingRow === `${item.inboundId}-${item.itemIdx}` ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleSave(item)}
                                                        className="p-1 text-accent-green hover:bg-accent-green/10 rounded-md transition-colors"
                                                        title="Simpan"
                                                    >
                                                        <Save className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancel}
                                                        className="p-1 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                                        title="Batal"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-1 text-accent-blue hover:bg-accent-blue/10 rounded-md transition-colors"
                                                    title="Edit Mutasi"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
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
