import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Search, Package, ArrowDownCircle, Download, Edit2, Save, X, Upload, FileText, Trash2, ArrowLeftCircle, FileSpreadsheet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToXLS } from '../../utils/exportXLS';

const PergerakanBarang = () => {
    const [searchParams] = useSearchParams();
    const { mutationLogs = [], quotations = [], inboundTransactions = [], updateMutationLog, addMutationLog, deleteMutationLog, warehouseInventory = [], companySettings } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);
    const [documents, setDocuments] = useState([]);
    const fileInputRef = useRef(null);

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

    // Filter mutation logs
    const filteredLogs = mutationLogs.filter(log =>
        (log.pengajuanNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.bcDocumentNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.assetName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.itemCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper function to calculate remutation info matching Bridge logic
    const getRemutationInfo = (log) => {
        const isOutbound = (log.destination || '').toLowerCase() !== 'warehouse' &&
            (log.destination || '').toLowerCase() !== 'gudang';

        if (!isOutbound) {
            // This IS a remutation (return to warehouse)
            return {
                calculatedRemutated: Number(log.mutatedQty) || 0,
                calculatedSisa: 0
            };
        }

        // For outbound, find related returns
        const relatedRemutations = mutationLogs.filter(m =>
            m.pengajuanNumber === log.pengajuanNumber &&
            m.itemCode === log.itemCode &&
            (m.serialNumber || '') === (log.serialNumber || '') &&
            m.id !== log.id &&
            ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
        );

        const totalRemutated = relatedRemutations.reduce((sum, r) => sum + (Number(r.mutatedQty) || 0), 0);
        const mutatedQty = Number(log.mutatedQty) || 0;

        // Cap: remutasi tidak boleh lebih dari mutasi
        const cappedRemutated = Math.min(totalRemutated, mutatedQty);
        const sisaDiLokasi = Math.max(0, mutatedQty - cappedRemutated);

        return {
            calculatedRemutated: cappedRemutated,
            calculatedSisa: sisaDiLokasi
        };
    };

    // Helper to find source inventory/inbound data
    const findInventorySource = (log) => {
        let result = {
            sender: null,
            packageNumber: null,
            serialNumber: null,
            hsCode: null
        };

        // 1. Try Inbound Transactions (Primary Source for Inventory Data)
        // First, try matching by BC Document Number
        let inbound = inboundTransactions.find(t =>
            (t.bcDocumentNumber || t.customsDocNumber || '').trim() === (log.bcDocumentNumber || '').trim() &&
            (t.itemCode || '').trim() === (log.itemCode || '').trim() &&
            ((t.itemName || '').trim().toLowerCase() === (log.itemName || '').trim().toLowerCase() ||
                (t.assetName || '').trim().toLowerCase() === (log.assetName || log.itemName || '').trim().toLowerCase())
        );

        // If not found, try matching by Pengajuan Number (fallback)
        if (!inbound) {
            inbound = inboundTransactions.find(t =>
                (t.pengajuanNumber || '').trim() === (log.pengajuanNumber || '').trim() &&
                (t.itemCode || '').trim() === (log.itemCode || '').trim() &&
                ((t.itemName || '').trim().toLowerCase() === (log.itemName || '').trim().toLowerCase() ||
                    (t.assetName || '').trim().toLowerCase() === (log.assetName || log.itemName || '').trim().toLowerCase())
            );
        }

        if (inbound) {
            // Populate from inbound
            result.sender = inbound.sender;
            result.packageNumber = inbound.packageNumber || inbound.package_number;
            result.serialNumber = inbound.serialNumber || inbound.serial_number;
            result.hsCode = inbound.hsCode || inbound.hs_code;
        }

        // 2. Lookup Quotations for missing fields (especially serialNumber)
        const quotation = quotations.find(q =>
            (q.quotationNumber || q.quotation_number || '').trim() === (log.pengajuanNumber || '').trim()
        );

        if (quotation) {
            // Fill sender if not found from inbound
            if (!result.sender) {
                result.sender = quotation.shipper?.name ||
                    quotation.shipper_name ||
                    quotation.customer?.name ||
                    quotation.customer_name ||
                    quotation.companyName;
            }

            // Try to find serialNumber from package items if not found in inbound
            if (!result.serialNumber && quotation.packages) {
                // Find matching package
                const pkg = quotation.packages.find(p =>
                    (p.packageNumber || '').trim() === (log.packageNumber || result.packageNumber || '').trim()
                );
                const packagesToSearch = pkg ? [pkg] : quotation.packages;

                for (const p of packagesToSearch) {
                    if (p.items) {
                        const itemIndex = p.items.findIndex(i =>
                            (i.itemCode || '').trim() === (log.itemCode || '').trim() &&
                            (i.name || i.itemName || '').trim().toLowerCase() === (log.itemName || log.assetName || '').trim().toLowerCase()
                        );

                        if (itemIndex !== -1) {
                            result.serialNumber = (itemIndex + 1).toString();
                            if (!result.packageNumber) {
                                result.packageNumber = p.packageNumber;
                            }
                            if (!result.hsCode) {
                                result.hsCode = p.items[itemIndex].hsCode;
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Fallback to log data if still empty
        if (!result.packageNumber) result.packageNumber = log.packageNumber;
        if (!result.serialNumber) result.serialNumber = log.serialNumber;
        if (!result.hsCode) result.hsCode = log.hsCode;
        if (!result.sender) result.sender = '-';

        // Return null if all fields are empty/default
        if (!result.sender || result.sender === '-') {
            if (!result.packageNumber && !result.serialNumber && !result.hsCode) {
                return null;
            }
        }

        return result;
    };

    // Export to CSV handler with Header
    const handleExportCSV = () => {
        const dataToExport = filteredLogs.map((item, idx) => {
            const totalQty = item.totalStock || item.quantity || 0;
            const mutatedQty = item.mutatedQty || 0;

            const { calculatedRemutated, calculatedSisa } = getRemutationInfo(item);
            const source = findInventorySource(item);

            return {
                no: idx + 1,
                noPengajuan: item.pengajuanNumber,
                jenisDokumen: 'BC 2.3',
                tglTerima: formatDate(item.approvedDate || item.date),
                pengirim: item.sender || source?.sender || '-',
                kodePackage: source?.packageNumber || item.packageNumber || '-',
                kodeBarang: item.itemCode,
                kodeHS: source?.hsCode || item.hsCode,
                noUrut: source?.serialNumber || item.serialNumber || '-',
                namaBarang: item.itemName || item.assetName,
                jmlAwal: totalQty,
                jmlMutasi: mutatedQty,
                jmlRemutasi: calculatedRemutated,
                jmlBarang: calculatedSisa,
                satuan: item.uom || 'pcs',
                keterangan: item.remarks || '-'
            };
        });

        // Get period info
        const dates = filteredLogs.map(log => new Date(log.date || log.approvedDate));
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
        const periodText = `Periode: ${formatDate(minDate.toISOString())} - ${formatDate(maxDate.toISOString())}`;

        // Build CSV with header
        const companyName = companySettings?.company_name || 'PT. FREIGHT ONE INDONESIA';
        const companyAddress = companySettings?.address || 'Jl. Contoh No. 123, Jakarta';

        let csvContent = '';
        csvContent += `${companyName}\n`;
        csvContent += `${companyAddress}\n`;
        csvContent += `\n`;
        csvContent += `DATA MUTASI BARANG\n`;
        csvContent += `${periodText}\n`;
        csvContent += `\n`;

        // Add table headers
        const headers = ['No', 'No. Pengajuan', 'Jenis Dokumen', 'Tgl. Terima', 'Pengirim', 'Kode Package/Box',
            'Kode Barang', 'Kode HS', 'No. Urut', 'Nama Barang', 'Jumlah Barang Awal',
            'Jumlah Barang Mutasi', 'Jumlah Barang Remutasi', 'Jumlah Barang', 'Satuan', 'Keterangan'];
        csvContent += headers.join(',') + '\n';

        // Add data rows
        dataToExport.forEach(row => {
            const rowData = [
                row.no, row.noPengajuan, row.jenisDokumen, row.tglTerima, row.pengirim,
                row.kodePackage, row.kodeBarang, row.kodeHS, row.noUrut, row.namaBarang,
                row.jmlAwal, row.jmlMutasi, row.jmlRemutasi, row.jmlBarang, row.satuan, row.keterangan
            ];
            csvContent += rowData.map(cell => `"${cell}"`).join(',') + '\n';
        });

        link.download = `Data_Mutasi_Barang_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Export to XLS handler
    const handleExportXLS = () => {
        if (filteredLogs.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        // Prepare Data (Mirroring CSV logic)
        const exportData = filteredLogs.map((item, idx) => {
            const totalQty = item.totalStock || item.quantity || 0;
            const mutatedQty = item.mutatedQty || 0;

            const { calculatedRemutated, calculatedSisa } = getRemutationInfo(item);
            const source = findInventorySource(item);

            return {
                no: idx + 1,
                noPengajuan: item.pengajuanNumber,
                jenisDokumen: 'BC 2.3',
                tglTerima: item.approvedDate || item.date ? new Date(item.approvedDate || item.date).toLocaleDateString('id-ID') : '-',
                pengirim: item.sender || source?.sender || '-',
                kodePackage: source?.packageNumber || item.packageNumber || '-',
                kodeBarang: item.itemCode,
                kodeHS: source?.hsCode || item.hsCode,
                noUrut: source?.serialNumber || item.serialNumber || '-',
                namaBarang: item.itemName || item.assetName,
                jmlAwal: Number(totalQty) || 0,
                jmlMutasi: Number(mutatedQty) || 0,
                jmlRemutasi: Number(calculatedRemutated) || 0,
                jmlBarang: Number(calculatedSisa) || 0,
                satuan: item.uom || 'pcs',
                keterangan: item.remarks || '-'
            };
        });

        // Calculate Period
        const dates = filteredLogs.map(log => new Date(log.date || log.approvedDate));
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
        const formatDate = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        // Format period string explicitly as shown in image "Periode: DD/MM/YYYY - DD/MM/YYYY"
        const period = `Periode: ${formatDate(minDate)} - ${formatDate(maxDate)}`;

        // Define Header Structure matching image
        const headerRows = [
            { value: 'PT. BAKHTERA FREIGHT WORLDWIDE', style: 'company' },
            { value: 'Jl. Contoh No. 123, Jakarta', style: 'normal' },
            { value: '' },
            { value: 'DATA MUTASI BARANG', style: 'title' },
            { value: period, style: 'normal' },
            { value: '' },
            { value: '' }
        ];

        // Define Columns
        const xlsColumns = [
            { header: 'No', key: 'no', width: 5, align: 'center' },
            { header: 'No. Pengajuan', key: 'noPengajuan', width: 20 },
            { header: 'Jenis Dokumen', key: 'jenisDokumen', width: 12 },
            { header: 'Tgl. Terima', key: 'tglTerima', width: 12 },
            { header: 'Pengirim', key: 'pengirim', width: 20 },
            { header: 'Kode Package/Box', key: 'kodePackage', width: 15, align: 'center' },
            { header: 'Kode Barang', key: 'kodeBarang', width: 15 },
            { header: 'Kode HS', key: 'kodeHS', width: 12 },
            { header: 'No. Urut', key: 'noUrut', width: 8, align: 'center' },
            { header: 'Nama Barang', key: 'namaBarang', width: 30 },
            { header: 'Jumlah Barang Awal', key: 'jmlAwal', width: 15, align: 'center' },
            { header: 'Jumlah Barang Mutasi', key: 'jmlMutasi', width: 15, align: 'center' },
            { header: 'Jumlah Barang Remutasi', key: 'jmlRemutasi', width: 15, align: 'center' },
            { header: 'Jumlah Barang Sisa', key: 'jmlBarang', width: 15, align: 'center' },
            { header: 'Satuan', key: 'satuan', width: 8, align: 'center' },
            { header: 'Keterangan', key: 'keterangan', width: 25 }
        ];

        exportToXLS(exportData, 'Data_Mutasi_Barang', headerRows, xlsColumns);
    };



    // Document upload handlers
    const compressImage = (file, maxSizeKB = 3000) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (file.type === 'application/pdf') {
                    if (file.size <= maxSizeKB * 1024) {
                        resolve({ data: e.target.result, size: file.size });
                    } else {
                        alert(`File PDF "${file.name}" melebihi ${maxSizeKB}KB.`);
                        resolve(null);
                    }
                    return;
                }

                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    let quality = 0.9;

                    const maxDim = 1200;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = (height / width) * maxDim;
                            width = maxDim;
                        } else {
                            width = (width / height) * maxDim;
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compress = () => {
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        const size = Math.round((dataUrl.length * 3) / 4);

                        if (size > maxSizeKB * 1024 && quality > 0.1) {
                            quality -= 0.1;
                            compress();
                        } else {
                            resolve({ data: dataUrl, size });
                        }
                    };
                    compress();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        const maxFiles = 8;

        if (documents.length + files.length > maxFiles) {
            alert(`Maksimal ${maxFiles} file.`);
            return;
        }

        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                alert(`Format file "${file.name}" tidak didukung. Gunakan JPG, PNG, atau PDF.`);
                continue;
            }

            const result = await compressImage(file, 3000);
            if (result) {
                setDocuments(prev => [...prev, {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    title: '',
                    data: result.data,
                    size: result.size
                }]);
            }
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDocumentTitleChange = (docId, title) => {
        setDocuments(prev => prev.map(doc =>
            doc.id === docId ? { ...doc, title } : doc
        ));
    };

    const handleRemoveDocument = (docId) => {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
    };

    const handleDeleteRow = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Yakin ingin menghapus data mutasi ini secara permanen?')) return;

        if (deleteMutationLog) {
            try {
                await deleteMutationLog(id);
            } catch (error) {
                console.error("Delete failed", error);
                alert("Gagal menghapus data");
            }
        }
    };

    // Edit handlers
    const handleRowClick = (log) => {
        setSelectedLog(log);
        setEditData(JSON.parse(JSON.stringify(log)));
        setDocuments(log.documents || []);
        setIsEditing(false);
    };

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditData(JSON.parse(JSON.stringify(selectedLog)));
        setDocuments(selectedLog.documents || []);
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        try {
            const updatedLog = {
                ...editData,
                documents: documents
            };

            if (updateMutationLog) {
                await updateMutationLog(selectedLog.id, updatedLog);
            }

            setSelectedLog(updatedLog);
            setIsEditing(false);
            alert('✅ Data mutasi berhasil diupdate!');
        } catch (error) {
            console.error('❌ Error updating mutation:', error);
            alert('Gagal menyimpan perubahan.');
        }
    };

    const handleReturnToWarehouse = async () => {
        if (!window.confirm('Apakah Anda yakin ingin mengembalikan barang ini ke warehouse?')) {
            return;
        }

        try {
            const returnMutation = {
                pengajuanId: selectedLog.pengajuanId,
                pengajuanNumber: selectedLog.pengajuanNumber,
                bcDocumentNumber: selectedLog.bcDocumentNumber,
                packageNumber: selectedLog.packageNumber,
                itemCode: selectedLog.itemCode,
                itemName: selectedLog.itemName || selectedLog.assetName,
                hsCode: selectedLog.hsCode,
                totalStock: selectedLog.mutatedQty,
                mutatedQty: selectedLog.mutatedQty,
                remainingStock: 0,
                origin: selectedLog.destination,
                destination: 'warehouse',
                condition: selectedLog.condition || 'Baik',
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                pic: editData.pic || '',
                remarks: `Pengembalian dari ${selectedLog.destination}`,
                documents: documents
            };

            if (addMutationLog) {
                await addMutationLog(returnMutation);
            }

            setSelectedLog(null);
            setEditData(null);
            setDocuments([]);
            setIsEditing(false);
            alert('✅ Barang berhasil dikembalikan ke warehouse!');
        } catch (error) {
            console.error('❌ Error returning to warehouse:', error);
            alert('Gagal mengembalikan barang.');
        }
    };

    const handleCloseModal = () => {
        setSelectedLog(null);
        setEditData(null);
        setDocuments([]);
        setIsEditing(false);
    };

    const displayData = isEditing ? editData : selectedLog;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Pergerakan Barang (Mutasi)</h1>
                <p className="text-silver-dark mt-1">Daftar Barang yang Dimutasi dari Inventaris Gudang</p>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari No. Pengajuan, No. BC, Nama Barang..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Item Mutasi</p>
                    <p className="text-2xl font-bold text-accent-blue">{mutationLogs.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-orange-500">
                    <p className="text-xs text-silver-dark">Mutasi Hari Ini</p>
                    <p className="text-2xl font-bold text-orange-500">
                        {mutationLogs.filter(t => t.date === new Date().toISOString().split('T')[0]).length}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Mutasi Barang</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredLogs.length} entri</span>
                        <div className="flex gap-2 ml-2">
                            <Button
                                onClick={handleExportXLS}
                                variant="success"
                                icon={FileSpreadsheet}
                                className="!py-1.5 !px-3 !text-xs"
                            >
                                Export XLS
                            </Button>
                            <Button
                                onClick={handleExportCSV}
                                variant="secondary"
                                icon={Download}
                                className="!py-1.5 !px-3 !text-xs"
                            >
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue/10">
                            <tr>

                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">No</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Jenis Dokumen</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Tgl. Terima</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Pengirim</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode Package</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode Barang</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Kode HS</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">No. Urut</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Nama Barang</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Jml Awal</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-orange-400 whitespace-nowrap">Jml Mutasi</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-blue-400 whitespace-nowrap">Jml Remutasi</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-green-400 whitespace-nowrap">Jml Barang</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Satuan</th>
                                <th className="px-2 py-2 text-left text-[10px] font-semibold text-silver whitespace-nowrap">Keterangan</th>
                                <th className="px-2 py-2 text-center text-[10px] font-semibold text-silver whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="16" className="px-4 py-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data mutasi</p>
                                        <p className="text-sm text-silver-dark mt-2">Item yang dimutasi dari inventaris akan muncul di sini</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((item, idx) => {
                                    const totalQty = item.totalStock || item.quantity || 0;
                                    const mutatedQty = item.mutatedQty || 0;

                                    const { calculatedRemutated, calculatedSisa } = getRemutationInfo(item);


                                    const source = findInventorySource(item);

                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => handleRowClick(item)}
                                            className="border-t border-dark-border hover:bg-dark-surface/50 cursor-pointer"
                                        >
                                            <td className="px-2 py-2 text-[11px] text-center text-silver">{idx + 1}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver font-medium">{item.pengajuanNumber || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver">BC 2.3</td>
                                            <td className="px-2 py-2 text-[11px] text-center text-silver">
                                                {formatDate(item.approvedDate || item.date)}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-silver">{item.sender || source?.sender || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver font-mono text-center">{source?.packageNumber || item.packageNumber || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver font-mono">{item.itemCode || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver font-mono">{source?.hsCode || item.hsCode || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-center text-silver font-mono">{source?.serialNumber || item.serialNumber || '-'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver">{item.itemName || item.assetName}</td>
                                            <td className="px-2 py-2 text-[11px] text-center text-silver">{totalQty}</td>
                                            <td className="px-2 py-2 text-[11px] text-center text-orange-400 font-bold">
                                                {mutatedQty}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-center text-blue-400 font-bold">
                                                {calculatedRemutated}
                                            </td>
                                            <td className={`px-2 py-2 text-[11px] text-center font-bold ${calculatedSisa < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {calculatedSisa}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-center text-silver">{item.uom || 'pcs'}</td>
                                            <td className="px-2 py-2 text-[11px] text-silver">{item.remarks || '-'}</td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    onClick={(e) => handleDeleteRow(e, item.id)}
                                                    className="p-1 hover:bg-red-500/20 rounded-lg group transition-colors"
                                                    title="Hapus Log Mutasi"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Enhanced Detail/Edit Modal */}
            {selectedLog && displayData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="glass-card rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold gradient-text">
                                {isEditing ? 'Edit Mutasi Barang' : 'Detail Mutasi Barang'}
                            </h3>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <>
                                        {/* Read-only view, buttons removed as per request */}
                                    </>
                                ) : (
                                    <>
                                        <Button onClick={handleCancelEdit} variant="secondary" icon={X} className="text-sm">
                                            Batal
                                        </Button>
                                        <Button onClick={handleSaveEdit} variant="primary" icon={Save} className="text-sm">
                                            Simpan
                                        </Button>
                                    </>
                                )}
                                <button onClick={handleCloseModal} className="p-2 hover:bg-dark-border rounded">
                                    <X className="w-5 h-5 text-silver" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-silver-dark">No. Pengajuan</label>
                                    <p className="text-sm text-silver-light">{displayData.pengajuanNumber}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">No. BC</label>
                                    <p className="text-sm text-accent-blue">{displayData.bcDocumentNumber}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Kode Barang</label>
                                    <p className="text-sm text-silver-light font-mono">{displayData.itemCode}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Nama Barang</label>
                                    <p className="text-sm text-silver-light font-medium">{displayData.assetName || displayData.itemName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Lokasi Mutasi</label>
                                    {isEditing ? (
                                        <select
                                            value={editData.destination || 'warehouse'}
                                            onChange={(e) => setEditData({ ...editData, destination: e.target.value })}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                        >
                                            <option value="warehouse">Warehouse</option>
                                            <option value="pameran">Pameran</option>
                                        </select>
                                    ) : (
                                        <p className="text-sm text-orange-400 font-bold">{displayData.destination}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Kondisi</label>
                                    {isEditing ? (
                                        <select
                                            value={editData.condition || 'Baik'}
                                            onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                        >
                                            <option value="Baik">Baik</option>
                                            <option value="Rusak">Rusak</option>
                                            <option value="Cacat">Cacat</option>
                                        </select>
                                    ) : (
                                        <p className="text-sm text-silver-light">{displayData.condition || 'Baik'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Jumlah Mutasi</label>
                                    <p className="text-lg font-bold text-orange-400">{displayData.mutatedQty} {displayData.uom}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-silver-dark">Tanggal Mutasi</label>
                                    <p className="text-sm text-silver-light">{formatDate(displayData.date)} {displayData.time ? `(${displayData.time})` : ''}</p>
                                </div>
                                {isEditing && (
                                    <div className="col-span-2">
                                        <label className="text-xs text-silver-dark">PIC</label>
                                        <input
                                            type="text"
                                            value={editData.pic || ''}
                                            onChange={(e) => setEditData({ ...editData, pic: e.target.value })}
                                            className="w-full px-2 py-1 text-sm border rounded"
                                            placeholder="Nama PIC"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Document Upload Section */}
                            {isEditing && (
                                <div className="border border-dark-border rounded-lg overflow-hidden">
                                    <div className="bg-dark-surface px-3 py-2 border-b border-dark-border flex justify-between items-center">
                                        <span className="text-sm font-semibold text-silver-light">Dokumen Pendukung ({documents.length}/8)</span>
                                        <div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" multiple className="hidden" />
                                            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" icon={Upload} className="text-xs" disabled={documents.length >= 8}>
                                                Upload Dokumen
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        {documents.length === 0 ? (
                                            <p className="text-xs text-silver-dark text-center py-4">Klik Upload untuk menambahkan dokumen (JPG, PNG, PDF - Max 3MB)</p>
                                        ) : (
                                            <table className="w-full">
                                                <thead className="bg-dark-surface">
                                                    <tr>
                                                        <th className="px-2 py-1 text-left text-xs font-semibold text-silver w-8">No</th>
                                                        <th className="px-2 py-1 text-left text-xs font-semibold text-silver">Judul Dokumen</th>
                                                        <th className="px-2 py-1 text-left text-xs font-semibold text-silver">Nama File</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-silver">Tipe</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-silver">Ukuran</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-silver w-12">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-dark-border">
                                                    {documents.map((doc, idx) => (
                                                        <tr key={doc.id}>
                                                            <td className="px-2 py-1 text-xs text-silver">{idx + 1}</td>
                                                            <td className="px-2 py-1 text-xs">
                                                                <input
                                                                    type="text"
                                                                    value={doc.title}
                                                                    onChange={(e) => handleDocumentTitleChange(doc.id, e.target.value)}
                                                                    placeholder="Masukkan judul..."
                                                                    className="w-full px-2 py-1 text-xs border rounded"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1 text-xs text-silver flex items-center gap-1">
                                                                <FileText className="w-3 h-3" /> {doc.name}
                                                            </td>
                                                            <td className="px-2 py-1 text-xs text-silver-dark text-center uppercase">{doc.type.split('/')[1]}</td>
                                                            <td className="px-2 py-1 text-xs text-silver-dark text-center">{(doc.size / 1024).toFixed(1)} KB</td>
                                                            <td className="px-2 py-1 text-center">
                                                                <button onClick={() => handleRemoveDocument(doc.id)} className="p-1 hover:bg-red-900/20 rounded text-red-500">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Supporting Documents (View Mode) */}
                            {!isEditing && displayData.documents && displayData.documents.length > 0 && (
                                <div>
                                    <label className="text-xs text-silver-dark block mb-2">Dokumen Pendukung Mutasi</label>
                                    <div className="space-y-2">
                                        {displayData.documents.map((doc, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 bg-dark-surface rounded border border-dark-border">
                                                <div className="flex-1">
                                                    <p className="text-sm text-silver-light">{doc.title || doc.name}</p>
                                                    <p className="text-[10px] text-silver-dark">{doc.type}</p>
                                                </div>
                                                {doc.data && (
                                                    <a
                                                        href={doc.data}
                                                        download={doc.name}
                                                        className="text-accent-blue text-xs hover:underline flex items-center gap-1"
                                                    >
                                                        <Download className="w-3 h-3" /> Unduh
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PergerakanBarang;

