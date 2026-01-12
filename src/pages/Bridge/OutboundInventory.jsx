import React, { useState, useMemo } from 'react';
import { Search, Download, Package, TrendingUp, Calendar, FileText, Eye, X, Edit, Trash2, RefreshCw, Send } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const OutboundInventory = () => {
    const { quotations = [], addMutationLog } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Edit Mode States
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Filter only approved OUTBOUND pengajuan
    const approvedOutboundPengajuan = quotations.filter(q =>
        (q.documentStatus === 'approved' || q.document_status === 'approved') &&
        q.type === 'outbound'
    );

    // Helper function to count packages and items
    const countPackagesAndItems = (pengajuan) => {
        const packages = pengajuan.packages || [];
        const packageCount = packages.length;
        const itemCount = packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0);
        return { packageCount, itemCount };
    };

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
            return '-';
        }
    };

    // Format time helper
    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    };

    // Filter outbound data based on search
    const filteredData = approvedOutboundPengajuan.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (item.quotationNumber || item.quotation_number || '').toLowerCase().includes(searchLower) ||
            (item.bcDocumentNumber || item.bc_document_number || '').toLowerCase().includes(searchLower) ||
            (item.customer || '').toLowerCase().includes(searchLower) ||
            (item.destination || '').toLowerCase().includes(searchLower) ||
            (item.sourcePengajuanNumber || item.source_pengajuan_number || '').toLowerCase().includes(searchLower)
        );
    });

    // Calculate statistics
    const stats = {
        totalPengajuan: filteredData.length,
        totalPackages: filteredData.reduce((sum, item) => sum + countPackagesAndItems(item).packageCount, 0),
        totalItems: filteredData.reduce((sum, item) => sum + countPackagesAndItems(item).itemCount, 0),
        uniqueCustomers: new Set(filteredData.map(item => item.customer)).size,
    };

    // Handle row click
    const handleRowClick = (item) => {
        setSelectedItem(item);
        // Initialize edited item with deep copy to avoid direct mutation
        setEditedItem(JSON.parse(JSON.stringify(item)));
        setIsEditing(false);
        setShowDetailModal(true);
    };

    // Handle export CSV (Main Table)
    const handleExportCSV = () => {
        const exportData = filteredData.map(item => {
            const { packageCount, itemCount } = countPackagesAndItems(item);
            return {
                noPengajuan: item.quotationNumber || item.quotation_number || '-',
                noPabean: item.bcDocumentNumber || item.bc_document_number || '-',
                tanggalKeluar: formatDate(item.approvedDate || item.approved_date || item.date),
                tujuan: item.destination || '-',
                customer: item.customer || '-',
                jumlahPackage: packageCount,
                jumlahPackage: packageCount,
                jumlahItem: itemCount,
                status: (item.outbound_status === 'submitted' && item.outbound_date)
                    ? `Barang Keluar (${formatDate(item.outbound_date)} ${formatTime(item.outbound_date)})`
                    : 'Document Approved'
            };
        });

        const columns = [
            { key: 'noPengajuan', header: 'No. Pengajuan' },
            { key: 'noPabean', header: 'No. Pabean' },
            { key: 'tanggalKeluar', header: 'Tgl Keluar Gudang' },
            { key: 'tujuan', header: 'Tujuan' },
            { key: 'customer', header: 'Customer' },
            { key: 'jumlahPackage', header: 'Jml Package' },
            { key: 'jumlahItem', header: 'Jml Item' },
            { key: 'status', header: 'Status' }
        ];

        exportToCSV(exportData, 'Inventaris_Barang_Keluar', columns);
    };

    // Handle export Detail CSV (Modal)
    const handleExportDetailCSV = () => {
        if (!selectedItem) return;
        const allItems = [];
        const { packages = [] } = selectedItem;

        packages.forEach((pkg, pkgIdx) => {
            (pkg.items || []).forEach((item, itemIdx) => {
                allItems.push({
                    noPengajuan: selectedItem.quotationNumber || selectedItem.quotation_number,
                    noPabean: selectedItem.bcDocumentNumber || selectedItem.bc_document_number,
                    customer: selectedItem.customer,
                    kodePacking: pkg.packageNumber || `Paket_${pkgIdx + 1}`,
                    noUrut: itemIdx + 1,
                    kodeBarang: item.itemCode,
                    hsCode: item.hsCode,
                    item: item.name || item.itemName,
                    jumlah: item.quantity,
                    satuan: item.uom,
                    lokasi: item.location,
                    kondisi: item.condition,
                    keterangan: item.notes
                });
            });
        });

        const columns = [
            { key: 'noPengajuan', header: 'No. Pengajuan' },
            { key: 'noPabean', header: 'No. Pabean' },
            { key: 'customer', header: 'Customer' },
            { key: 'kodePacking', header: 'Kode Packing' },
            { key: 'noUrut', header: 'No. Urut' },
            { key: 'kodeBarang', header: 'Kode Barang' },
            { key: 'hsCode', header: 'HS Code' },
            { key: 'item', header: 'Item' },
            { key: 'jumlah', header: 'Jumlah' },
            { key: 'satuan', header: 'Satuan' },
            { key: 'lokasi', header: 'Lokasi' },
            { key: 'kondisi', header: 'Kondisi' },
            { key: 'keterangan', header: 'Keterangan' }
        ];

        exportToCSV(allItems, `Detail_Inventaris_${selectedItem.quotationNumber || 'Export'}`, columns);
    };

    // Handle export Detail XLS (Modal)
    const handleExportDetailXLS = () => {
        import('xlsx-js-style').then(XLSX => {
            if (!selectedItem) return;

            const { packages = [] } = selectedItem;
            const data = [];

            // Header
            data.push([
                'No. Pengajuan', 'No. Pabean', 'Customer', 'Kode Packing',
                'No. Urut', 'Kode Barang', 'HS Code', 'Item',
                'Jumlah', 'Satuan', 'Lokasi', 'Kondisi', 'Keterangan'
            ]);

            // Body
            packages.forEach((pkg, pkgIdx) => {
                (pkg.items || []).forEach((item, itemIdx) => {
                    data.push([
                        selectedItem.quotationNumber || selectedItem.quotation_number,
                        selectedItem.bcDocumentNumber || selectedItem.bc_document_number,
                        selectedItem.customer,
                        pkg.packageNumber || `Paket_${pkgIdx + 1}`,
                        itemIdx + 1,
                        item.itemCode,
                        item.hsCode,
                        item.name || item.itemName,
                        item.quantity,
                        item.uom,
                        item.location,
                        item.condition,
                        item.notes
                    ]);
                });
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);

            // Style header
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1";
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "2563EB" } }, // Blue-600
                    alignment: { horizontal: "center" }
                };
            }

            // Auto-width
            const colWidths = data[0].map((_, i) => ({ wch: 20 }));
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, "Detail Inventaris");
            XLSX.writeFile(wb, `Detail_Inventaris_${selectedItem.quotationNumber || 'Export'}.xlsx`);
        }).catch(err => {
            console.error("Failed to load xlsx-js-style", err);
            alert("Gagal memuat modul export Excel. Menggunakan CSV sebagai alternatif.");
            handleExportDetailCSV();
        });
    };

    // ITEM UPDATE HANDLERS
    const handleUpdateItem = (pkgIndex, itemIndex, field, value) => {
        const newEditedItem = { ...editedItem };
        newEditedItem.packages[pkgIndex].items[itemIndex][field] = value;
        setEditedItem(newEditedItem);
    };

    // TOP LEVEL UPDATE HANDLER
    const handleUpdateTopLevel = (field, value) => {
        setEditedItem(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Helper to combine date and time for approvedDate
    const handleDateTimeChange = (type, value) => {
        const currentData = editedItem.approvedDate || editedItem.approved_date || editedItem.date || new Date().toISOString();
        const dateObj = new Date(currentData);

        if (type === 'date') {
            // value is YYYY-MM-DD
            const [year, month, day] = value.split('-');
            dateObj.setFullYear(year, month - 1, day);
        } else if (type === 'time') {
            // value is HH:MM
            const [hours, minutes] = value.split(':');
            dateObj.setHours(hours, minutes);
        }

        // Update both camelCase and snake_case to be safe
        setEditedItem(prev => ({
            ...prev,
            approvedDate: dateObj.toISOString(),
            approved_date: dateObj.toISOString(),
            date: dateObj.toISOString() // fallback
        }));
    };

    const handleSaveChanges = async () => {
        if (!editedItem) return;
        setIsSaving(true);
        try {
            const { supabase } = await import('../../lib/supabase');

            // Prepare payload
            // We update packages (items), and top-level fields: pic, approved_date
            const updatePayload = {
                packages: editedItem.packages,
                pic: editedItem.pic,
                approved_date: editedItem.approvedDate || editedItem.approved_date,
                // Also update 'date' column if it's used for display
                date: (editedItem.approvedDate || editedItem.approved_date || '').split('T')[0],
                // Ensure we don't lose status if just editing details
                outbound_status: editedItem.outbound_status,
                outbound_date: editedItem.outbound_date
            };

            const { error } = await supabase
                .from('freight_quotations')
                .update(updatePayload)
                .eq('id', editedItem.id);

            if (error) throw error;

            // Success
            setIsEditing(false);
            setSelectedItem(editedItem); // Update local view

            // Note: DataContext realtime subscription should automatically update the global state/list

        } catch (error) {
            console.error("Failed to save changes:", error);
            alert("Gagal menyimpan perubahan: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditedItem(JSON.parse(JSON.stringify(selectedItem)));
        setIsEditing(false);
    };

    // SUBMIT TO PABEAN HANDLER
    const handleSubmitToPabean = async () => {
        if (!selectedItem) return;

        const confirmMsg = `Anda akan mengirimkan data ${selectedItem.quotationNumber || selectedItem.quotation_number} ke Pabean - Barang Keluar.\n\nPastikan data sudah benar. Lanjutkan?`;
        if (!window.confirm(confirmMsg)) return;

        setIsSaving(true);
        try {
            let successCount = 0;
            const errors = [];

            // Iterate through all packages and items to create mutation logs
            const promises = (selectedItem.packages || []).flatMap((pkg) =>
                (pkg.items || []).map(async (item) => {
                    try {
                        const newMutation = {
                            pengajuanId: selectedItem.id,
                            pengajuanNumber: selectedItem.quotationNumber || selectedItem.quotation_number,
                            bcDocumentNumber: selectedItem.bcDocumentNumber || selectedItem.bc_document_number,
                            packageNumber: pkg.packageNumber,
                            itemCode: item.itemCode,
                            itemName: item.name || item.itemName,
                            serialNumber: item.serialNumber || '-', // Assuming serial number might be there or not
                            totalStock: item.quantity, // For outbound, stock is what is being moved
                            origin: 'Warehouse', // Usually outbound comes FROM warehouse
                            destination: item.location || 'Keluar', // Destination set in item or default 'Keluar'
                            mutatedQty: item.quantity,
                            remainingStock: 0, // Outbound leaves 0 usually if full move
                            date: (selectedItem.approvedDate || selectedItem.approved_date || new Date().toISOString()).split('T')[0],
                            time: new Date(selectedItem.approvedDate || selectedItem.approved_date || new Date()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            pic: selectedItem.pic || 'Admin',
                            remarks: item.notes || 'Outbound Submission',
                            condition: item.condition || 'Baik',
                            uom: item.uom || 'pcs'
                        };

                        await addMutationLog(newMutation);
                        successCount++;
                    } catch (err) {
                        console.error(`Error submitting item ${item.itemCode}:`, err);
                        errors.push(item.itemCode);
                    }
                })
            );

            await Promise.all(promises);

            if (errors.length > 0) {
                alert(`Submit selesai sebagian. Gagal mengirim items: ${errors.join(', ')}`);
            } else {
                // Update QUOTATION STATUS to 'submitted'
                const { supabase } = await import('../../lib/supabase');
                const now = new Date().toISOString();

                const { error: statusError } = await supabase
                    .from('freight_quotations')
                    .update({
                        outbound_status: 'submitted',
                        outbound_date: now
                    })
                    .eq('id', selectedItem.id);

                if (statusError) {
                    console.error("Failed to update status:", statusError);
                    alert("Data terkirim ke Pabean, tetapi gagal update status dokumen.");
                } else {
                    alert('Berhasil mengirim data ke Pabean - Barang Keluar! Status dokumen diperbarui.');
                    setShowDetailModal(false);
                    // Force refresh or rely on realtime if available
                }
            }

        } catch (error) {
            console.error("Failed to submit to Pabean:", error);
            alert("Gagal mengirim ke Pabean: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
                        <Package className="w-8 h-8" />
                        Inventaris Barang Keluar
                    </h1>
                    <p className="text-silver-dark mt-1">
                        Data Barang Keluar dari Pengajuan Outbound yang Disetujui
                    </p>
                </div>
                <Button onClick={handleExportCSV} variant="primary" icon={Download}>
                    Export CSV
                </Button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 border border-dark-border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Total Pengajuan</p>
                            <p className="text-2xl font-bold text-accent-purple mt-1">{stats.totalPengajuan}</p>
                        </div>
                        <FileText className="w-8 h-8 text-accent-purple opacity-50" />
                    </div>
                </div>

                <div className="glass-card p-4 border border-dark-border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Total Packages</p>
                            <p className="text-2xl font-bold text-accent-blue mt-1">{stats.totalPackages}</p>
                        </div>
                        <Package className="w-8 h-8 text-accent-blue opacity-50" />
                    </div>
                </div>

                <div className="glass-card p-4 border border-dark-border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Total Items</p>
                            <p className="text-2xl font-bold text-accent-green mt-1">{stats.totalItems}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-accent-green opacity-50" />
                    </div>
                </div>

                <div className="glass-card p-4 border border-dark-border rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Customers</p>
                            <p className="text-2xl font-bold text-accent-orange mt-1">{stats.uniqueCustomers}</p>
                        </div>
                        <Calendar className="w-8 h-8 text-accent-orange opacity-50" />
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-card p-4 border border-dark-border rounded-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan No. Pengajuan, No. Pabean, Customer, Tujuan, atau Status..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver placeholder:text-silver-dark focus:outline-none focus:border-accent-blue transition-colors"
                    />
                </div>
            </div>

            {/* Table - COMPACT VERSION */}
            <div className="glass-card border border-dark-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-purple">
                            <tr>
                                <th className="px-3 py-1.5 text-left text-[11px] font-bold text-white whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">No. Pabean</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Tgl Keluar</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Tujuan</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Customer</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Pkg</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Items</th>
                                <th className="px-3 py-1.5 text-center text-[11px] font-bold text-white whitespace-nowrap">Status</th>
                                {/* Removed Aksi Column Header */}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-6 text-center text-silver-dark text-xs">
                                        Belum ada pengajuan keluar yang disetujui
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((pengajuan) => {
                                    const { packageCount, itemCount } = countPackagesAndItems(pengajuan);
                                    return (
                                        <tr
                                            key={pengajuan.id}
                                            className="hover:bg-dark-surface/50 transition-colors cursor-pointer"
                                            onClick={() => handleRowClick(pengajuan)}
                                            title="Klik untuk melihat detail"
                                        >
                                            <td className="px-3 py-1.5 text-[11px] text-accent-purple font-semibold whitespace-nowrap">{pengajuan.quotationNumber || pengajuan.quotation_number || '-'}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-silver text-center whitespace-nowrap">{pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '-'}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-silver text-center whitespace-nowrap">{formatDate(pengajuan.approvedDate || pengajuan.approved_date || pengajuan.date)}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-silver text-center whitespace-nowrap">{pengajuan.destination || '-'}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-silver text-center whitespace-nowrap">{pengajuan.customer || '-'}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-accent-purple font-bold text-center whitespace-nowrap">{packageCount}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-accent-purple font-bold text-center whitespace-nowrap">{itemCount}</td>
                                            <td className="px-3 py-1.5 text-[11px] text-center whitespace-nowrap">
                                                {pengajuan.outbound_status === 'submitted' ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-[10px]">
                                                        Barang Keluar ({formatDate(pengajuan.outbound_date)} {formatTime(pengajuan.outbound_date)})
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">
                                                        Document Approved
                                                    </span>
                                                )}
                                            </td>
                                            {/* Removed Aksi Column Cell */}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Detail Inventaris</h2>
                                <p className="text-sm text-gray-500 mt-1">{selectedItem.quotationNumber || selectedItem.quotation_number || '-'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportDetailCSV}
                                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                    title="Export Detail CSV"
                                >
                                    <Download className="w-4 h-4" />
                                    CSV
                                </button>
                                <button
                                    onClick={handleExportDetailXLS}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mr-2"
                                    title="Export Detail Excel"
                                >
                                    <FileText className="w-4 h-4" /> {/* Approximate icon for XLS */}
                                    XLS
                                </button>

                                {/* SUBMIT/KIRIM BUTTON - Show only when NOT editing, next to Edit */}
                                {!isEditing && (
                                    <button
                                        onClick={handleSubmitToPabean}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mr-2"
                                        title="Kirim ke Pabean - Barang Keluar"
                                    >
                                        <Send className="w-4 h-4" />
                                        Kirim
                                    </button>
                                )}

                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={handleSaveChanges}
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
                                            Simpan
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            Batal
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                )}

                                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[75vh] bg-gray-50 space-y-6">
                            {/* Data Inventaris */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">📦 Data Inventaris {isEditing && <span className="text-xs font-normal text-blue-600 ml-2">(Mode Edit Aktif)</span>}</h3>
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-blue-600">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">NO. PENGAJUAN</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">NO. PABEAN</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">TGL KELUAR GUDANG</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">JAM KELUAR</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">JML PACKAGE</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">JML ITEM</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">PIC PENGELUARAN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">{selectedItem.quotationNumber || selectedItem.quotation_number || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{selectedItem.bcDocumentNumber || selectedItem.bc_document_number || '-'}</td>

                                                {/* TGL KELUAR - Editable */}
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            value={((editedItem.approvedDate || editedItem.approved_date || editedItem.date) || '').split('T')[0]}
                                                            onChange={(e) => handleDateTimeChange('date', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                    ) : (formatDate(selectedItem.approvedDate || selectedItem.approved_date || selectedItem.date))}
                                                </td>

                                                {/* JAM KELUAR - Editable */}
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {isEditing ? (
                                                        <input
                                                            type="time"
                                                            value={new Date((editedItem.approvedDate || editedItem.approved_date || editedItem.date)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                            onChange={(e) => handleDateTimeChange('time', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                    ) : (formatTime(selectedItem.approvedDate || selectedItem.approved_date || selectedItem.date))}
                                                </td>

                                                <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{(selectedItem.packages || []).length}</td>
                                                <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{(selectedItem.packages || []).reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0)}</td>

                                                {/* PIC PENGELUARAN - Editable */}
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editedItem.pic || ''}
                                                            onChange={(e) => handleUpdateTopLevel('pic', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                    ) : (selectedItem.pic || 'ABD')}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detail Items */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-3">📝 Detail Item {isEditing && <span className="text-xs font-normal text-blue-600 ml-2">(Mode Edit Aktif)</span>}</h3>
                                <div className="space-y-4">
                                    {((isEditing ? editedItem : selectedItem).packages || []).map((pkg, pkgIndex) => (
                                        <div key={pkgIndex}>
                                            <div className="bg-gray-100 px-4 py-2 rounded-t-lg">
                                                <span className="text-sm font-semibold text-gray-700">Kode Packing: {pkg.packageNumber || `Paket_${pkgIndex + 1}`}</span>
                                            </div>
                                            <div className="bg-white rounded-b-xl shadow-sm overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-blue-600">
                                                        <tr>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase w-16">NO. URUT</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">KODE BARANG</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase w-20">HS CODE</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">ITEM</th>
                                                            <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase w-20">JUMLAH</th>
                                                            <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase w-20">SATUAN</th>
                                                            <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase w-24">STATUS</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase w-24">LOKASI</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase w-20">KONDISI</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">KETERANGAN</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {(pkg.items || []).map((item, itemIdx) => (
                                                            <tr key={itemIdx} className="hover:bg-blue-50/50">
                                                                <td className="px-3 py-2 text-sm text-gray-900 font-medium">{itemIdx + 1}</td>

                                                                {/* KODE BARANG */}
                                                                <td className="px-3 py-2 text-sm font-mono text-gray-900">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.itemCode || ''}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'itemCode', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.itemCode || '-')}
                                                                </td>

                                                                {/* HS CODE */}
                                                                <td className="px-3 py-2 text-sm text-gray-700">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.hsCode || ''}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'hsCode', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.hsCode || '-')}
                                                                </td>

                                                                {/* ITEM NAME */}
                                                                <td className="px-3 py-2 text-sm text-gray-700">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.name || item.itemName || ''}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'name', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.name || item.itemName || '-')}
                                                                </td>

                                                                {/* JUMLAH (Number) */}
                                                                <td className="px-3 py-2 text-sm text-center text-gray-900 font-semibold">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            value={item.quantity || 0}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'quantity', parseFloat(e.target.value))}
                                                                            className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.quantity || 0)}
                                                                </td>

                                                                {/* SATUAN */}
                                                                <td className="px-3 py-2 text-sm text-center text-gray-700">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.uom || ''}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'uom', e.target.value)}
                                                                            className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.uom || 'pcs')}
                                                                </td>

                                                                {/* STATUS (Badge) - Not editable (derived) */}
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                                        {item.quantity || 0}
                                                                    </span>
                                                                </td>

                                                                {/* LOKASI */}
                                                                <td className="px-3 py-2 text-sm text-gray-700">
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={item.location || 'Keluar'}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'location', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        >
                                                                            <option value="Keluar">Keluar</option>
                                                                            <option value="Warehouse">Warehouse</option>
                                                                        </select>
                                                                    ) : (item.location || 'Keluar')}
                                                                </td>

                                                                {/* KONDISI */}
                                                                <td className="px-3 py-2 text-sm text-gray-700">
                                                                    {isEditing ? (
                                                                        <select
                                                                            value={item.condition || 'Baik'}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'condition', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        >
                                                                            <option value="Baik">Baik</option>
                                                                            <option value="Rusak">Rusak</option>
                                                                            <option value="Perbaikan">Perbaikan</option>
                                                                        </select>
                                                                    ) : (item.condition || 'Baik')}
                                                                </td>

                                                                {/* KETERANGAN */}
                                                                <td className="px-3 py-2 text-sm text-gray-500">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.notes || ''}
                                                                            onChange={(e) => handleUpdateItem(pkgIndex, itemIdx, 'notes', e.target.value)}
                                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                                                        />
                                                                    ) : (item.notes || '-')}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutboundInventory;
