import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Warehouse, Search, Download, X, Edit2, Save, XCircle, ArrowRightLeft, Upload, FileText, Trash2, ExternalLink, AlertCircle, CheckCircle, Box, MapPin, LogOut, Plus, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { LOCATION_OPTIONS, DEFAULT_LOCATION } from '../../constants/locationOptions';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';
import { calculateDaysDifference, getAgingStatus } from '../../utils/agingCalculator';
import { useLanguage } from '../../i18n/LanguageContext';
import { hasApprovedOutboundForSource } from './outboundApproval';
import {
    getExternalLocationBalances,
    getWarehouseStock,
    shouldShowWarehouseMutationRow
} from './warehouseStock';
import { validateMutationRequests } from './mutationValidation';
import { applyMutationTracking } from './mutationTracking';
import { useDraftSave, getDraftFromStorage, clearDraftFromStorage, formatDraftTimestamp } from '../../hooks/useDraftSave';
import DraftRecoveryPrompt from '../../components/Common/DraftRecoveryPrompt';

const isWarehouseMutationRow = item => String(item?._replicaIndex || '').startsWith('warehouse');
const getMutationSourceLocation = item =>
    isWarehouseMutationRow(item) ? 'warehouse' : item?._sourceLocation || item?._replicaIndex;

const WarehouseInventory = () => {
    const { t } = useLanguage();
    const { canEdit, canDelete, user, isSuperAdmin } = useAuth();
    const hasEdit = canEdit('bridge_inventory');
    const hasDelete = canDelete('bridge_inventory');
    const canClearAll = hasDelete && isSuperAdmin();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { quotations, warehouseInventory = [], updateQuotation, updateWarehouseInventory, addMutationLog, mutationLogs = [], deleteMutationLog, updateInventoryStock, outboundTransactions = [], updateItemCheckout, requestApproval, isExhibitionLocation, getExhibitionLocation } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPengajuan, setSelectedPengajuan] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);
    // Tambahan: State untuk jam masuk (entryTime) saat edit
    const [entryTime, setEntryTime] = useState('');
    
    // Draft recovery states
    const [showDraftRecovery, setShowDraftRecovery] = useState(false);
    const [draftData, setDraftData] = useState(null);

    // Mutation modal states
    const [showMutationModal, setShowMutationModal] = useState(false);
    const [mutationData, setMutationData] = useState(null);
    const [mutationDocuments, setMutationDocuments] = useState([]);
    const [activeDocumentRow, setActiveDocumentRow] = useState(null); // { pkgIndex, itemIdx }
    const fileInputRef = useRef(null);

    const approvedInboundPengajuan = quotations.filter(q =>
        ['approved'].includes(String(q.documentStatus || q.document_status || '').trim().toLowerCase()) &&
        (String(q.type || '').trim().toLowerCase() === 'inbound' || !q.type)
    );

    // Keep inventory rows visible even when their quotation status no longer qualifies.
    const warehouseGroups = new Map();
    warehouseInventory.forEach(item => {
        const pengajuanId = item.pengajuanId || item.pengajuan_id;
        const pengajuanNumber = item.pengajuanNumber || item.pengajuan_number;
        const groupKey = pengajuanId || pengajuanNumber || item.id;
        if (!groupKey) return;
        if (!warehouseGroups.has(groupKey)) warehouseGroups.set(groupKey, []);
        warehouseGroups.get(groupKey).push(item);
    });

    const warehouseBackedPengajuan = Array.from(warehouseGroups.entries()).flatMap(([groupKey, items]) => {
        const firstItem = items[0];
        const pengajuanId = firstItem.pengajuanId || firstItem.pengajuan_id;
        const pengajuanNumber = firstItem.pengajuanNumber || firstItem.pengajuan_number;
        const quotation = quotations.find(q =>
            (pengajuanId && q.id === pengajuanId) ||
            (pengajuanNumber && String(q.quotationNumber || q.quotation_number || '').trim().toLowerCase() === String(pengajuanNumber).trim().toLowerCase())
        );

        if (String(quotation?.type || '').trim().toLowerCase() === 'outbound') return [];
        if (quotation && approvedInboundPengajuan.includes(quotation) && quotation.packages?.length) return [];

        const packagesByNumber = new Map();
        items.forEach(item => {
            const packageNumber = item.packageNumber || item.package_number || 'Tanpa Package';
            if (!packagesByNumber.has(packageNumber)) {
                packagesByNumber.set(packageNumber, { packageNumber, items: [] });
            }
            packagesByNumber.get(packageNumber).items.push({
                warehouseInventoryId: item.id,
                itemCode: item.itemCode || item.item_code,
                name: item.itemName || item.item_name || item.assetName || item.asset_name || '-',
                itemName: item.itemName || item.item_name || item.assetName || item.asset_name || '-',
                serialNumber: item.serialNumber || item.serial_number,
                quantity: Number(item.currentStock ?? item.quantity ?? 0),
                uom: item.unit || 'pcs',
                condition: item.condition,
                value: item.value,
                notes: item.notes || item.remarks || ''
            });
        });

        return [{
            ...(quotation || {}),
            id: quotation?.id || pengajuanId || `warehouse-${groupKey}`,
            quotationNumber: pengajuanNumber || quotation?.quotationNumber || quotation?.quotation_number || '-',
            quotation_number: pengajuanNumber || quotation?.quotation_number || quotation?.quotationNumber || '-',
            bcDocumentNumber: firstItem.bcDocumentNumber || firstItem.bc_document_number || quotation?.bcDocumentNumber || quotation?.bc_document_number,
            bc_document_number: firstItem.bc_document_number || firstItem.bcDocumentNumber || quotation?.bc_document_number || quotation?.bcDocumentNumber,
            submissionDate: firstItem.submissionDate || firstItem.submission_date || firstItem.entryDate || firstItem.entry_date || quotation?.submissionDate || quotation?.submission_date,
            submission_date: firstItem.submission_date || firstItem.submissionDate || firstItem.entry_date || firstItem.entryDate || quotation?.submission_date || quotation?.submissionDate,
            type: 'inbound',
            documentStatus: 'approved',
            packages: Array.from(packagesByNumber.values()),
            warehouseQuotationExists: Boolean(quotation),
            isWarehouseFallback: true
        }];
    });

    const visibleInboundPengajuan = [
        ...approvedInboundPengajuan.filter(q => !warehouseBackedPengajuan.some(item => item.id === q.id)),
        ...warehouseBackedPengajuan
    ];

    // Filter only approved OUTBOUND pengajuan (these are leaving warehouse)
    const approvedOutboundPengajuan = quotations.filter(q =>
        (q.documentStatus === 'approved' || q.document_status === 'approved') &&
        q.type === 'outbound'
    );

    const getSubmissionTime = (q) => {
        const time = Date.parse(q.submissionDate || q.submission_date || q.created_at || q.createdAt || '');
        return Number.isNaN(time) ? 0 : time;
    };
    const getCreatedTime = (q) => {
        const time = Date.parse(q.created_at || q.createdAt || '');
        return Number.isNaN(time) ? 0 : time;
    };
    const sortNewestFirst = (a, b) =>
        getSubmissionTime(b) - getSubmissionTime(a) ||
        getCreatedTime(b) - getCreatedTime(a) ||
        String(b.quotationNumber || b.quotation_number || '').localeCompare(
            String(a.quotationNumber || a.quotation_number || ''), undefined, { numeric: true });

    // Filter inbound based on search
    const filteredInboundPengajuan = visibleInboundPengajuan.filter(q => {
        const searchLower = searchTerm.toLowerCase();
        const pengajuanNo = q.quotationNumber || q.quotation_number || '';
        const bcNo = q.bcDocumentNumber || q.bc_document_number || '';
        const customer = q.customer || '';

        return pengajuanNo.toLowerCase().includes(searchLower) ||
            bcNo.toLowerCase().includes(searchLower) ||
            customer.toLowerCase().includes(searchLower);
    }).sort(sortNewestFirst);

    // Filter outbound based on search
    const filteredOutboundPengajuan = approvedOutboundPengajuan.filter(q => {
        const searchLower = searchTerm.toLowerCase();
        const pengajuanNo = q.quotationNumber || q.quotation_number || '';
        const bcNo = q.bcDocumentNumber || q.bc_document_number || '';
        const customer = q.customer || '';

        return pengajuanNo.toLowerCase().includes(searchLower) ||
            bcNo.toLowerCase().includes(searchLower) ||
            customer.toLowerCase().includes(searchLower);
    }).sort(sortNewestFirst);

    // Same stock source as the Goods Movement modal (freight_warehouse balance)
    const getCurrentWarehouseStock = (pengajuan) => (pengajuan.packages || []).reduce((total, pkg) =>
        total + (pkg.items || []).reduce((sum, item) => {
            const status = getIndividualItemStatus(
                item.itemCode, pkg.packageNumber, item.name || item.itemName, item.warehouseInventoryId, pengajuan
            );
            const stock = status.warehouseAvailable ?? (Number(item.quantity || 0) - (status.totalDeducted || 0));
            return sum + Math.max(0, Number(stock) || 0);
        }, 0), 0);

    // Helper function to count packages and items
    const countPackagesAndItems = (pengajuan) => {
        const packages = pengajuan.packages || [];
        const packageCount = packages.length;
        const itemCount = packages.reduce((sum, pkg) => {
            const uniqueItems = new Set();
            let pkgSum = 0;
            (pkg.items || []).forEach((item, idx) => {
                const identifier = item._originalItemIdx !== undefined ? item._originalItemIdx : idx;
                if (!uniqueItems.has(identifier)) {
                    uniqueItems.add(identifier);
                    pkgSum += Number(item.quantity || 0);
                }
            });
            return sum + pkgSum;
        }, 0);
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
        // Ambil jam dari approvedDate jika ada, format ke HH:mm
        let jam = '';
        const dateStr = pengajuan.approvedDate || pengajuan.approved_date;
        if (dateStr) {
            try {
                const d = new Date(dateStr);
                jam = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            } catch {}
        }
        setEntryTime(jam);
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
        if (!hasEdit) return;
        // Saat mulai edit, pastikan entryTime diisi dari data
        let jam = entryTime;
        if (!jam && editData) {
            const dateStr = editData.approvedDate || editData.approved_date;
            if (dateStr) {
                try {
                    const d = new Date(dateStr);
                    jam = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                } catch {}
            }
        }
        setEntryTime(jam);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditData(JSON.parse(JSON.stringify(selectedPengajuan)));
        // Reset entryTime ke data awal
        let jam = '';
        const dateStr = selectedPengajuan?.approvedDate || selectedPengajuan?.approved_date;
        if (dateStr) {
            try {
                const d = new Date(dateStr);
                jam = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            } catch {}
        }
        setEntryTime(jam);
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        try {
            let approvedDateISO = editData.approvedDate || editData.approved_date || editData.submissionDate || editData.submission_date || new Date().toISOString();
            if ((editData.approvedDate || editData.approved_date || editData.submissionDate || editData.submission_date) && entryTime) {
                let dateObj = new Date(editData.approvedDate || editData.approved_date || editData.submissionDate || editData.submission_date);
                if (isNaN(dateObj.getTime())) dateObj = new Date();
                const [hours, minutes] = entryTime.split(':');
                dateObj.setHours(parseInt(hours, 10));
                dateObj.setMinutes(parseInt(minutes, 10));
                approvedDateISO = dateObj.toISOString();
            }

            // Sanitize: Remove temporary mutation fields before saving
            const cleanedData = {
                ...editData,
                approvedDate: approvedDateISO,
                approved_date: approvedDateISO,
                packages: (editData.packages || []).map(pkg => ({
                    ...pkg,
                    items: (pkg.items || []).map(item => {
                        const { mutationInQty, mutationOutQty, mutationDate, ...cleanItem } = item;
                        return cleanItem;
                    })
                }))
            };

            if (!selectedPengajuan.isWarehouseFallback) {
                const mutationRequests = (editData.packages || []).flatMap(pkg =>
                    (pkg.items || []).flatMap(item => {
                        const itemStatus = getIndividualItemStatus(
                            item.itemCode,
                            pkg.packageNumber,
                            item.name || item.itemName,
                            item.warehouseInventoryId
                        );
                        const availableInWarehouse = itemStatus.warehouseAvailable ??
                            (Number(item.quantity) || 0) - (itemStatus.totalDeducted || itemStatus.atPameran);
                        const scope = (direction) => JSON.stringify([
                            selectedPengajuan.id,
                            pkg.packageNumber || '',
                            item.itemCode || '',
                            direction
                        ]);

                        return [
                            {
                                scope: scope('outbound'),
                                quantity: item.mutationOutQty,
                                availableStock: availableInWarehouse,
                                itemName: item.name || item.itemName
                            },
                            {
                                scope: scope('inbound'),
                                quantity: item.mutationInQty,
                                availableStock: itemStatus.atPameran,
                                itemName: item.name || item.itemName
                            }
                        ];
                    })
                );
                validateMutationRequests(mutationRequests);

                if (mutationRequests.some(request => Number(request.quantity || 0) > 0) &&
                    (!addMutationLog || !updateInventoryStock)) {
                    throw new Error('Fungsi penyimpanan mutasi tidak tersedia. Muat ulang halaman dan coba lagi.');
                }
            }

            if (selectedPengajuan.isWarehouseFallback) {
                const warehouseUpdates = (cleanedData.packages || []).flatMap(pkg =>
                    (pkg.items || []).map(item => {
                        const quantity = Number(item.quantity);
                        if (!item.warehouseInventoryId || !Number.isFinite(quantity) || quantity < 0) {
                            throw new Error('Data inventaris tidak valid atau ID baris warehouse tidak ditemukan.');
                        }
                        return updateWarehouseInventory(item.warehouseInventoryId, {
                            item_code: item.itemCode || null,
                            item_name: item.name || item.itemName || null,
                            asset_name: item.name || item.itemName || null,
                            package_number: pkg.packageNumber || null,
                            quantity,
                            unit: item.uom || 'pcs',
                            condition: item.condition || null,
                            value: item.value || 0,
                            notes: item.notes || '',
                            remarks: item.notes || '',
                            entry_date: cleanedData.submissionDate || cleanedData.submission_date || null,
                            submission_date: cleanedData.submissionDate || cleanedData.submission_date || null,
                            bc_document_number: cleanedData.bcDocumentNumber || cleanedData.bc_document_number || null
                        });
                    })
                );
                const updateResults = await Promise.all(warehouseUpdates);
                if (updateResults.some(result => result !== true)) {
                    throw new Error('Sebagian data warehouse gagal disimpan. Periksa pesan error dan muat ulang sebelum mencoba lagi.');
                }

                setSelectedPengajuan(cleanedData);
                setEditData(cleanedData);
                setIsEditing(false);
                clearDraftFromStorage(`warehouse_edit_${selectedPengajuan.id}`);
                alert(t("Data inventaris berhasil disimpan"));
                return;
            }

            // 1. Save quotation data (without mutation fields)
            const quotationSaved = await updateQuotation(selectedPengajuan.id, cleanedData);
            if (!quotationSaved) {
                throw new Error('Data pengajuan gagal disimpan. Mutasi belum diproses.');
            }
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
                    const itemStatus = getIndividualItemStatus(item.itemCode, pkg.packageNumber, itemName, item.warehouseInventoryId);
                    // Use totalDeducted to account for official outbound as well
                    const inWarehouse = itemStatus.warehouseAvailable ??
                        (item.quantity || 0) - (itemStatus.totalDeducted || itemStatus.atPameran);

                    // Process outbound mutation (Gudang -> Pameran)
                    if (outQty > 0) {
                        // Per-item location if specified, else header fallback
                        const destinationLocation = item.mutationLocation || editData.mutationLocation || DEFAULT_LOCATION;
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
                    if (inQty > 0) {
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
                            origin: item.mutationLocation || editData.mutationLocation || DEFAULT_LOCATION,
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
            if (mutations.length > 0) {
                console.log('📊 Processing', mutations.length, 'mutation(s)...');
                for (const mutation of mutations) {
                    console.log('💾 Saving mutation:', mutation.itemName, mutation._type, 'qty:', mutation.mutatedQty);

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
                            0,
                            {
                                pengajuanId: mutation.pengajuanId,
                                pengajuanNumber: mutation.pengajuanNumber,
                                packageNumber: mutation.packageNumber
                            }
                        );
                        console.log('📉 Inventory updated:', mutation.itemCode, qtyChange);
                    }
                    try {
                        await addMutationLog(mutation);
                    } catch (logError) {
                        if (updateInventoryStock) {
                            try {
                                await updateInventoryStock(
                                    mutation.itemCode,
                                    mutation.itemName,
                                    -qtyChange,
                                    'pcs',
                                    'Mutation Rollback',
                                    mutation.pengajuanNumber,
                                    0,
                                    {
                                        pengajuanId: mutation.pengajuanId,
                                        pengajuanNumber: mutation.pengajuanNumber,
                                        packageNumber: mutation.packageNumber
                                    }
                                );
                            } catch (rollbackError) {
                                console.error('Failed to restore warehouse stock after mutation log error:', rollbackError);
                                throw new Error(`Mutasi gagal dicatat dan stok gagal dipulihkan: ${rollbackError.message}`);
                            }
                        }
                        throw logError;
                    }
                }
                alert(`Data berhasil disimpan! ${mutations.length} mutasi diproses.`);
                // Auto-navigate to Goods Movement page after inline mutations
                navigate(`/bridge/goods-movement?pengajuan=${encodeURIComponent(qNumber)}`);
                handleCloseDetail();
                if (requestApproval) {
                    const userName = user?.full_name || user?.username || 'User';
                    const userId = user?.id || null;
                    const mutationTypes = [...new Set(mutations.map(m => m._type))];
                    const typeLabel = mutationTypes.includes('inbound') ? 'mutation_in' : 'mutation_out';
                    try {
                        await requestApproval(
                            typeLabel, 'Bridge', 'Mutation', selectedPengajuan.id,
                            editData.quotationNumber || editData.quotation_number,
                            { items: mutations.map(m => ({ itemCode: m.itemCode, itemName: m.itemName, qty: m.mutatedQty, type: m._type })), totalItems: mutations.length },
                            `Mutasi ${mutations.length} item (inline edit)`,
                            userName, userId
                        );
                    } catch (approvalErr) {
                        console.warn('⚠️ Approval request failed (non-critical):', approvalErr);
                    }
                }
            } else {
                alert(t("Data berhasil disimpan!"));
            }

            // Update selectedPengajuan dengan data baru (approvedDate sudah update)
            setSelectedPengajuan({ ...editData, approvedDate: approvedDateISO, approved_date: approvedDateISO });
            setIsEditing(false);
            clearDraftFromStorage(`warehouse_edit_${selectedPengajuan.id}`);
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
        const currentDocs = activeDocumentRow && mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || [];
        const maxFiles = 5;

        if (currentDocs.length + files.length > maxFiles) {
            alert(`Maksimal ${maxFiles} file. Anda sudah memiliki ${currentDocs.length} file.`);
            return;
        }

        const newDocs = [];
        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                alert(`Format file "${file.name}" tidak didukung. Gunakan JPG, PNG, atau PDF.`);
                continue;
            }

            const result = await compressImage(file, 3000);
            if (result) {
                newDocs.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    title: '',
                    data: result.data,
                    size: result.size
                });
            }
        }

        if (newDocs.length > 0 && activeDocumentRow) {
            handleMutationItemChange(activeDocumentRow.pkgIndex, activeDocumentRow.itemIdx, 'mutationDocuments', [...currentDocs, ...newDocs]);
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

    const handleStartMutation = async (data) => {
        if (!hasEdit) return;
        // Fix: If 'data' is an event object (from button click) or undefined, use selectedPengajuan
        const pengajuanToProcess = (data && !data.packages && !data.quotationNumber && !data.quotation_number)
            ? selectedPengajuan
            : (data || selectedPengajuan);

        if (!pengajuanToProcess) {
            console.warn('⚠️ No pengajuan data available for mutation.');
            return;
        }

        const submissionNumber = pengajuanToProcess.quotationNumber || pengajuanToProcess.quotation_number;
        const logColumns = 'id,pengajuan_id,pengajuan_number,item_code,item_name,mutated_qty,origin,destination,date,time,pic,created_at,meta_package:documents->>packageNumber';
        const logQueries = [];
        if (submissionNumber) {
            logQueries.push(
                supabase.from('freight_mutation_logs').select(logColumns).eq('pengajuan_number', submissionNumber)
            );
        }
        if (pengajuanToProcess.id) {
            logQueries.push(
                supabase.from('freight_mutation_logs').select(logColumns).eq('pengajuan_id', pengajuanToProcess.id)
            );
        }

        let freshMutationLogs;
        try {
            const results = await Promise.all(logQueries);
            const logsById = new Map();
            results.forEach(({ data, error }) => {
                if (error) throw error;
                (data || []).forEach(log => logsById.set(String(log.id), log));
            });
            freshMutationLogs = Array.from(logsById.values()).map(log => ({
                id: String(log.id),
                pengajuanId: log.pengajuan_id,
                pengajuanNumber: log.pengajuan_number,
                packageNumber: log.meta_package,
                itemCode: log.item_code,
                itemName: log.item_name,
                mutatedQty: Number(log.mutated_qty) || 0,
                origin: log.origin,
                destination: log.destination,
                date: log.date,
                time: log.time,
                pic: log.pic
            }));
        } catch (error) {
            console.error('Gagal memuat riwayat mutasi sebelum membuka modal:', error);
            alert(`Gagal memuat riwayat mutasi: ${error.message || 'Muat ulang halaman dan coba lagi.'}`);
            return;
        }

        console.log('🚀 Starting mutation for:', pengajuanToProcess.quotationNumber || pengajuanToProcess.quotation_number, 'ID:', pengajuanToProcess.id);

        const mutData = {
            ...JSON.parse(JSON.stringify(pengajuanToProcess)),
            mutationDate: new Date().toISOString().split('T')[0],
            mutationTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            mutationPic: '',
            mutationLocation: DEFAULT_LOCATION, // Default location (header fallback)
            packages: (pengajuanToProcess.packages || []).map(pkg => ({
                ...pkg,
                // Show actionable warehouse stock and each outstanding external location.
                items: (pkg.items || []).flatMap((item, originalItemIdx) => {
                    const rows = [];
                    const status = getIndividualItemStatus(
                        item.itemCode,
                        pkg.packageNumber,
                        item.name || item.itemName,
                        item.warehouseInventoryId,
                        pengajuanToProcess
                    );
                    const inWarehouse = status.warehouseAvailable ??
                        (item.quantity || 0) - (status.totalDeducted || status.atPameran);

                    const pengajuanNumberLocal = pengajuanToProcess.quotationNumber || pengajuanToProcess.quotation_number;
                    const relatedMutations = freshMutationLogs.filter(m =>
                        (m.pengajuanId === pengajuanToProcess.id || normalize(m.pengajuanNumber) === normalize(pengajuanNumberLocal)) &&
                        normalize(m.itemCode) === normalize(item.itemCode) &&
                        (pkg.packageNumber ? normalize(m.packageNumber) === normalize(pkg.packageNumber) : true)
                    );

                    const externalLocationBalances = getExternalLocationBalances(relatedMutations);

                    // Determine a safe non-Gudang default location for outbound warehouse rows
                    const safeExhibitionLoc = (() => {
                        const exhibLoc = getExhibitionLocation ? getExhibitionLocation() : null;
                        // Ensure the exhibition location is not Gudang
                        if (exhibLoc && String(exhibLoc).toLowerCase() !== 'gudang') return exhibLoc;
                        // Fallback: pick first non-Gudang option from LOCATION_OPTIONS
                        const nonGudang = LOCATION_OPTIONS.find(opt => opt.value.toLowerCase() !== 'gudang');
                        return nonGudang ? nonGudang.value : 'Hall 1';
                    })();

                    // Add one source row for each external location that currently holds stock.
                    externalLocationBalances.forEach(({ location, quantity }) => {
                        rows.push({
                            ...item,
                            _originalItem: item.itemCode,
                            _originalItemIdx: originalItemIdx,
                            _replicaIndex: location,
                            _sourceLocation: location,
                            mutationLocation: 'Gudang',
                            inWarehouse: 0,
                            atPameran: quantity,
                            maxMutationQty: 0,
                            maxRemutationQty: quantity,
                            mutationQty: 0,
                            remutationQty: 0,
                            mutationCondition: 'Baik',
                            mutationDate: new Date().toISOString().split('T')[0],
                            mutationTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            mutationPic: '',
                            mutationDocuments: []
                        });
                    });

                    const hasOutstandingExternalStock = externalLocationBalances.length > 0;
                    if (shouldShowWarehouseMutationRow(inWarehouse, hasOutstandingExternalStock)) {
                        rows.unshift({
                            ...item,
                            _originalItem: item.itemCode,
                            _originalItemIdx: originalItemIdx,
                            _replicaIndex: 'warehouse',
                            _sourceLocation: 'warehouse',
                            mutationLocation: safeExhibitionLoc,
                            inWarehouse: Math.max(0, inWarehouse),
                            atPameran: 0,
                            maxMutationQty: Math.max(0, inWarehouse),
                            maxRemutationQty: 0,
                            mutationQty: 0,
                            remutationQty: 0,
                            mutationCondition: 'Baik',
                            mutationDate: new Date().toISOString().split('T')[0],
                            mutationTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                            mutationPic: '',
                            mutationDocuments: []
                        });
                    }

                    return rows;
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

    // Auto-save draft ketika editData berubah
    useDraftSave(
        selectedPengajuan?.id ? `warehouse_edit_${selectedPengajuan.id}` : null,
        editData && isEditing ? { editData, entryTime, selectedPengajuan } : null,
        30000 // Auto-save setiap 30 detik
    );

    // Check dan prompt restore draft saat selectedPengajuan berubah
    useEffect(() => {
        if (!selectedPengajuan?.id || isEditing) return;

        const draftKey = `warehouse_edit_${selectedPengajuan.id}`;
        const draft = getDraftFromStorage(draftKey);

        if (draft && draft.data && draft.data.editData) {
            setDraftData(draft);
            setShowDraftRecovery(true);
        } else {
            setShowDraftRecovery(false);
            setDraftData(null);
        }
    }, [selectedPengajuan?.id, isEditing]);

    const handleRecoverDraft = () => {
        if (!draftData || !draftData.data) return;

        setEditData(draftData.data.editData);
        setEntryTime(draftData.data.entryTime || '');
        setIsEditing(true);
        setShowDraftRecovery(false);
        console.log('✅ Draft berhasil di-restore');
    };

    const handleDiscardDraft = () => {
        if (!selectedPengajuan?.id) return;

        clearDraftFromStorage(`warehouse_edit_${selectedPengajuan.id}`);
        setShowDraftRecovery(false);
        setDraftData(null);
        console.log('🗑️ Draft berhasil dihapus');
    };

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

        // When mutationLocation changes, recalculate max values based on new location
        if (field === 'mutationLocation') {
            const item = newData.packages[pkgIndex].items[itemIndex];
            const newLocation = value;
            item.maxMutationQty = isWarehouseMutationRow(item)
                ? item.inWarehouse || 0
                : item.atPameran || 0;
            item.maxRemutationQty = isWarehouseMutationRow(item) ? 0 : item.atPameran || 0;
            item.mutationQty = 0;
            item.remutationQty = 0;
        }

        // Validate mutation qty doesn't exceed remaining stock
        if (field === 'mutationQty') {
            const item = newData.packages[pkgIndex].items[itemIndex];
            
            // Check max based on other identical items
            const isWarehouseRow = isWarehouseMutationRow(item);
            const sourceLocation = normalize(getMutationSourceLocation(item));
            let sumOtherMutations = 0;
            newData.packages[pkgIndex].items.forEach((otherItem, otherIdx) => {
                if (
                    otherIdx !== itemIndex &&
                    otherItem._originalItemIdx === item._originalItemIdx &&
                    normalize(getMutationSourceLocation(otherItem)) === sourceLocation
                ) {
                    sumOtherMutations += Number(otherItem.mutationQty) || 0;
                }
            });

            const sourceStock = isWarehouseRow ? item.inWarehouse : item.atPameran;
            const maxMutasi = Math.max(0, (Number(sourceStock) || 0) - sumOtherMutations);

            if (value !== '' && value > maxMutasi) {
                value = maxMutasi;
            }
        }

        // Validate remutation qty doesn't exceed stock at exhibition
        if (field === 'remutationQty') {
            const item = newData.packages[pkgIndex].items[itemIndex];
            const maxQty = item.maxRemutationQty || item.atPameran || 0;
            value = Math.min(Math.max(0, parseInt(value) || 0), maxQty);
        }

        newData.packages[pkgIndex].items[itemIndex][field] = value;
        setMutationData(newData);
    };

    const handleAddMultiMutation = (pkgIndex, itemIndex) => {
        const newData = { ...mutationData };
        if (!newData.packages) newData.packages = [];
        const pkg = newData.packages[pkgIndex];
        if (!pkg) return;
        if (!pkg.items) pkg.items = [];
        
        const baseItem = pkg.items[itemIndex];
        if (!baseItem) return;
        const isWarehouseRow = isWarehouseMutationRow(baseItem);
        const sourceLocation = getMutationSourceLocation(baseItem);

        // Find the last index of rows belonging to this original item
        let lastIdx = itemIndex;
        for (let i = itemIndex; i < pkg.items.length; i++) {
            if (pkg.items[i]._originalItemIdx === baseItem._originalItemIdx) {
                lastIdx = i;
            } else {
                break;
            }
        }

        const newRow = {
            ...baseItem,
            _replicaIndex: `${isWarehouseRow ? 'warehouse' : 'external'}_multi_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            _sourceLocation: sourceLocation,
            mutationLocation: isWarehouseRow
                ? getExhibitionLocation() || LOCATION_OPTIONS.find(opt => opt.value.toLowerCase() !== 'gudang')?.value || 'Hall 1'
                : LOCATION_OPTIONS.find(opt =>
                    !['gudang', 'outbound'].includes(opt.value.toLowerCase()) &&
                    normalize(opt.value) !== normalize(sourceLocation)
                )?.value || 'Gudang',
            mutationQty: 0,
            remutationQty: 0,
            mutationCondition: 'Baik',
            notes: ''
        };

        // Insert new row after the last row of this item
        pkg.items.splice(lastIdx + 1, 0, newRow);
        setMutationData(newData);
    };

    const handleRemoveMultiMutation = (pkgIndex, itemIndex) => {
        const newData = { ...mutationData };
        newData.packages[pkgIndex].items.splice(itemIndex, 1);
        setMutationData(newData);
    };

    const handleSaveMutation = async () => {
        try {
            // Check if any item is going to Outbound - require approved Pengajuan Barang Keluar
            const hasOutbound = mutationData?.packages?.some(pkg => 
                pkg.items?.some(item => String(item.mutationLocation || '').toLowerCase() === 'outbound')
            );

            if (hasOutbound) {
                const submissionId = mutationData?.id || selectedPengajuan?.id;
                const submissionNumber = mutationData?.quotationNumber || mutationData?.quotation_number ||
                    selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;
                let outboundApproved = hasApprovedOutboundForSource({
                    quotations,
                    submissionId,
                    submissionNumber
                }) || outboundTransactions?.some(o =>
                    (String(o.quotation_id || o.pengajuanId || o.pengajuan_id || '') === String(submissionId || '') ||
                        (submissionNumber && String(o.quotationNumber || o.quotation_number || o.pengajuanNumber || o.pengajuan_number || '').trim().toLowerCase() === String(submissionNumber).trim().toLowerCase())) &&
                    (String(o.status || '').trim().toLowerCase() === 'approved' ||
                        String(o.document_status || '').trim().toLowerCase() === 'approved')
                );

                if (!outboundApproved) {
                    const hasApprovedRecord = async (column, value) => {
                        if (!value) return false;

                        const { data, error } = await supabase
                            .from('freight_quotations')
                            .select('id')
                            .eq('type', 'outbound')
                            .eq('document_status', 'approved')
                            .eq(column, value)
                            .limit(1)
                            .maybeSingle();

                        if (error) throw error;
                        return Boolean(data);
                    };

                    outboundApproved =
                        await hasApprovedRecord('id', submissionId) ||
                        await hasApprovedRecord('source_pengajuan_id', submissionId) ||
                        await hasApprovedRecord('quotation_number', submissionNumber) ||
                        await hasApprovedRecord('source_pengajuan_number', submissionNumber);
                }
                
                if (!outboundApproved) {
                    alert(t("❌ Tidak bisa melakukan outbound. Pengajuan Barang Keluar belum disetujui.\n\nSilakan buat dan setujui pengajuan barang keluar terlebih dahulu."));
                    return;
                }
            }

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
                alert(t("Gagal: ID Pengajuan tidak ditemukan. Silakan refresh halaman dan coba lagi."));
                console.error("❌ Critical Error: Quotation ID missing even after lookup.");
                return;
            }

            const mutationRequests = (mutationData?.packages || []).flatMap(pkg =>
                (pkg.items || []).map(item => {
                    const isToGudang = String(item.mutationLocation || 'Gudang').toLowerCase() === 'gudang';
                    const sourceLocation = getMutationSourceLocation(item);
                    const availableStock = isWarehouseMutationRow(item) ? item.inWarehouse : item.atPameran;

                    return {
                        scope: JSON.stringify([
                            qId,
                            pkg.packageNumber || '',
                            item.itemCode || '',
                            sourceLocation
                        ]),
                        quantity: item.mutationQty,
                        availableStock,
                        itemName: item.name || item.itemName
                    };
                })
            );
            validateMutationRequests(mutationRequests);

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
                    const mutationQty = item.mutationQty ?? 0;
                    if (mutationQty <= 0) return;

                    const bcNum = selectedPengajuan?.bcDocumentNumber || selectedPengajuan?.bc_document_number ||
                        mutationData?.bcDocumentNumber || mutationData?.bc_document_number;
                    const destinationLocation = item.mutationLocation || mutationData.mutationLocation || DEFAULT_LOCATION;
                    const isToGudang = String(destinationLocation).toLowerCase() === 'gudang';
                    const isWarehouseSource = isWarehouseMutationRow(item);
                    const originLocation = getMutationSourceLocation(item);
                    const type = isWarehouseSource ? 'outbound' : isToGudang ? 'inbound' : 'transfer';
                    const sourceStock = Number(isWarehouseSource ? item.inWarehouse : item.atPameran) || 0;
                    const destination = isToGudang ? 'warehouse' : destinationLocation;

                    mutations.push({
                        pengajuanId: qId,
                        pengajuanNumber: qNumber,
                        pengajuan_number: qNumber,
                        bcDocumentNumber: bcNum,
                        packageNumber: pkg.packageNumber,
                        itemCode: item.itemCode,
                        itemName: item.name || item.itemName,
                        warehouseInventoryId: item.warehouseInventoryId,
                        hsCode: item.hsCode,
                        sender: senderName,
                        totalStock: item.quantity,
                        mutatedQty: mutationQty,
                        remainingStock: type === 'inbound'
                            ? (Number(item.inWarehouse) || 0) + mutationQty
                            : Math.max(0, sourceStock - mutationQty),
                        origin: originLocation,
                        destination,
                        condition: item.mutationCondition,
                        date: item.mutationDate,
                        time: item.mutationTime,
                        pic: item.mutationPic,
                        remarks: item.notes || (
                            type === 'inbound'
                                ? `Kembali ke Gudang`
                                : type === 'transfer'
                                    ? `Pindah dari ${originLocation} ke ${destinationLocation}`
                                    : `Mutasi ke ${destinationLocation}`
                        ),
                        documents: (item.mutationDocuments || []).map(d => ({ title: d.title, name: d.name, type: d.type, data: d.data })),
                        _pkgIndex: pkgIdx,
                        _itemIndex: Number.isInteger(item._originalItemIdx) ? item._originalItemIdx : itemIdx,
                        _type: type
                    });
                });
            });

            if (mutations.length === 0) {
                const hasAvailableStock = mutationRequests.some(request => Number(request.availableStock) > 0);
                throw new Error(hasAvailableStock
                    ? 'Belum ada jumlah mutasi yang diisi. Masukkan jumlah minimal 1 pada baris dengan stok tersedia.'
                    : 'Stok tersedia untuk semua item adalah 0. Pastikan stok sudah tercatat di inventaris warehouse, lalu muat ulang halaman.');
            }

            console.log('📊 Total mutations to save:', mutations.length);

            if (mutations.length > 0 && !addMutationLog) {
                throw new Error('Fungsi penyimpanan log mutasi tidak tersedia. Muat ulang halaman dan coba lagi.');
            }
            const needsWarehouseStockUpdate = mutations.some(mutation => mutation._type !== 'transfer');
            if (needsWarehouseStockUpdate && (
                selectedPengajuan.isWarehouseFallback
                    ? !updateWarehouseInventory
                    : !updateInventoryStock
            )) {
                throw new Error('Fungsi pembaruan stok warehouse tidak tersedia. Muat ulang halaman dan coba lagi.');
            }

            if (mutations.length > 0) {
                const fallbackStocks = new Map();
                if (selectedPengajuan.isWarehouseFallback) {
                    mutations.forEach(mutation => {
                        if (mutation._type === 'transfer') return;
                        const inventoryItem = warehouseInventory.find(item => item.id === mutation.warehouseInventoryId);
                        if (!inventoryItem) throw new Error('Baris inventaris untuk mutasi tidak ditemukan. Muat ulang halaman.');
                        fallbackStocks.set(mutation.warehouseInventoryId, Number(inventoryItem.currentStock ?? inventoryItem.quantity ?? 0));
                    });
                }

                // Save each mutation AND Update Inventory
                for (const mutation of mutations) {
                    console.log('💾 Saving mutation:', mutation.itemName, 'qty:', mutation.mutatedQty);

                    const qtyChange = mutation._type === 'transfer'
                        ? 0
                        : mutation._type === 'outbound'
                            ? -Math.abs(mutation.mutatedQty)
                            : Math.abs(mutation.mutatedQty);

                    if (qtyChange !== 0 && selectedPengajuan.isWarehouseFallback) {
                        const inventoryId = mutation.warehouseInventoryId;
                        const nextStock = fallbackStocks.get(inventoryId) + qtyChange;
                        if (nextStock < 0) throw new Error('Stok warehouse tidak mencukupi untuk mutasi ini.');
                        const saved = await updateWarehouseInventory(inventoryId, { quantity: nextStock });
                        if (!saved) throw new Error(`Gagal memperbarui stok warehouse untuk ${mutation.itemName}.`);
                        fallbackStocks.set(inventoryId, nextStock);
                    } else if (qtyChange !== 0 && updateInventoryStock) {
                        await updateInventoryStock(
                            mutation.itemCode,
                            mutation.itemName,
                            qtyChange,
                            'pcs',
                            mutation._type === 'outbound' ? 'Mutation Out' : 'Mutation In',
                            mutation.pengajuanNumber,
                            0,
                            {
                                pengajuanId: mutation.pengajuanId,
                                pengajuanNumber: mutation.pengajuanNumber,
                                packageNumber: mutation.packageNumber
                            }
                        );
                        console.log('📉 Inventory updated:', mutation.itemCode, qtyChange);
                    }
                    const logData = {
                        ...mutation,
                        pengajuanId: selectedPengajuan.isWarehouseFallback && !selectedPengajuan.warehouseQuotationExists
                            ? null
                            : mutation.pengajuanId
                    };
                    try {
                        await addMutationLog(logData);
                    } catch (logError) {
                        if (qtyChange !== 0) {
                            try {
                                if (selectedPengajuan.isWarehouseFallback) {
                                    const inventoryId = mutation.warehouseInventoryId;
                                    const previousStock = fallbackStocks.get(inventoryId) - qtyChange;
                                    const restored = await updateWarehouseInventory(inventoryId, { quantity: previousStock });
                                    if (!restored) throw new Error('Gagal memperbarui stok warehouse.');
                                    fallbackStocks.set(inventoryId, previousStock);
                                } else if (updateInventoryStock) {
                                    await updateInventoryStock(
                                        mutation.itemCode,
                                        mutation.itemName,
                                        -qtyChange,
                                        'pcs',
                                        'Mutation Rollback',
                                        mutation.pengajuanNumber,
                                        0,
                                        {
                                            pengajuanId: mutation.pengajuanId,
                                            pengajuanNumber: mutation.pengajuanNumber,
                                            packageNumber: mutation.packageNumber
                                        }
                                    );
                                }
                            } catch (rollbackError) {
                                console.error('Failed to restore warehouse stock after mutation log error:', rollbackError);
                                throw new Error(`Mutasi gagal dicatat dan stok gagal dipulihkan: ${rollbackError.message}`);
                            }
                        }
                        throw logError;
                    }
                }

                // Update the original quotation items, not the expanded source-location rows.
                const updatedPackages = applyMutationTracking(
                    selectedPengajuan.packages || [],
                    mutations,
                    mutationLogs,
                    qNumber
                );

                if (selectedPengajuan.isWarehouseFallback) {
                    console.log('✅ Mutasi tersimpan langsung ke log dan stok inventaris warehouse');
                } else {
                    // Save updated quotation with mutation tracking
                    await updateQuotation(qId, { packages: updatedPackages });
                    console.log('✅ Quotation updated with mutation labels');
                }
            }

            console.log('✅ Mutasi berhasil disimpan:', mutations.length, 'records');

            // Create approval request for monitoring in Approval Manager
            if (requestApproval && mutations.length > 0) {
                const userName = user?.full_name || user?.username || 'User';
                const userId = user?.id || null;
                const mutationTypes = [...new Set(mutations.map(m => m._type))];
                const typeLabel = mutationTypes.includes('outbound') && mutationTypes.includes('inbound')
                    ? 'mutation_out' : mutationTypes.includes('inbound') ? 'mutation_in' : 'mutation_out';

                const mutationSummary = mutations.map(m =>
                    `${m.itemName}: ${m.mutatedQty} ${m.uom || 'pcs'} (${
                        m._type === 'outbound' ? 'Keluar' : m._type === 'inbound' ? 'Masuk' : 'Pindah'
                    })`
                ).join(', ');

                try {
                    await requestApproval(
                        typeLabel,
                        'Bridge',
                        'Mutation',
                        qId,
                        qNumber,
                        {
                            items: mutations.map(m => ({
                                itemCode: m.itemCode,
                                itemName: m.itemName,
                                qty: m.mutatedQty,
                                type: m._type,
                                origin: m.origin,
                                destination: m.destination,
                                date: m.date,
                                pic: m.pic
                            })),
                            totalItems: mutations.length,
                            location: mutationData.mutationLocation || DEFAULT_LOCATION
                        },
                        `Mutasi ${mutations.length} item: ${mutationSummary}`,
                        userName,
                        userId
                    );
                    console.log('📋 Approval request created for mutation tracking');
                } catch (approvalErr) {
                    console.warn('⚠️ Failed to create approval request (non-critical):', approvalErr);
                }
            }

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

                // 1. Find outbound MUTATIONS (semua lokasi non-warehouse/gudang)
                const mutationsOut = mutationLogs.filter(m =>
                    (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
                    normalize(m.itemCode) === normalize(item.itemCode) &&
                    normalize(m.packageNumber) === normalize(pkg.packageNumber) &&
                    (itemName ? (normalize(m.itemName) === normalize(itemName) || normalize(m.assetName) === normalize(itemName)) : true) &&
                    (m.destination || '') &&
                    (m.destination || '').toLowerCase() !== 'warehouse' &&
                    (m.destination || '').toLowerCase() !== 'gudang'
                );

                // 2. Find official OUTBOUND TRANSACTIONS (freight_outbound)
                // STRICT ISOLATION: Only match if source reference explicitly matches this pengajuan
                const officialOutbound = outboundTransactions.filter(o => {
                    // Must have explicit source reference to this pengajuan
                    const matchSource = (normalize(o.documents?.source_pengajuan_number) === normalize(pengajuanNumber)) ||
                        (o.pengajuan_id === pengajuanId);

                    // Must match the item
                    const matchItem = normalize(o.item_code) === normalize(item.itemCode) &&
                        (pkg.packageNumber ? normalize(o.documents?.packageNumber) === normalize(pkg.packageNumber) : true);

                    // STRICT: Must match BOTH source reference AND item - no fallback to prevent cross-contamination
                    return matchSource && matchItem;
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
                const totalReturned = returnMutations.reduce((sum, m) => sum + (m.mutatedQty || 0), 0);

                // Net barang di luar = keluar - kembali
                const netAtPameran = Math.max(0, totalMutationOut - totalReturned);

                // Remaining in Warehouse = Initial - Net di Luar (no double-count dari officialOutbound)
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
    const getIndividualItemStatus = (itemCode, packageNumber, itemName, warehouseInventoryId, pengajuan = selectedPengajuan) => {
        if (!pengajuan) return { atPameran: 0, totalOutbound: 0, totalReturned: 0, officialOutbound: 0, totalDeducted: 0 };

        const pengajuanNumber = pengajuan.quotationNumber || pengajuan.quotation_number;
        const pengajuanId = pengajuan.id;
        const warehouseAvailable = getWarehouseStock(warehouseInventory, {
            submissionId: pengajuanId,
            submissionNumber: pengajuanNumber,
            packageNumber,
            itemCode,
            warehouseInventoryId,
            preferInventoryId: pengajuan.isWarehouseFallback
        });

        // Helper: is this destination "outside" (non-warehouse, non-gudang)?
        const isOutsideDestination = (dest) => {
            if (!dest) return false;
            const d = dest.toString().toLowerCase().trim();
            return d !== 'warehouse' && d !== 'gudang';
        };

        const itemMutations = mutationLogs.filter(m =>
            (m.pengajuanId === pengajuanId || normalize(m.pengajuanNumber) === normalize(pengajuanNumber)) &&
            normalize(m.itemCode) === normalize(itemCode) &&
            (packageNumber ? normalize(m.packageNumber) === normalize(packageNumber) : true)
        );

        // 2. OFFICIAL OUTBOUND (freight_outbound) - used only for display/reporting, NOT for stock deduction
        // to avoid double-counting with mutation logs
        const officialOutbound = outboundTransactions.filter(o => {
            const sourceRef = o.documents?.source_pengajuan_number || '';
            const docPackage = o.documents?.packageNumber;

            const isItemMatch = normalize(o.item_code) === normalize(itemCode);
            if (!isItemMatch) return false;

            const matchSource = (normalize(sourceRef) === normalize(pengajuanNumber)) ||
                (o.pengajuan_id === pengajuanId);

            const matchPackage = packageNumber && docPackage
                ? normalize(docPackage) === normalize(packageNumber)
                : true;

            return matchSource && matchPackage;
        });

        const totalMutationOut = itemMutations.reduce((sum, m) =>
            sum + (['warehouse', 'gudang'].includes(normalize(m.origin)) && isOutsideDestination(m.destination)
                ? (Number(m.mutatedQty) || 0) : 0), 0);
        const totalOfficialOut = officialOutbound.reduce((sum, o) => sum + (parseInt(o.quantity) || 0), 0);
        const totalReturned = itemMutations.reduce((sum, m) =>
            sum + (isOutsideDestination(m.origin) && ['warehouse', 'gudang'].includes(normalize(m.destination))
                ? (Number(m.mutatedQty) || 0) : 0), 0);
        const netAtPameran = getExternalLocationBalances(itemMutations)
            .reduce((sum, location) => sum + location.quantity, 0);

        return {
            atPameran: netAtPameran,             // barang sedang di luar gudang (semua lokasi)
            totalOutbound: totalMutationOut,      // total pernah keluar
            totalOfficialOut: totalOfficialOut,   // untuk display saja
            totalReturned,
            // Untuk deduction stok: hanya pakai net dari mutation logs (tidak double-count outbound transactions)
            totalDeducted: netAtPameran,
            warehouseAvailable
        };
    };

    // Handle delete all mutations for an item
    const handleDeleteMutations = async (itemCode, packageNumber) => {
        if (!hasDelete) {
            alert(t("Anda tidak memiliki izin untuk menghapus mutasi"));
            return;
        }
        if (!deleteMutationLog) {
            alert(t("Fungsi hapus tidak tersedia"));
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
        if (!canClearAll) {
            alert(t("Anda tidak memiliki izin untuk menghapus mutasi"));
            return;
        }
        if (!deleteMutationLog) {
            alert(t("Fungsi hapus tidak tersedia"));
            return;
        }

        const pengajuanNumber = selectedPengajuan?.quotationNumber || selectedPengajuan?.quotation_number;

        // Count total mutations
        const allMutations = mutationLogs.filter(m =>
            m.pengajuanNumber === pengajuanNumber
        );

        if (allMutations.length === 0) {
            alert(t("Tidak ada data mutasi untuk dihapus"));
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

            alert(t("Semua data mutasi berhasil dihapus"));
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
                    <div className="text-silver-dark animate-pulse">{t("Memuat Editor Mutasi...")}</div>
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">{t("Inventaris Gudang")}</h1>
                    <p className="text-silver-dark mt-1">{t("Data Barang Masuk dari Pengajuan yang Disetujui")}</p>
                </div>
                <Button onClick={handleExportCSV} variant="secondary" icon={Download}>{t("Export CSV")}</Button>
            </div>

            {/* Search */}
            <div className="glass-card p-4 rounded-lg">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-silver-dark w-5 h-5" />
                    <input
                        type="text"
                        placeholder={t("Cari berdasarkan no. pengajuan, no. dokumen pabean, atau customer...")}
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
                                <th className="px-2 py-1 text-left text-xs font-semibold text-white whitespace-nowrap">{t("No. Pengajuan")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("No. Pabean")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Tgl Masuk Gudang")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Jam Masuk")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Durasi")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Jml Package")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Jml Item")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("Stok Gudang")}</th>
                                <th className="px-2 py-1 text-center text-xs font-semibold text-white whitespace-nowrap">{t("PIC Penerima")}</th>
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
                                        {(() => {
                                            const days = calculateDaysDifference(pengajuan.submissionDate || pengajuan.submission_date || pengajuan.date);
                                            const status = getAgingStatus(days);
                                            return (
                                                <td className={`px-2 py-0.5 text-xs text-center whitespace-nowrap font-medium ${status.color}`}>
                                                    {status.isAlert && <AlertCircle className="w-3 h-3 inline mr-1" />}
                                                    {days} {t("Hari")}
                                                </td>
                                            );
                                        })()}
                                        <td className="px-2 py-0.5 text-xs text-accent-blue font-bold text-center">{packageCount}</td>
                                        <td className="px-2 py-0.5 text-xs text-accent-blue font-bold text-center">{itemCount}</td>
                                        <td className={`px-2 py-0.5 text-xs font-bold text-center ${getCurrentWarehouseStock(pengajuan) === 0 ? 'text-red-400' : 'text-green-400'}`}>{getCurrentWarehouseStock(pengajuan)}</td>
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
                        <p className="text-silver-dark">{t("Belum ada data inventaris gudang")}</p>
                    </div>
                )}
            </div>


            {/* Detail Inventory Modal */}
            {
                selectedPengajuan && displayData && !showMutationModal && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-2" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-[98vw] h-[94vh] max-h-[94vh] overflow-hidden shadow-xl flex flex-col">
                            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("Detail Inventaris")}</h2>
                                    <p className="text-sm text-gray-500 dark:text-silver-dark">{selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isEditing ? (
                                        <>
                                            {/* Only show mutation buttons for inbound pengajuan */}
                                            {selectedPengajuan.type !== 'outbound' && (
                                                <>
                                                    {canClearAll && !selectedPengajuan.isWarehouseFallback && (
                                                        <Button onClick={handleDeleteAllMutations} variant="secondary" icon={Trash2} className="text-sm text-red-600 hover:text-red-800">{t("Hapus Mutasi")}</Button>
                                                    )}
                                                    {hasEdit && (
                                                        <Button onClick={() => handleStartMutation(selectedPengajuan)} variant="primary" icon={ArrowRightLeft} className="text-sm">{t("Mutasi")}</Button>
                                                    )}
                                                </>
                                            )}
                                            {hasEdit && (
                                                <Button onClick={handleStartEdit} variant="secondary" icon={Edit2} className="text-sm">{t("Kelola")}</Button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Button onClick={handleCancelEdit} variant="secondary" icon={XCircle} className="text-sm">{t("Batal")}</Button>
                                            <Button onClick={handleSaveEdit} variant="primary" icon={Save} className="text-sm">{t("Simpan")}</Button>
                                        </>
                                    )}
                                    <button onClick={handleCloseDetail} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                                </div>
                            </div>

                            {/* Data Inventaris Section Title */}
                            <div className="flex-shrink-0 px-4 pt-4 pb-2">
                                <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">{t("📦 Data Inventaris")}</h3>
                            </div>

                            {/* Draft Recovery Prompt */}
                            {showDraftRecovery && draftData && (
                                <div className="flex-shrink-0 px-4 pb-2">
                                    <DraftRecoveryPrompt
                                        draftTime={formatDraftTimestamp(draftData.timestamp)}
                                        pengajuanNumber={selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}
                                        onRecover={handleRecoverDraft}
                                        onDiscard={handleDiscardDraft}
                                    />
                                </div>
                            )}

                            {/* Header Table */}
                            <div className="flex-shrink-0 px-4 pb-4 border-b border-gray-200 dark:border-dark-border">
                                <div className="overflow-x-auto border border-gray-200 dark:border-dark-border rounded-lg">
                                    <table className="w-full">
                                        <thead className={selectedPengajuan.type === 'outbound' ? 'bg-accent-purple' : 'bg-accent-blue'}>
                                            <tr>
                                                <th className="px-2 py-1 text-left text-xs font-semibold text-white">{t("No. Pengajuan")}</th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">{t("No. Pabean")}</th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                    {selectedPengajuan.type === 'outbound' ? 'Tgl Keluar Gudang' : 'Tgl Masuk Gudang'}
                                                </th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                    {selectedPengajuan.type === 'outbound' ? 'Jam Keluar' : 'Jam Masuk'}
                                                </th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">{t("Jml Package")}</th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">{t("Jml Item")}</th>
                                                <th className="px-2 py-1 text-center text-xs font-semibold text-white">
                                                    {selectedPengajuan.type === 'outbound' ? 'PIC yang Mengeluarkan' : 'PIC Penerima'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-white dark:bg-dark-card">
                                                <td className="px-2 py-0.5 text-xs text-gray-900 dark:text-silver-light font-semibold">{displayData.quotationNumber || displayData.quotation_number || '-'}</td>
                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                    {isEditing && selectedPengajuan.isWarehouseFallback
                                                        ? <input type="text" value={editData.bcDocumentNumber || editData.bc_document_number || ''} onChange={(e) => setEditData({ ...editData, bcDocumentNumber: e.target.value, bc_document_number: e.target.value })} className="w-32 px-1 py-0.5 text-xs border rounded text-center" />
                                                        : (displayData.bcDocumentNumber || displayData.bc_document_number || '-')}
                                                </td>
                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                    {isEditing ? <input type="date" value={editData.submissionDate || editData.submission_date || ''} onChange={(e) => setEditData({ ...editData, submissionDate: e.target.value })} className="px-1 py-0.5 text-xs border rounded" /> : formatDate(displayData.submissionDate || displayData.submission_date)}
                                                </td>
                                                <td className="px-2 py-0.5 text-xs text-gray-700 dark:text-silver text-center">
                                                    {isEditing ? (
                                                        <input
                                                            type="time"
                                                            value={entryTime || ''}
                                                            onChange={e => setEntryTime(e.target.value)}
                                                            className="px-1 py-0.5 text-xs border rounded"
                                                        />
                                                    ) : formatTime(displayData.approvedDate || displayData.approved_date)}
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

                            {/* Monitoring Durasi & Timeline Section */}
                            <div className={isEditing ? 'hidden' : 'flex-shrink-0 px-3 pt-2 pb-2 border-b border-gray-200 dark:border-dark-border'}>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-silver-light mb-2">{t("⏱️ Monitoring Durasi & Timeline")}</h3>

                                {(() => {
                                    const entryDate = displayData.submissionDate || displayData.submission_date || displayData.date;
                                    const days = calculateDaysDifference(entryDate);
                                    const status = getAgingStatus(days);
                                    const locationInfo = getItemsByLocation(displayData);

                                    // Get all mutations for this pengajuan to build timeline
                                    const pengajuanNumber = displayData.quotationNumber || displayData.quotation_number;
                                    const pengajuanId = displayData.id;
                                    const allMutations = mutationLogs.filter(m =>
                                        m.pengajuanId === pengajuanId ||
                                        normalize(m.pengajuanNumber) === normalize(pengajuanNumber)
                                    ).sort((a, b) => new Date(b.date) - new Date(a.date));

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {/* Aging Status Card */}
                                            <div className="glass-card p-2 rounded-lg border-l-4" style={{ borderLeftColor: status.color.replace('text-', '#') }}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-silver-light">{t("Status Aging")}</h4>
                                                    {status.isAlert && <AlertCircle className={`w-4 h-4 ${status.color}`} />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600 dark:text-silver-dark">{t("Tanggal Masuk:")}</span>
                                                        <span className="text-xs font-semibold text-gray-900 dark:text-silver-light">{formatDate(entryDate)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600 dark:text-silver-dark">{t("Jam Masuk:")}</span>
                                                        <span className="text-xs font-semibold text-gray-900 dark:text-silver-light">{formatTime(displayData.approvedDate || displayData.approved_date)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-dark-border">
                                                        <span className="text-xs text-gray-600 dark:text-silver-dark">{t("Durasi di Gudang:")}</span>
                                                        <span className={`text-base font-bold ${status.color}`}>{days} {t("Hari")}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Location Breakdown Card */}
                                            <div className="glass-card p-2 rounded-lg">
                                                <h4 className="text-xs font-semibold text-gray-700 dark:text-silver-light mb-1">{t("Distribusi Lokasi")}</h4>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600 dark:text-silver-dark">{t("Total Item:")}</span>
                                                        <span className="text-xs font-bold text-accent-blue">{locationInfo.totalItems}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-green-600 dark:text-green-400">{t("📦 Di Gudang:")}</span>
                                                        <span className="text-xs font-bold text-green-700 dark:text-green-400">{locationInfo.itemsInWarehouse}</span>
                                                    </div>
                                                    {locationInfo.itemsAtPameran > 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-orange-600 dark:text-orange-400">🎪 Di {getExhibitionLocation ? getExhibitionLocation() : DEFAULT_LOCATION}:</span>
                                                            <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{locationInfo.itemsAtPameran}</span>
                                                        </div>
                                                    )}
                                                    {(locationInfo.totalItems - locationInfo.itemsInWarehouse - locationInfo.itemsAtPameran) > 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-purple-600 dark:text-purple-400">{t("📤 Keluar:")}</span>
                                                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                                                                {locationInfo.totalItems - locationInfo.itemsInWarehouse - locationInfo.itemsAtPameran}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Activity Timeline Card */}
                                            <div className="glass-card p-2 rounded-lg">
                                                <h4 className="text-xs font-semibold text-gray-700 dark:text-silver-light mb-1">{t("Aktivitas & Frekuensi")}</h4>
                                                {allMutations.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {/* Mutation Statistics */}
                                                        {(() => {
                                                            // Calculate mutation frequencies
                                                            const toPameran = allMutations.filter(m =>
                                                                (m.destination || '').toLowerCase() === DEFAULT_LOCATION.toLowerCase()
                                                            );
                                                            const toGudang = allMutations.filter(m =>
                                                                (m.destination || '').toLowerCase() === 'gudang' ||
                                                                (m.destination || '').toLowerCase() === 'warehouse'
                                                            );
                                                            const toOther = allMutations.filter(m => {
                                                                const dest = (m.destination || '').toLowerCase();
                                                                return dest !== DEFAULT_LOCATION.toLowerCase() && dest !== 'gudang' && dest !== 'warehouse';
                                                            });

                                                            return (
                                                                <div className="grid grid-cols-3 gap-1 pb-1 border-b border-gray-200 dark:border-dark-border">
                                                                    {/* Pameran Counter */}
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">{DEFAULT_LOCATION}</div>
                                                                        <div className="text-base font-bold text-orange-700 dark:text-orange-300">{toPameran.length}x</div>
                                                                    </div>
                                                                    {/* Gudang Counter */}
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] text-green-600 dark:text-green-400 font-medium">{t("Kembali")}</div>
                                                                        <div className="text-base font-bold text-green-700 dark:text-green-300">{toGudang.length}x</div>
                                                                    </div>
                                                                    {/* Other Counter */}
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">{t("Lainnya")}</div>
                                                                        <div className="text-base font-bold text-purple-700 dark:text-purple-300">{toOther.length}x</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Recent Activity Timeline */}
                                                        <div className="space-y-1 max-h-14 overflow-y-auto">
                                                            {allMutations.slice(0, 3).map((mutation, idx) => {
                                                                const dest = (mutation.destination || '').toLowerCase();
                                                                const isPameran = dest === DEFAULT_LOCATION.toLowerCase();
                                                                const isGudang = dest === 'gudang' || dest === 'warehouse';
                                                                const dotColor = isPameran ? 'bg-orange-500' : isGudang ? 'bg-green-500' : 'bg-purple-500';

                                                                return (
                                                                    <div key={idx} className="flex items-start gap-2 text-xs">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`}></div>
                                                                        <div className="flex-1">
                                                                            <div className="flex justify-between items-start">
                                                                                <span className="font-medium text-gray-700 dark:text-silver-light">
                                                                                    {mutation.mutatedQty}x → {mutation.destination}
                                                                                </span>
                                                                                <span className="text-gray-500 dark:text-silver-dark text-[10px]">
                                                                                    {formatDate(mutation.date)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-gray-500 dark:text-silver-dark text-[10px]">
                                                                                {mutation.itemCode} • {mutation.pic || 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {allMutations.length > 3 && (
                                                                <div className="text-center pt-1">
                                                                    <span className="text-[10px] text-accent-blue cursor-pointer hover:underline">
                                                                        +{allMutations.length - 3} {t("aktivitas lainnya")}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-2">
                                                        <p className="text-xs text-gray-500 dark:text-silver-dark">{t("Belum ada aktivitas mutasi")}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Detail Item Section Title */}
                            <div className="flex-shrink-0 px-4 pt-3 pb-2">
                                <h3 className="text-base font-bold text-gray-800 dark:text-silver-light">{t("📝 Detail Item")}</h3>
                            </div>

                            {/* Detail Items */}
                            <div className="flex-1 min-h-0 px-3 pb-3 overflow-y-auto space-y-3">
                                {isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback && (
                                    <p className="text-xs text-gray-600 dark:text-silver-dark">
                                        {t("Geser tabel ke kanan untuk melihat seluruh kolom mutasi.")}
                                    </p>
                                )}
                                {(displayData.packages || []).map((pkg, pkgIndex) => (
                                    <div key={pkgIndex} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 dark:bg-dark-surface px-3 py-2 border-b border-gray-200 dark:border-dark-border">
                                            <span className="text-sm font-semibold text-gray-700 dark:text-silver-light">{t("Kode Packing:")} {pkg.packageNumber || `PKG-${pkgIndex + 1}`}</span>
                                        </div>
                                        <div className="max-w-full overflow-x-auto overscroll-x-contain">
                                            <table className={`warehouse-detail-table w-full ${isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback ? 'min-w-[1500px]' : 'min-w-[920px]'}`}>
                                                <thead className={selectedPengajuan.type === 'outbound' ? 'bg-accent-purple' : 'bg-accent-blue'}>
                                                    <tr>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-8" style={{ fontWeight: 'bold' }}>No.</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-20" style={{ fontWeight: 'bold' }}>{t("Kode Brg")}</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-16" style={{ fontWeight: 'bold' }}>HS</th>
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white" style={{ fontWeight: 'bold' }}>{t("Item")}</th>
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-12" style={{ fontWeight: 'bold' }}>{t("Awal")}</th>
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-12" style={{ fontWeight: 'bold' }}>{t("Sat")}</th>
                                                        {isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback && (
                                                            <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-green-700 w-16" style={{ fontWeight: 'bold' }}>{t("Stok")}</th>
                                                        )}
                                                        <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white w-28" style={{ fontWeight: 'bold' }}>{t("Status")}</th>
                                                        { /* Lokasi removed from here */}
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-14" style={{ fontWeight: 'bold' }}>{t("Kondisi")}</th>
                                                        {/* Mutation columns - only in edit mode for inbound */}
                                                        {isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback && (
                                                            <>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-700 w-16" style={{ fontWeight: 'bold' }}>{t("Keluar")}</th>
                                                                {/* New Outbound Details */}
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-24">{t("Tgl Keluar")}</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-16">{t("Jam")}</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-red-800 w-20">PIC</th>

                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-700 w-16" style={{ fontWeight: 'bold' }}>{t("Kembali")}</th>
                                                                {/* New Inbound Details */}
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-24">{t("Tgl Kembali")}</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-16">{t("Jam")}</th>
                                                                <th className="px-1 py-0.5 text-center text-xs font-bold whitespace-nowrap text-white bg-blue-800 w-20">PIC</th>
                                                            </>
                                                        )}
                                                        <th className="px-1 py-0.5 text-left text-xs font-bold whitespace-nowrap text-white w-full" style={{ fontWeight: 'bold' }}>{t("Keterangan")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                    {(pkg.items || []).map((item, itemIdx) => {
                                                        const itemName = item.name || item.itemName;
                                                        const mutationInfo = getItemMutationInfo(item.itemCode, pkg.packageNumber, itemName);
                                                        const itemStatus = getIndividualItemStatus(item.itemCode, pkg.packageNumber, itemName, item.warehouseInventoryId);
                                                        // Use totalDeducted to account for official outbound
                                                        const inWarehouse = itemStatus.warehouseAvailable ??
                                                            (item.quantity || 0) - (itemStatus.totalDeducted || itemStatus.atPameran);
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
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">
                                                                    {isEditing && selectedPengajuan.isWarehouseFallback
                                                                        ? <input type="text" value={item.itemCode || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'itemCode', e.target.value)} className="w-24 px-1 py-0 text-xs border rounded" />
                                                                        : (item.itemCode || '-')}
                                                                </td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">{(item.hsCode || '-')}</td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver max-w-[250px] break-words">
                                                                    {isEditing && selectedPengajuan.isWarehouseFallback
                                                                        ? <input type="text" value={item.name || item.itemName || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'name', e.target.value)} className="w-40 px-1 py-0 text-xs border rounded" />
                                                                        : (item.name || item.itemName || '-')}
                                                                </td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver text-center">
                                                                    {isEditing && selectedPengajuan.isWarehouseFallback
                                                                        ? <input type="number" min="0" value={item.quantity ?? 0} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} className="w-16 px-1 py-0 text-xs border rounded text-center" />
                                                                        : <span className="font-semibold">{item.quantity || 0}</span>}
                                                                </td>
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver text-center">
                                                                    {isEditing && selectedPengajuan.isWarehouseFallback
                                                                        ? <input type="text" value={item.uom || 'pcs'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'uom', e.target.value)} className="w-14 px-1 py-0 text-xs border rounded text-center" />
                                                                        : (item.uom || 'pcs')}
                                                                </td>
                                                                {isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback && (
                                                                    <td className="px-1 py-0 text-xs text-center bg-green-50 font-bold text-green-700">
                                                                        {projectedSisa}
                                                                    </td>
                                                                )}
                                                                <td className="px-1 py-1 text-xs text-left align-top">
                                                                    <div className="flex flex-col gap-1 items-start">
                                                                        {/* Warehouse */}
                                                                        <div className="flex items-center justify-between w-full min-w-[70px] bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-100 dark:border-green-800/50">
                                                                            <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">{t("Gudang")}</span>
                                                                            <span className="text-[10px] font-bold text-green-800 dark:text-green-300">{inWarehouse}</span>
                                                                        </div>

                                                                        {/* Exhibition / Hall */}
                                                                        {itemStatus.atPameran > 0 && (
                                                                            <div className="flex items-center justify-between w-full min-w-[70px] bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800/50">
                                                                                <span className="text-[10px] text-orange-700 dark:text-orange-400 font-medium">{DEFAULT_LOCATION}</span>
                                                                                <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300">{itemStatus.atPameran}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* Keluar */}
                                                                        {itemStatus.totalOfficialOut > 0 && (
                                                                            <div className="flex items-center justify-between w-full min-w-[70px] bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800/50">
                                                                                <span className="text-[10px] text-purple-700 dark:text-purple-400 font-medium">{t("Keluar")}</span>
                                                                                <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300">{itemStatus.totalOfficialOut}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {/* <td ... Lokasi removed from here ... ></td> */}
                                                                <td className="px-1 py-0 text-xs text-gray-700 dark:text-silver">{isEditing ? <select value={item.condition || 'Baik'} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'condition', e.target.value)} className="px-1 py-0 text-xs border rounded"><option value="Baik">{t("Baik")}</option><option value="Rusak">{t("Rusak")}</option><option value="Cacat">{t("Cacat")}</option></select> : (item.condition || 'Baik')}</td>
                                                                {/* Mutation columns - only in edit mode for inbound */}
                                                                {isEditing && selectedPengajuan.type !== 'outbound' && !selectedPengajuan.isWarehouseFallback && (
                                                                    <>
                                                                        {/* Keluar Cols */}
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={maxKeluar}
                                                                                value={keluarQty}
                                                                                onChange={(e) => {
                                                                                    let val = parseInt(e.target.value) || 0;
                                                                                    if (val < 0) val = 0;
                                                                                    if (val > maxKeluar) val = maxKeluar;
                                                                                    handleItemChange(pkgIndex, itemIdx, 'mutationOutQty', val);
                                                                                }}
                                                                                className={`w-16 px-2 py-1 text-sm border rounded text-center ${maxKeluar > 0 ? 'border-red-300 bg-white' : 'border-gray-300 bg-gray-200 cursor-not-allowed'}`}
                                                                                disabled={maxKeluar === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="date" className="w-[130px] px-2 py-1 text-xs border border-red-200 rounded"
                                                                                value={item.mutationDateOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationDateOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="time" className="w-[95px] px-2 py-1 text-xs border border-red-200 rounded"
                                                                                value={item.mutationTimeOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationTimeOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-red-50">
                                                                            <input type="text" className="w-[110px] px-2 py-1 text-xs border border-red-200 rounded" placeholder="PIC"
                                                                                value={item.mutationPicOut || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationPicOut', e.target.value)}
                                                                                disabled={keluarQty === 0}
                                                                            />
                                                                        </td>

                                                                        {/* Kembali Cols */}
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={maxKembali}
                                                                                value={kembaliQty}
                                                                                onChange={(e) => {
                                                                                    let val = parseInt(e.target.value) || 0;
                                                                                    if (val < 0) val = 0;
                                                                                    if (val > maxKembali) val = maxKembali;
                                                                                    handleItemChange(pkgIndex, itemIdx, 'mutationInQty', val);
                                                                                }}
                                                                                className={`w-16 px-2 py-1 text-sm border rounded text-center ${maxKembali > 0 ? 'border-blue-300 bg-white' : 'border-gray-300 bg-gray-200 cursor-not-allowed'}`}
                                                                                disabled={maxKembali === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="date" className="w-[130px] px-2 py-1 text-xs border border-blue-200 rounded"
                                                                                value={item.mutationDateIn || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationDateIn', e.target.value)}
                                                                                disabled={kembaliQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="time" className="w-[95px] px-2 py-1 text-xs border border-blue-200 rounded"
                                                                                value={item.mutationTimeIn || ''}
                                                                                onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'mutationTimeIn', e.target.value)}
                                                                                disabled={kembaliQty === 0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-1 py-0 text-xs text-center bg-blue-50">
                                                                            <input type="text" className="w-[110px] px-2 py-1 text-xs border border-blue-200 rounded" placeholder="PIC"
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
                                                                            <input type="text" value={item.notes || ''} onChange={(e) => handleItemChange(pkgIndex, itemIdx, 'notes', e.target.value)} className="w-36 px-2 py-1 text-xs border rounded" placeholder={t("Catatan...")} />
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
                                                                                {t("KELUAR")}
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
                                                                                {t("MUTASI")}
                                                                            </span>
                                                                            <span className="text-[9px] text-orange-600 dark:text-orange-400 whitespace-nowrap">
                                                                                {mutationInfo.totalMutated}u → {mutationInfo.destination}
                                                                            </span>
                                                                            <button
                                                                                onClick={handleGoToPergerakan}
                                                                                className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                                                                            >
                                                                                <ExternalLink className="w-2.5 h-2.5" />
                                                                                {t("Detail")}
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
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-3" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <div className="bg-white dark:bg-dark-card rounded-xl w-full max-w-[98vw] h-[96vh] max-h-[96vh] overflow-hidden shadow-xl flex flex-col">
                            {/* Modal Header */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 sm:p-5 border-b border-gray-200 dark:border-dark-border bg-red-50 dark:bg-red-900/20 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">{t("Mutasi Barang")}</h2>
                                    <p className="text-base text-red-600 dark:text-red-500">{selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}</p>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <Button onClick={handleCloseMutation} variant="secondary" icon={XCircle} className="text-sm min-h-11">{t("Batal")}</Button>
                                    <Button onClick={handleSaveMutation} variant="danger" icon={Save} className="text-sm min-h-11">{t("Simpan Mutasi")}</Button>
                                    <button onClick={handleCloseMutation} className="p-2 hover:bg-red-100 rounded-lg"><X className="w-5 h-5 text-red-500" /></button>
                                </div>
                            </div>

                            {/* Mutation Header Table */}
                            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-dark-border shrink-0">
                                <div className="overflow-x-auto border border-gray-200 dark:border-dark-border rounded-lg">
                                    <table className="w-full min-w-[900px]">
                                        <thead className="bg-red-600">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-sm font-semibold text-white">{t("No. Pengajuan")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">{t("No. Pabean")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">{t("Tgl Masuk")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">{t("Jam Masuk")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">{t("Jml Pkg")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">{t("Jml Item")}</th>
                                                <th className="px-3 py-2 text-center text-sm font-semibold text-white">PIC</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-white dark:bg-dark-card">
                                                <td className="px-3 py-3 text-sm font-semibold">{mutationData.quotationNumber || mutationData.quotation_number || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-center">{mutationData.bcDocumentNumber || mutationData.bc_document_number || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-center">{formatDate(mutationData.submissionDate || mutationData.submission_date)}</td>
                                                <td className="px-3 py-3 text-sm text-center">{formatTime(mutationData.approvedDate || mutationData.approved_date)}</td>
                                                <td className="px-3 py-3 text-sm text-center font-bold">{countPackagesAndItems(mutationData).packageCount}</td>
                                                <td className="px-3 py-3 text-sm text-center font-bold">{countPackagesAndItems(mutationData).itemCount}</td>
                                                <td className="px-3 py-3 text-sm text-center">{mutationData.pic || '-'}</td>
                                                {/* Header-level mutation fields removed to move them to row level */}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mutation Body */}
                            <div className="p-3 sm:p-5 overflow-auto flex-1 min-h-0 space-y-4">
                                {(mutationData.packages || []).map((pkg, pkgIndex) => (
                                    <div key={pkgIndex} className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 dark:bg-dark-surface px-4 py-3 border-b border-gray-200 dark:border-dark-border">
                                            <span className="text-base font-semibold">{t("Kode Packing:")} {pkg.packageNumber || `PKG-${pkgIndex + 1}`}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1500px]">
                                                <thead className="bg-accent-blue">
                                                    <tr>
                                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white w-12">No.</th>
                                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white w-32">{t("Kode Brg")}</th>
                                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white min-w-[220px]">{t("Item")}</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white w-24">{t("Stok")}</th>
                                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white w-44">{t("Tujuan/Lokasi")}</th>
                                                        {/* Mutation columns */}
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-28">{t("Mutasi")}</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-24">{t("Sisa")}</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-40">{t("Tgl")}</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-32">{t("Jam")}</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-40">PIC</th>
                                                        <th className="px-3 py-3 text-center text-sm font-semibold text-white bg-red-700 w-36">{t("Dokumen")}</th>
                                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white w-56">{t("Keterangan")}</th>
                                                        <th className="sticky right-0 z-10 px-2 py-3 text-center text-sm font-semibold text-white w-20 bg-accent-blue">{t("Aksi")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                    {(pkg.items || []).map((item, itemIdx) => {
                                                        // Logic berdasarkan lokasi mutasi yang dipilih (per-item preferred)
                                                        const isFullyMutated = item.inWarehouse === 0 && item.atPameran === 0;

                                                        // Determine effective mutation location
                                                        // For warehouse rows: prefer item.mutationLocation but NEVER fallback to Gudang
                                                        const isWarehouseRow = String(item._replicaIndex).startsWith('warehouse');
                                                        let mutationLocation = item.mutationLocation || '';
                                                        if (!mutationLocation || (isWarehouseRow && String(mutationLocation).toLowerCase() === 'gudang')) {
                                                            // Warehouse rows should always go OUT, default to a non-Gudang location
                                                            const safeDefault = (() => {
                                                                const exhibLoc = getExhibitionLocation ? getExhibitionLocation() : null;
                                                                if (exhibLoc && String(exhibLoc).toLowerCase() !== 'gudang') return exhibLoc;
                                                                const nonGudang = LOCATION_OPTIONS.find(opt => opt.value.toLowerCase() !== 'gudang');
                                                                return nonGudang ? nonGudang.value : 'Hall 1';
                                                            })();
                                                            mutationLocation = isWarehouseRow ? safeDefault : (mutationData?.mutationLocation || DEFAULT_LOCATION);
                                                        }

                                                        // Determine which direction is active based on selected location
                                                        const isToGudang = String(mutationLocation).toLowerCase() === 'gudang'; // Remutasi: Exhibition -> Gudang
                                                        const isToOutbound = String(mutationLocation).toLowerCase() === 'outbound';

                                                        const sourceLocation = normalize(getMutationSourceLocation(item));
                                                        let sumOtherMutations = 0;
                                                        (pkg.items || []).forEach((otherItem, otherIdx) => {
                                                            if (
                                                                otherIdx !== itemIdx &&
                                                                otherItem._originalItemIdx === item._originalItemIdx &&
                                                                normalize(getMutationSourceLocation(otherItem)) === sourceLocation
                                                            ) {
                                                                sumOtherMutations += Number(otherItem.mutationQty) || 0;
                                                            }
                                                        });

                                                        const sourceStock = Number(isWarehouseRow ? item.inWarehouse : item.atPameran) || 0;
                                                        const maxMutasi = Math.max(0, sourceStock - sumOtherMutations);
                                                        const projectedStock = isWarehouseRow
                                                            ? sourceStock - sumOtherMutations - (Number(item.mutationQty) || 0)
                                                            : isToGudang
                                                                ? (Number(item.inWarehouse) || 0) + (Number(item.mutationQty) || 0)
                                                                : sourceStock - sumOtherMutations - (Number(item.mutationQty) || 0);
                                                        const isPrimaryRow = isWarehouseRow
                                                            ? item._replicaIndex === 'warehouse'
                                                            : normalize(item._replicaIndex) === sourceLocation;
                                                        const isMultiRow = String(item._replicaIndex).includes('_multi_');

                                                        return (
                                                            <tr key={itemIdx} className={`hover:bg-gray-50 dark:hover:bg-dark-surface/50 ${isFullyMutated ? 'opacity-75 bg-gray-50' : ''}`}>
                                                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-silver">{itemIdx + 1}</td>
                                                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-silver">{item.itemCode || '-'}</td>
                                                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-silver whitespace-normal">{item.name || item.itemName || '-'}</td>
                                                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-silver text-center">
                                                                    {sourceStock} {item.uom || 'pcs'}
                                                                    {!isWarehouseRow && (
                                                                        <div className="text-xs text-gray-500 dark:text-silver-dark">
                                                                            {t("Dari:")} {getMutationSourceLocation(item)}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 text-sm text-gray-700 dark:text-silver">
                                                                    <select
                                                                        value={mutationLocation}
                                                                        onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationLocation', e.target.value)}
                                                                        aria-label={`${t("Tujuan/Lokasi")} ${item.itemCode || ''}`}
                                                                        title={t("Pilih tujuan perpindahan")}
                                                                        className="w-full min-w-36 min-h-11 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-dark-surface dark:text-silver-light text-center cursor-pointer pointer-events-auto"
                                                                    >
                                                                        {LOCATION_OPTIONS.filter(opt => {
                                                                            const location = opt.value.toLowerCase();
                                                                            if (isWarehouseRow) return location !== 'gudang';
                                                                            return location !== 'outbound' && normalize(location) !== sourceLocation;
                                                                        }).map(opt => (
                                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                        ))}
                                                                        {isWarehouseRow && <option value="Outbound">{t("Outbound")}</option>}
                                                                    </select>
                                                                </td>

                                                                {/* Mutation input (Unified) */}
                                                                <td className="px-3 py-3 text-center border-r border-red-100 dark:border-red-900/20 bg-red-50 dark:bg-red-900/10">
                                                                    <div className="flex flex-col items-center">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={maxMutasi}
                                                                            value={item.mutationQty !== undefined ? item.mutationQty : 0}
                                                                            onChange={(e) => {
                                                                                const rawValue = e.target.value;
                                                                                if (rawValue === '') {
                                                                                    handleMutationItemChange(pkgIndex, itemIdx, 'mutationQty', '');
                                                                                    return;
                                                                                }
                                                                                let val = parseInt(rawValue);
                                                                                if (isNaN(val) || val < 0) val = 0;
                                                                                if (val > maxMutasi) val = maxMutasi;
                                                                                handleMutationItemChange(pkgIndex, itemIdx, 'mutationQty', val);
                                                                            }}
                                                                            className={`w-full max-w-24 min-h-11 px-3 py-2 text-base text-center border rounded-lg focus:ring-2 ${maxMutasi > 0 ? 'border-red-300 focus:ring-red-500 bg-white dark:bg-dark-surface dark:text-silver-light' : 'border-gray-300 bg-gray-200 cursor-not-allowed'}`}
                                                                            disabled={maxMutasi === 0}
                                                                        />
                                                                        <span className="text-xs mt-1 text-red-500">{t("Max:")} {maxMutasi}</span>
                                                                    </div>
                                                                </td>

                                                                {/* Total Saat Ini (Projected Warehouse Stock) */}
                                                                <td className="px-3 py-3 text-base text-center bg-red-50 dark:bg-red-900/10 font-bold text-gray-800 dark:text-gray-200">
                                                                    {projectedStock}
                                                                </td>

                                                                {/* Tgl Mutasi */}
                                                                <td className="px-2 py-3 text-sm text-center bg-red-50 dark:bg-red-900/10">
                                                                    <input type="date" value={item.mutationDate || ''} onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationDate', e.target.value)} className="w-full min-w-36 min-h-11 px-2 py-2 text-sm border border-red-300 rounded-lg dark:bg-dark-surface dark:text-silver-light" />
                                                                </td>
                                                                
                                                                {/* Jam Mutasi */}
                                                                <td className="px-2 py-3 text-sm text-center bg-red-50 dark:bg-red-900/10">
                                                                    <input type="time" value={item.mutationTime || ''} onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationTime', e.target.value)} className="w-full min-w-28 min-h-11 px-2 py-2 text-sm border border-red-300 rounded-lg dark:bg-dark-surface dark:text-silver-light" />
                                                                </td>
                                                                
                                                                {/* PIC Mutasi */}
                                                                <td className="px-2 py-3 text-sm text-center bg-red-50 dark:bg-red-900/10">
                                                                    <input type="text" value={item.mutationPic || ''} onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'mutationPic', e.target.value)} placeholder="PIC" className="w-full min-w-32 min-h-11 px-3 py-2 text-sm border border-red-300 rounded-lg dark:bg-dark-surface dark:text-silver-light" />
                                                                </td>

                                                                {/* Dokumen */}
                                                                <td className="px-2 py-3 text-sm text-center bg-red-50 dark:bg-red-900/10">
                                                                    <Button 
                                                                        onClick={() => setActiveDocumentRow({ pkgIndex, itemIdx })} 
                                                                        variant="secondary" 
                                                                        className="!px-3 !py-2 !text-sm min-h-11 w-full flex justify-center"
                                                                    >
                                                                        <Paperclip className="w-4 h-4 mr-2" /> {(item.mutationDocuments || []).length}/5
                                                                    </Button>
                                                                </td>

                                                                {/* Notes */}
                                                                <td className="px-2 py-3 text-sm bg-red-50 dark:bg-red-900/10">
                                                                    <textarea
                                                                        value={item.notes || ''}
                                                                        onChange={(e) => handleMutationItemChange(pkgIndex, itemIdx, 'notes', e.target.value)}
                                                                        rows={2}
                                                                        className="w-full min-w-48 min-h-11 px-3 py-2 text-sm border border-red-300 rounded-lg resize-y dark:bg-dark-surface dark:text-silver-light"
                                                                        placeholder={t("Keterangan mutasi...")}
                                                                    />
                                                                </td>
                                                                
                                                                {/* Aksi */}
                                                                <td className="sticky right-0 z-10 px-2 py-3 text-sm text-center border-l border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card">
                                                                    {!isFullyMutated && (isPrimaryRow || isMultiRow) && (
                                                                        <div className="flex gap-1 justify-center">
                                                                            {isPrimaryRow ? (
                                                                                <Button
                                                                                    onClick={() => handleAddMultiMutation(pkgIndex, itemIdx)}
                                                                                    variant="primary"
                                                                                    className="!p-2 min-h-11 min-w-11"
                                                                                    title={t("Tambah Lokasi Mutasi")}
                                                                                >
                                                                                    <Plus className="w-5 h-5" />
                                                                                </Button>
                                                                            ) : (
                                                                                <Button
                                                                                    onClick={() => handleRemoveMultiMutation(pkgIndex, itemIdx)}
                                                                                    variant="danger"
                                                                                    className="!p-2 min-h-11 min-w-11"
                                                                                    title={t("Hapus Baris")}
                                                                                >
                                                                                    <Trash2 className="w-5 h-5" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}

                                {/* Document Upload Modal per Row */}
                                {activeDocumentRow && (
                                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                                        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-300 dark:border-dark-border">
                                            <div className="bg-gray-100 dark:bg-dark-surface px-4 py-3 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                                                <div>
                                                    <span className="text-base font-semibold text-gray-800 dark:text-silver-light">{t("Dokumen Pendukung Mutasi")}</span>
                                                    <p className="text-xs text-gray-500">
                                                        {t("Item:")} {mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.itemName || mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.name}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" multiple className="hidden" />
                                                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" icon={Upload} className="text-xs" disabled={(mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || []).length >= 5}>
                                                        {t("Upload (")}{((mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || [])).length}/5)
                                                    </Button>
                                                    <button onClick={() => setActiveDocumentRow(null)} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4 overflow-y-auto">
                                                {!(mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || []).length ? (
                                                    <p className="text-sm text-gray-500 text-center py-8">{t("Belum ada dokumen pendukung. Klik Upload untuk menambahkan (JPG, PNG, PDF - Max 3MB).")}</p>
                                                ) : (
                                                    <table className="w-full">
                                                        <thead className="bg-gray-50 dark:bg-dark-surface">
                                                            <tr>
                                                                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-8">No</th>
                                                                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">{t("Judul Dokumen")}</th>
                                                                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">{t("Nama File")}</th>
                                                                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600">{t("Tipe")}</th>
                                                                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600">{t("Ukuran")}</th>
                                                                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 w-12">{t("Aksi")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                            {(mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || []).map((doc, idx) => (
                                                                <tr key={doc.id}>
                                                                    <td className="px-2 py-2 text-xs text-gray-700">{idx + 1}</td>
                                                                    <td className="px-2 py-2 text-xs">
                                                                        <input 
                                                                            type="text" 
                                                                            value={doc.title} 
                                                                            onChange={(e) => {
                                                                                const newDocs = [...(mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || [])];
                                                                                newDocs[idx] = { ...newDocs[idx], title: e.target.value };
                                                                                handleMutationItemChange(activeDocumentRow.pkgIndex, activeDocumentRow.itemIdx, 'mutationDocuments', newDocs);
                                                                            }} 
                                                                            placeholder={t("Masukkan judul...")} 
                                                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded" 
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2 text-xs text-gray-700 flex items-center gap-1">
                                                                        <FileText className="w-3 h-3" /> <span className="truncate max-w-[100px]">{doc.name}</span>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-xs text-gray-500 text-center uppercase">{doc.type.split('/')[1]}</td>
                                                                    <td className="px-2 py-2 text-xs text-gray-500 text-center">{(doc.size / 1024).toFixed(1)} KB</td>
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button onClick={() => {
                                                                            const newDocs = (mutationData?.packages[activeDocumentRow.pkgIndex]?.items[activeDocumentRow.itemIdx]?.mutationDocuments || []).filter(d => d.id !== doc.id);
                                                                            handleMutationItemChange(activeDocumentRow.pkgIndex, activeDocumentRow.itemIdx, 'mutationDocuments', newDocs);
                                                                        }} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default WarehouseInventory;
