import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Warehouse, Search, Download, X, Edit2, Save, XCircle, ArrowRightLeft, Upload, FileText, Trash2, ExternalLink, AlertCircle, CheckCircle, Box, MapPin, LogOut } from 'lucide-react';
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
            // Sanitize: Remove temporary mutation fields before saving
            const cleanedData = {
                ...editData,
                packages: (editData.packages || []).map(pkg => ({
                    ...pkg,
                    items: (pkg.items || []).map(item => {
                        const { mutationInQty, mutationOutQty, mutationDate, ...cleanItem } = item;
                        return cleanItem;
                    })
                }))
            };

            // 1. Save quotation data (without mutation fields)
            await updateQuotation(selectedPengajuan.id, cleanedData);
            console.log('✅ Data inventaris berhasil disimpan');

            // 2. Process mutations if any
            const mutations = [];
            const qNumber = editData.quotationNumber || editData.quotation_number;
            const qId = selectedPengajuan.id;
            const bcNum = editData.bcDocumentNumber || editData.bc_document_number;
            const senderName = (typeof editData?.shipper === 'string' ? editData.shipper : null) ||
                editData?.shipper?.name || editData?.shipper_name ||
                (typeof editData?.customer === 'string' ? editData.customer : null) ||
                editData?.customer?.name || editData?.customer_name ||
                editData?.companyName || editData?.company_name || '-';

            (editData.packages || []).forEach((pkg, pkgIdx) => {
                (pkg.items || []).forEach((item, itemIdx) => {
                    const outQty = item.mutationOutQty || 0;
                    const inQty = item.mutationInQty || 0;

                    // Get item status for validation
                    const itemName = item.name || item.itemName;
                    const itemStatus = getIndividualItemStatus(item.itemCode, pkg.packageNumber, itemName);
                    // Use totalDeducted to account for official outbound as well
                    const inWarehouse = (item.quantity || 0) - (itemStatus.totalDeducted || itemStatus.atPameran);

                    // Process outbound mutation (Gudang -> Pameran)
                    if (outQty > 0 && outQty <= inWarehouse) {
                        // Strict data flow: Manual Out = Pameran
                        const destinationLocation = 'Pameran';
                        mutations.push({
                            pengajuanId: qId,
                            pengajuanNumber: qNumber,
                            bcDocumentNumber: bcNum,
                            packageNumber: pkg.packageNumber,
                            itemCode: item.itemCode,
                            itemName: itemName,
                            hsCode: item.hsCode,
                            sender: senderName,
                            totalStock: item.quantity,
                            mutatedQty: outQty,
                            remainingStock: inWarehouse - outQty,
                            origin: 'warehouse',
                            destination: destinationLocation,
                            condition: item.condition || 'Baik',
                            // Use per-item Out details, fallback to global or current
                            date: item.mutationDateOut || editData.mutationDate || new Date().toISOString().split('T')[0],
                            time: item.mutationTimeOut || editData.mutationTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            pic: item.mutationPicOut || editData.mutationPic || '',
                            remarks: item.notes || `Mutasi ke ${destinationLocation}`,
                            _type: 'outbound'
                        });
                    }

                    // Process inbound mutation (Pameran -> Gudang)
                    if (inQty > 0 && inQty <= itemStatus.atPameran) {
                        mutations.push({
                            pengajuanId: qId,
                            pengajuanNumber: qNumber,
                            bcDocumentNumber: bcNum,
                            packageNumber: pkg.packageNumber,
                            itemCode: item.itemCode,
                            itemName: itemName,
                            hsCode: item.hsCode,
                            sender: senderName,
                            totalStock: item.quantity,
                            mutatedQty: inQty,
                            remainingStock: inWarehouse + inQty,
                            origin: 'Pameran',
                            destination: 'warehouse',
                            condition: item.condition || 'Baik',
                            // Use per-item In details
                            date: item.mutationDateIn || editData.mutationDate || new Date().toISOString().split('T')[0],
                            time: item.mutationTimeIn || editData.mutationTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            pic: item.mutationPicIn || editData.mutationPic || '',
                            remarks: item.notes || 'Pengembalian ke Gudang',
                            _type: 'inbound'
                        });
                    }

                    // Reset mutation fields after processing
                    item.mutationOutQty = 0;
                    item.mutationInQty = 0;
                });
            });

            // Save mutations
            if (addMutationLog && mutations.length > 0) {
                console.log('📊 Processing', mutations.length, 'mutation(s)...');
                for (const mutation of mutations) {
                    console.log('💾 Saving mutation:', mutation.itemName, mutation._type, 'qty:', mutation.mutatedQty);
                    await addMutationLog(mutation);

                    // Update inventory stock
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
                alert(`Data berhasil disimpan! ${mutations.length} mutasi diproses.`);
            } else {
                alert('Data berhasil disimpan!');
            }

            setSelectedPengajuan(editData);
            setIsEditing(false);
        } catch (error) {
            console.error('❌ Gagal menyimpan data:', error);
            alert('Gagal menyimpan data: ' + error.message);
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
            mutationLocation: 'Pameran', // Default location
            packages: (pengajuanToProcess.packages || []).map(pkg => ({
                ...pkg,
                items: (pkg.items || []).map(item => {
                    const status = getIndividualItemStatus(item.itemCode, pkg.packageNumber);
                    // inWarehouse = max allowed for OUTBOUND (Mutasi) - includes official outbound deduction
                    const inWarehouse = (item.quantity || 0) - (status.totalDeducted || status.atPameran);

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

        if (pengajuanParam && quotations.length > 0) {
            const paramClean = pengajuanParam.trim();
            const found = quotations.find(q =>
                (q.quotationNumber || q.quotation_number || '').trim() === paramClean
            );

            if (found) {
                if (actionParam === 'openMutation') {
                    // Ensure we haven't already opened it or are currently editing something else
                    if (!showMutationModal && !isEditing) {
                        console.log('✅ [AutoOpen] Match found. Opening mutation modal shortly for:', found.quotationNumber);

                        // Add slight delay to ensure UI/State is ready
                        const timer = setTimeout(() => {
                            handleStartMutation(found);
                        }, 300);

                        return () => clearTimeout(timer);
                    }
                } else if (actionParam === 'viewDetail') {
                    // Ensure we haven't already opened it
                    if (!selectedPengajuan) {
                        console.log('✅ [AutoOpen] Match found. Opening detail modal shortly for:', found.quotationNumber);
                        const timer = setTimeout(() => {
                            handleRowClick(found);
                        }, 300);
                        return () => clearTimeout(timer);
                    }
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

                    // 1. Process Outbound Mutation (Warehouse -> Selected Location)
                    if (mutationQty > 0 && mutationQty <= item.inWarehouse) {
                        const destinationLocation = mutationData.mutationLocation || 'Pameran';
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
                            destination: destinationLocation,
                            condition: item.mutationCondition,
                            date: mutationData.mutationDate,
                            time: mutationData.mutationTime,
                            pic: mutationData.mutationPic,
                            remarks: item.notes || `Mutasi ke ${destinationLocation}`,
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

    // Helper to calculate items by location for a pengajuan (real-time from mutation logs AND outbound transactions)
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

                // 1. Find outbound MUTATIONS (e.g. Pameran)
                const mutationsOut = mutationLogs.filter(m =>
                    (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
                    normalize(m.itemCode) === normalize(item.itemCode) &&
                    normalize(m.packageNumber) === normalize(pkg.packageNumber) &&
                    (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
                    (m.destination || '').toLowerCase() !== 'warehouse' &&
                    (m.destination || '').toLowerCase() !== 'gudang'
                );

                // 2. Find official OUTBOUND TRANSACTIONS (freight_outbound)
                // Filter strictly by source reference or loosely by code if no source ref
                const officialOutbound = outboundTransactions.filter(o => {
                    const matchSource = (o.documents?.source_pengajuan_number === pengajuanNumber) ||
                        (o.pengajuan_id === pengajuanId); // Ideal match

                    const matchItem = normalize(o.item_code) === normalize(item.itemCode) &&
                        (pkg.packageNumber ? normalize(o.documents?.packageNumber) === normalize(pkg.packageNumber) : true);

                    // If source ref exists, use it. Else fallback to item match (risky but needed)
                    if (o.documents?.source_pengajuan_number) return matchSource && matchItem;
                    return matchItem;
                });

                // 3. Find RETURN mutations (Pameran -> Warehouse)
                const returnMutations = mutationLogs.filter(m =>
                    (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
                    normalize(m.itemCode) === normalize(item.itemCode) &&
                    normalize(m.packageNumber) === normalize(pkg.packageNumber) &&
                    (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
                    ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
                );

                // Calculate totals
                const totalMutationOut = mutationsOut.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);
                const totalOfficialOut = officialOutbound.reduce((sum, o) => sum + (o.quantity || 0), 0);
                const totalReturned = returnMutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);

                // Net Pameran = Mutasi Keluar - Mutasi Balik
                const netAtPameran = Math.max(0, totalMutationOut - totalReturned);

                // Remaining in Warehouse = Initial - (Net Pameran + Official Outbound)
                const remainingInWarehouse = Math.max(0, itemQty - netAtPameran - totalOfficialOut);

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
        if (!selectedPengajuan) return { atPameran: 0, totalOutbound: 0, totalReturned: 0, officialOutbound: 0 };

        const pengajuanNumber = selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number;
        const pengajuanId = selectedPengajuan.id;

        // 1. MUTATIONS (Pameran etc)
        const outboundMutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true) &&
            (m.destination || '').toLowerCase() !== 'warehouse' &&
            (m.destination || '').toLowerCase() !== 'gudang'
        );

        // 2. OFFICIAL OUTBOUND (freight_outbound)
        const officialOutbound = outboundTransactions.filter(o => {
            const hasSourceRef = !!o.documents?.source_pengajuan_number;
            const sourceRef = o.documents?.source_pengajuan_number || '';
            const docPackage = o.documents?.packageNumber;

            // Debug matching
            const isItemMatch = normalize(o.item_code) === normalize(itemCode);

            // Relaxed Source Match: 
            const matchSource = (normalize(sourceRef) === normalize(pengajuanNumber)) ||
                (normalize(sourceRef).includes(normalize(pengajuanNumber)) && pengajuanNumber.length > 5) || // Ensure not matching empty/short strings
                (normalize(pengajuanNumber).includes(normalize(sourceRef)) && sourceRef.length > 5) ||
                (o.pengajuan_id === pengajuanId);

            // Relaxed Item Match
            // If Source Matches -> We trust it significantly. Ignore package number mismatch if highly likely.
            if (matchSource && isItemMatch) return true;

            // Manual/Legacy Match (No Source Ref)
            // Match Item Code AND (Package Match OR Outbound has no package info)
            const matchPackage = packageNumber
                ? (docPackage ? normalize(docPackage) === normalize(packageNumber) : true) // If doc has no pkg, assume valid
                : true;

            if (isItemMatch && !matchSource && !hasSourceRef) {
                return matchPackage;
            }

            return false;
        });

        // 3. RETURN MUTATIONS
        const returnMutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true) &&
            ((m.destination || '').toLowerCase() === 'warehouse' || (m.destination || '').toLowerCase() === 'gudang')
        );

        // Calc totals
        const totalMutationOut = outboundMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);
        const totalOfficialOut = officialOutbound.reduce((sum, o) => sum + (parseInt(o.quantity) || 0), 0);
        const totalReturned = returnMutations.reduce((sum, m) => sum + (parseInt(m.mutatedQty) || 0), 0);

        const netAtPameran = Math.max(0, totalMutationOut - totalReturned);

        // Debug Log
        if (totalOfficialOut > 0) {
            console.log(`✅ [${itemCode}] STOCK ADJUSTED: -${totalOfficialOut} from Outbound`);
        }

        return {
            atPameran: netAtPameran,
            totalOutbound: totalMutationOut,
            totalOfficialOut: totalOfficialOut,
            totalReturned,
            // Convenience total for deduction
            totalDeducted: netAtPameran + totalOfficialOut
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


            {/* Detail Inventory Modal */}
            {
                selectedPengajuan && displayData && !showMutationModal && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
                            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
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
                                                    <Button onClick={handleDeleteAllMutations} variant="secondary" icon={Trash2} className="text-sm text-red-600 hover:text-red-800">Hapus Mutasi</Button>
                                                </>
                                            )}
                                            <Button onClick={handleStartEdit} variant="secondary" icon={Edit2} className="text-sm">Kelola</Button>
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
                            <div className="flex-shrink-0 px-4 pt-4 pb-2">
                                <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">📦 Data Inventaris</h3>
                            </div>

                            {/* Header Table */}
                            <div className="flex-shrink-0 px-4 pb-4 border-b border-gray-200 dark:border-dark-border">
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

                            {/* Mutation Info Section REMOVED - Using per-row columns */}

                            {/* Detail Item Section Title */}
                            <div className="flex-shrink-0 px-4 pt-4 pb-3">
                                <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">📝 Detail Item</h3>
                            </div>

                            {/* Detail Items */}
                            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4">
                                {(displayData.packages || []).map((pkg, pkgIndex) => (
                                    <div key={pkgIndex} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 dark:bg-dark-surface px-3 py-2 border-b border-gray-200 dark:border-dark-border">
                                            <span className="text-sm font-semibold text-gray-700 dark:text-silver-light">Kode Packing: {pkg.packageNumber || `PKG-${pkgIndex + 1}`}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className={selectedPengajuan.type === 'outbound' ? 'bg-accent-purple' : 'bg-accent-blue'}>
                                                    <tr>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-8" style={{ fontWeight: 'bold' }}>No.</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-20" style={{ fontWeight: 'bold' }}>Kode Brg</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-16" style={{ fontWeight: 'bold' }}>HS</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white" style={{ fontWeight: 'bold' }}>Item</th>
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-12" style={{ fontWeight: 'bold' }}>Awal</th>
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-12" style={{ fontWeight: 'bold' }}>Sat</th>
                                                        {isEditing && selectedPengajuan.type !== 'outbound' && (
                                                            <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-green-700 w-16" style={{ fontWeight: 'bold' }}>Stok</th>
                                                        )}
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-28" style={{ fontWeight: 'bold' }}>Status</th>
                                                        { /* Lokasi removed from here */}
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-14" style={{ fontWeight: 'bold' }}>Kondisi</th>
                                                        {/* Mutation columns - only in edit mode for inbound */}
                                                        {isEditing && selectedPengajuan.type !== 'outbound' && (
                                                            <>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-700 w-16" style={{ fontWeight: 'bold' }}>Keluar</th>
                                                                {/* New Outbound Details */}
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-24">Tgl Keluar</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-16">Jam</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-20">PIC</th>

                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-700 w-16" style={{ fontWeight: 'bold' }}>Kembali</th>
                                                                {/* New Inbound Details */}
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-24">Tgl Kembali</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-16">Jam</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-20">PIC</th>
                                                            </>
                                                        )}
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-full" style={{ fontWeight: 'bold' }}>Keterangan</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                    {(pkg.items || []).map((item, itemIdx) => {
                                                        const itemName = item.name || item.itemName;
                                                        const mutationInfo = getItemMutationInfo(item.itemCode, pkg.packageNumber, itemName);
                                                        const itemStatus = getIndividualItemStatus(item.itemCode, pkg.packageNumber, itemName);
                                                        // Use totalDeducted to account for official outbound
                                                        const inWarehouse = (item.quantity || 0) - (itemStatus.totalDeducted || itemStatus.atPameran);
                                                        const isCheckedOut = item.checkedOut || item.checked_out;
                                                        const checkoutBcNumber = item.checkoutBcNumber || item.checkout_bc_number;

                                                        // Logic values for mutations
                                                        const maxKeluar = inWarehouse || 0;
                                                        const maxKembali = itemStatus.atPameran || 0;
                                                        // Sanitize: Cap mutation values by max allowed to prevent ghost values
                                                        const keluarQty = Math.min(item.mutationOutQty || 0, maxKeluar);
                                                        const kembaliQty = Math.min(item.mutationInQty || 0, maxKembali);
                                                        const projectedSisa = inWarehouse - keluarQty + kembaliQty;

                                                        // Determine row styling - brown for checked out items
                                                        const rowClass = isCheckedOut
                                                            ? 'bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30'
                                                            : mutationInfo
                                                                ? 'bg-orange-50 dark:bg-orange-900/10 hover:bg-gray-50 dark:hover:bg-dark-surface/50'
                                                                : 'hover:bg-gray-50 dark:hover:bg-dark-surface/50';

                                                        return (
                                                            <tr key={itemIdx} className={rowClass}>
                                                                <td className={`px-1 py-0 text-xs ${isCheckedOut ? 'text-amber-800 dark:text-amber-400' : 'text-gray-700 dark:text-silver'}`}>{itemIdx + 1}</td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">{(item.itemCode || '-')}</td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">{(item.hsCode || '-')}</td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver max-w-[250px] break-words">{(item.name || item.itemName || '-')}</td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver text-center">
                                                                    <span className="font-semibold">{item.quantity || 0}</span>
                                                                </td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver text-center">{(item.uom || 'pcs')}</td>
                                                                {isEditing && selectedPengajuan.type !== 'outbound' && (
                                                                    <td className="px-1 py-0 text-xs text-center bg-green-50 font-bold text-green-700">
                                                                        {projectedSisa}
                                                                    </td>
                                                                )}
                                                                <td className="px-1 py-1 text-xs text-left align-top">
                                                                    <div className="flex flex-col gap-1 items-start">
                                                                        {/* Warehouse */}
                                                                        <div className="flex items-center justify-between w-full min-w-[70px] bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-800/50">
                                                                            <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">Gudang</span>
                                                                            <span className="text-[10px] font-bold text-green-800 dark:text-green-300">{inWarehouse}</span>
                                                                        </div>

                                                                        {/* Pameran */}
                                                                        {itemStatus.atPameran > 0 && (
                                                                            <div className="flex items-center justify-between w-full min-w-[70px] bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800/50">
                                                                                <span className="text-[10px] text-orange-700 dark:text-orange-400 font-medium">Pameran</span>
                                                                                <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300">{itemStatus.atPameran}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* Keluar */}
                                                                        {itemStatus.totalOfficialOut > 0 && (
                                                                            <div className="flex items-center justify-between w-full min-w-[70px] bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800/50">
                                                                                <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">Keluar</span>
                                                                                <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300">{itemStatus.totalOfficialOut}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {/* <td ... Lokasi removed from here ... ></td> */}
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">{isEditing ? <select value={item.condition || 'Baik'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'condition', e.target.value)} className="px-1 py-0 text-xs border rounded"><option value="Baik">Baik</option><option value="Rusak">Rusak</option><option value="Cacat">Cacat</option></select> : (item.condition || 'Baik')}</td>
                                                                {/* Mutation columns - only in edit mode for inbound */}
                                                                {isEditing && selectedPengajuan.type !== 'outbound' && (
                                                                    <>
                                                                        {/* Keluar Cols */}
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <select
                                                                                value={keluarQty}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationOutQty', parseInt(e.target.value) || 0)}
                                                                                className={`w-12 px-1 py-0 text-xs border rounded text-center ${maxKeluar > 0 ? 'border-red-300 bg-white' : 'border-gray-300 bg-gray-200'}`}
                                                                                disabled={maxKeluar === 0}
                                                                            >
                                                                                {[...Array(maxKeluar + 1).keys()].map(n => (
                                                                                    <option key={n} value={n}>{n}</option>
                                                                                ))}
                                                                            </select>
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="date" className="w-[85px] px-0.5 py-0 text-[10px] border border-red-200 rounded"
                                                                                value={item.mutationDateOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationDateOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="time" className="w-[60px] px-0.5 py-0 text-[10px] border border-red-200 rounded"
                                                                                value={item.mutationTimeOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationTimeOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="text" className="w-[70px] px-0.5 py-0 text-[10px] border border-red-200 rounded" placeholder="PIC"
                                                                                value={item.mutationPicOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationPicOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>

                                                                        {/* Kembali Cols */}
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <select
                                                                                value={kembaliQty}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationInQty', parseInt(e.target.value) || 0)}
                                                                                className={`w-12 px-1 py-0 text-xs border rounded text-center ${maxKembali > 0 ? 'border-blue-300 bg-white' : 'border-gray-300 bg-gray-200'}`}
                                                                                disabled={maxKembali === 0}
                                                                            >
                                                                                {[...Array(maxKembali + 1).keys()].map(n => (
                                                                                    <option key={n} value={n}>{n}</option>
                                                                                ))}
                                                                            </select>
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="date" className="w-[85px] px-0.5 py-0 text-[10px] border border-blue-200 rounded"
                                                                                value={item.mutationDateIn || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationDateIn', e.target.value)}
                                                                                disabled={kembaliQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="time" className="w-[60px] px-0.5 py-0 text-[10px] border border-blue-200 rounded"
                                                                                value={item.mutationTimeIn || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationTimeIn', e.target.value)}
                                                                                disabled={kembaliQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="text" className="w-[70px] px-0.5 py-0 text-[10px] border border-blue-200 rounded" placeholder="PIC"
                                                                                value={item.mutationPicIn || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationPicIn', e.target.value)}
                                                                                disabled={kembaliQty === 0}
                                                                            />
                                                                        </td>

                                                                    </>
                                                                )}
                                                                <td className={`px-1 py-0 text-xs ${isCheckedOut ? 'text-amber-800 dark:text-amber-400' : 'text-gray-700 dark:text-silver'}`}>
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <input type="text" value={item.notes || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'notes', e.target.value)} className="w-24 px-1 py-0 text-xs border rounded" placeholder="Catatan..." />
                                                                            {item.checkedOut && (
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.checkoutBcNumber || ''}
                                                                                    onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'checkoutBcNumber', e.target.value)}
                                                                                    className="w-20 px-1 py-0 text-xs border border-amber-400 rounded bg-amber-50"
                                                                                    placeholder="No. BC"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    ) : isCheckedOut ? (
                                                                        <div className="flex items-center gap-1 flex-wrap">
                                                                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-medium bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                                                                                <CheckCircle className="w-2.5 h-2.5" />
                                                                                KELUAR
                                                                            </span>
                                                                            {checkoutBcNumber && (
                                                                                <span className="text-[9px] text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                                                                    BC: {checkoutBcNumber}
                                                                                </span>
                                                                            )}
                                                                            {item.notes && <span className="text-[9px]">{item.notes}</span>}
                                                                        </div>
                                                                    ) : mutationInfo ? (
                                                                        <div className="flex items-center gap-1 flex-wrap">
                                                                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap">
                                                                                <AlertCircle className="w-2.5 h-2.5" />
                                                                                MUTASI
                                                                            </span>
                                                                            <span className="text-[9px] text-orange-600 dark:text-orange-400 whitespace-nowrap">
                                                                                {mutationInfo.totalMutated}u → {mutationInfo.destination}
                                                                            </span>
                                                                            <button
                                                                                onClick={handleGoToPergerakan}
                                                                                className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                                                                            >
                                                                                <ExternalLink className="w-2.5 h-2.5" />
                                                                                Detail
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
                    </div >
                )
            }

            {/* ========== MUTATION MODAL ========== */}
            {
                showMutationModal && mutationData && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
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
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700">Lokasi Mutasi</th>
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
                                                <td className="px-2 py-1 text-xs text-center bg-red-50 dark:bg-red-900/10">
                                                    <select
                                                        value={mutationData.mutationLocation || 'Pameran'}
                                                        onChange={(e) => setMutationData({ ...mutationData, mutationLocation: e.target.value })}
                                                        className="px-2 py-0.5 text-xs border border-red-300 rounded text-center bg-white dark:bg-dark-card"
                                                    >
                                                        <option value="Gudang">Gudang</option>
                                                        <option value="Pameran">Pameran</option>
                                                        <option value="Outbound">Outbound</option>
                                                    </select>
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
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-24">Keluar Gudang</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-blue-700 w-24">Kembali Gudang</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-20">Sisa Gudang</th>
                                                        <th className="px-2 py-1 text-center text-xs font-semibold text-white bg-red-700 w-20">Kondisi</th>
                                                        <th className="px-2 py-1 text-left text-xs font-semibold text-white w-full">Keterangan</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                    {(pkg.items || []).map((item, itemIdx) => {
                                                        // Logic berdasarkan lokasi mutasi yang dipilih
                                                        const isFullyMutated = item.inWarehouse === 0 && item.atPameran === 0;
                                                        const mutationLocation = mutationData?.mutationLocation || 'Pameran';

                                                        // Determine which direction is active based on selected location
                                                        const isToGudang = mutationLocation === 'Gudang'; // Remutasi: Pameran -> Gudang
                                                        const isToPameranOrOutbound = mutationLocation === 'Pameran' || mutationLocation === 'Outbound'; // Mutasi: Gudang -> Pameran/Outbound

                                                        // Calculate max values
                                                        const maxMutasi = item.inWarehouse || 0; // Max bisa keluar dari gudang
                                                        const maxRemutasi = item.atPameran || 0; // Max bisa balik dari pameran

                                                        // Outbound only available if stock in warehouse
                                                        const canMutateToOutbound = mutationLocation === 'Outbound' && maxMutasi > 0;
                                                        const canMutateToPameran = mutationLocation === 'Pameran' && maxMutasi > 0;
                                                        const canRemutate = mutationLocation === 'Gudang' && maxRemutasi > 0;

                                                        return (
                                                            <tr key={itemIdx} className={`hover:bg-gray-50 dark:hover:bg-dark-surface/50 ${isFullyMutated ? 'opacity-75 bg-gray-50' : ''}`}>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{itemIdx + 1}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.itemCode || '-'}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.hsCode || '-'}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.name || item.itemName || '-'}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{item.quantity || 0}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">{item.uom || 'pcs'}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{typeof item.location === 'string' ? item.location : (typeof item.location?.room === 'string' ? item.location.room : 'warehouse')}</td>
                                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver">{item.condition || 'Baik'}</td>

                                                                {/* Mutation input (Gudang -> Pameran/Outbound) - Active when going TO Pameran/Outbound */}
                                                                <td className={`px-2 py-0.5 text-xs text-center border-r border-red-100 dark:border-red-900/20 ${isToPameranOrOutbound ? 'bg-red-50 dark:bg-red-900/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                                    <div className="flex flex-col items-center">
                                                                        <select
                                                                            value={item.mutationQty || 0}
                                                                            onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationQty', parseInt(e.target.value) || 0)}
                                                                            className={`w-16 px-1 py-0.5 text-xs text-center border rounded focus:ring-1 ${isToPameranOrOutbound && maxMutasi > 0 ? 'border-red-300 focus:ring-red-500 bg-white' : 'border-gray-300 bg-gray-200 cursor-not-allowed'}`}
                                                                            disabled={!isToPameranOrOutbound || maxMutasi === 0}
                                                                        >
                                                                            {[...Array(maxMutasi + 1).keys()].map(n => (
                                                                                <option key={n} value={n}>{n}</option>
                                                                            ))}
                                                                        </select>
                                                                        <span className={`text-[9px] mt-0.5 ${isToPameranOrOutbound ? 'text-red-500' : 'text-gray-400'}`}>
                                                                            Stok: {maxMutasi}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Remutation input (Pameran -> Gudang) - Active when going TO Gudang */}
                                                                <td className={`px-2 py-0.5 text-xs text-center ${isToGudang ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                                    <div className="flex flex-col items-center">
                                                                        <select
                                                                            value={item.remutationQty || 0}
                                                                            onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'remutationQty', parseInt(e.target.value) || 0)}
                                                                            className={`w-16 px-1 py-0.5 text-xs text-center border rounded focus:ring-1 ${isToGudang && maxRemutasi > 0 ? 'border-blue-300 focus:ring-blue-500 bg-white' : 'border-gray-300 bg-gray-200 cursor-not-allowed'}`}
                                                                            disabled={!isToGudang || maxRemutasi === 0}
                                                                        >
                                                                            {[...Array(maxRemutasi + 1).keys()].map(n => (
                                                                                <option key={n} value={n}>{n}</option>
                                                                            ))}
                                                                        </select>
                                                                        <span className={`text-[9px] mt-0.5 ${isToGudang ? 'text-blue-500' : 'text-gray-400'}`}>
                                                                            Di Pameran: {maxRemutasi}
                                                                        </span>
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
                )
            }
        </div >
    );
};

export default WarehouseInventory;
