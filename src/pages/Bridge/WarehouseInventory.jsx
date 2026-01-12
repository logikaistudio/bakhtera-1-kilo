import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Warehouse, Search, Download, X, Edit2, Save, XCircle, ArrowRightLeft, Upload, FileText, Trash2, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const WarehouseInventory = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { quotations, updateQuotation, addMutationLog, mutationLogs = [], deleteMutationLog, updateInventoryStock, outboundTransactions = [], updateItemCheckout } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPengajuan, setSelectedPengajuan] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);

    // Mutation modal states
    const [showMutationModal, setShowMutationModal] = useState(false);
    const [mutationData, setMutationData] = useState(null);
    const [mutationDocuments, setMutationDocuments] = useState([]);
    const fileInputRef = useRef(null);

    // Filter only approved INBOUND pengajuan (these are in warehouse inventory)
    const approvedInboundPengajuan = quotations.filter(q =>
        (q.documentStatus === 'approved' || q.document_status === 'approved') &&
        (q.type === 'inbound' || !q.type) // default to inbound if type not specified
    );

    // Filter only approved OUTBOUND pengajuan (these are leaving warehouse)
    const approvedOutboundPengajuan = quotations.filter(q =>
        (q.documentStatus === 'approved' || q.document_status === 'approved') &&
        q.type === 'outbound'
    );

    // Filter inbound based on search
    const filteredInboundPengajuan = approvedInboundPengajuan.filter(q => {
        const searchLower = searchTerm.toLowerCase();
        const pengajuanNo = q.quotationNumber || q.quotation_number || '';
        const bcNo = q.bcDocumentNumber || q.bc_document_number || '';
        const customer = q.customer || '';

        return pengajuanNo.toLowerCase().includes(searchLower) ||
            bcNo.toLowerCase().includes(searchLower) ||
            customer.toLowerCase().includes(searchLower);
    });

    // Filter outbound based on search
    const filteredOutboundPengajuan = approvedOutboundPengajuan.filter(q => {
        const searchLower = searchTerm.toLowerCase();
        const pengajuanNo = q.quotationNumber || q.quotation_number || '';
        const bcNo = q.bcDocumentNumber || q.bc_document_number || '';
        const customer = q.customer || '';

        return pengajuanNo.toLowerCase().includes(searchLower) ||
            bcNo.toLowerCase().includes(searchLower) ||
            customer.toLowerCase().includes(searchLower);
    });

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

    const handleRowClick = (pengajuan) => {
        setSelectedPengajuan(pengajuan);
        setEditData(JSON.parse(JSON.stringify(pengajuan)));
        setIsEditing(false);
        setShowMutationModal(false);
    };

    const handleCloseDetail = () => {
        setSelectedPengajuan(null);
        setEditData(null);
        setIsEditing(false);
        setShowMutationModal(false);
        setMutationData(null);
        setMutationDocuments([]);
    };

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditData(JSON.parse(JSON.stringify(selectedPengajuan)));
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        try {
            await updateQuotation(selectedPengajuan.id, editData);
            setSelectedPengajuan(editData);
            setIsEditing(false);
            console.log('✅ Data inventaris berhasil disimpan');
        } catch (error) {
            console.error('❌ Gagal menyimpan data:', error);
        }
    };

    // Handle item field change
    const handleItemChange = (pkgIndex, itemIndex, field, value) => {
        const newData = { ...editData };
        if (!newData.packages) newData.packages = [];
        if (!newData.packages[pkgIndex]) return;
        if (!newData.packages[pkgIndex].items) newData.packages[pkgIndex].items = [];
        if (!newData.packages[pkgIndex].items[itemIndex]) return;

        if (field === 'location') {
            newData.packages[pkgIndex].items[itemIndex].location = { room: value };
        } else {
            newData.packages[pkgIndex].items[itemIndex][field] = value;
        }
        setEditData(newData);
    };

    // ========== DOCUMENT UPLOAD HANDLERS ==========
    const compressImage = (file, maxSizeKB = 200) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (file.type === 'application/pdf') {
                    // PDF cannot be compressed client-side, just check size
                    if (file.size <= maxSizeKB * 1024) {
                        resolve({ data: e.target.result, size: file.size });
                    } else {
                        alert(`File PDF "${file.name}" melebihi ${maxSizeKB}KB dan tidak dapat dikompresi. Silakan kompres manual.`);
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

                    // Reduce dimensions if needed
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

                    // Iteratively reduce quality until under maxSizeKB
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

        if (mutationDocuments.length + files.length > maxFiles) {
            alert(`Maksimal ${maxFiles} file. Anda sudah memiliki ${mutationDocuments.length} file.`);
            return;
        }

        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                alert(`Format file "${file.name}" tidak didukung. Gunakan JPG, PNG, atau PDF.`);
                continue;
            }

            const result = await compressImage(file, 3000);
            if (result) {
                setMutationDocuments(prev => [...prev, {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    title: '',
                    data: result.data,
                    size: result.size
                }]);
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDocumentTitleChange = (docId, title) => {
        setMutationDocuments(prev => prev.map(doc =>
            doc.id === docId ? { ...doc, title } : doc
        ));
    };

    const handleRemoveDocument = (docId) => {
        setMutationDocuments(prev => prev.filter(doc => doc.id !== docId));
    };

    // ========== MUTATION HANDLERS ==========
    // Helper to calculate already mutated quantity for an item
    const getAlreadyMutatedQty = (itemCode, packageNumber) => {
        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;
        const prevMutations = mutationLogs.filter(m =>
            m.pengajuanNumber === pengajuanNumber &&
            m.itemCode === itemCode &&
            (packageNumber ? m.packageNumber === packageNumber : true)
        );
        return prevMutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);
    };

    const handleStartMutation = (data) => {
        // Fix: If 'data' is an event object (from button click) or undefined, use selectedPengajuan
        const pengajuanToProcess = (data && !data.packages && !data.quotationNumber && !data.quotation_number)
            ? selectedPengajuan
            : (data || selectedPengajuan);

        if (!pengajuanToProcess) {
            console.warn('⚠️ No pengajuan data available for mutation.');
            return;
        }

        console.log('🚀 Starting mutation for:', pengajuanToProcess.quotationNumber || pengajuanToProcess.quotation_number, 'ID:', pengajuanToProcess.id);

        const mutData = {
            ...JSON.parse(JSON.stringify(pengajuanToProcess)),
            mutationDate: new Date().toISOString().split('T')[0],
            mutationTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            mutationPic: '',
            packages: (pengajuanToProcess.packages || []).map(pkg => ({
                ...pkg,
                items: (pkg.items || []).map(item => {
                    const status = getIndividualItemStatus(item.itemCode, pkg.packageNumber);
                    // inWarehouse = max allowed for OUTBOUND (Mutasi)
                    const inWarehouse = (item.quantity || 0) - status.atPameran;

                    return {
                        ...item,
                        inWarehouse: Math.max(0, inWarehouse),
                        atPameran: status.atPameran, // max allowed for RETURN (Remutasi)
                        mutationQty: 0,
                        remutationQty: 0,
                        mutationCondition: 'Baik'
                    };
                })
            }))
        };
        setMutationData(mutData);
        setMutationDocuments([]);
        setShowMutationModal(true);

        // If we opened this via auto-open (passed data), ensure selectedPengajuan is set correctly
        // Use pengajuanToProcess (validated data) instead of raw data
        if (pengajuanToProcess !== selectedPengajuan) setSelectedPengajuan(pengajuanToProcess);
    };

    // Auto-open Mutation Modal based on URL params
    useEffect(() => {
        const pengajuanParam = searchParams.get('pengajuan');
        const actionParam = searchParams.get('action');

        if (pengajuanParam) {
            setSearchTerm(pengajuanParam);
        }

        // Debug log (remove in production)
        console.log('🔄 [AutoOpen] Check:', {
            pengajuanParam,
            actionParam,
            quotationsReady: quotations.length > 0,
            modalOpen: showMutationModal
        });

        if (pengajuanParam && actionParam === 'openMutation' && quotations.length > 0) {
            const paramClean = pengajuanParam.trim();
            const found = quotations.find(q =>
                (q.quotationNumber || q.quotation_number || '').trim() === paramClean
            );

            if (found) {
                // Ensure we haven't already opened it or are currently editing something else
                if (!showMutationModal && !isEditing) {
                    console.log('✅ [AutoOpen] Match found. Opening modal shortly for:', found.quotationNumber);

                    // Add slight delay to ensure UI/State is ready
                    const timer = setTimeout(() => {
                        handleStartMutation(found);
                    }, 300);

                    return () => clearTimeout(timer);
                }
            } else {
                console.warn('⚠️ [AutoOpen] Quotation not found for:', paramClean);
            }
        }
    }, [searchParams, quotations, mutationLogs, showMutationModal]);

    const handleCloseMutation = () => {
        setShowMutationModal(false);
        setMutationData(null);
        setMutationDocuments([]);
    };

    const handleMutationItemChange = (pkgIndex, itemIndex, field, value) => {
        const newData = { ...mutationData };
        if (!newData.packages) newData.packages = [];
        if (!newData.packages[pkgIndex]) return;
        if (!newData.packages[pkgIndex].items) newData.packages[pkgIndex].items = [];
        if (!newData.packages[pkgIndex].items[itemIndex]) return;

        // Validate mutation qty doesn't exceed remaining stock
        if (field === 'mutationQty') {
            const item = newData.packages[pkgIndex].items[itemIndex];
            const maxQty = item.maxMutationQty || item.remainingStock || item.quantity || 0;
            value = Math.min(Math.max(0, parseInt(value) || 0), maxQty);
        }

        newData.packages[pkgIndex].items[itemIndex][field] = value;
        setMutationData(newData);
    };

    const handleSaveMutation = async () => {
        try {
            const mutations = [];
            console.log('📋 Processing mutation data...');
            console.log('📦 mutationData:', mutationData);
            console.log('📦 selectedPengajuan:', selectedPengajuan);
            console.log('📦 Packages to process:', (mutationData?.packages || []).length);

            // Header Data Fallbacks - Robust ID Lookup
            // Use mutationData first (set from actual pengajuan), then fallback to selectedPengajuan
            const qNumber = mutationData?.quotationNumber || mutationData?.quotation_number ||
                selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;
            let qId = mutationData?.id || selectedPengajuan?.id;

            console.log('🔍 Initial lookup - qNumber:', qNumber, 'qId:', qId);

            // If ID is missing, try to find it in the quotations master list
            if (!qId && quotations.length > 0) {
                const found = quotations.find(q =>
                    normalize(q.quotationNumber) === normalize(qNumber)
                );
                if (found) {
                    qId = found.id;
                    console.log('✅ Recovered Quotation ID from master list:', qId);
                }
            }

            // Fallback: Direct DB Lookup (Fail-safe)
            if (!qId) {
                console.log('⚠️ ID not in context, fetching from DB...', qNumber);
                const { data: dbData, error: dbError } = await supabase
                    .from('freight_quotations')
                    .select('id')
                    .eq('quotation_number', qNumber)
                    .single();

                if (dbData) {
                    qId = dbData.id;
                    console.log('✅ Recovered Quotation ID from DB:', qId);
                } else {
                    console.error("❌ DB Lookup failed:", dbError);
                }
            }

            if (!qId) {
                alert("Gagal: ID Pengajuan tidak ditemukan. Silakan refresh halaman dan coba lagi.");
                console.error("❌ Critical Error: Quotation ID missing even after lookup.");
                return;
            }

            // Extract sender/shipper info from pengajuan data
            // Note: shipper field can be a direct string (from PengajuanManagement) or an object
            const senderName = (typeof mutationData?.shipper === 'string' ? mutationData.shipper : null) ||
                mutationData?.shipper?.name || mutationData?.shipper_name ||
                (typeof mutationData?.customer === 'string' ? mutationData.customer : null) ||
                mutationData?.customer?.name || mutationData?.customer_name ||
                mutationData?.companyName || mutationData?.company_name ||
                (typeof selectedPengajuan?.shipper === 'string' ? selectedPengajuan.shipper : null) ||
                selectedPengajuan?.shipper?.name || selectedPengajuan?.shipper_name ||
                (typeof selectedPengajuan?.customer === 'string' ? selectedPengajuan.customer : null) ||
                selectedPengajuan?.customer?.name || selectedPengajuan?.customer_name ||
                selectedPengajuan?.companyName || selectedPengajuan?.company_name || '-';

            console.log('📤 Sender for mutation:', senderName);

            (mutationData.packages || []).forEach((pkg, pkgIdx) => {
                console.log(`📦 Package ${pkgIdx + 1}:`, pkg.packageNumber, '- Items:', (pkg.items || []).length);

                (pkg.items || []).forEach((item, itemIdx) => {
                    const mutationQty = item.mutationQty || 0;
                    const remutationQty = item.remutationQty || 0;
                    const bcNum = selectedPengajuan?.bcDocumentNumber || selectedPengajuan?.bc_document_number ||
                        mutationData?.bcDocumentNumber || mutationData?.bc_document_number;

                    // 1. Process Outbound Mutation (Warehouse -> Pameran)
                    if (mutationQty > 0 && mutationQty <= item.inWarehouse) {
                        mutations.push({
                            pengajuanId: qId,
                            pengajuanNumber: qNumber,
                            pengajuan_number: qNumber, // Robust fallback
                            bcDocumentNumber: bcNum,
                            packageNumber: pkg.packageNumber,
                            itemCode: item.itemCode,
                            itemName: item.name || item.itemName,
                            hsCode: item.hsCode,
                            sender: senderName, // Added for Pabean Barang Mutasi
                            totalStock: item.quantity,
                            mutatedQty: mutationQty,
                            remainingStock: item.inWarehouse - mutationQty, // Logic sisa gudang
                            origin: 'warehouse',
                            destination: 'Pameran',
                            condition: item.mutationCondition,
                            date: mutationData.mutationDate,
                            time: mutationData.mutationTime,
                            pic: mutationData.mutationPic,
                            remarks: item.notes || `Mutasi ke Pameran`,
                            documents: mutationDocuments.map(d => ({ title: d.title, name: d.name, type: d.type })),
                            _pkgIndex: pkgIdx,
                            _itemIndex: itemIdx,
                            _type: 'outbound'
                        });
                    }

                    // 2. Process Return Mutation (Pameran -> Warehouse)
                    if (remutationQty > 0 && remutationQty <= item.atPameran) {
                        mutations.push({
                            pengajuanId: qId,
                            pengajuanNumber: qNumber,
                            pengajuan_number: qNumber, // Robust fallback
                            bcDocumentNumber: bcNum,
                            packageNumber: pkg.packageNumber,
                            itemCode: item.itemCode,
                            itemName: item.name || item.itemName,
                            hsCode: item.hsCode,
                            sender: senderName, // Added for Pabean Barang Mutasi
                            totalStock: item.quantity,
                            mutatedQty: remutationQty,
                            remainingStock: (item.inWarehouse || 0) + remutationQty, // Logic balik gudang
                            origin: 'Pameran',
                            destination: 'warehouse',
                            condition: item.mutationCondition,
                            date: mutationData.mutationDate,
                            time: mutationData.mutationTime,
                            pic: mutationData.mutationPic,
                            remarks: item.notes || `Kembali ke Gudang`,
                            documents: mutationDocuments.map(d => ({ title: d.title, name: d.name, type: d.type })),
                            _pkgIndex: pkgIdx,
                            _itemIndex: itemIdx,
                            _type: 'inbound'
                        });
                    }
                });
            });

            console.log('📊 Total mutations to save:', mutations.length);

            if (addMutationLog && mutations.length > 0) {
                // Save each mutation AND Update Inventory
                for (const mutation of mutations) {
                    console.log('💾 Saving mutation:', mutation.itemName, 'qty:', mutation.mutatedQty);
                    await addMutationLog(mutation);

                    // Update Warehouse Inventory Stock (RESTORED LOGIC)
                    // Outbound (Mutasi) = Decrease Stock
                    // Inbound (Remutasi) = Increase Stock
                    const qtyChange = mutation._type === 'outbound' ? -Math.abs(mutation.mutatedQty) : Math.abs(mutation.mutatedQty);

                    if (updateInventoryStock) {
                        await updateInventoryStock(
                            mutation.itemCode,
                            mutation.itemName,
                            qtyChange,
                            'pcs',
                            mutation._type === 'outbound' ? 'Mutation Out' : 'Mutation In',
                            mutation.pengajuanNumber,
                            0
                        );
                        console.log('📉 Inventory updated:', mutation.itemCode, qtyChange);
                    }
                }

                // Update quotation with mutation tracking labels
                const updatedPackages = JSON.parse(JSON.stringify(selectedPengajuan.packages || []));

                for (const mutation of mutations) {
                    const pkg = updatedPackages[mutation._pkgIndex];
                    if (pkg && pkg.items && pkg.items[mutation._itemIndex]) {
                        const item = pkg.items[mutation._itemIndex];

                        // Count existing mutations for this item
                        const existingMutations = mutationLogs.filter(m =>
                            m.pengajuanNumber === qNumber &&
                            m.itemCode === item.itemCode &&
                            m.packageNumber === pkg.packageNumber
                        ).length;

                        // Set mutation label: mutasi-1, mutasi-2, or re-mutasi for 3+
                        const mutationNum = existingMutations + 1;
                        const mutationLabel = mutationNum >= 3 ? 're-mutasi' : `mutasi-${mutationNum}`;

                        // Update item with mutation tracking
                        item.mutationStatus = mutationLabel;
                        item.lastMutationDate = mutation.date;
                        item.lastMutationQty = mutation.mutatedQty;
                        item.totalMutated = (item.totalMutated || 0) + mutation.mutatedQty;

                        console.log(`📝 Updated ${item.name || item.itemName} → ${mutationLabel}`);
                    }
                }

                // Save updated quotation with mutation tracking
                await updateQuotation(qId, { packages: updatedPackages });
                console.log('✅ Quotation updated with mutation labels');
            }

            console.log('✅ Mutasi berhasil disimpan:', mutations.length, 'records');

            // Auto-navigate to Goods Movement page (RESTORED LOGIC)
            navigate(`/bridge/goods-movement?pengajuan=${encodeURIComponent(qNumber)}`);

            setShowMutationModal(false);
            setMutationData(null);
            setMutationDocuments([]);
            handleCloseDetail();
        } catch (error) {
            console.error('❌ Gagal menyimpan mutasi:', error);
            alert('Gagal menyimpan mutasi: ' + error.message);
        }
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const exportData = filteredInboundPengajuan.map(q => {
            const { packageCount, itemCount } = countPackagesAndItems(q);
            return {
                noPengajuan: q.quotationNumber || q.quotation_number || '-',
                noPabean: q.bcDocumentNumber || q.bc_document_number || '-',
                tanggalMasuk: formatDate(q.submissionDate || q.submission_date || q.date),
                jamMasuk: formatTime(q.approvedDate || q.approved_date),
                jumlahPackage: packageCount,
                jumlahItem: itemCount,
                picPenerima: q.pic || q.receivedBy || '-'
            };
        });

        const columns = [
            { key: 'noPengajuan', header: 'No. Pengajuan' },
            { key: 'noPabean', header: 'No. Pabean' },
            { key: 'tanggalMasuk', header: 'Tgl Masuk Gudang' },
            { key: 'jamMasuk', header: 'Jam Masuk' },
            { key: 'jumlahPackage', header: 'Jml Package' },
            { key: 'jumlahItem', header: 'Jml Item' },
            { key: 'picPenerima', header: 'PIC Penerima' }
        ];

        exportToCSV(exportData, 'Inventaris_Gudang', columns);
    };

    const displayData = isEditing ? editData : selectedPengajuan;

    // Helper to normalize strings for robust comparison
    const normalize = (str) => (str || '').toString().trim().toLowerCase();

    // Helper to find mutation info for an item
    const getItemMutationInfo = (itemCode, packageNumber, itemName) => {
        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;
        const pengajuanId = selectedPengajuan?.id;

        const mutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true) &&
            (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true)
        );

        if (mutations.length === 0) return null;

        // Sum all mutations for this item
        const totalMutated = mutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);
        const latestMutation = mutations.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        return {
            totalMutated,
            date: latestMutation.date,
            time: latestMutation.time,
            destination: latestMutation.destination,
            mutationCount: mutations.length
        };
    };

    // Helper to calculate items by location for a pengajuan (real-time from mutation logs)
    const getItemsByLocation = (pengajuan) => {
        const pengajuanNumber = pengajuan.quotationNumber || pengajuan.quotation_number;
        const pengajuanId = pengajuan.id;
        const packages = pengajuan.packages || [];

        let totalItems = 0;
        let itemsInWarehouse = 0;
        let itemsAtPameran = 0;

        packages.forEach(pkg => {
            (pkg.items || []).forEach(item => {
                const itemQty = item.quantity || 0;
                totalItems += itemQty;
                const itemName = item.name || item.itemName;

                // Find all outbound mutations for this item
                const outboundMutations = mutationLogs.filter(m =>
                    (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
                    normalize(m.itemCode) === normalize(item.itemCode) &&
                    normalize(m.packageNumber) === normalize(pkg.packageNumber) &&
                    (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
                    (m.destination || '').toLowerCase() !== 'warehouse' &&
                    (m.destination || '').toLowerCase() !== 'gudang'
                );

                // Find all inbound/return mutations for this item
                const returnMutations = mutationLogs.filter(m =>
                    (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
                    normalize(m.itemCode) === normalize(item.itemCode) &&
                    normalize(m.packageNumber) === normalize(pkg.packageNumber) &&
                    (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
                    ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
                );

                // Calculate net outbound to pameran
                const totalOutbound = outboundMutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);
                const totalReturned = returnMutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);
                const netAtPameran = Math.max(0, totalOutbound - totalReturned);

                // Calculate remaining in warehouse
                const remainingInWarehouse = Math.max(0, itemQty - netAtPameran);

                itemsInWarehouse += remainingInWarehouse;
                itemsAtPameran += netAtPameran;
            });
        });

        return {
            totalItems,
            itemsInWarehouse,
            itemsAtPameran
        };
    };

    // Helper to calculate item location status (per individual item)
    const getIndividualItemStatus = (itemCode, packageNumber, itemName) => {
        if (!selectedPengajuan) return { atPameran: 0, totalOutbound: 0, totalReturned: 0 };

        const pengajuanNumber = selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number;
        const pengajuanId = selectedPengajuan.id;

        // Find all outbound mutations for this specific item
        const outboundMutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            normalize(m.packageNumber) === normalize(packageNumber) &&
            (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
            (m.destination || '').toLowerCase() !== 'warehouse' &&
            (m.destination || '').toLowerCase() !== 'gudang'
        );

        // Find all return mutations for this specific item
        const returnMutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            normalize(m.packageNumber) === normalize(packageNumber) &&
            (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
            ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
        );

        // Calculate net outbound
        const totalOutbound = outboundMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);
        const totalReturned = returnMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);
        const netAtPameran = Math.max(0, totalOutbound - totalReturned);

        return {
            atPameran: netAtPameran,
            totalOutbound,
            totalReturned
        };
    };

    // Handle delete all mutations for an item
    const handleDeleteMutations = async (itemCode, packageNumber) => {
        if (!deleteMutationLog) {
            alert('Fungsi hapus tidak tersedia');
            return;
        }

        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;

        const confirmDelete = window.confirm(
            `Apakah Anda yakin ingin menghapus semua data mutasi untuk item "${itemCode}"?\n\nTindakan ini tidak dapat dibatalkan.`
        );

        if (!confirmDelete) return;

        try {
            // Find all mutations for this item
            const itemMutations = mutationLogs.filter(m =>
                m.pengajuanNumber === pengajuanNumber &&
                m.itemCode === itemCode &&
                m.packageNumber === packageNumber
            );

            console.log(`🗑️ Deleting ${itemMutations.length} mutation(s) for item ${itemCode}`);

            // Delete each mutation
            for (const mutation of itemMutations) {
                await deleteMutationLog(mutation.id);
            }

            console.log('✅ Mutations deleted successfully');

            // Refresh the detail view
            const updatedPengajuan = quotations.find(q => q.id === selectedPengajuan.id);
            if (updatedPengajuan) {
                setSelectedPengajuan(updatedPengajuan);
                setEditData(JSON.parse(JSON.stringify(updatedPengajuan)));
            }
        } catch (error) {
            console.error('❌ Error deleting mutations:', error);
            alert('Gagal menghapus data mutasi: ' + error.message);
        }
    };

    // Handle delete ALL mutations for entire pengajuan
    const handleDeleteAllMutations = async () => {
        if (!deleteMutationLog) {
            alert('Fungsi hapus tidak tersedia');
            return;
        }

        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;

        // Count total mutations
        const allMutations = mutationLogs.filter(m =>
            m.pengajuanNumber === pengajuanNumber
        );

        if (allMutations.length === 0) {
            alert('Tidak ada data mutasi untuk dihapus');
            return;
        }

        const confirmDelete = window.confirm(
            `Apakah Anda yakin ingin menghapus SEMUA data mutasi untuk pengajuan "${pengajuanNumber}"?\n\nTotal: ${allMutations.length} mutasi\n\nTindakan ini tidak dapat dibatalkan.`
        );

        if (!confirmDelete) return;

        try {
            console.log(`🗑️ Deleting ${allMutations.length} mutation(s) for ${pengajuanNumber}`);

            // Delete each mutation
            for (const mutation of allMutations) {
                await deleteMutationLog(mutation.id);
            }

            console.log('✅ All mutations deleted successfully');

            // Refresh the detail view
            let updatedPengajuan = quotations.find(q => q.id === selectedPengajuan.id);

            // Clean up mutation tracking fields from quotation packages
            if (updatedPengajuan) {
                const cleanPackages = (updatedPengajuan.packages || []).map(pkg => ({
                    ...pkg,
                    items: (pkg.items || []).map(item => {
                        // Create a clean item copy without mutation fields
                        const cleanItem = { ...item };
                        delete cleanItem.mutationStatus;
                        delete cleanItem.lastMutationDate;
                        delete cleanItem.lastMutationQty;
                        delete cleanItem.totalMutated;
                        return cleanItem;
                    })
                }));

                // Update quotation in database to remove red mutation labels
                await updateQuotation(selectedPengajuan.id, { packages: cleanPackages });
                console.log('🧹 Cleared mutation flags from quotation');

                // Get fresh data after update
                updatedPengajuan = { ...updatedPengajuan, packages: cleanPackages };

                setSelectedPengajuan(updatedPengajuan);
                setEditData(JSON.parse(JSON.stringify(updatedPengajuan)));
            }

            alert('Semua data mutasi berhasil dihapus');
        } catch (error) {
            console.error('❌ Error deleting mutations:', error);
            alert('Gagal menghapus data mutasi: ' + error.message);
        }
    };

    // Navigate to Pergerakan Barang with pengajuan filter
    const handleGoToPergerakan = () => {
        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;
        handleCloseDetail();
        navigate(`/bridge/goods-movement?pengajuan=${encodeURIComponent(pengajuanNumber)}`);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Focus Mode Overlay: Hides main content when direct-linking to mutation modal */}
            {showMutationModal && searchParams.get('action') === 'openMutation' && (
                <div className="fixed inset-0 z-40 bg-gray-50 dark:bg-dark-bg animate-fade-in flex items-center justify-center">
                    <div className="text-silver-dark animate-pulse">Memuat Editor Mutasi...</div>
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Inventaris Gudang</h1>
                    <p className="text-silver-dark mt-1">Data Barang Masuk dari Pengajuan yang Disetujui</p>
                </div>
                <Button onClick={handleExportCSV} variant="secondary" icon={Download}>Export CSV</Button>
            </div>

            {/* Search */}
            <div className="glass-card p-4 rounded-lg">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-silver-dark w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan no. pengajuan, no. dokumen pabean, atau customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue">
                            <tr>
                                <th className="px-2 py-1 text-left text-xs font-semibold text-white whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">No. Pabean</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Tgl Masuk Gudang</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Jam Masuk</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Jml Package</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Jml Item</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">PIC Penerima</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredInboundPengajuan.map(pengajuan => {
                                const { packageCount, itemCount } = countPackagesAndItems(pengajuan);
                                return (
                                    <tr key={pengajuan.id} className="hover:bg-dark-surface smooth-transition cursor-pointer" onClick={() => handleRowClick(pengajuan)}>
                                        <td className="px-2 py-0.5 text-xs text-accent-blue font-semibold whitespace-nowrap">{pengajuan.quotationNumber || pengajuan.quotation_number || '-'}</td>
                                        <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '-'}</td>
                                        <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{formatDate(pengajuan.submissionDate || pengajuan.submission_date || pengajuan.date)}</td>
                                        <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{formatTime(pengajuan.approvedDate || pengajuan.approved_date)}</td>
                                        <td className="px-2 py-0.5 text-xs text-accent-blue font-bold text-center">{packageCount}</td>
                                        <td className="px-2 py-0.5 text-xs text-accent-blue font-bold text-center">{itemCount}</td>
                                        <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{pengajuan.pic || pengajuan.receivedBy || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredInboundPengajuan.length === 0 && (
                    <div className="text-center py-12">
                        <Warehouse className="w-16 h-16 text-silver-dark mx-auto mb-4" />
                        <p className="text-silver-dark">Belum ada pengajuan yang disetujui</p>
                    </div>
                )}
            </div>

            {/* ==================== DATA INVENTARIS KELUAR ==================== */}
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">📤 Data Inventaris Keluar</h2>
                        <p className="text-silver-dark mt-1">Data Barang Keluar dari Pengajuan Outbound yang Disetujui</p>
                    </div>
                </div>

                <div className="glass-card rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-purple">
                                <tr>
                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white whitespace-nowrap">No. Pengajuan</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">No. Pabean</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Tgl Keluar Gudang</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Tujuan</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Customer</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Jml Package</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Jml Item</th>
                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">Sumber</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredOutboundPengajuan.map(pengajuan => {
                                    const { packageCount, itemCount } = countPackagesAndItems(pengajuan);
                                    return (
                                        <tr key={pengajuan.id} className="hover:bg-dark-surface smooth-transition cursor-pointer" onClick={() => handleRowClick(pengajuan)}>
                                            <td className="px-2 py-0.5 text-xs text-accent-purple font-semibold whitespace-nowrap">{pengajuan.quotationNumber || pengajuan.quotation_number || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{formatDate(pengajuan.approvedDate || pengajuan.approved_date || pengajuan.date)}</td>
                                            <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{pengajuan.destination || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-silver text-center whitespace-nowrap">{pengajuan.customer || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-accent-purple font-bold text-center">{packageCount}</td>
                                            <td className="px-2 py-0.5 text-xs text-accent-purple font-bold text-center">{itemCount}</td>
                                            <td className="px-2 py-0.5 text-xs text-accent-green text-center whitespace-nowrap">{pengajuan.sourcePengajuanNumber || pengajuan.source_pengajuan_number || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredOutboundPengajuan.length === 0 && (
                        <div className="text-center py-12">
                            <ExternalLink className="w-16 h-16 text-silver-dark mx-auto mb-4" />
                            <p className="text-silver-dark">Belum ada pengajuan keluar yang disetujui</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Inventory Modal */}
            {selectedPengajuan && displayData && !showMutationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-xl">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Detail Inventaris</h2>
                                <p className="text-sm text-gray-500 dark:text-silver-dark">{selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <>
                                        {/* Only show mutation buttons for inbound pengajuan */}
                                        {selectedPengajuan.type !== 'outbound' && (
                                            <>
                                                <Button onClick={handleStartMutation} variant="danger" icon={ArrowRightLeft} className="text-sm">Mutasi</Button>
                                                <Button onClick={handleDeleteAllMutations} variant="secondary" icon={Trash2} className="text-sm text-red-600 hover:text-red-800">Hapus Mutasi</Button>
                                            </>
                                        )}
                                        <Button onClick={handleStartEdit} variant="secondary" icon={Edit2} className="text-sm">Edit</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button onClick={handleCancelEdit} variant="secondary" icon={XCircle} className="text-sm">Batal</Button>
                                        <Button onClick={handleSaveEdit} variant="primary" icon={Save} className="text-sm">Simpan</Button>
                                    </>
                                )}
                                <button onClick={handleCloseDetail} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                            </div>
                        </div>

                        {/* Data Inventaris Section Title */}
                        <div className="px-4 pt-4 pb-2">
                            <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">📦 Data Inventaris</h3>
                        </div>

                        {/* Header Table */}
                        <div className="px-4 pb-4 border-b border-gray-200 dark:border-dark-border">
                            <div className="overflow-x-auto border border-gray-200 dark:border-dark-border rounded-lg">
                                <table className="w-full">
                                    <thead className={selectedPengajuan.type === 'outbound' ? 'bg-accent-purple' : 'bg-accent-blue'}>
                                        <tr>
                                            <th className="px-2 py-1 text-left text-xs font-semibold text-white">No. Pengajuan</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">No. Pabean</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                {selectedPengajuan.type === 'outbound' ? 'Tgl Keluar Gudang' : 'Tgl Masuk Gudang'}
                                            </th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                {selectedPengajuan.type === 'outbound' ? 'Jam Keluar' : 'Jam Masuk'}
                                            </th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Jml Package</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Jml Item</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                {selectedPengajuan.type === 'outbound' ? 'PIC yang Mengeluarkan' : 'PIC Penerima'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-white dark:bg-dark-card">
                                            <td className="px-2 py-0.5 text-xs text-gray-900 dark:text-silver-light font-semibold">{displayData.quotationNumber || displayData.quotation_number || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{displayData.bcDocumentNumber || displayData.bc_document_number || '-'}</td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                {isEditing ? <input type="date" value={editData.submissionDate || editData.submission_date || ''} onChange={(e) => setEditData({ ...editData, submissionDate: e.target.value })} className="px-1 py-0.5 text-xs border rounded" /> : formatDate(displayData.submissionDate || displayData.submission_date)}
                                            </td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                {isEditing ? <input type="time" value={editData.entryTime || ''} onChange={(e) => setEditData({ ...editData, entryTime: e.target.value })} className="px-1 py-0.5 text-xs border rounded" /> : formatTime(displayData.approvedDate || displayData.approved_date)}
                                            </td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center font-bold">{countPackagesAndItems(displayData).packageCount}</td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center font-bold">{countPackagesAndItems(displayData).itemCount}</td>
                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                {isEditing ? <input type="text" value={editData.pic || ''} onChange={(e) => setEditData({ ...editData, pic: e.target.value })} className="w-20 px-1 py-0.5 text-xs border rounded text-center" /> : (displayData.pic || '-')}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Detail Item Section Title */}
                        <div className="px-4 pt-8 pb-3">
                            <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">📝 Detail Item</h3>
                        </div>

                        {/* Detail Items */}
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-280px)] space-y-4">
                            {(displayData.packages || []).map((pkg, pkgIndex) => (
                                <div key={pkgIndex} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 dark:bg-dark-surface px-3 py-2 border-b border-gray-200 dark:border-dark-border">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-silver-light">Kode Packing: {pkg.packageNumber || `PKG-${pkgIndex + 1}`}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className={selectedPengajuan.type === 'outbound' ? 'bg-accent-purple' : 'bg-accent-blue'}>
                                                <tr>
                                                    {selectedPengajuan.type !== 'outbound' && (
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-white w-16">Checkout</th>
                                                    )}
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-8">No. Urut</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-20">Kode Barang</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-16">HS Code</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white">Item</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white w-14">Jumlah</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white w-14">Satuan</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white w-32">Status</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-20">Lokasi</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-16">Kondisi</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-full">Keterangan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                {(pkg.items || []).map((item, itemIdx) => {
                                                    const itemName = item.name || item.itemName;
                                                    const mutationInfo = getItemMutationInfo(item.itemCode, pkg.packageNumber, itemName);
                                                    const itemStatus = getIndividualItemStatus(item.itemCode, pkg.packageNumber, itemName);
                                                    const inWarehouse = (item.quantity || 0) - itemStatus.atPameran;
                                                    const isCheckedOut = item.checkedOut || item.checked_out;
                                                    const checkoutBcNumber = item.checkoutBcNumber || item.checkout_bc_number;

                                                    // Determine row styling - brown for checked out items
                                                    const rowClass = isCheckedOut
                                                        ? 'bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30'
                                                        : mutationInfo
                                                            ? 'bg-orange-50 dark:bg-orange-900/10 hover:bg-gray-50 dark:hover:bg-dark-surface/50'
                                                            : 'hover:bg-gray-50 dark:hover:bg-dark-surface/50';

                                                    return (
                                                        <tr key={itemIdx} className={rowClass}>
                                                            {/* Checkout column - only for inbound */}
                                                            {selectedPengajuan.type !== 'outbound' && (
                                                                <td className="px-2 py-0.5 text-center">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={item.checkedOut || false}
                                                                            onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'checkedOut', e.target.checked)}
                                                                            className="w-4 h-4 rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
                                                                        />
                                                                    ) : isCheckedOut ? (
                                                                        <CheckCircle className="w-4 h-4 text-amber-600 mx-auto" />
                                                                    ) : (
                                                                        <span className="text-gray-300">○</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            <td className={`px-2 py-0.5 text-xs ${isCheckedOut ? 'text-amber-800 dark:text-amber-400' : 'text-gray-700 dark:text-silver'}`}>{itemIdx + 1}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{isEditing ? <input type="text" value={item.itemCode || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'itemCode', e.target.value)} className="w-full px-1 py-0.5 text-xs border rounded" /> : (item.itemCode || '-')}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{isEditing ? <input type="text" value={item.hsCode || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'hsCode', e.target.value)} className="w-full px-1 py-0.5 text-xs border rounded" /> : (item.hsCode || '-')}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{isEditing ? <input type="text" value={item.name || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'name', e.target.value)} className="w-full px-1 py-0.5 text-xs border rounded" /> : (item.name || item.itemName || '-')}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{isEditing ? <input type="number" value={item.quantity || 0} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'quantity', parseInt(e.target.value) || 0)} className="w-14 px-1 py-0.5 text-xs border rounded text-center" /> : (item.quantity || 0)}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{isEditing ? <input type="text" value={item.uom || 'pcs'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'uom', e.target.value)} className="w-12 px-1 py-0.5 text-xs border rounded text-center" /> : (item.uom || 'pcs')}</td>
                                                            <td className="px-2 py-0.5 text-xs text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                        🏢 {inWarehouse}
                                                                    </span>
                                                                    {itemStatus.atPameran > 0 && (
                                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                                            📍 {itemStatus.atPameran}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{isEditing ? <select value={item.location?.room || 'warehouse'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'location', e.target.value)} className="px-1 py-0.5 text-xs border rounded"><option value="warehouse">Warehouse</option><option value="pameran">Pameran</option></select> : (item.location?.room || 'warehouse')}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{isEditing ? <select value={item.condition || 'Baik'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'condition', e.target.value)} className="px-1 py-0.5 text-xs border rounded"><option value="Baik">Baik</option><option value="Rusak">Rusak</option><option value="Cacat">Cacat</option></select> : (item.condition || 'Baik')}</td>
                                                            <td className={`px-2 py-0.5 text-xs ${isCheckedOut ? 'text-amber-800 dark:text-amber-400' : 'text-gray-700 dark:text-silver'}`}>
                                                                {isEditing ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <input type="text" value={item.notes || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'notes', e.target.value)} className="w-full px-1 py-0.5 text-xs border rounded" placeholder="Catatan..." />
                                                                        {item.checkedOut && (
                                                                            <input
                                                                                type="text"
                                                                                value={item.checkoutBcNumber || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'checkoutBcNumber', e.target.value)}
                                                                                className="w-full px-1 py-0.5 text-xs border border-amber-400 rounded bg-amber-50"
                                                                                placeholder="No. Dokumen Pabean Keluar"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ) : isCheckedOut ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                                            <CheckCircle className="w-3 h-3" />
                                                                            SUDAH KELUAR
                                                                        </span>
                                                                        {checkoutBcNumber && (
                                                                            <span className="text-[10px] text-amber-700 dark:text-amber-400">
                                                                                BC: {checkoutBcNumber}
                                                                            </span>
                                                                        )}
                                                                        {item.notes && <span className="text-[10px]">{item.notes}</span>}
                                                                    </div>
                                                                ) : mutationInfo ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                                                <AlertCircle className="w-3 h-3" />
                                                                                MUTASI
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] text-orange-600 dark:text-orange-400">
                                                                            {mutationInfo.totalMutated} unit ke {mutationInfo.destination} ({formatDate(mutationInfo.date)})
                                                                        </span>
                                                                        <button
                                                                            onClick={handleGoToPergerakan}
                                                                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                                                                        >
                                                                            <ExternalLink className="w-3 h-3" />
                                                                            Lihat di Pergerakan Barang
                                                                        </button>
                                                                    </div>
                                                                ) : (item.notes || '-')}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========== MUTATION MODAL ========== */}
            {showMutationModal && mutationData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden shadow-xl">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border bg-red-50 dark:bg-red-900/20">
                            <div>
                                <h2 className="text-xl font-bold text-red-700 dark:text-red-400">Mutasi Barang</h2>
                                <p className="text-sm text-red-600 dark:text-red-500">{selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={handleCloseMutation} variant="secondary" icon={XCircle} className="text-sm">Batal</Button>
                                <Button onClick={handleSaveMutation} variant="danger" icon={Save} className="text-sm">Simpan Mutasi</Button>
                                <button onClick={handleCloseMutation} className="p-2 hover:bg-red-100 rounded-lg"><X className="w-5 h-5 text-red-500" /></button>
                            </div>
                        </div>

                        {/* Mutation Header Table */}
                        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                            <div className="overflow-x-auto border border-gray-200 dark:border-dark-border rounded-lg">
                                <table className="w-full">
                                    <thead className="bg-red-600">
                                        <tr>
                                            <th className="px-2 py-1 text-left text-xs font-semibold text-white">No. Pengajuan</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">No. Pabean</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Tgl Masuk</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Jam Masuk</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Jml Pkg</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">Jml Item</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white">PIC</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700">Tgl Mutasi</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700">Jam Mutasi</th>
                                            <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700">PIC Mutasi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-white dark:bg-dark-card">
                                            <td className="px-2 py-1 text-xs font-semibold">{mutationData.quotationNumber || mutationData.quotation_number || '-'}</td>
                                            <td className="px-2 py-1 text-xs text-center">{mutationData.bcDocumentNumber || mutationData.bc_document_number || '-'}</td>
                                            <td className="px-2 py-1 text-xs text-center">{formatDate(mutationData.submissionDate || mutationData.submission_date)}</td>
                                            <td className="px-2 py-1 text-xs text-center">{formatTime(mutationData.approvedDate || mutationData.approved_date)}</td>
                                            <td className="px-2 py-1 text-xs text-center font-bold">{countPackagesAndItems(mutationData).packageCount}</td>
                                            <td className="px-2 py-1 text-xs text-center font-bold">{countPackagesAndItems(mutationData).itemCount}</td>
                                            <td className="px-2 py-1 text-xs text-center">{mutationData.pic || '-'}</td>
                                            <td className="px-2 py-1 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                <input type="date" value={mutationData.mutationDate || ''} onChange={(e) => setMutationData({ ...mutationData, mutationDate: e.target.value })} className="px-1 py-0.5 text-xs border border-red-300 rounded" />
                                            </td>
                                            <td className="px-2 py-1 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                <input type="time" value={mutationData.mutationTime || ''} onChange={(e) => setMutationData({ ...mutationData, mutationTime: e.target.value })} className="px-1 py-0.5 text-xs border border-red-300 rounded" />
                                            </td>
                                            <td className="px-2 py-1 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                <input type="text" value={mutationData.mutationPic || ''} onChange={(e) => setMutationData({ ...mutationData, mutationPic: e.target.value })} placeholder="PIC" className="w-20 px-1 py-0.5 text-xs border border-red-300 rounded text-center" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mutation Body */}
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-400px)] space-y-4">
                            {(mutationData.packages || []).map((pkg, pkgIndex) => (
                                <div key={pkgIndex} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 dark:bg-dark-surface px-3 py-2 border-b border-gray-200 dark:border-dark-border">
                                        <span className="text-sm font-semibold">Kode Packing: {pkg.packageNumber || `PKG-${pkgIndex + 1}`}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-accent-blue">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-8">No. Urut</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-20">Kode Barang</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-16">HS Code</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white">Item</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white w-14">Jumlah</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white w-14">Satuan</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-20">Lokasi</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-16">Kondisi</th>
                                                    {/* Mutation columns */}
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-24">Jml Mutasi</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-24">Jml Remutasi</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-20">Total Saat Ini</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-20">Kondisi</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-white w-full">Keterangan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                {(pkg.items || []).map((item, itemIdx) => {
                                                    // Logic baru menggunakan inWarehouse & atPameran
                                                    const isFullyMutated = item.inWarehouse === 0 && item.atPameran === 0;

                                                    return (
                                                        <tr key={itemIdx} className={`hover:bg-gray-50 dark:hover:bg-dark-surface/50 ${isFullyMutated ? 'opacity-75 bg-gray-50' : ''}`}>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{itemIdx + 1}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.itemCode || '-'}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.hsCode || '-'}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.name || item.itemName || '-'}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{item.quantity || 0}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{item.uom || 'pcs'}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.location?.room || 'warehouse'}</td>
                                                            <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.condition || 'Baik'}</td>

                                                            {/* Mutation input (Gudang -> Pameran) */}
                                                            <td className="px-2 py-0.5 text-xs text-center bg-red-50 dark:bg-red-900/10 border-r border-red-100 dark:border-red-900/20">
                                                                <div className="flex flex-col items-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={item.inWarehouse}
                                                                        value={item.mutationQty || ''}
                                                                        onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationQty', parseInt(e.target.value) || 0)}
                                                                        className="w-16 px-1 py-0.5 text-xs text-center border border-red-300 rounded focus:ring-1 focus:ring-red-500"
                                                                        placeholder="0"
                                                                        disabled={item.inWarehouse === 0}
                                                                    />
                                                                    <span className="text-[9px] text-gray-400 mt-0.5">Max: {item.inWarehouse}</span>
                                                                </div>
                                                            </td>

                                                            {/* Remutation input (Pameran -> Gudang) */}
                                                            <td className="px-2 py-0.5 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                                <div className="flex flex-col items-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={item.atPameran}
                                                                        value={item.remutationQty || ''}
                                                                        onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'remutationQty', parseInt(e.target.value) || 0)}
                                                                        className="w-16 px-1 py-0.5 text-xs text-center border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                                                                        placeholder="0"
                                                                        disabled={item.atPameran === 0}
                                                                    />
                                                                    <span className="text-[9px] text-gray-400 mt-0.5">Max: {item.atPameran}</span>
                                                                </div>
                                                            </td>

                                                            {/* Total Saat Ini (Projected Warehouse Stock) */}
                                                            <td className="px-2 py-0.5 text-xs text-center bg-red-50 dark:bg-red-900/10 font-bold text-gray-800 dark:text-gray-200">
                                                                {(item.inWarehouse || 0) - (item.mutationQty || 0) + (item.remutationQty || 0)}
                                                            </td>

                                                            {/* Condition */}
                                                            <td className="px-2 py-0.5 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                                <select
                                                                    value={item.mutationCondition || 'Baik'}
                                                                    onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationCondition', e.target.value)}
                                                                    className="w-full px-1 py-0.5 text-xs border border-red-300 rounded bg-white text-center"
                                                                >
                                                                    <option value="Baik">Baik</option>
                                                                    <option value="Rusak">Rusak</option>
                                                                    <option value="Cacat">Cacat</option>
                                                                </select>
                                                            </td>

                                                            {/* Notes */}
                                                            <td className="px-2 py-0.5 text-xs bg-red-50 dark:bg-red-900/10">
                                                                <input
                                                                    type="text"
                                                                    value={item.notes || ''}
                                                                    onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'notes', e.target.value)}
                                                                    className="w-full px-1 py-0.5 text-xs border border-red-300 rounded"
                                                                    placeholder="Keterangan..."
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}

                            {/* Document Upload Section */}
                            <div className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden mt-4">
                                <div className="bg-gray-100 dark:bg-dark-surface px-3 py-2 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-silver-light">Dokumen Pendukung ({mutationDocuments.length}/8)</span>
                                    <div>
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" multiple className="hidden" />
                                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" icon={Upload} className="text-xs" disabled={mutationDocuments.length >= 8}>
                                            Upload Dokumen
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-3">
                                    {mutationDocuments.length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-4">Belum ada dokumen pendukung. Klik Upload untuk menambahkan (JPG, PNG, PDF - Max 3MB).</p>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-dark-surface">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600 w-8">No</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600">Judul Dokumen</th>
                                                    <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600">Nama File</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600">Tipe</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600">Ukuran</th>
                                                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600 w-12">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                {mutationDocuments.map((doc, idx) => (
                                                    <tr key={doc.id}>
                                                        <td className="px-2 py-1 text-xs text-gray-700">{idx + 1}</td>
                                                        <td className="px-2 py-1 text-xs">
                                                            <input type="text" value={doc.title} onChange={(e) => handleDocumentTitleChange(doc.id, e.target.value)} placeholder="Masukkan judul..." className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                                        </td>
                                                        <td className="px-2 py-1 text-xs text-gray-700 flex items-center gap-1">
                                                            <FileText className="w-3 h-3" /> {doc.name}
                                                        </td>
                                                        <td className="px-2 py-1 text-xs text-gray-500 text-center uppercase">{doc.type.split('/')[1]}</td>
                                                        <td className="px-2 py-1 text-xs text-gray-500 text-center">{(doc.size / 1024).toFixed(1)} KB</td>
                                                        <td className="px-2 py-1 text-center">
                                                            <button onClick={() => handleRemoveDocument(doc.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehouseInventory;
