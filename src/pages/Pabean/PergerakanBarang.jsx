import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Search, Package, ArrowDownCircle, Download, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const PergerakanBarang = () => {
    const [searchParams] = useSearchParams();
    const { inboundTransactions = [], mutationLogs = [], companySettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

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

    // Flatten Inbound items if they are grouped
    const allInboundItems = useMemo(() => {
        return inboundTransactions.flatMap(t => {
            if (t.items && t.items.length > 0) {
                return t.items.map((item, itemIdx) => ({
                    ...t,
                    ...item, // Flatten item details
                    // Ensure essential IDs are preserved and fields are prioritized
                    inboundId: t.id,
                    assetName: item.name || item.itemName || t.assetName,
                    itemCode: item.itemCode || t.itemCode,
                    originalQty: Number(item.quantity) || Number(t.quantity) || 0,
                    // Use actual sequence number from data (text based per user request), fallback to index if missing
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
    const reconciliationData = useMemo(() => {
        return allInboundItems.map(inbound => {
            // Find User's Outbound Logs matching this Inbound Item
            // Matching criteria: Item Code AND (Serial Number IF available)
            // NOTE: We DO NOT match Pengajuan Number because Outbound uses a different document number than Inbound.

            const relatedOutbound = mutationLogs.filter(log => {
                // Case-insensitive Item Code Match
                const matchCode = (log.itemCode || '').trim().toLowerCase() === (inbound.itemCode || '').trim().toLowerCase();

                // Optional: Match Serial Number if both exist and are not empty/-
                let matchSerial = true;
                const inboundSerial = (inbound.serialNumber || '').trim();
                const logSerial = (log.serialNumber || '').trim();

                if (inboundSerial && logSerial && inboundSerial !== '-' && logSerial !== '-') {
                    matchSerial = String(inboundSerial).toLowerCase() === String(logSerial).toLowerCase();
                }

                // Outbound = Destination != Warehouse.
                const isOutbound = (log.destination || '').toLowerCase() !== 'warehouse' && (log.destination || '').toLowerCase() !== 'gudang';

                return matchCode && matchSerial && isOutbound;
            });

            // Calculate total outbound quantity
            const totalOut = relatedOutbound.reduce((sum, log) => sum + (Number(log.mutatedQty) || 0), 0);

            // Find latest outbound date
            let latestOutboundDate = null;
            if (relatedOutbound.length > 0) {
                // Sort by date desc
                const sortedLogs = [...relatedOutbound].sort((a, b) => new Date(b.date) - new Date(a.date));
                latestOutboundDate = sortedLogs[0].date;
            }

            const balance = inbound.originalQty - totalOut;

            return {
                ...inbound,
                qtyMasuk: inbound.originalQty,
                qtyKeluar: totalOut,
                latestOutboundDate: latestOutboundDate,
                qtySisa: balance,
                // Ensure noUrut is preserved
                noUrut: inbound.noUrut
            };
        });
    }, [allInboundItems, mutationLogs]);

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
            { key: 'customsDocNumber', header: 'No. Pabean' },
            { key: 'noUrut', header: 'No. Urut' },
            { key: 'date', header: 'Tgl. Masuk' },
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
            { value: 'DATA MUTASI BARANG (REKONSILIASI PABEAN)', style: 'title' }
        ];
        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'pengajuanNumber', width: 20 },
            { header: 'No. Pabean', key: 'customsDocNumber', width: 20 },
            { header: 'No. Urut', key: 'noUrut', width: 8, align: 'center' },
            { header: 'Tgl. Masuk', key: 'date', width: 12, align: 'center' },
            { header: 'Tgl. Keluar', key: 'latestOutboundDate', width: 12, align: 'center' },
            { header: 'Kode Barang', key: 'itemCode', width: 15 },
            { header: 'Nama Barang', key: 'assetName', width: 30 },
            { header: 'Satuan', key: 'unit', width: 8, align: 'center' },
            { header: 'Jml Masuk', key: 'qtyMasuk', width: 12, align: 'center' },
            { header: 'Jml Keluar', key: 'qtyKeluar', width: 12, align: 'center' },
            { header: 'Saldo Akhir', key: 'qtySisa', width: 12, align: 'center' },
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Item Masuk</p>
                    <p className="text-2xl font-bold text-accent-blue">{filteredData.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-green-500">
                    <p className="text-xs text-silver-dark">Saldo Aktif &gt; 0</p>
                    <p className="text-2xl font-bold text-green-500">
                        {filteredData.filter(i => i.qtySisa > 0).length}
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
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-silver whitespace-nowrap">No. Pabean</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">No. Urut</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-silver whitespace-nowrap">Tgl. Masuk</th>
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
                                    <td colSpan="12" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={idx} className="border-t border-dark-border hover:bg-dark-surface/50">
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{idx + 1}</td>
                                        <td className="px-3 py-1 text-[11px] text-silver-light font-medium whitespace-nowrap">{item.pengajuanNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-accent-blue whitespace-nowrap">{item.customsDocNumber || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">{item.noUrut || '-'}</td>
                                        <td className="px-3 py-1 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {formatDate(item.date)}
                                        </td>
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
