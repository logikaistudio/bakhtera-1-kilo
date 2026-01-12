import React, { useState } from 'react';
import { Plus, FileText, CheckCircle, Edit2, Download, Trash2, X, Warehouse, Package } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import PackageManager from '../../components/Common/PackageManager';
import DocumentUploadManager from '../../components/Common/DocumentUploadManager';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../../utils/exportCSV';

const PengajuanManagement = () => {
    const {
        quotations = [],
        customers = [],
        addQuotation,
        updateQuotation,
        deleteQuotation,
        confirmQuotation,
        bcCodes = [],
        itemMaster = [],
        addInboundTransaction,
        addOutboundTransaction, // Added for outbound approval
        vendors = [],
        mutationLogs = [] // Added for calculating available stock
    } = useData();
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ show: false, quotationId: null });
    const [editModal, setEditModal] = useState({ show: false, pengajuan: null });
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, pengajuanId: null });

    // Warehouse selector states for outbound
    const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);
    const [sourcePengajuanId, setSourcePengajuanId] = useState(null);

    const [editFormData, setEditFormData] = useState({
        bcDocumentNumber: '',
        bcDocumentDate: '',
        bcSupportingDocuments: [],
        documentStatus: 'pengajuan',
        rejectionReason: '',
        rejectionDate: '',
        pic: ''
    });

    const [formData, setFormData] = useState({
        submissionDate: new Date().toISOString().split('T')[0],
        customer: '',
        type: 'inbound',
        bcDocType: '',

        shipper: '',
        origin: '',
        destination: '',
        itemDate: '',  // Tanggal Masuk/Keluar Barang (conditional based on type)
        packages: [],
        documents: [],
        notes: '',
        // BL and Invoice fields
        blNumber: '',
        blDate: '',
        invoiceNumber: '',
        invoiceValue: '',
        invoiceCurrency: 'IDR',
        exchangeRate: '',
        exchangeRateDate: '',
        // Approval workflow fields
        documentStatus: 'pengajuan',
        bcDocumentNumber: '',
        bcDocumentDate: '',  // Tanggal Pabean
        bcSupportingDocuments: [],
        rejectionReason: '',
        rejectionDate: '',
        pic: '',
        customsStatus: 'pending'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('🚀 handleSubmit called');
        console.log('📋 Current formData:', formData);
        console.log('📦 Packages:', formData.packages);
        console.log('📦 Packages length:', formData.packages.length);

        if (formData.packages.length === 0) {
            console.error('❌ Validation failed: No packages');
            alert('❌ VALIDASI GAGAL:\nHarap tambahkan minimal satu package!\n\nKlik "Tambah Package" terlebih dahulu.');
            return;
        }

        // Check if at least one package has items
        console.log('🔍 Checking if packages have items...');
        formData.packages.forEach((pkg, idx) => {
            console.log(`  Package ${idx + 1} (${pkg.packageNumber}):`, pkg.items?.length || 0, 'items');
        });

        const hasItems = formData.packages.some(pkg => pkg.items && pkg.items.length > 0);
        if (!hasItems) {
            console.error('❌ Validation failed: No items in packages');
            alert('❌ VALIDASI GAGAL:\nMinimal satu package harus berisi barang!\n\n1. Expand package dengan klik chevron\n2. Klik "Tambah Barang" dalam package\n3. Isi minimal nama barang');
            return;
        }

        console.log('✅ Validation passed - packages:', formData.packages.length, 'items:', formData.packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0));

        const pengajuanData = {
            ...formData,
            date: formData.submissionDate || new Date().toISOString().split('T')[0],
            status: 'quotation',
            documentStatus: 'pengajuan', // Default status
            customsStatus: 'pending'
        };

        console.log('📝 Sending pengajuan data:', pengajuanData);
        console.log('📝 Sending pengajuan data:', pengajuanData);
        if (formData.id) {
            updateQuotation(formData.id, pengajuanData);
            console.log('✅ updateQuotation called');
        } else {
            addQuotation(pengajuanData);
            console.log('✅ addQuotation called');
        }

        // Reset form
        setFormData({
            id: null,
            submissionDate: new Date().toISOString().split('T')[0],
            customer: '',
            type: 'inbound',
            bcDocType: '',

            shipper: '',
            origin: '',
            destination: '',
            itemDate: '',
            packages: [],
            documents: [],
            notes: '',
            blNumber: '',
            blDate: '',
            invoiceNumber: '',
            invoiceValue: '',
            invoiceCurrency: 'IDR',
            exchangeRate: '',
            exchangeRateDate: '',
            documentStatus: 'pengajuan',
            bcDocumentNumber: '',
            bcSupportingDocuments: [],
            rejectionReason: '',
            rejectionDate: '',
            pic: '',
            customsStatus: 'pending'
        });
        setShowForm(false);
        alert('Pengajuan berhasil dibuat!');
        console.log('✅ Form reset complete');
    };

    const handleConfirm = (quotationId) => {
        setConfirmDialog({ show: true, quotationId });
    };

    const handleConfirmAction = () => {
        confirmQuotation(confirmDialog.quotationId);
        setConfirmDialog({ show: false, quotationId: null });
        navigate('/bridge/customs-docs');
    };

    const handleCancelDialog = () => {
        setConfirmDialog({ show: false, quotationId: null });
    };

    const handleFullEdit = (p) => {
        // Prevent editing if document is approved
        const docStatus = p.documentStatus || p.document_status || 'pengajuan';
        if (docStatus === 'approved') {
            alert('❌ Dokumen yang sudah approved tidak dapat diedit!\n\nAnda hanya dapat menghapus dokumen ini jika perlu.');
            return;
        }

        setFormData({
            id: p.id,
            submissionDate: p.submissionDate || p.submission_date || p.date,
            customer: p.customer,
            type: p.type,
            bcDocType: p.bcDocType,
            shipper: p.shipper,
            origin: p.origin || '',
            destination: p.destination || '',
            itemDate: p.itemDate || '',
            packages: p.packages || [],
            documents: p.documents || [],
            notes: p.notes || '',
            blNumber: p.blNumber || '',
            blDate: p.blDate || '',
            invoiceNumber: p.invoiceNumber || '',
            invoiceValue: p.invoiceValue || '',
            invoiceCurrency: p.invoiceCurrency || 'IDR',
            exchangeRate: p.exchangeRate || '',
            exchangeRateDate: p.exchangeRateDate || '',
            documentStatus: p.documentStatus || 'pengajuan',
            bcDocumentNumber: p.bcDocumentNumber || '',
            bcSupportingDocuments: p.bcSupportingDocuments || [],
            rejectionReason: p.rejectionReason || '',
            rejectionDate: p.rejectionDate || '',
            pic: p.pic || '',
            customsStatus: p.customsStatus || 'pending'
        });
        setEditModal({ show: false, pengajuan: null });
        setShowForm(true);
    };

    const handleEditPengajuan = (pengajuan) => {
        // Check if document is approved - show view-only modal
        const docStatus = pengajuan.documentStatus || pengajuan.document_status || 'pengajuan';

        setEditFormData({
            bcDocumentNumber: pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '',
            bcDocumentDate: pengajuan.bcDocumentDate || pengajuan.bc_document_date || '',
            bcSupportingDocuments: pengajuan.bcSupportingDocuments || pengajuan.bc_supporting_documents || [],
            documentStatus: pengajuan.documentStatus || pengajuan.document_status || 'pengajuan',
            rejectionReason: pengajuan.rejectionReason || pengajuan.rejection_reason || '',
            rejectionDate: pengajuan.rejectionDate || pengajuan.rejection_date || '',
            pic: pengajuan.pic || '',
            manualDate: pengajuan.approvedDate || pengajuan.approved_date || new Date().toISOString().split('T')[0]
        });
        setEditModal({ show: true, pengajuan });
    };

    const handleSaveEdit = async () => {
        // Validation
        if (editFormData.documentStatus === 'approved' && !editFormData.bcDocumentNumber.trim()) {
            alert('❌ No. Dokumen Pabean wajib diisi untuk approval');
            return;
        }

        if (editFormData.documentStatus === 'rejected') {
            if (!editFormData.rejectionReason.trim()) {
                alert('❌ Keterangan Penolakan wajib diisi untuk rejection');
                return;
            }
            if (!editFormData.rejectionDate) {
                alert('❌ Tanggal Reject wajib diisi untuk rejection');
                return;
            }
        }

        console.log('💾 Updating pengajuan:', editModal.pengajuan.id, editFormData);

        // Call update function from DataContext
        if (updateQuotation) {
            const updatedData = {
                ...editModal.pengajuan,
                ...editFormData,
                // Also update customs status when document is approved
                customsStatus: editFormData.documentStatus === 'approved' ? 'approved' : editModal.pengajuan.customsStatus,
                // USE MANUAL DATE FOR APPROVED DATE
                approvedDate: editFormData.documentStatus === 'approved' ? (editFormData.manualDate || new Date().toISOString().split('T')[0]) : editModal.pengajuan.approvedDate,
                approvedBy: editFormData.documentStatus === 'approved' ? 'Admin' : editModal.pengajuan.approvedBy
            };

            // AUTO-GENERATION LOGIC FOR APPROVED
            // Trigger if status is approved (allow re-triggering if data missing)
            if (editFormData.documentStatus === 'approved') {
                const pengajuanType = editModal.pengajuan.type;
                const isOutbound = pengajuanType === 'outbound';

                console.log(`🔄 Triggering Automated ${isOutbound ? 'Outbound' : 'Inbound'} & Inventory Update (Sync Mode)...`);
                const allItems = editModal.pengajuan.packages?.flatMap(pkg => pkg.items || []) || [];

                if (allItems.length > 0) {
                    let processedCount = 0;
                    for (const item of allItems) {
                        if (isOutbound) {
                            // OUTBOUND TRANSACTION
                            const transaction = {
                                assetId: item.itemCode || `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                assetName: item.itemName,
                                quantity: Number(item.quantity) || 0,
                                unit: item.uom || 'pcs',
                                value: (Number(item.price) || 0) * (Number(item.quantity) || 0),

                                customsDocType: editModal.pengajuan.bcDocType,
                                customsDocNumber: editFormData.bcDocumentNumber,
                                customsDocDate: editFormData.bcDocumentDate,

                                hsCode: item.hsCode || item.hs_code || '',
                                currency: editModal.pengajuan.invoiceCurrency || 'IDR',

                                // Outbound specific fields
                                destination: editModal.pengajuan.destination || 'Ekspor',
                                receiver: editModal.pengajuan.customer || '',
                                sourcePengajuanId: editModal.pengajuan.sourcePengajuanId,
                                sourcePengajuanNumber: editModal.pengajuan.sourcePengajuanNumber,

                                date: editFormData.manualDate || editFormData.bcDocumentDate || editModal.pengajuan.submissionDate || editModal.pengajuan.submission_date || editModal.pengajuan.date,
                                notes: `Auto-generated from Outbound Quotation ${editModal.pengajuan.quotationNumber || editModal.pengajuan.quotation_number || editModal.pengajuan.id}`
                            };

                            await addOutboundTransaction(transaction);
                        } else {
                            // INBOUND TRANSACTION (existing logic)
                            const transaction = {
                                assetId: item.itemCode || `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                assetName: item.itemName,
                                quantity: Number(item.quantity) || 0,
                                unit: item.uom || 'pcs',
                                value: (Number(item.price) || 0) * (Number(item.quantity) || 0),

                                customsDocType: editModal.pengajuan.bcDocType,
                                customsDocNumber: editFormData.bcDocumentNumber,
                                customsDocDate: editFormData.bcDocumentDate,

                                hsCode: item.hsCode || item.hs_code || '',
                                serialNumber: (processedCount + 1).toString(),
                                currency: editModal.pengajuan.invoiceCurrency || 'IDR',
                                receiptNumber: editModal.pengajuan.quotationNumber || editModal.pengajuan.quotation_number || editModal.pengajuan.id,

                                date: editFormData.manualDate || editFormData.bcDocumentDate || editModal.pengajuan.submissionDate || editModal.pengajuan.submission_date || editModal.pengajuan.date,
                                sender: editModal.pengajuan.shipper,
                                notes: `Auto-generated from Quotation ${editModal.pengajuan.quotationNumber || editModal.pengajuan.quotation_number || editModal.pengajuan.id}`
                            };

                            await addInboundTransaction(transaction);
                        }
                        processedCount++;
                    }
                    if (processedCount > 0) {
                        const targetModule = isOutbound ? 'Barang Keluar & Inventory' : 'Barang Masuk & Inventory';
                        alert(`✨ Otomatisasi: ${processedCount} Item berhasil disinkronkan ke ${targetModule}!`);
                    }
                }
            }

            updateQuotation(editModal.pengajuan.id, updatedData);
            alert('✅ Status pengajuan berhasil diupdate!');
            setEditModal({ show: false, pengajuan: null });
        } else {
            alert('❌ updateQuotation function not found');
        }
    };

    const handleCancelEdit = () => {
        setEditModal({ show: false, pengajuan: null });
        setEditFormData({
            bcDocumentNumber: '',
            bcSupportingDocuments: [],
            documentStatus: 'pengajuan',
            rejectionReason: '',
            rejectionDate: '',
            pic: ''
        });
    };

    const handleDeleteQuotation = async () => {
        console.log('🗑️ Delete button clicked');
        if (!editModal.pengajuan) {
            console.error('❌ editModal.pengajuan is missing');
            return;
        }

        console.log('🗑️ Opening delete confirmation modal for ID:', editModal.pengajuan.id);
        setDeleteConfirmModal({ show: true, pengajuanId: editModal.pengajuan.id });
    };

    const handleConfirmDelete = async () => {
        console.log('✅ User CONFIRMED delete');
        const pengajuanId = deleteConfirmModal.pengajuanId;
        setDeleteConfirmModal({ show: false, pengajuanId: null });

        if (!pengajuanId) {
            console.error('❌ No pengajuan ID in confirmation');
            return;
        }

        console.log('🔍 Checking deleteQuotation function availability:', typeof deleteQuotation, deleteQuotation ? 'AVAILABLE' : 'NOT AVAILABLE');

        if (deleteQuotation) {
            console.log('🚀 Calling deleteQuotation...');
            try {
                const result = await deleteQuotation(pengajuanId);
                console.log('✅ deleteQuotation result:', result);

                if (result.success) {
                    alert('✅ Pengajuan berhasil dihapus');
                    setEditModal({ show: false, pengajuan: null });
                } else {
                    console.error('Delete failed:', result.error);
                    alert(`❌ Gagal menghapus pengajuan: ${result.error?.message || result.error || 'Unknown error'}`);
                }
            } catch (err) {
                console.error('❌ Exception in deleteQuotation call:', err);
                alert(`❌ Exception: ${err.message}`);
            }
        } else {
            console.error('❌ deleteQuotation function is not available in context');
            alert('❌ Fungsi delete belum tersedia (function not found)');
        }
    };

    const handleCancelDelete = () => {
        console.log('⚠️ User CANCELLED delete');
        setDeleteConfirmModal({ show: false, pengajuanId: null });
    };

    const getFilteredBCCodes = () => {
        return bcCodes.filter(bc =>
            (bc.is_active || bc.isActive) &&
            (formData.type === 'inbound' ? bc.category === 'inbound' : bc.category === 'outbound')
        );
    };

    // Get approved inbound pengajuan that have inventory in warehouse
    const getApprovedInboundPengajuan = () => {
        return quotations.filter(q => {
            const docStatus = q.documentStatus || q.document_status;
            const type = q.type;
            return docStatus === 'approved' && type === 'inbound' && (q.packages?.length > 0);
        });
    };

    // Calculate available stock for each item in a pengajuan
    const calculateAvailableStock = (pengajuan) => {
        const pengajuanId = pengajuan.id;
        const pengajuanNumber = pengajuan.quotationNumber || pengajuan.quotation_number;

        // Get all outbound mutations for this pengajuan
        const outboundMutations = mutationLogs.filter(log =>
            (log.pengajuanId === pengajuanId || log.pengajuanNumber === pengajuanNumber) &&
            (log.origin === 'warehouse' && log.destination !== 'warehouse')
        );

        // Create map of mutated quantities per item
        const mutatedQtyMap = {};
        outboundMutations.forEach(log => {
            const key = `${log.packageNumber}-${log.itemCode}`;
            mutatedQtyMap[key] = (mutatedQtyMap[key] || 0) + (log.mutatedQty || 0);
        });

        // Calculate available stock for each package/item
        const packagesWithStock = (pengajuan.packages || []).map(pkg => ({
            ...pkg,
            items: (pkg.items || []).map(item => {
                const key = `${pkg.packageNumber}-${item.itemCode}`;
                const mutated = mutatedQtyMap[key] || 0;
                const originalQty = item.quantity || 0;
                const availableQty = Math.max(0, originalQty - mutated);
                return {
                    ...item,
                    originalQty,
                    mutatedQty: mutated,
                    availableQty,
                    outboundQty: availableQty // Default to max available
                };
            })
        }));

        return packagesWithStock;
    };

    // Handle selection of source pengajuan for outbound
    const handleSelectSourcePengajuan = (pengajuan) => {
        const packagesWithStock = calculateAvailableStock(pengajuan);

        // Filter out packages with no available items
        const packagesWithAvailable = packagesWithStock.filter(pkg =>
            pkg.items.some(item => item.availableQty > 0)
        ).map(pkg => ({
            ...pkg,
            items: pkg.items.filter(item => item.availableQty > 0).map(item => ({
                ...item,
                quantity: item.outboundQty // Set quantity to outbound qty
            }))
        }));

        if (packagesWithAvailable.length === 0) {
            alert('❌ Tidak ada barang yang tersedia di gudang untuk pengajuan ini');
            return;
        }

        // Auto-fill form with source data
        setFormData(prev => ({
            ...prev,
            customer: pengajuan.customer || '',
            shipper: pengajuan.shipper || '',
            origin: 'Gudang TPPB', // Outbound origin is warehouse
            packages: packagesWithAvailable,
            // Reference to source
            sourcePengajuanId: pengajuan.id,
            sourcePengajuanNumber: pengajuan.quotationNumber || pengajuan.quotation_number
        }));

        setSourcePengajuanId(pengajuan.id);
        setShowWarehouseSelector(false);

        console.log('📦 Selected source pengajuan:', pengajuan.quotationNumber || pengajuan.quotation_number);
        console.log('📦 Packages with available stock:', packagesWithAvailable);
    };

    // Removed getCustomsStatusBadge - Status Bea Cukai column removed per user request

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'quotationNumber', header: 'No. Pengajuan' },
            { key: 'submissionDate', header: 'Tanggal' },
            { key: 'customer', header: 'Pemilik Barang' },
            { key: 'type', header: 'Tipe' },
            { key: 'bcDocType', header: 'Dokumen BC' },
            { key: 'itemCode', header: 'Kode Barang' },
            { key: 'bcDocumentNumber', header: 'No. Dokumen Pabean' },
            { key: 'bcDocumentDate', header: 'Tgl Approval' },
            { key: 'documentStatus', header: 'Status Dokumen' },
            { key: 'shipper', header: 'Pengirim' },
            { key: 'origin', header: 'Asal' },
            { key: 'destination', header: 'Tujuan' },
            { key: 'notes', header: 'Catatan' }
        ];

        exportToCSV(quotations, 'Pendaftaran_TPPB', columns);
    };

    // Debug logging
    console.log('🔍 PengajuanManagement render - quotations count:', quotations.length);

    return (
        <div className="p-6 space-y-6" >
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Manajemen Pengajuan</h1>
                    <p className="text-silver-dark mt-1">Pengajuan Layanan TPPB & Tracking Status Bea Cukai</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} icon={Plus}>
                    {showForm ? 'Batal' : 'Buat Pengajuan Baru'}
                </Button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="glass-card p-6 rounded-lg space-y-6">
                    <h3 className="text-lg font-semibold text-silver-light">Pengajuan Baru</h3>

                    {/* Submission Info */}
                    <div className="glass-card p-4 rounded-lg border-2 border-accent-blue bg-accent-blue/10">
                        <h4 className="text-sm font-semibold text-silver-light mb-3">📋 Informasi Pengajuan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    No. Pengajuan
                                </label>
                                <input
                                    type="text"
                                    value="Auto-generated saat submit"
                                    disabled
                                    className="w-full bg-dark-surface/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Tanggal Pengajuan *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.submissionDate}
                                    onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    {formData.type === 'inbound' ? 'Tanggal Masuk Barang' : 'Tanggal Keluar Barang'}
                                    {formData.type === 'outbound' && <span className="text-red-400"> *</span>}
                                </label>
                                <input
                                    type="date"
                                    required={formData.type === 'outbound'}
                                    value={formData.itemDate}
                                    onChange={(e) => setFormData({ ...formData, itemDate: e.target.value })}
                                    className="w-full"
                                />
                                <p className="text-xs text-silver-dark mt-1">
                                    {formData.type === 'inbound'
                                        ? 'Tanggal barang masuk ke TPPB (opsional)'
                                        : 'Tanggal barang keluar dari TPPB (wajib untuk ekspor)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer & Transaction Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Pemilik Barang *</label>
                            <select
                                required
                                value={formData.customer}
                                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                                className="w-full"
                            >
                                <option value="">-- Pilih Pelanggan --</option>
                                {customers.map(cust => (
                                    <option key={cust.id} value={cust.name}>
                                        {cust.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-silver-dark mt-1">
                                Pilih dari daftar customer yang sudah terdaftar
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Tipe *</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full"
                            >
                                <option value="inbound">Masuk (Inbound)</option>
                                <option value="outbound">Keluar (Outbound)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Jenis Dokumen BC *</label>
                            <select
                                required
                                value={formData.bcDocType}
                                onChange={(e) => setFormData({ ...formData, bcDocType: e.target.value })}
                                className="w-full"
                            >
                                <option value="">-- Pilih Jenis Dokumen BC --</option>
                                {getFilteredBCCodes().map(bc => (
                                    <option key={bc.id} value={bc.code}>
                                        {bc.code} - {bc.name}
                                    </option>
                                ))}
                            </select>
                        </div>



                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Shipper *</label>
                            <select
                                required
                                value={formData.shipper}
                                onChange={(e) => setFormData({ ...formData, shipper: e.target.value })}
                                className="w-full"
                            >
                                <option value="">-- Pilih Shipper --</option>
                                {vendors.map(vendor => (
                                    <option key={vendor.id} value={vendor.name}>
                                        {vendor.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Asal</label>
                            <input
                                type="text"
                                value={formData.origin}
                                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                placeholder="Negara/Kota asal"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Tujuan</label>
                            <input
                                type="text"
                                value={formData.destination}
                                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                placeholder="Negara/Kota tujuan"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* BL & Invoice Information */}
                    <div className="glass-card p-4 rounded-lg border-2 border-accent-green bg-accent-green/10">
                        <h4 className="text-sm font-semibold text-silver-light mb-3">📄 Informasi BL & Invoice</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">No. BL</label>
                                <input
                                    type="text"
                                    value={formData.blNumber}
                                    onChange={(e) => setFormData({ ...formData, blNumber: e.target.value })}
                                    placeholder="Bill of Lading Number"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Tanggal BL</label>
                                <input
                                    type="date"
                                    value={formData.blDate}
                                    onChange={(e) => setFormData({ ...formData, blDate: e.target.value })}
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">No. Invoice</label>
                                <input
                                    type="text"
                                    value={formData.invoiceNumber}
                                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                    placeholder="Invoice Number"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Nilai Invoice</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.invoiceValue}
                                    onChange={(e) => setFormData({ ...formData, invoiceValue: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Kurs</label>
                                <select
                                    value={formData.invoiceCurrency}
                                    onChange={(e) => setFormData({ ...formData, invoiceCurrency: e.target.value })}
                                    className="w-full"
                                >
                                    <option value="IDR">IDR - Rupiah</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="SGD">SGD - Singapore Dollar</option>
                                    <option value="JPY">JPY - Japanese Yen</option>
                                    <option value="CNY">CNY - Chinese Yuan</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Rate Kurs</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formData.exchangeRate}
                                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                                    placeholder="1.0000"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Tanggal Rate Kurs</label>
                                <input
                                    type="date"
                                    value={formData.exchangeRateDate}
                                    onChange={(e) => setFormData({ ...formData, exchangeRateDate: e.target.value })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Warehouse Selector for Outbound */}
                    {formData.type === 'outbound' && (
                        <div className="glass-card p-4 rounded-lg border-2 border-accent-purple bg-accent-purple/10">
                            <h4 className="text-sm font-semibold text-silver-light mb-3">📦 Pilih Barang dari Gudang</h4>
                            <p className="text-xs text-silver-dark mb-3">
                                Untuk pengajuan keluar, pilih barang yang sudah ada di gudang dari pengajuan inbound yang sudah approved.
                            </p>

                            {sourcePengajuanId ? (
                                <div className="flex items-center justify-between bg-dark-surface/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-5 h-5 text-accent-green" />
                                        <span className="text-sm text-silver">
                                            Sumber: <span className="font-medium text-accent-green">{formData.sourcePengajuanNumber}</span>
                                        </span>
                                        <span className="text-xs text-silver-dark">
                                            ({formData.packages?.length || 0} package, {formData.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0} item)
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setSourcePengajuanId(null);
                                            setFormData(prev => ({ ...prev, packages: [], sourcePengajuanId: null, sourcePengajuanNumber: null }));
                                        }}
                                    >
                                        Ganti
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="primary"
                                    icon={Warehouse}
                                    onClick={() => setShowWarehouseSelector(true)}
                                >
                                    Pilih dari Gudang
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Package Management - Nested structure */}
                    {/* For outbound with source selected, show read-only or editable view */}
                    {(formData.type === 'inbound' || sourcePengajuanId) && (
                        <PackageManager
                            packages={formData.packages}
                            onChange={(packages) => setFormData({ ...formData, packages })}
                            itemMaster={itemMaster}
                            readOnly={formData.type === 'outbound' && sourcePengajuanId} // Optional: make it read-only for outbound
                        />
                    )}

                    {formData.type === 'outbound' && !sourcePengajuanId && (
                        <div className="glass-card p-6 rounded-lg border-2 border-dashed border-dark-border text-center">
                            <Warehouse className="w-12 h-12 mx-auto mb-3 text-silver-dark opacity-50" />
                            <p className="text-silver-dark">Klik "Pilih dari Gudang" di atas untuk memilih barang yang akan dikeluarkan</p>
                        </div>
                    )}

                    {/* Document Upload */}
                    <DocumentUploadManager
                        documents={formData.documents}
                        onChange={(docs) => setFormData({ ...formData, documents: docs })}
                        maxFiles={10}
                        maxSizeKB={200}
                    />

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Catatan</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Catatan tambahan..."
                            rows={3}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                            Batal
                        </Button>
                        <Button type="submit" icon={Plus}>
                            Buat Pengajuan
                        </Button>
                    </div>
                </form>
            )}

            {/* Daftar Pengajuan - TABLE FORMAT */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-silver-light">Pengajuan</h3>
                    <Button
                        onClick={handleExportCSV}
                        variant="secondary"
                        icon={Download}
                    >
                        Export CSV
                    </Button>
                </div>

                {quotations.length === 0 ? (
                    <div className="text-center py-8 text-silver-dark">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Belum ada pengajuan</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-blue">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">No. Pengajuan</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tanggal</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Pemilik Barang</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tipe</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Dokumen BC</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Jumlah Barang</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">No. Dokumen Pabean</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tgl Approval</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status Dokumen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {quotations.map(quot => {
                                    const docStatus = quot.documentStatus || quot.document_status || 'pengajuan';
                                    const docStatusBadge = {
                                        pengajuan: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Pengajuan' },
                                        approved: { color: 'bg-green-500/20 text-green-400', label: 'Approved' },
                                        rejected: { color: 'bg-red-500/20 text-red-400', label: 'Rejected' }
                                    }[docStatus] || { color: 'bg-yellow-500/20 text-yellow-400', label: 'Pengajuan' };

                                    return (
                                        <tr
                                            key={quot.id}
                                            onClick={() => handleEditPengajuan(quot)}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                        >
                                            <td className="px-4 py-3 text-sm text-silver-light font-medium">
                                                {quot.quotationNumber || quot.quotation_number || quot.id}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-dark">
                                                {new Date(quot.submissionDate || quot.submission_date || quot.date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver">
                                                {quot.customer}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-dark">
                                                {quot.type === 'inbound' ? 'Masuk (Inbound)' : 'Keluar (Outbound)'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver">
                                                {quot.bcDocType || quot.bc_document_type || '-'}
                                            </td>

                                            {/* Jumlah Barang */}
                                            <td className="px-4 py-3 text-sm text-silver">
                                                {quot.packages
                                                    ? `${quot.packages.length} package (${quot.packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0)} item)`
                                                    : (quot.packageItems?.length || quot.items?.length || 0)
                                                }
                                            </td>

                                            {/* No. Dokumen Pabean */}
                                            <td className="px-4 py-3 text-sm text-accent-blue font-medium">
                                                {quot.bcDocumentNumber || quot.bc_document_number || '-'}
                                            </td>

                                            {/* Tanggal Approval */}
                                            <td className="px-4 py-3 text-sm text-silver">
                                                {quot.approvedDate || quot.approved_date ? new Date(quot.approvedDate || quot.approved_date).toLocaleDateString('id-ID') : '-'}
                                            </td>

                                            {/* Status Dokumen */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${docStatusBadge.color}`}>
                                                    {docStatusBadge.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
                }
            </div>

            {/* Confirmation Dialog */}
            {
                confirmDialog.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="glass-card p-6 rounded-lg max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-silver-light mb-4">
                                Konfirmasi Pendaftaran
                            </h3>
                            <p className="text-silver mb-6">
                                Apakah Anda yakin ingin mengirim pengajuan ini ke Bea Cukai?
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button variant="secondary" onClick={handleCancelDialog}>
                                    Batal
                                </Button>
                                <Button onClick={handleConfirmAction} icon={CheckCircle}>
                                    Ya, Kirim
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Pengajuan Modal */}
            {
                editModal.show && editModal.pengajuan && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="glass-card rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-dark-surface p-6 border-b border-dark-border z-10 flex justify-between items-center">
                                <h2 className="text-xl font-bold gradient-text">Edit Status Pengajuan</h2>
                                <button onClick={handleCancelEdit} className="text-silver-dark hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Summary */}
                                <div className="glass-card p-4 rounded-lg bg-accent-blue/10">
                                    <h3 className="text-sm font-semibold text-silver-light mb-3">📋 Ringkasan Pengajuan</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-silver-dark">No. Pendaftaran</p>
                                            <p className="text-silver-light font-medium">{editModal.pengajuan.quotationNumber || editModal.pengajuan.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-silver-dark">Tanggal</p>
                                            <p className="text-silver-light">{new Date(editModal.pengajuan.submissionDate || editModal.pengajuan.date).toLocaleDateString('id-ID')}</p>
                                        </div>
                                        <div>
                                            <p className="text-silver-dark">Customer</p>
                                            <p className="text-silver-light font-medium">{editModal.pengajuan.customer}</p>
                                        </div>
                                        <div>
                                            <p className="text-silver-dark">BC Document</p>
                                            <p className="text-silver-light">{editModal.pengajuan.bcDocType}</p>
                                        </div>
                                        <div>
                                            <p className="text-silver-dark">Package</p>
                                            <p className="text-silver-light">{editModal.pengajuan.packages?.length || 0} package</p>
                                        </div>
                                        <div>
                                            <p className="text-silver-dark">Total Items</p>
                                            <p className="text-silver-light">
                                                {editModal.pengajuan.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0} item
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-dark-border text-right">
                                        {(editModal.pengajuan.documentStatus || editModal.pengajuan.document_status) === 'approved' ? (
                                            <p className="text-xs text-amber-400 italic">
                                                ⚠️ Dokumen approved tidak dapat diedit. Hanya bisa dihapus jika perlu.
                                            </p>
                                        ) : (
                                            <Button size="sm" variant="secondary" onClick={() => handleFullEdit(editModal.pengajuan)} icon={Edit2}>
                                                Edit Detail Data
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* BC Document Number */}
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">
                                        No. Dokumen Pabean {editFormData.documentStatus === 'approved' && <span className="text-red-400">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.bcDocumentNumber}
                                        onChange={(e) => setEditFormData({ ...editFormData, bcDocumentNumber: e.target.value })}
                                        placeholder="contoh: BC2.3-2025-001"
                                        className="w-full"
                                    />
                                </div>

                                {/* BC Document Date */}
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">
                                        Tanggal Dokumen Pabean
                                    </label>
                                    <input
                                        type="date"
                                        value={editFormData.bcDocumentDate}
                                        onChange={(e) => setEditFormData({ ...editFormData, bcDocumentDate: e.target.value })}
                                        className="w-full"
                                    />
                                </div>

                                {/* BC Supporting Documents */}
                                <DocumentUploadManager
                                    documents={editFormData.bcSupportingDocuments}
                                    onChange={(docs) => setEditFormData({ ...editFormData, bcSupportingDocuments: docs })}
                                    maxFiles={10}
                                    maxSizeKB={200}
                                    label="Dokumen Pendukung Pabean"
                                />

                                {/* Status Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">
                                        Status Dokumen *
                                    </label>
                                    <select
                                        value={editFormData.documentStatus}
                                        onChange={(e) => setEditFormData({ ...editFormData, documentStatus: e.target.value })}
                                        className="w-full"
                                    >
                                        <option value="pengajuan">Pendaftaran</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>

                                {/* Manual Approval Date - ONLY VISIBLE IF APPROVED */}
                                {editFormData.documentStatus === 'approved' && (
                                    <div>
                                        <label className="block text-sm font-medium text-accent-green mb-2">
                                            Tanggal Approval (Manual) *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={editFormData.manualDate}
                                            onChange={(e) => setEditFormData({ ...editFormData, manualDate: e.target.value })}
                                            className="w-full border-accent-green focus:ring-accent-green"
                                        />
                                        <p className="text-xs text-silver-dark mt-1">Tanggal ini akan digunakan sebagai tanggal masuk barang di sistem.</p>
                                    </div>
                                )}

                                {/* PIC Field */}
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">
                                        PIC (Person In Charge)
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.pic}
                                        onChange={(e) => setEditFormData({ ...editFormData, pic: e.target.value })}
                                        placeholder="Nama PIC yang menangani pendaftaran"
                                        className="w-full"
                                    />
                                </div>

                                {/* Rejection Reason (Conditional) */}
                                {editFormData.documentStatus === 'rejected' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-silver mb-2">
                                                Tanggal Reject *
                                            </label>
                                            <input
                                                type="date"
                                                value={editFormData.rejectionDate}
                                                onChange={(e) => setEditFormData({ ...editFormData, rejectionDate: e.target.value })}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-silver mb-2">
                                                Keterangan Penolakan *
                                            </label>
                                            <textarea
                                                value={editFormData.rejectionReason}
                                                onChange={(e) => setEditFormData({ ...editFormData, rejectionReason: e.target.value })}
                                                placeholder="Jelaskan alasan penolakan..."
                                                rows={3}
                                                className="w-full"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Buttons */}
                                {/* Buttons */}
                                <div className="flex justify-between items-center pt-4 border-t border-dark-border">
                                    <Button
                                        variant="danger"
                                        onClick={handleDeleteQuotation}
                                        icon={Trash2}
                                        className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
                                    >
                                        Hapus
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button variant="secondary" onClick={handleCancelEdit}>
                                            Batal
                                        </Button>
                                        <Button onClick={handleSaveEdit} icon={CheckCircle}>
                                            Simpan Perubahan
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                deleteConfirmModal.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
                        <div className="glass-card rounded-lg max-w-md w-full p-6 border-2 border-red-500">
                            <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Konfirmasi Hapus</h2>
                            <p className="text-silver-light mb-6">
                                Apakah Anda yakin ingin menghapus pengajuan ini?
                                <br />
                                <span className="text-red-400 font-semibold">Data yang dihapus tidak dapat dikembalikan.</span>
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button variant="secondary" onClick={handleCancelDelete}>
                                    TIDAK, Batal
                                </Button>
                                <Button variant="danger" onClick={handleConfirmDelete} icon={Trash2}>
                                    YA, Hapus
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Warehouse Selector Modal for Outbound */}
            {showWarehouseSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
                    <div className="glass-card rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-dark-border">
                            <h2 className="text-xl font-bold text-silver-light">
                                <Warehouse className="inline-block w-5 h-5 mr-2" />
                                Pilih Barang dari Gudang
                            </h2>
                            <button
                                onClick={() => setShowWarehouseSelector(false)}
                                className="text-silver-dark hover:text-silver p-1"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {getApprovedInboundPengajuan().length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="w-12 h-12 mx-auto mb-3 text-silver-dark opacity-50" />
                                    <p className="text-silver-dark">Belum ada pengajuan inbound yang approved</p>
                                    <p className="text-xs text-silver-dark mt-1">Buat dan approve pengajuan inbound terlebih dahulu</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {getApprovedInboundPengajuan().map(pengajuan => {
                                        const packagesWithStock = calculateAvailableStock(pengajuan);
                                        const totalItems = packagesWithStock.reduce((sum, pkg) =>
                                            sum + pkg.items.filter(item => item.availableQty > 0).length, 0
                                        );
                                        const totalAvailable = packagesWithStock.reduce((sum, pkg) =>
                                            sum + pkg.items.reduce((itemSum, item) => itemSum + item.availableQty, 0), 0
                                        );

                                        return (
                                            <div
                                                key={pengajuan.id}
                                                className={`glass-card p-4 rounded-lg border-2 cursor-pointer transition-all
                                                    ${totalItems > 0
                                                        ? 'border-dark-border hover:border-accent-blue'
                                                        : 'border-dark-border opacity-50 cursor-not-allowed'
                                                    }`}
                                                onClick={() => totalItems > 0 && handleSelectSourcePengajuan(pengajuan)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-semibold text-silver-light">
                                                            {pengajuan.quotationNumber || pengajuan.quotation_number}
                                                        </h4>
                                                        <p className="text-sm text-silver-dark mt-1">
                                                            {pengajuan.customer} • {pengajuan.shipper || '-'}
                                                        </p>
                                                        <p className="text-xs text-silver-dark mt-1">
                                                            BC: {pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '-'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium
                                                            ${totalItems > 0
                                                                ? 'bg-accent-green/20 text-accent-green'
                                                                : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {totalItems > 0
                                                                ? `${totalAvailable} item tersedia`
                                                                : 'Stok habis'
                                                            }
                                                        </span>
                                                        <p className="text-xs text-silver-dark mt-1">
                                                            {pengajuan.packages?.length || 0} package
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Package preview */}
                                                <div className="mt-3 pt-3 border-t border-dark-border">
                                                    <div className="flex flex-wrap gap-2">
                                                        {packagesWithStock.slice(0, 3).map((pkg, idx) => (
                                                            <span key={idx} className="text-xs bg-dark-surface px-2 py-1 rounded">
                                                                📦 {pkg.packageNumber}: {pkg.items.filter(i => i.availableQty > 0).length} item
                                                            </span>
                                                        ))}
                                                        {packagesWithStock.length > 3 && (
                                                            <span className="text-xs text-silver-dark">
                                                                +{packagesWithStock.length - 3} lainnya
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t border-dark-border">
                            <Button variant="secondary" onClick={() => setShowWarehouseSelector(false)}>
                                Batal
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default PengajuanManagement;
