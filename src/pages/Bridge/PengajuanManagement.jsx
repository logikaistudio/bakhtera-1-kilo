import React, { useState } from 'react';
import { Plus, FileText, CheckCircle, Edit2, Download, Trash2, X, Warehouse, Package, ArrowRight, Save } from 'lucide-react';
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
        mutationLogs = [], // Added for calculating available stock
        warehouseInventory = [] // Added for accurate stock checking
    } = useData();
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ show: false, quotationId: null });
    const [editModal, setEditModal] = useState({ show: false, pengajuan: null });
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, pengajuanId: null });

    // Warehouse selector states for outbound
    const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);
    const [sourcePengajuanId, setSourcePengajuanId] = useState(null);
    const [showItemEditor, setShowItemEditor] = useState(false); // NEW: For editing selected items
    const [editablePackages, setEditablePackages] = useState([]); // NEW: Temporary packages for editing
    const [showDetailModal, setShowDetailModal] = useState(false); // NEW: Detail modal
    const [selectedPengajuan, setSelectedPengajuan] = useState(null); // NEW: Selected pengajuan for detail

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

                // Loop through packages to preserve package context
                const packages = editModal.pengajuan.packages || [];

                if (packages.length > 0) {
                    let processedCount = 0;

                    for (const pkg of packages) {
                        const items = pkg.items || [];

                        for (const item of items) {
                            if (isOutbound) {
                                // OUTBOUND TRANSACTION
                                const itemCode = item.itemCode || item.item_code;
                                const itemName = item.itemName || item.item_name || item.name || 'Unknown Item';

                                if (!itemCode) {
                                    console.error('❌ Missing item code for item:', item);
                                    alert(`Error: Kode barang tidak ditemukan untuk item "${itemName}". Transaksi dibatalkan.`);
                                    return;
                                }

                                const transaction = {
                                    assetId: itemCode,
                                    assetName: itemName,
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

                                    // IMPORTANT: Include package number for proper stock validation
                                    packageNumber: pkg.packageNumber || pkg.package_number,

                                    date: editFormData.manualDate || editFormData.bcDocumentDate || editModal.pengajuan.submissionDate || editModal.pengajuan.submission_date || editModal.pengajuan.date,
                                    notes: `Auto-generated from Outbound Quotation ${editModal.pengajuan.quotationNumber || editModal.pengajuan.quotation_number || editModal.pengajuan.id}`
                                };

                                await addOutboundTransaction(transaction);
                            } else {
                                // INBOUND TRANSACTION (existing logic)
                                // Consistency fix: Use same robust property access
                                const itemCodeIn = item.itemCode || item.item_code || `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                                const itemNameIn = item.itemName || item.item_name || item.name || 'Unknown Item';

                                const transaction = {
                                    assetId: itemCodeIn,
                                    assetName: itemNameIn,
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
        // Use warehouseInventory as the source of truth for current stock
        // This handles cases where items were moved/shipped via Outbound or Mutation

        const packagesWithStock = (pengajuan.packages || []).map(pkg => ({
            ...pkg,
            items: (pkg.items || []).map(item => {
                const itemCode = item.itemCode || item.item_code;

                // Find matching inventory record
                // Matches based on Pengajuan ID (FIFO/Specific Ident) and Package/Item Code
                // Note: freight_warehouse should have these fields populated from inbound
                const inventoryItem = warehouseInventory.find(inv =>
                    (inv.pengajuanId === pengajuanId || inv.pengajuan_id === pengajuanId) &&
                    (inv.itemCode === itemCode || inv.item_code === itemCode) &&
                    (inv.packageNumber === pkg.packageNumber || inv.package_number === pkg.packageNumber)
                );

                const currentStock = inventoryItem ? (inventoryItem.currentStock ?? inventoryItem.quantity ?? 0) : 0;

                return {
                    ...item,
                    originalQty: item.quantity || 0,
                    mutatedQty: 0, // Not strictly needed for logic, but kept for structure
                    availableQty: currentStock,
                    outboundQty: currentStock // Default to max available
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

    // NEW: Handle editing item selection
    const handleEditItemSelection = () => {
        setEditablePackages(formData.packages || []);
        setShowItemEditor(true);
    };

    // NEW: Handle confirm edited items
    const handleConfirmEditedItems = () => {
        // Filter out items with 0 quantity
        const filteredPackages = editablePackages
            .map(pkg => ({
                ...pkg,
                items: pkg.items.filter(item => (item.quantity || 0) > 0)
            }))
            .filter(pkg => pkg.items.length > 0);

        if (filteredPackages.length === 0) {
            alert('⚠️ Tidak ada item yang dipilih. Pilih setidaknya 1 item untuk dikeluarkan.');
            return;
        }

        setFormData(prev => ({
            ...prev,
            packages: filteredPackages
        }));

        setShowItemEditor(false);
        console.log('✅ Item selection updated:', filteredPackages);
    };

    // NEW: Handle quantity change in editor
    const handleItemQuantityChange = (pkgIndex, itemIndex, newQty) => {
        setEditablePackages(prev => {
            const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
            const item = updated[pkgIndex].items[itemIndex];
            const maxQty = item.availableQty || item.quantity || 0;

            // Validate quantity
            const validQty = Math.max(0, Math.min(parseInt(newQty) || 0, maxQty));
            updated[pkgIndex].items[itemIndex].quantity = validQty;

            return updated;
        });
    };

    // NEW: Handle remove item (set quantity to 0)
    const handleRemoveItem = (pkgIndex, itemIndex) => {
        setEditablePackages(prev => {
            const updated = JSON.parse(JSON.stringify(prev)); // Deep clone
            updated[pkgIndex].items[itemIndex].quantity = 0;
            return updated;
        });
    };

    // NEW: Quick outbound submission from inbound pengajuan
    const handleQuickOutbound = (inboundPengajuan, e) => {
        e.stopPropagation(); // Prevent row click

        // Calculate available stock for this pengajuan
        const packagesWithStock = calculateAvailableStock(inboundPengajuan);

        // Filter packages with available items
        const packagesWithAvailable = packagesWithStock.filter(pkg =>
            pkg.items.some(item => item.availableQty > 0)
        ).map(pkg => ({
            ...pkg,
            items: pkg.items.filter(item => item.availableQty > 0).map(item => ({
                ...item,
                quantity: item.availableQty
            }))
        }));

        if (packagesWithAvailable.length === 0) {
            alert('❌ Tidak ada barang yang tersedia di gudang untuk pengajuan ini.\n\nSemua barang mungkin sudah dipindahkan ke Pameran atau sudah keluar dari TPB.');
            return;
        }

        // Store in editable state
        setEditablePackages(packagesWithAvailable);

        // Auto-populate form for outbound
        setFormData({
            submissionDate: new Date().toISOString().split('T')[0],
            customer: inboundPengajuan.customer || '',
            type: 'outbound',
            bcDocType: inboundPengajuan.bcDocType || inboundPengajuan.bc_document_type || '',
            shipper: inboundPengajuan.shipper || '',
            owner: inboundPengajuan.customer || '',
            origin: 'Gudang TPPB',
            destination: '',
            itemDate: '',
            packages: packagesWithAvailable,
            documents: [],
            notes: `Pengajuan keluar dari ${inboundPengajuan.quotationNumber || inboundPengajuan.quotation_number}`,
            blNumber: '',
            blDate: '',
            invoiceNumber: '',
            invoiceValue: '',
            invoiceCurrency: 'IDR',
            exchangeRate: '',
            exchangeRateDate: '',
            documentStatus: 'pengajuan',
            bcDocumentNumber: '',
            bcDocumentDate: '',
            bcSupportingDocuments: [],
            rejectionReason: '',
            rejectionDate: '',
            pic: '',
            customsStatus: 'pending',
            sourcePengajuanId: inboundPengajuan.id,
            sourcePengajuanNumber: inboundPengajuan.quotationNumber || inboundPengajuan.quotation_number
        });

        setSourcePengajuanId(inboundPengajuan.id);
        setShowForm(true);

        console.log('🚀 Quick Outbound from:', inboundPengajuan.quotationNumber || inboundPengajuan.quotation_number);
        console.log(`📦 ${packagesWithAvailable.length} package dengan ${packagesWithAvailable.reduce((sum, pkg) => sum + pkg.items.length, 0)} item siap diajukan keluar`);
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

                    {/* Tipe Pengajuan Section - NEW */}
                    <div className="glass-card p-4 rounded-lg border-2 border-accent-purple bg-accent-purple/10">
                        <h4 className="text-sm font-semibold text-silver-light mb-3">📦 Tipe Pengajuan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-silver mb-2">Tipe *</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full"
                                >
                                    <option value="inbound">Masuk (Inbound)</option>
                                    <option value="outbound">Keluar (Outbound)</option>
                                </select>
                                <p className="text-xs text-silver-dark mt-1">
                                    Pilih tipe pengajuan sesuai dengan alur barang (masuk atau keluar)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* BC Document, Owner & Shipper Section - NEW */}
                    <div className="glass-card p-4 rounded-lg border-2 border-accent-orange bg-accent-orange/10">
                        <h4 className="text-sm font-semibold text-silver-light mb-3">📄 Dokumen BC & Pihak Terkait</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <p className="text-xs text-silver-dark mt-1">
                                    Pilih jenis dokumen Bea Cukai sesuai tipe pengajuan
                                </p>
                            </div>

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
                                <p className="text-xs text-silver-dark mt-1">
                                    Pengirim/vendor yang mengirimkan barang
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Origin & Destination */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="space-y-2">
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
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                icon={Edit2}
                                                onClick={handleEditItemSelection}
                                            >
                                                Edit Pilihan
                                            </Button>
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
                                    </div>
                                    <p className="text-xs text-silver-dark italic">
                                        💡 Klik "Edit Pilihan" untuk menyesuaikan item atau quantity yang akan dikeluarkan
                                    </p>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="primary"
                                    icon={Warehouse}
                                    onClick={() => {
                                        if (window.confirm('Anda akan diarahkan ke halaman Stok Gudang untuk memilih barang keluar. Lanjutkan?')) {
                                            navigate('/bridge/inventory');
                                        }
                                    }}
                                >
                                    Pilih dari Gudang / Input Stok
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

            {/* Daftar Pengajuan - SPLIT INTO TWO TABLES */}

            {/* ==================== PENGAJUAN MASUK (INBOUND) ==================== */}
            <div className="glass-card p-6 rounded-lg border-2 border-accent-blue">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-accent-blue flex items-center gap-2">
                            📥 Pengajuan Masuk (Inbound)
                        </h3>
                        <p className="text-xs text-silver-dark mt-1">Pengajuan barang masuk ke TPPB</p>
                    </div>
                    <Button
                        onClick={handleExportCSV}
                        variant="secondary"
                        icon={Download}
                        size="sm"
                    >
                        Export CSV
                    </Button>
                </div>

                {quotations.filter(q => q.type === 'inbound').length === 0 ? (
                    <div className="text-center py-8 text-silver-dark">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Belum ada pengajuan masuk</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-blue">
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Pengajuan</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Pemilik Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Dokumen BC</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Jumlah Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Dokumen Pabean</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tgl Approval</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Status Dokumen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {quotations.filter(q => q.type === 'inbound').map(quot => {
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
                                            <td className="px-4 py-2 text-sm text-silver-light font-medium whitespace-nowrap">
                                                {quot.quotationNumber || quot.quotation_number || quot.id}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver-dark whitespace-nowrap">
                                                {new Date(quot.submissionDate || quot.submission_date || quot.date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.customer}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.bcDocType || quot.bc_document_type || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.packages
                                                    ? `${quot.packages.length} package (${quot.packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0)} item)`
                                                    : (quot.packageItems?.length || quot.items?.length || 0)
                                                }
                                            </td>
                                            <td className="px-4 py-2 text-sm text-accent-blue font-medium whitespace-nowrap">
                                                {quot.bcDocumentNumber || quot.bc_document_number || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.approvedDate || quot.approved_date ? new Date(quot.approvedDate || quot.approved_date).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
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

            {/* ==================== PENGAJUAN KELUAR (OUTBOUND) ==================== */}
            <div className="glass-card p-6 rounded-lg border-2 border-accent-purple mt-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-accent-purple flex items-center gap-2">
                            📤 Pengajuan Keluar (Outbound)
                        </h3>
                        <p className="text-xs text-silver-dark mt-1">Pengajuan barang keluar dari TPPB</p>
                    </div>
                    <Button
                        onClick={handleExportCSV}
                        variant="secondary"
                        icon={Download}
                        size="sm"
                    >
                        Export CSV
                    </Button>
                </div>

                {quotations.filter(q => q.type === 'outbound').length === 0 ? (
                    <div className="text-center py-8 text-silver-dark">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Belum ada pengajuan keluar</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-purple">
                                <tr>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Pengajuan</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tanggal</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Pemilik Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Dokumen BC</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Jumlah Barang</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">No. Dokumen Pabean</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Tgl Approval</th>
                                    <th className="px-4 py-2 text-left text-sm font-bold text-white whitespace-nowrap">Status Dokumen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {quotations.filter(q => q.type === 'outbound').map(quot => {
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
                                            <td className="px-4 py-2 text-sm text-silver-light font-medium whitespace-nowrap">
                                                {quot.quotationNumber || quot.quotation_number || quot.id}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver-dark whitespace-nowrap">
                                                {new Date(quot.submissionDate || quot.submission_date || quot.date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.customer}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.bcDocType || quot.bc_document_type || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.packages
                                                    ? `${quot.packages.length} package (${quot.packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0)} item)`
                                                    : (quot.packageItems?.length || quot.items?.length || 0)
                                                }
                                            </td>
                                            <td className="px-4 py-2 text-sm text-accent-purple font-medium whitespace-nowrap">
                                                {quot.bcDocumentNumber || quot.bc_document_number || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver whitespace-nowrap">
                                                {quot.approvedDate || quot.approved_date ? new Date(quot.approvedDate || quot.approved_date).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
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

                                    {editModal.pengajuan.type === 'inbound' &&
                                        (editModal.pengajuan.documentStatus || editModal.pengajuan.document_status) === 'approved' && (
                                            <Button
                                                variant="primary"
                                                onClick={(e) => {
                                                    handleQuickOutbound(editModal.pengajuan, e);
                                                    setEditModal({ show: false, pengajuan: null });
                                                }}
                                                icon={ArrowRight}
                                                className="bg-accent-purple hover:bg-accent-purple/80"
                                            >
                                                Ajukan Barang Keluar
                                            </Button>
                                        )}

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

            {/* Item Editor Modal */}
            {showItemEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Edit2 className="w-5 h-5" />
                                    Detail Inventaris
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Pilih item dan quantity yang akan dikeluarkan dari gudang
                                </p>
                            </div>
                            <button onClick={() => setShowItemEditor(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 space-y-4">
                            {/* Detail Item Section Title */}
                            <div className="pb-2">
                                <h3 className="text-base font-bold text-gray-800">📝 Detail Item</h3>
                            </div>

                            {editablePackages.map((pkg, pkgIndex) => {
                                const activeItems = pkg.items.filter(item => (item.quantity || 0) > 0);
                                if (activeItems.length === 0) return null;
                                return (
                                    <div key={pkgIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Package className="w-4 h-4 text-accent-purple" />
                                                Kode Packing: {pkg.packageNumber}
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-accent-purple">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap text-white w-12">NO. URUT</th>
                                                        <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap text-white w-24">KODE BARANG</th>
                                                        <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap text-white w-20">HS CODE</th>
                                                        <th className="px-2 py-2 text-left text-xs font-bold whitespace-nowrap text-white">ITEM</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-16">JML AWAL</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-14">SATUAN</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-24">STATUS</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-20">LOKASI</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-16">KONDISI</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white bg-green-700 w-24">QTY KELUAR</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-white w-12">AKSI</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {pkg.items.map((item, itemIndex) => {
                                                        if ((item.quantity || 0) === 0) return null;
                                                        const maxQty = item.availableQty || item.quantity || 0;
                                                        const currentQty = item.quantity || 0;
                                                        return (
                                                            <tr key={itemIndex} className="hover:bg-purple-50/50">
                                                                <td className="px-2 py-2 text-xs text-gray-700">{itemIndex + 1}</td>
                                                                <td className="px-2 py-2 text-xs font-mono text-gray-900">{item.itemCode || '-'}</td>
                                                                <td className="px-2 py-2 text-xs text-gray-700">{item.hsCode || '-'}</td>
                                                                <td className="px-2 py-2 text-xs text-gray-700">{item.name || item.itemName || '-'}</td>
                                                                <td className="px-2 py-2 text-xs text-center font-semibold text-gray-900">{item.originalQty || maxQty}</td>
                                                                <td className="px-2 py-2 text-xs text-center text-gray-700">{item.uom || 'pcs'}</td>
                                                                <td className="px-2 py-2 text-xs text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                                                                            📦 {maxQty}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-2 text-xs text-center text-gray-700">warehouse</td>
                                                                <td className="px-2 py-2 text-xs text-center text-gray-700">{item.condition || 'Baik'}</td>
                                                                <td className="px-2 py-2 text-center bg-green-50">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={maxQty}
                                                                        value={currentQty}
                                                                        onChange={(e) => handleItemQuantityChange(pkgIndex, itemIndex, e.target.value)}
                                                                        className="w-20 px-2 py-1 text-center border-2 border-green-300 rounded-lg text-gray-900 font-semibold focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2 text-center">
                                                                    <button
                                                                        onClick={() => handleRemoveItem(pkgIndex, itemIndex)}
                                                                        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                                        title="Hapus item ini"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl shadow-md">
                                <h4 className="text-sm font-bold text-gray-700 mb-3">📊 Ringkasan</h4>
                                <div className="grid grid-cols-3 gap-6 text-sm">
                                    <div>
                                        <p className="text-gray-500 font-medium mb-1">Total Package</p>
                                        <p className="text-2xl font-bold text-accent-purple">
                                            {editablePackages.filter(pkg => pkg.items.some(i => (i.quantity || 0) > 0)).length}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-medium mb-1">Total Item</p>
                                        <p className="text-2xl font-bold text-accent-purple">
                                            {editablePackages.reduce((sum, pkg) => sum + pkg.items.filter(i => (i.quantity || 0) > 0).length, 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-medium mb-1">Total Quantity</p>
                                        <p className="text-2xl font-bold text-accent-purple">
                                            {editablePackages.reduce((sum, pkg) => sum + pkg.items.reduce((itemSum, i) => itemSum + (i.quantity || 0), 0), 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
                            <Button variant="secondary" onClick={() => setShowItemEditor(false)}>Batal</Button>
                            <Button variant="primary" icon={Save} onClick={handleConfirmEditedItems}>Simpan</Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default PengajuanManagement;
