import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fileToBase64, validateImage } from '../utils/validateImage';
import { useAuth } from './AuthContext';
import { getActiveDivision, canViewPartnerInDivision } from '../utils/divisionContext';

const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    // Centralized data state
    const [vendors, setVendors] = useState([]); // Deprecated: use businessPartners filtered by is_vendor
    const [customers, setCustomers] = useState([]); // Deprecated: use businessPartners filtered by is_customer
    const [businessPartners, setBusinessPartners] = useState([]); // NEW: Unified partner management
    const [finance, setFinance] = useState([]);
    
    // Company Settings by Module
    const [companySettings, setCompanySettings] = useState(null); // Blink/Central (default)
    const [bankAccounts, setBankAccounts] = useState([]); 
    
    const [bridgeSettings, setBridgeSettings] = useState(null);
    const [bridgeBankAccounts, setBridgeBankAccounts] = useState([]);
    
    const [bigSettings, setBigSettings] = useState(null);
    const [bigBankAccounts, setBigBankAccounts] = useState([]);

    // Module-specific data
    const [shipments, setShipments] = useState([]);
    const [assets, setAssets] = useState([]);
    const [events, setEvents] = useState([]);

    // Bridge TPPB specific data
    const [quotations, setQuotations] = useState([]);
    const [customsDocuments, setCustomsDocuments] = useState([]);
    const [goodsMovements, setGoodsMovements] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [itemMaster, setItemMaster] = useState([]);
    const [picMaster, setPicMaster] = useState([]);
    const [inboundTransactions, setInboundTransactions] = useState([]);
    const [outboundTransactions, setOutboundTransactions] = useState([]);
    const [rejectTransactions, setRejectTransactions] = useState([]);
    const [bridgeBusinessPartners, setBridgeBusinessPartners] = useState([]); // Bridge-specific partners
    const [locations, setLocations] = useState([]);

    // Activity Logs for audit tracking
    const [activityLogs, setActivityLogs] = useState([]);

    // Auth helpers (AuthProvider wraps DataProvider)
    const { isAdmin, canDelete } = useAuth();

    // Helper function to log activity
    const logActivity = (module, action, entityType, entityId, entityName, details, user = 'System User') => {
        const newLog = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            module,
            action,
            entityType,
            entityId,
            entityName,
            user,
            details
        };
        setActivityLogs(prev => [newLog, ...prev]);
    };

    // Pending Approvals (persisted to Supabase)
    const [pendingApprovals, setPendingApprovals] = useState([]);

    // Helper: normalize DB row -> camelCase for UI
    const normalizeApprovalRow = (row) => ({
        id: row.id,
        requestDate: row.created_at,
        type: row.type,
        module: row.module,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        requestedBy: row.requested_by_name,
        requestedById: row.requested_by_id,
        changes: row.changes || {},
        details: row.details || '',
        status: row.status,
        approvedBy: row.approved_by,
        approvalDate: row.approval_date,
        rejectionReason: row.rejection_reason,
        rejectionDate: row.rejection_date,
    });

    const requestApproval = async (type, module, entityType, entityId, entityName, changes, details, requestedBy = 'User', requestedById = null) => {
        const row = {
            type,
            module,
            entity_type: entityType,
            entity_id: String(entityId),
            entity_name: entityName,
            requested_by_id: requestedById,
            requested_by_name: requestedBy,
            changes: changes || {},
            details: details || '',
            status: 'pending',
        };
        const { data, error } = await supabase.from('approval_requests').insert([row]).select();
        if (error) {
            console.error('Error creating approval request:', error);
            // Fallback: in-memory only
            const fallback = { id: `approval-${Date.now()}`, requestDate: new Date().toISOString(), ...row, requestedBy, changes: changes || {}, details: details || '' };
            setPendingApprovals(prev => [normalizeApprovalRow({ ...row, id: fallback.id, created_at: fallback.requestDate }), ...prev]);
            logActivity(module, 'approval_request', entityType, entityId, entityName, `Requested ${type}: ${details}`, requestedBy);
            return fallback.id;
        }
        const created = data[0];
        setPendingApprovals(prev => [normalizeApprovalRow(created), ...prev]);
        logActivity(module, 'approval_request', entityType, entityId, entityName, `Requested ${type}: ${details}`, requestedBy);
        return created.id;
    };

    const approveRequest = async (requestId, approvedBy = 'Manager') => {
        const now = new Date().toISOString();
        const { error } = await supabase.from('approval_requests').update({
            status: 'approved',
            approved_by: approvedBy,
            approval_date: now,
        }).eq('id', requestId);
        if (error) console.error('Error approving request:', error);
        setPendingApprovals(prev => prev.map(req => req.id === requestId ? { ...req, status: 'approved', approvedBy, approvalDate: now } : req));
        const request = pendingApprovals.find(r => r.id === requestId);
        if (request) logActivity(request.module, 'approved', request.entityType, request.entityId, request.entityName, `Approved ${request.type}`, approvedBy);
    };

    const rejectRequest = async (requestId, rejectedBy = 'Manager', reason = '') => {
        const now = new Date().toISOString();
        const { error } = await supabase.from('approval_requests').update({
            status: 'rejected',
            rejection_reason: reason,
            rejection_date: now,
        }).eq('id', requestId);
        if (error) console.error('Error rejecting request:', error);
        setPendingApprovals(prev => prev.map(req => req.id === requestId ? { ...req, status: 'rejected', rejectionReason: reason, rejectionDate: now } : req));
        const request = pendingApprovals.find(r => r.id === requestId);
        if (request) logActivity(request.module, 'rejected', request.entityType, request.entityId, request.entityName, `Rejected: ${reason}`, rejectedBy);
    };

    const [warehouseInventory, setWarehouseInventory] = useState([]);
    const [mutationLogs, setMutationLogs] = useState([]);
    const [bcCodes, setBcCodes] = useState([]);
    const [hsCodes, setHSCodes] = useState([]); // HS Master State

    // Finance module data
    const [invoices, setInvoices] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [leads, setLeads] = useState([]);

    // Shared Helper: Map Quotation DB -> State
    const normalizeQuotation = (q) => ({
        ...q,
        quotationNumber: q.quotation_number,
        submissionDate: q.submission_date || q.date,
        documentStatus: q.document_status,
        customsStatus: q.customs_status,
        bcDocumentNumber: q.bc_document_number,
        bcDocumentDate: q.bc_document_date,
        bcDocType: q.bc_document_type,
        bcSupportingDocuments: q.bc_supporting_documents || [],
        approvedDate: q.approved_date,
        approvedBy: q.approved_by,
        rejectionReason: q.rejection_reason,
        rejectionDate: q.rejection_date,
        itemCode: q.item_code,
        // Outbound processing status
        outboundStatus: q.outbound_status || null,
        outboundDate: q.outbound_date || null,
        // Source Reference Fields (For Outbound History)
        sourcePengajuanId: q.source_pengajuan_id || null,
        sourcePengajuanNumber: q.source_pengajuan_number || null,
        sourceBcDocumentNumber: q.source_bc_document_number || null,
        sourceBcDocumentDate: q.source_bc_document_date || null,
        // Invoice / Currency fields
        invoiceNumber: q.invoice_number || q.invoiceNumber || null,
        invoiceValue: q.invoice_value || q.invoiceValue || null,
        invoiceCurrency: q.invoice_currency || q.invoiceCurrency || 'IDR',
        exchangeRate: q.exchange_rate || q.exchangeRate || null,
        exchangeRateDate: q.exchange_rate_date || q.exchangeRateDate || null,
        blNumber: q.bl_number || q.blNumber || null,
        blDate: q.bl_date || q.blDate || null,
        itemDate: q.item_date || q.itemDate || null,
    });

    // Shared Helper: Map Inbound DB -> State (freight_inbound schema)
    const mapInboundToState = (i) => {
        // Parse documents JSONB
        let parsedDocs = {};
        if (typeof i.documents === 'string') {
            try { parsedDocs = JSON.parse(i.documents); } catch (e) { parsedDocs = {}; }
        } else {
            parsedDocs = i.documents || {};
        }

        const items = parsedDocs.items || [];
        // Extract supporting documents to prevent UI crash when mapping
        const supportingDocs = parsedDocs.bcSupportingDocuments || [];

        return {
            ...i,
            // CamelCase aliases for UI
            pengajuanId: i.pengajuan_id,
            pengajuanNumber: i.pengajuan_number,
            customsDocNumber: i.customs_doc_number,
            customsDocDate: i.customs_doc_date,
            customsDocType: i.customs_doc_type,
            receiptNumber: i.receipt_number,
            itemCode: i.item_code,
            hsCode: i.hs_code,
            serialNumber: i.serial_number,
            currency: i.currency,
            quantity: i.quantity,
            unit: i.unit,
            value: i.value,
            sender: i.sender,
            assetName: i.asset_name,
            assetId: i.item_code,
            createdAt: i.created_at,
            date: i.date,
            // Items array for BarangMasuk.jsx flatMap
            items: items,
            // Use the extracted array for UI mapping
            documents: supportingDocs,
            // Keep original data just in case
            originalDocuments: i.documents
        };
    };

    // Shared Helper: Map Outbound DB -> State (freight_outbound schema)
    const mapOutboundToState = (o) => {
        // Parse documents JSONB
        let parsedDocs = {};
        if (typeof o.documents === 'string') {
            try { parsedDocs = JSON.parse(o.documents); } catch (e) { parsedDocs = {}; }
        } else {
            parsedDocs = o.documents || {};
        }

        const items = parsedDocs.items || [];
        // Extract supporting documents to prevent UI crash when mapping
        const supportingDocs = parsedDocs.bcSupportingDocuments || [];

        return {
            ...o,
            // CamelCase aliases for UI
            pengajuanId: o.pengajuan_id,
            pengajuanNumber: o.pengajuan_number,
            customsDocNumber: o.customs_doc_number,
            customsDocDate: o.customs_doc_date,
            customsDocType: o.customs_doc_type,
            receiptNumber: o.receipt_number,
            itemCode: o.item_code,
            hsCode: o.hs_code,
            serialNumber: o.serial_number,
            currency: o.currency,
            quantity: o.quantity,
            unit: o.unit,
            value: o.value,
            receiver: o.receiver,
            destination: o.destination,
            assetName: o.asset_name,
            assetId: o.item_code,
            createdAt: o.created_at,
            date: o.date,
            // Extracted Source Reference for Reconciliation
            sourcePengajuanNumber: parsedDocs.source_pengajuan_number,
            // Items array for BarangKeluar.jsx flatMap
            items: items,
            // Use the extracted array for UI mapping to prevent crash (.map on string)
            documents: supportingDocs,
            // Keep original data just in case
            originalDocuments: o.documents
        };
    };

    // Load data from localStorage on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                // Listen for external warehouse inventory updates
                const handleWarehouseUpdate = (event) => {
                    if (event.detail) {
                        setWarehouseInventory(event.detail);
                    }
                };
                window.addEventListener('updateWarehouseInventory', handleWarehouseUpdate);

                // Helper: Map Quotation DB -> State
                const mapQuotationToState = (q) => ({
                    ...q,
                    quotationNumber: q.quotation_number,
                    submissionDate: q.submission_date || q.date,
                    documentStatus: q.document_status,
                    customsStatus: q.customs_status,
                    bcDocumentNumber: q.bc_document_number,
                    bcDocumentDate: q.bc_document_date,
                    bcDocType: q.bc_document_type,
                    bcSupportingDocuments: q.bc_supporting_documents || [],
                    approvedDate: q.approved_date,
                    approvedBy: q.approved_by,
                    rejectionReason: q.rejection_reason,
                    rejectionDate: q.rejection_date,
                    itemCode: q.item_code,
                    // Outbound processing status
                    outboundStatus: q.outbound_status,
                    outboundDate: q.outbound_date,
                    // Source Reference Fields
                    sourcePengajuanNumber: q.source_pengajuan_number || null,
                    sourceBcDocumentNumber: q.source_bc_document_number || null,
                    sourceBcDocumentDate: q.source_bc_document_date || null,
                    // Keep original snake_case too just in case? Or rely on camelCase
                });

                // Helper: Map Warehouse DB -> State (freight_warehouse schema)
                const mapWarehouseToState = (w) => {
                    // Parse location if stored as string
                    let location = w.location;
                    if (typeof location === 'string') {
                        try { location = JSON.parse(location); } catch (e) { location = {}; }
                    }
                    return {
                        ...w,
                        // CamelCase aliases for UI
                        pengajuanId: w.pengajuan_id,
                        pengajuanNumber: w.pengajuan_number,
                        bcDocumentNumber: w.bc_document_number,
                        packageNumber: w.package_number,
                        itemCode: w.item_code,
                        itemName: w.item_name,
                        assetName: w.asset_name || w.item_name,
                        serialNumber: w.serial_number,
                        entryDate: w.entry_date,
                        submissionDate: w.submission_date,
                        location: location,
                        // Legacy compatibility
                        assetId: w.item_code,
                        currentStock: w.quantity,
                    };
                };

                // Load TPPB Workflow Data (Quotations, etc.)
                const { data: quotData, error: quotError } = await supabase.from('freight_quotations').select('*');
                if (quotError) console.error('Error fetching quotations:', quotError);
                else setQuotations((quotData || []).map(normalizeQuotation));

                // Load Warehouse Inventory
                const { data: whData, error: whError } = await supabase.from('freight_warehouse').select('*');
                if (whError) console.error('Error fetching inventory:', whError);
                else setWarehouseInventory((whData || []).map(mapWarehouseToState));

                // Load Master Data
                const { data: bcData, error: bcError } = await supabase.from('freight_bc_codes').select('*');
                if (bcError) console.error('Error fetching BC codes:', bcError);
                else setBcCodes(bcData || []);

                const { data: hsData, error: hsError } = await supabase.from('freight_hs_codes').select('*');
                if (hsError) console.error('Error fetching HS codes:', hsError);
                else setHSCodes(hsData.map(h => ({
                    id: h.id,
                    hsCode: h.hs_code,
                    description: h.description
                })) || []);

                const { data: itemData, error: itemError } = await supabase.from('freight_inventory').select('*');
                if (itemError) console.error('Error fetching Item master:', itemError);
                else {
                    // Map snake_case from DB to camelCase for UI
                    const mappedItems = (itemData || []).map(item => ({
                        id: item.id,
                        itemCode: item.item_code,
                        itemType: item.item_type,
                        description: item.description
                    }));
                    setItemMaster(mappedItems);
                }


                // ========================================
                // CENTRALIZED BUSINESS PARTNERS
                // Load from unified blink_business_partners table
                // ========================================
                console.log('🔄 Fetching business partners from Supabase...');
                const { data: partnerData, error: partnerError } = await supabase
                    .from('blink_business_partners')
                    .select('*');

                if (partnerError) {
                    console.error('❌ Error fetching business partners:', partnerError);
                } else if (partnerData) {
                    console.log(`✅ Loaded ${partnerData.length} business partners from Supabase`);
                    const activeDivision = getActiveDivision();
                    const visiblePartners = partnerData.filter(p => canViewPartnerInDivision(p, activeDivision, isAdmin()));
                    setBusinessPartners(visiblePartners);

                    // Backward compatibility: Populate old state
                    const customerRecords = partnerData.filter(p => p.is_customer);
                    const vendorRecords = partnerData.filter(p => p.is_vendor);

                    console.log(`📊 Customers: ${customerRecords.length}, Vendors: ${vendorRecords.length}`);
                    setCustomers(customerRecords);
                    setVendors(vendorRecords);
                }

                // ========================================
                // BRIDGE BUSINESS PARTNERS
                // Load from bridge_business_partners table
                // ========================================
                console.log('🔄 Fetching Bridge business partners...');
                const { data: bridgePartnerData, error: bridgePartnerError } = await supabase
                    .from('bridge_business_partners')
                    .select('*');

                if (bridgePartnerError) {
                    // Table might not exist yet - not critical
                    console.log('⚠️ Bridge business partners table not found or error:', bridgePartnerError.message);
                } else if (bridgePartnerData) {
                    console.log(`✅ Loaded ${bridgePartnerData.length} Bridge business partners`);
                    setBridgeBusinessPartners(bridgePartnerData);
                }


                // Load Transactions (Inbound, Outbound, Reject)
                const { data: inData, error: inError } = await supabase.from('freight_inbound').select('*');
                if (!inError) setInboundTransactions((inData || []).map(mapInboundToState));

                const { data: outData, error: outError } = await supabase.from('freight_outbound').select('*');
                if (!outError) setOutboundTransactions((outData || []).map(mapOutboundToState));

                const { data: rejData, error: rejError } = await supabase.from('freight_reject').select('*');
                if (!rejError) setRejectTransactions(rejData || []);

                // Load Supporting Data
                const { data: inspData, error: inspError } = await supabase.from('freight_inspections').select('*');
                if (!inspError) setInspections(inspData || []);

                const { data: custDocData, error: custDocError } = await supabase.from('freight_customs').select('*');
                if (!custDocError) setCustomsDocuments(custDocData || []);

                // Load Mutation Logs from freight_mutation_logs table
                const { data: mLogData, error: mLogError } = await supabase.from('freight_mutation_logs').select('*');
                if (!mLogError) {
                    // Map snake_case to camelCase for UI
                    const mappedLogs = (mLogData || []).map(log => {
                        // Extract metadata from documents if valid object (and not array of files)
                        // Note: older logs might have array of files in documents. 
                        // Newer logs (post-fix) have object { files: [], ...meta }
                        const docs = log.documents || {};
                        const isMeta = docs && !Array.isArray(docs);
                        const meta = isMeta ? docs : {};
                        const files = isMeta ? (docs.files || []) : (Array.isArray(docs) ? docs : []);

                        return {
                            id: log.id?.toString(),
                            pengajuanId: log.pengajuan_id,
                            pengajuanNumber: log.pengajuan_number,
                            bcDocumentNumber: log.bc_document_number,
                            packageNumber: log.package_number || meta.packageNumber,
                            itemCode: log.item_code,
                            itemName: log.item_name,
                            assetName: log.item_name,
                            hsCode: log.hs_code || meta.hsCode,
                            bcDocType: meta.bcDocType, // Extracted for Pabean Mutation Report
                            serialNumber: log.serial_number,
                            totalStock: log.total_stock,
                            mutatedQty: log.mutated_qty,
                            remainingStock: log.remaining_stock,
                            origin: log.origin,
                            destination: log.destination,
                            condition: log.condition || meta.condition || 'Baik',
                            date: log.date,
                            time: log.time,
                            pic: log.pic,
                            remarks: log.remarks,
                            documents: files, // Return array of files to UI for compatibility
                            uom: log.uom || meta.uom || 'pcs',
                            mutationLocation: log.mutation_location || meta.mutationLocation,
                            storageLocation: log.storage_location || meta.storageLocation,
                            sender: log.sender || meta.sender,
                            createdAt: log.created_at,
                            submissionDate: log.date,
                            approvedDate: log.date
                        };
                    });
                    setMutationLogs(mappedLogs);
                    console.log(`✅ Loaded ${mappedLogs.length} mutation logs from Supabase`);
                }

                // Load Finance Data
                const { data: invData, error: invError } = await supabase.from('freight_invoices').select('*');
                if (!invError) setInvoices(invData || []);

                const { data: purData, error: purError } = await supabase.from('freight_purchases').select('*');
                if (!purError) setPurchases(purData || []);

                const { data: finData, error: finError } = await supabase.from('freight_finance').select('*');
                if (!finError) setFinance(finData || []);

                // Load Module Data
                const { data: shipData, error: shipError } = await supabase.from('freight_shipments').select('*');
                if (!shipError) setShipments(shipData || []);

                const { data: assetData, error: assetError } = await supabase.from('freight_assets').select('*');
                if (!assetError) setAssets(assetData || []);

                const { data: eventData, error: eventError } = await supabase.from('big_events').select('*');
                if (!eventError) setEvents(eventData || []);

                const { data: moveData, error: moveError } = await supabase.from('freight_movements').select('*');
                if (!moveError) setGoodsMovements(moveData || []);

                // Load Approval Requests from Supabase
                const { data: approvalData, error: approvalError } = await supabase
                    .from('approval_requests')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (approvalError) {
                    console.warn('⚠️ Could not load approval_requests (table may not exist yet):', approvalError.message);
                } else {
                    setPendingApprovals((approvalData || []).map(normalizeApprovalRow));
                    console.log(`✅ Loaded ${(approvalData || []).length} approval requests`);
                }

                // Load Locations table if available. Table name: 'locations'
                try {
                    const { data: locData, error: locError } = await supabase.from('locations').select('*');
                    if (locError) {
                        console.log('⚠️ locations table not found or error:', locError.message);
                    } else if (locData) {
                        // Normalize simple shape: { id, value, label, is_default }
                        const mapped = locData.map(l => ({ id: l.id, value: l.value || l.code || l.name, label: l.label || l.name || l.value, is_default: l.is_default || l.is_exhibition || false }));
                        setLocations(mapped);
                        console.log(`✅ Loaded ${mapped.length} locations from DB`);
                    }
                } catch (err) {
                    console.warn('⚠️ Failed to load locations table (ignored):', err.message || err);
                }

                // Load Company Settings
                await fetchCompanySettings('blink');
                await fetchCompanySettings('bridge');
                await fetchCompanySettings('big');

            } catch (error) {
                console.error("Failed to load data from Supabase:", error);
            }
        };
        loadData();
    }, []);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel('postgres_changes')
            // ========================================
            // CENTRALIZED BUSINESS PARTNERS REALTIME
            // Subscribe to blink_business_partners changes
            // ========================================
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_business_partners' }, (payload) => {
                console.log('⚡ Realtime Business Partner Update:', payload);
                const activeDivision = getActiveDivision();
                const visibleRecord = payload.new || payload.old;
                const isVisible = canViewPartnerInDivision(visibleRecord, activeDivision, isAdmin());

                if (payload.eventType === 'INSERT') {
                    if (isVisible) {
                        setBusinessPartners(prev => {
                            const exists = prev.some(item => item.id === payload.new.id);
                            if (exists) return prev;
                            return [...prev, payload.new];
                        });
                    }
                    // Update old state for backward compatibility
                    if (payload.new.is_customer) setCustomers(prev => [...prev, payload.new]);
                    if (payload.new.is_vendor) setVendors(prev => [...prev, payload.new]);
                }
                else if (payload.eventType === 'UPDATE') {
                    setBusinessPartners(prev => {
                        const exists = prev.some(item => item.id === payload.new.id);
                        if (!isVisible) return prev.filter(item => item.id !== payload.new.id);
                        if (!exists) return [...prev, payload.new];
                        return prev.map(item => item.id === payload.new.id ? payload.new : item);
                    });
                    // Update old state
                    if (payload.new.is_customer) {
                        setCustomers(prev => {
                            const exists = prev.find(c => c.id === payload.new.id);
                            if (exists) return prev.map(item => item.id === payload.new.id ? payload.new : item);
                            else return [...prev, payload.new]; // Add if newly marked as customer
                        });
                    } else {
                        setCustomers(prev => prev.filter(item => item.id !== payload.new.id)); // Remove if no longer customer
                    }

                    if (payload.new.is_vendor) {
                        setVendors(prev => {
                            const exists = prev.find(v => v.id === payload.new.id);
                            if (exists) return prev.map(item => item.id === payload.new.id ? payload.new : item);
                            else return [...prev, payload.new];
                        });
                    } else {
                        setVendors(prev => prev.filter(item => item.id !== payload.new.id));
                    }
                }
                else if (payload.eventType === 'DELETE') {
                    setBusinessPartners(prev => prev.filter(item => item.id !== payload.old.id));
                    setCustomers(prev => prev.filter(item => item.id !== payload.old.id));
                    setVendors(prev => prev.filter(item => item.id !== payload.old.id));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_quotations' }, (payload) => {
                console.log('⚡ Realtime Quotation Update:', payload);
                if (payload.eventType === 'INSERT') setQuotations(prev => [...prev, normalizeQuotation(payload.new)]);
                else if (payload.eventType === 'UPDATE') setQuotations(prev => prev.map(item => item.id === payload.new.id ? normalizeQuotation(payload.new) : item));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_warehouse' }, (payload) => {
                console.log('⚡ Realtime Warehouse Update:', payload);
                if (payload.eventType === 'INSERT') setWarehouseInventory(prev => [...prev, mapWarehouseToState(payload.new)]);
                else if (payload.eventType === 'UPDATE') setWarehouseInventory(prev => prev.map(item => item.id === payload.new.id ? mapWarehouseToState(payload.new) : item));
                else if (payload.eventType === 'DELETE') setWarehouseInventory(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_inbound' }, (payload) => {
                console.log('⚡ Realtime Inbound Update:', payload);
                if (payload.eventType === 'INSERT') setInboundTransactions(prev => [mapInboundToState(payload.new), ...prev]);
                else if (payload.eventType === 'UPDATE') setInboundTransactions(prev => prev.map(item => item.id === payload.new.id ? mapInboundToState(payload.new) : item));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_outbound' }, (payload) => {
                console.log('⚡ Realtime Outbound Update:', payload);
                if (payload.eventType === 'INSERT') setOutboundTransactions(prev => [mapOutboundToState(payload.new), ...prev]);
                else if (payload.eventType === 'UPDATE') setOutboundTransactions(prev => prev.map(item => item.id === payload.new.id ? mapOutboundToState(payload.new) : item));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_reject' }, (payload) => {
                console.log('⚡ Realtime Reject Update:', payload);
                if (payload.eventType === 'INSERT') setRejectTransactions(prev => [payload.new, ...prev]);
                else if (payload.eventType === 'UPDATE') setRejectTransactions(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_customs' }, (payload) => {
                console.log('⚡ Realtime Customs Doc Update:', payload);
                if (payload.eventType === 'INSERT') setCustomsDocuments(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setCustomsDocuments(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setCustomsDocuments(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_finance' }, (payload) => {
                console.log('⚡ Realtime Finance Update:', payload);
                if (payload.eventType === 'INSERT') setFinance(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setFinance(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setFinance(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_shipments' }, (payload) => {
                console.log('⚡ Realtime Shipment Update:', payload);
                if (payload.eventType === 'INSERT') setShipments(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setShipments(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setShipments(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_assets' }, (payload) => {
                console.log('⚡ Realtime Asset Update:', payload);
                if (payload.eventType === 'INSERT') setAssets(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setAssets(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setAssets(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'big_events' }, (payload) => {
                console.log('⚡ Realtime Event Update:', payload);
                if (payload.eventType === 'INSERT') setEvents(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setEvents(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setEvents(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_movements' }, (payload) => {
                console.log('⚡ Realtime Movement Update:', payload);
                if (payload.eventType === 'INSERT') setGoodsMovements(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setGoodsMovements(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setGoodsMovements(prev => prev.filter(item => item.id !== payload.old.id));
            })
            // Add subscription for Mutation Logs (for Bridge UI)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_mutation_logs' }, (payload) => {
                console.log('⚡ Realtime Mutation Log Update:', payload);
                const mapRealtimeLog = (log) => {
                    const docs = log.documents || {};
                    const isMeta = docs && !Array.isArray(docs);
                    const meta = isMeta ? docs : {};
                    const files = isMeta ? (docs.files || []) : (Array.isArray(docs) ? docs : []);

                    return {
                        id: log.id?.toString(),
                        pengajuanId: log.pengajuan_id,
                        pengajuanNumber: log.pengajuan_number,
                        bcDocumentNumber: log.bc_document_number,
                        packageNumber: log.package_number || meta.packageNumber,
                        itemCode: log.item_code,
                        itemName: log.item_name,
                        assetName: log.item_name, // fallback or same
                        hsCode: log.hs_code || meta.hsCode,
                        serialNumber: log.serial_number,
                        totalStock: log.total_stock,
                        mutatedQty: log.mutated_qty,
                        remainingStock: log.remaining_stock,
                        origin: log.origin,
                        destination: log.destination,
                        condition: log.condition || meta.condition || 'Baik',
                        date: log.date,
                        time: log.time,
                        pic: log.pic,
                        remarks: log.remarks,
                        documents: files,
                        uom: log.uom || meta.uom || 'pcs',
                        mutationLocation: log.mutation_location || meta.mutationLocation,
                        storageLocation: log.storage_location || meta.storageLocation,
                        sender: log.sender || meta.sender,
                        createdAt: log.created_at,
                        submissionDate: log.date,
                        approvedDate: log.date
                    };
                };

                if (payload.eventType === 'INSERT') {
                    setMutationLogs(prev => [...prev, mapRealtimeLog(payload.new)]);
                }
                else if (payload.eventType === 'UPDATE') {
                    setMutationLogs(prev => prev.map(item => item.id === payload.new.id.toString() ? mapRealtimeLog(payload.new) : item));
                }
                else if (payload.eventType === 'DELETE') {
                    setMutationLogs(prev => prev.filter(item => item.id !== payload.old.id.toString()));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_inspections' }, (payload) => {
                console.log('⚡ Realtime Inspection Update:', payload);
                if (payload.eventType === 'INSERT') setInspections(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setInspections(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setInspections(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_invoices' }, (payload) => {
                console.log('⚡ Realtime Invoice Update:', payload);
                if (payload.eventType === 'INSERT') setInvoices(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setInvoices(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setInvoices(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_purchases' }, (payload) => {
                console.log('⚡ Realtime Purchase Update:', payload);
                if (payload.eventType === 'INSERT') setPurchases(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setPurchases(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setPurchases(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_inventory' }, (payload) => {
                console.log('⚡ Realtime Item Master Update:', payload);
                if (payload.eventType === 'INSERT') {
                    const newItem = {
                        id: payload.new.id,
                        itemCode: payload.new.item_code,
                        itemType: payload.new.item_type,
                        description: payload.new.description
                    };
                    setItemMaster(prev => [...prev, newItem]);
                }
                else if (payload.eventType === 'UPDATE') {
                    const updatedItem = {
                        id: payload.new.id,
                        itemCode: payload.new.item_code,
                        itemType: payload.new.item_type,
                        description: payload.new.description
                    };
                    setItemMaster(prev => prev.map(item => item.id === payload.new.id ? updatedItem : item));
                }
                else if (payload.eventType === 'DELETE') {
                    setItemMaster(prev => prev.filter(item => item.id !== payload.old.id));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_bc_codes' }, (payload) => {
                console.log('⚡ Realtime BC Code Update:', payload);
                if (payload.eventType === 'INSERT') setBcCodes(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setBcCodes(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setBcCodes(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, (payload) => {
                console.log('⚡ Realtime Approval Request Update:', payload);
                if (payload.eventType === 'INSERT') {
                    setPendingApprovals(prev => [normalizeApprovalRow(payload.new), ...prev]);
                }
                else if (payload.eventType === 'UPDATE') {
                    setPendingApprovals(prev => prev.map(item =>
                        item.id === payload.new.id ? normalizeApprovalRow(payload.new) : item
                    ));
                }
                else if (payload.eventType === 'DELETE') {
                    setPendingApprovals(prev => prev.filter(item => item.id !== payload.old.id));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
                console.log('⚡ Realtime Locations Update:', payload);
                if (payload.eventType === 'INSERT') {
                    const l = payload.new;
                    const mapped = { id: l.id, value: l.value || l.code || l.name, label: l.label || l.name || l.value, is_default: l.is_default || l.is_exhibition || false };
                    setLocations(prev => [...prev, mapped]);
                } else if (payload.eventType === 'UPDATE') {
                    const l = payload.new;
                    const mapped = { id: l.id, value: l.value || l.code || l.name, label: l.label || l.name || l.value, is_default: l.is_default || l.is_exhibition || false };
                    setLocations(prev => prev.map(item => item.id === l.id ? mapped : item));
                } else if (payload.eventType === 'DELETE') {
                    setLocations(prev => prev.filter(item => item.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
    // Save to localStorage whenever data changes
    /*
    useEffect(() => {
        localStorage.setItem('freight_vendors', JSON.stringify(vendors));
    }, [vendors]);
    
    useEffect(() => {
        localStorage.setItem('freight_customers', JSON.stringify(customers));
    }, [customers]);
    */

    // Save to localStorage whenever data changes
    /*
    useEffect(() => {
        localStorage.setItem('freight_vendors', JSON.stringify(vendors));
    }, [vendors]);
    
    useEffect(() => {
        localStorage.setItem('freight_customers', JSON.stringify(customers));
    }, [customers]);
    */

    // ========================================
    // localStorage removed - all data now persisted to Supabase only
    // ========================================

    // ========================================
    // BUSINESS PARTNER CRUD OPERATIONS (NEW - CENTRALIZED)
    // ========================================
    const normalizePartnerString = (value) => (value || '').toString().trim().toLowerCase();

    const normalizePhone = (value) => (value || '').toString().replace(/\D/g, '');

    const addBusinessPartner = async (partner) => {
        const activeDivision = getActiveDivision();
        const normalizedName = normalizePartnerString(partner.partner_name);
        const normalizedTaxId = normalizePartnerString(partner.tax_id);
        const normalizedEmail = normalizePartnerString(partner.email);
        const normalizedPhone = normalizePhone(partner.phone || partner.mobile);

        // Auto-merge foundation: detect canonical candidate before insert.
        let duplicateCandidates = [];
        let duplicateSearchError = null;

        if (normalizedTaxId) {
            const { data, error } = await supabase
                .from('blink_business_partners')
                .select('id, partner_name, tax_id, email, phone, mobile, owner_division, is_shared, is_customer, is_vendor, is_agent, is_transporter, is_consignee, is_shipper')
                .is('merged_into_partner_id', null)
                .eq('tax_id', partner.tax_id)
                .limit(30);
            duplicateCandidates = data || [];
            duplicateSearchError = error;
        } else if (partner.partner_name) {
            const { data, error } = await supabase
                .from('blink_business_partners')
                .select('id, partner_name, tax_id, email, phone, mobile, owner_division, is_shared, is_customer, is_vendor, is_agent, is_transporter, is_consignee, is_shipper')
                .is('merged_into_partner_id', null)
                .ilike('partner_name', partner.partner_name)
                .limit(30);
            duplicateCandidates = data || [];
            duplicateSearchError = error;
        }

        if (duplicateSearchError) {
            console.warn('Duplicate search skipped:', duplicateSearchError.message);
        }

        const duplicate = (duplicateCandidates || []).find((row) => {
            const rowName = normalizePartnerString(row.partner_name);
            const rowTaxId = normalizePartnerString(row.tax_id);
            const rowEmail = normalizePartnerString(row.email);
            const rowPhone = normalizePhone(row.phone || row.mobile);

            if (normalizedTaxId && rowTaxId && normalizedTaxId === rowTaxId) return true;
            if (normalizedName && rowName && normalizedName === rowName) {
                if (normalizedEmail && rowEmail && normalizedEmail === rowEmail) return true;
                if (normalizedPhone && rowPhone && normalizedPhone === rowPhone) return true;
            }
            return false;
        });

        if (duplicate) {
            const mergedUpdate = {
                is_customer: Boolean(duplicate.is_customer || partner.is_customer),
                is_vendor: Boolean(duplicate.is_vendor || partner.is_vendor),
                is_agent: Boolean(duplicate.is_agent || partner.is_agent),
                is_transporter: Boolean(duplicate.is_transporter || partner.is_transporter),
                is_consignee: Boolean(duplicate.is_consignee || partner.is_consignee),
                is_shipper: Boolean(duplicate.is_shipper || partner.is_shipper),
                updated_at: new Date().toISOString(),
            };

            if ((duplicate.owner_division || 'blink') !== activeDivision && isAdmin()) {
                mergedUpdate.is_shared = true;
            }

            const { data: mergedRows, error: mergeError } = await supabase
                .from('blink_business_partners')
                .update(mergedUpdate)
                .eq('id', duplicate.id)
                .select();

            if (mergeError) {
                console.error('Error auto-merging business partner:', mergeError);
                alert('Failed to merge duplicate business partner');
                return null;
            }

            const merged = mergedRows?.[0] || { ...duplicate, ...mergedUpdate };
            setBusinessPartners(prev => {
                const exists = prev.some(p => p.id === merged.id);
                if (exists) return prev.map(p => p.id === merged.id ? merged : p);
                if (canViewPartnerInDivision(merged, activeDivision, isAdmin())) return [...prev, merged];
                return prev;
            });

            alert('Partner terdeteksi duplikat dan telah digabung otomatis ke data existing.');
            return merged;
        }

        const newPartner = {
            ...partner,
            owner_division: partner.owner_division || activeDivision,
            is_shared: isAdmin() ? Boolean(partner.is_shared) : false,
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase.from('blink_business_partners').insert([newPartner]).select();
        if (error) {
            console.error('Error adding business partner:', error);
            alert('Failed to add business partner to database');
            return null;
        }

        // Realtime will handle state update, but we update optimistically
        const inserted = data?.[0] || newPartner;
        if (canViewPartnerInDivision(inserted, activeDivision, isAdmin())) {
            setBusinessPartners(prev => [...prev, inserted]);
        }

        // Update old state for backward compatibility
        if (inserted.is_customer) setCustomers(prev => [...prev, inserted]);
        if (inserted.is_vendor) setVendors(prev => [...prev, inserted]);

        return inserted;
    };

    const updateBusinessPartner = async (id, updates) => {
        const updatedData = {
            ...updates,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('blink_business_partners')
            .update(updatedData)
            .eq('id', id);

        if (error) {
            console.error('Error updating business partner:', error);
            alert('Failed to update business partner');
            return false;
        }

        // Optimistically update state (realtime will sync)
        setBusinessPartners(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));

        // Update old state
        const updatedPartner = businessPartners.find(p => p.id === id);
        if (updatedPartner) {
            const merged = { ...updatedPartner, ...updatedData };
            if (merged.is_customer) {
                setCustomers(prev => {
                    const exists = prev.find(c => c.id === id);
                    if (exists) return prev.map(c => c.id === id ? merged : c);
                    else return [...prev, merged];
                });
            } else {
                setCustomers(prev => prev.filter(c => c.id !== id));
            }

            if (merged.is_vendor) {
                setVendors(prev => {
                    const exists = prev.find(v => v.id === id);
                    if (exists) return prev.map(v => v.id === id ? merged : v);
                    else return [...prev, merged];
                });
            } else {
                setVendors(prev => prev.filter(v => v.id !== id));
            }
        }

        return true;
    };

    const deleteBusinessPartner = async (id, table = 'blink_business_partners', menuCode = 'central_vendors') => {
        if (!(isAdmin() || canDelete(menuCode))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus partner.');
            return false;
        }
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) {
            console.error('Error deleting business partner:', error);
            alert('Failed to delete business partner');
            return false;
        }

        setBusinessPartners(prev => prev.filter(p => p.id !== id));
        setCustomers(prev => prev.filter(c => c.id !== id));
        setVendors(prev => prev.filter(v => v.id !== id));
        logActivity('central_vendors', 'delete', 'business_partner', id, id, `Deleted business partner ${id}`);
        return true;
    };

    const emitProgress = (onProgress, { stage = 1, totalStages = 1, label = '', batchIndex = 1, totalBatches = 1 }) => {
        if (!onProgress) return;
        const safeTotalStages = Math.max(1, Number(totalStages) || 1);
        const safeStage = Math.min(safeTotalStages, Math.max(1, Number(stage) || 1));
        const safeTotalBatches = Math.max(1, Number(totalBatches) || 1);
        const safeBatchIndex = Math.min(safeTotalBatches, Math.max(1, Number(batchIndex) || 1));
        const percent = Math.min(100, Math.max(0, Math.floor((((safeStage - 1) + (safeBatchIndex / safeTotalBatches)) / safeTotalStages) * 100)));
        const remainingBatches = Math.max(0, safeTotalBatches - safeBatchIndex);
        const batchInfo = safeTotalBatches > 1 ? ` (batch ${safeBatchIndex}/${safeTotalBatches}, estimasi sisa ${remainingBatches} batch)` : '';
        onProgress(`${percent}% • ${label}${batchInfo}`);
    };

    const isStatementTimeoutError = (error) => {
        const msg = String(error?.message || '').toLowerCase();
        const details = String(error?.details || '').toLowerCase();
        return msg.includes('statement timeout') || msg.includes('canceling statement') || details.includes('statement timeout');
    };

    const deletePartnersByIdChunks = async (table, targetIds = [], onProgress, { stage = 1, totalStages = 1, baseLabel = 'Menghapus data mitra...' } = {}) => {
        const normalizedIds = Array.isArray(targetIds) ? targetIds.filter(Boolean) : [];
        if (normalizedIds.length === 0) return 0;

        let cursor = 0;
        let deletedCount = 0;
        let chunkSize = 200;
        const minChunkSize = 10;

        while (cursor < normalizedIds.length) {
            const batch = normalizedIds.slice(cursor, cursor + chunkSize);

            emitProgress(onProgress, {
                stage,
                totalStages,
                label: `${baseLabel} ${deletedCount}/${normalizedIds.length}`,
                batchIndex: Math.floor(cursor / chunkSize) + 1,
                totalBatches: Math.max(1, Math.ceil(normalizedIds.length / chunkSize))
            });

            const { error } = await supabase.from(table).delete().in('id', batch);
            if (error) {
                if (isStatementTimeoutError(error) && chunkSize > minChunkSize) {
                    chunkSize = Math.max(minChunkSize, Math.floor(chunkSize / 2));
                    continue;
                }
                throw error;
            }

            cursor += batch.length;
            deletedCount += batch.length;
        }

        return deletedCount;
    };

    // Bulk delete helper for Business Partners (selected IDs or all rows)
    const deleteBusinessPartnersBulk = async (ids = [], table = 'blink_business_partners', menuCode = 'central_vendors', options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete(menuCode))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus partner.');
            return false;
        }

        try {
            const hasIds = Array.isArray(ids) && ids.length > 0;
            emitProgress(onProgress, {
                stage: 1,
                totalStages: 2,
                label: hasIds ? `Menghapus ${ids.length} data mitra...` : 'Menghapus seluruh data mitra...'
            });

            let targetIds = hasIds ? ids : [];
            if (!hasIds) {
                const { data: allRows, error: fetchErr } = await supabase
                    .from(table)
                    .select('id')
                    .not('id', 'is', null);
                if (fetchErr) throw fetchErr;
                targetIds = (allRows || []).map(row => row.id).filter(Boolean);
            }

            const deletedCount = await deletePartnersByIdChunks(table, targetIds, onProgress, {
                stage: 1,
                totalStages: 2,
                baseLabel: hasIds ? 'Menghapus data mitra terpilih...' : 'Menghapus seluruh data mitra...'
            });

            if (table === 'blink_business_partners') {
                if (hasIds) {
                    setBusinessPartners(prev => prev.filter(p => !ids.includes(p.id)));
                    setCustomers(prev => prev.filter(c => !ids.includes(c.id)));
                    setVendors(prev => prev.filter(v => !ids.includes(v.id)));
                } else {
                    setBusinessPartners([]);
                    setCustomers([]);
                    setVendors([]);
                }
            }

            if (table === 'bridge_business_partners') {
                if (hasIds) {
                    setBridgeBusinessPartners(prev => prev.filter(p => !ids.includes(p.id)));
                } else {
                    setBridgeBusinessPartners([]);
                }
            }

            const scope = hasIds ? `${deletedCount} partner(s)` : `ALL partners (${deletedCount})`;
            logActivity(menuCode, 'delete', 'business_partner', hasIds ? ids.join(',') : 'ALL', hasIds ? ids.join(',') : 'ALL', `Bulk deleted ${scope} from ${table}`);
            emitProgress(onProgress, { stage: 2, totalStages: 2, label: 'Cleansing mitra selesai.' });
            return true;
        } catch (error) {
            console.error('Error bulk deleting business partners:', error);
            alert('Gagal menghapus data mitra: ' + (error.message || error));
            return false;
        }
    };

    const deleteAllBusinessPartners = async (table = 'blink_business_partners', menuCode = 'central_vendors', options = {}) => {
        return deleteBusinessPartnersBulk([], table, menuCode, options);
    };

    // Delete COA - centralized helper with permission check and audit
    const deleteCOA = async (id, menuCode = 'central_coa') => {
        if (!(isAdmin() || canDelete(menuCode))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus COA.');
            return false;
        }

        try {
            const { error } = await supabase.from('finance_coa').delete().eq('id', id);
            if (error) {
                if (error.code === '23503' || error.message?.includes('foreign key')) {
                    alert('Gagal menghapus: COA ini terhubung dengan transaksi.');
                    return false;
                }
                throw error;
            }
            setAccounts && setAccounts(prev => prev ? prev.filter(a => a.id !== id) : prev);
            logActivity(menuCode, 'delete', 'coa', id, id, `Deleted COA ${id}`);
            return true;
        } catch (err) {
            console.error('Error deleting COA:', err);
            alert('Error deleting COA: ' + (err.message || err));
            return false;
        }
    };

    // Bridge COA delete (soft-delete for code_of_accounts table)
    const deleteBridgeCOA = async (id) => {
        if (!(isAdmin() || canDelete('bridge_coa'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus COA di Bridge.');
            return false;
        }

        try {
            const { error } = await supabase.from('code_of_accounts').update({ is_active: false }).eq('id', id);
            if (error) throw error;
            // update local cache if present
            setAccounts && setAccounts(prev => prev ? prev.filter(a => a.id !== id) : prev);
            logActivity('bridge_coa', 'delete', 'coa', id, id, `Soft-deleted bridge COA ${id}`);
            return true;
        } catch (err) {
            console.error('Error deleting bridge COA:', err);
            alert('Error deleting COA: ' + (err.message || err));
            return false;
        }
    };

    // Delete Blink quotation with cascade (UI should confirm first). Returns true on success.
    const deleteBlinkQuotationCascade = async (quotationIds, quotationsTable = 'blink_quotations', menuCode = 'blink_quotations', options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete(menuCode))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus pengajuan ini.');
            return false;
        }

        try {
            const assertNoError = (error, context) => {
                if (error) {
                    throw new Error(`${context}: ${error.message || error}`);
                }
            };

            // Accept single id or array
            const ids = Array.isArray(quotationIds) ? quotationIds : [quotationIds];
            emitProgress(onProgress, { stage: 1, totalStages: 8, label: `Mencari relasi quotation (${ids.length} data)...` });

            // Step 1: Find related shipments
            const { data: shipments, error: shipmentsErr } = await supabase.from('blink_shipments').select('id').in('quotation_id', ids);
            assertNoError(shipmentsErr, 'Gagal membaca shipment terkait quotation');
            const shipmentIds = (shipments || []).map(s => s.id);

            // Step 2: related invoices
            const { data: invoices, error: invErr } = await supabase.from('blink_invoices').select('id').in('quotation_id', ids);
            assertNoError(invErr, 'Gagal membaca invoice terkait quotation');
            const invoiceIds = (invoices || []).map(i => i.id);

            // Step 3: related POs
            const { data: pos, error: poErr } = await supabase.from('blink_purchase_orders').select('id').in('quotation_id', ids);
            assertNoError(poErr, 'Gagal membaca PO terkait quotation');
            const poIds = (pos || []).map(p => p.id);
            emitProgress(onProgress, { stage: 2, totalStages: 8, label: 'Menghapus jurnal dan pembayaran terkait...' });

            // AR and AP
            let arIds = [];
            if (invoiceIds.length > 0) {
                const { data: ars, error: arErr } = await supabase.from('blink_ar_transactions').select('id').in('invoice_id', invoiceIds);
                assertNoError(arErr, 'Gagal membaca AR terkait quotation');
                arIds = (ars || []).map(a => a.id);
            }

            let apIds = [];
            if (poIds.length > 0) {
                const { data: aps, error: apErr } = await supabase.from('blink_ap_transactions').select('id').in('po_id', poIds);
                assertNoError(apErr, 'Gagal membaca AP terkait quotation');
                apIds = (aps || []).map(a => a.id);
            }

            // Payments
            let paymentRefKeys = [];
            if (invoiceIds.length > 0) paymentRefKeys.push(...invoiceIds);
            if (poIds.length > 0) paymentRefKeys.push(...poIds);
            if (arIds.length > 0) paymentRefKeys.push(...arIds);
            if (apIds.length > 0) paymentRefKeys.push(...apIds);

            let paymentIds = [];
            if (paymentRefKeys.length > 0) {
                const { data: payments, error: payErr } = await supabase.from('blink_payments').select('id').in('reference_id', paymentRefKeys);
                assertNoError(payErr, 'Gagal membaca payment terkait quotation');
                paymentIds = (payments || []).map(p => p.id);
            }

            const journalRefIds = [...ids, ...shipmentIds, ...invoiceIds, ...poIds, ...arIds, ...apIds, ...paymentIds];

            if (journalRefIds.length > 0) {
                const { error: delJErr } = await supabase.from('blink_journal_entries').delete().in('reference_id', journalRefIds);
                assertNoError(delJErr, 'Gagal menghapus jurnal terkait quotation');
            }
            if (paymentIds.length > 0) {
                const { error: delPayErr } = await supabase.from('blink_payments').delete().in('id', paymentIds);
                assertNoError(delPayErr, 'Gagal menghapus payment terkait quotation');
            }
            emitProgress(onProgress, { stage: 3, totalStages: 8, label: 'Menghapus AR/AP...' });
            if (arIds.length > 0) {
                const { error: delArErr } = await supabase.from('blink_ar_transactions').delete().in('id', arIds);
                assertNoError(delArErr, 'Gagal menghapus AR terkait quotation');
            }
            if (apIds.length > 0) {
                const { error: delApErr } = await supabase.from('blink_ap_transactions').delete().in('id', apIds);
                assertNoError(delApErr, 'Gagal menghapus AP terkait quotation');
            }
            emitProgress(onProgress, { stage: 4, totalStages: 8, label: 'Menghapus invoice/PO...' });
            if (invoiceIds.length > 0) {
                const { error: delInvErr } = await supabase.from('blink_invoices').delete().in('id', invoiceIds);
                assertNoError(delInvErr, 'Gagal menghapus invoice terkait quotation');
            }
            if (poIds.length > 0) {
                const { error: delPoErr } = await supabase.from('blink_purchase_orders').delete().in('id', poIds);
                assertNoError(delPoErr, 'Gagal menghapus PO terkait quotation');
            }

            if (shipmentIds.length > 0) {
                emitProgress(onProgress, { stage: 5, totalStages: 8, label: 'Menghapus BL dan shipment...' });
                const { error: delBlErr } = await supabase.from('blink_bl_documents').delete().in('shipment_id', shipmentIds);
                assertNoError(delBlErr, 'Gagal menghapus BL terkait quotation');
                const { error: delShipErr } = await supabase.from('blink_shipments').delete().in('id', shipmentIds);
                assertNoError(delShipErr, 'Gagal menghapus shipment terkait quotation');
            }

            if (journalRefIds.length > 0) {
                const { error: delLogErr } = await supabase
                    .from('blink_transaction_logs')
                    .delete()
                    .in('transaction_id', journalRefIds);
                assertNoError(delLogErr, 'Gagal menghapus transaction record terkait quotation');
            }

            // Finally delete quotations
            emitProgress(onProgress, { stage: 6, totalStages: 8, label: 'Menghapus data quotation utama...' });
            const { error } = await supabase.from(quotationsTable).delete().in('id', ids);
            if (error) throw error;

            logActivity(menuCode, 'delete', 'quotation', ids.join(','), ids.join(','), `Deleted quotations ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 7, totalStages: 8, label: 'Menyimpan activity log...' });
            emitProgress(onProgress, { stage: 8, totalStages: 8, label: 'Cleansing quotation selesai.' });
            return true;
        } catch (err) {
            console.error('Cascade Delete Error (DataContext):', err);
            alert('Gagal menghapus data: ' + (err.message || err));
            return false;
        }
    };

    // ========================================
    // OLD VENDOR CRUD OPERATIONS (DEPRECATED - WRAPPER AROUND BUSINESS PARTNERS)
    // For backward compatibility only. New code should use addBusinessPartner()
    // ========================================
    // Vendor CRUD operations
    const addVendor = async (vendor) => {
        const newVendor = {
            ...vendor,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_vendors').insert([newVendor]);
        if (error) {
            console.error('Error adding vendor:', error);
            alert('Failed to add vendor to database');
            return;
        }

        setVendors(prev => [...prev, newVendor]);
        return newVendor;
    };

    const updateVendor = async (id, updatedVendor) => {
        const { error } = await supabase
            .from('freight_vendors')
            .update(updatedVendor)
            .eq('id', id);

        if (error) {
            console.error('Error updating vendor:', error);
            const { error: retryError } = await supabase.from('freight_vendors').upsert({ id, ...updatedVendor });
            if (retryError) {
                alert('Failed to update vendor');
                return;
            }
        }
        setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updatedVendor } : v));
    };

    const deleteVendor = async (id) => {
        const { error } = await supabase.from('freight_vendors').delete().eq('id', id);
        if (error) {
            console.error('Error deleting vendor:', error);
            alert('Failed to delete vendor');
            return;
        }
        setVendors(prev => prev.filter(v => v.id !== id));
    };

    // Customer CRUD operations
    const addCustomer = async (customer) => {
        const newCustomer = {
            ...customer,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_customers').insert([newCustomer]);
        if (error) {
            console.error('Error adding customer:', error);
            alert('Failed to add customer to database');
            return;
        }

        setCustomers(prev => [...prev, newCustomer]);
        return newCustomer;
    };

    const updateCustomer = async (id, updatedCustomer) => {
        const { error } = await supabase
            .from('freight_customers')
            .update(updatedCustomer)
            .eq('id', id);

        if (error) {
            console.error('Error updating customer:', error);
            const { error: retryError } = await supabase.from('freight_customers').upsert({ id, ...updatedCustomer });
            if (retryError) {
                alert('Failed to update customer');
                return;
            }
        }
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updatedCustomer } : c));
    };

    const deleteCustomer = async (id) => {
        const { error } = await supabase.from('freight_customers').delete().eq('id', id);
        if (error) {
            console.error('Error deleting customer:', error);
            alert('Failed to delete customer');
            return;
        }
        setCustomers(prev => prev.filter(c => c.id !== id));
    };

    // Finance CRUD operations
    const addFinanceTransaction = async (transaction) => {
        const newTransaction = {
            ...transaction,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_finance').insert([newTransaction]);
        if (error) {
            console.error('Error adding finance transaction:', error);
            return;
        }

        setFinance(prev => [...prev, newTransaction]);
        return newTransaction;
    };

    const updateFinanceTransaction = async (id, updatedTransaction) => {
        const { error } = await supabase.from('freight_finance').update(updatedTransaction).eq('id', id);
        if (error) {
            console.error('Error updating finance transaction:', error);
            return;
        }
        setFinance(prev => prev.map(t => t.id === id ? { ...t, ...updatedTransaction } : t));
    };

    const deleteFinanceTransaction = async (id) => {
        const { error } = await supabase.from('freight_finance').delete().eq('id', id);
        if (error) {
            console.error('Error deleting finance transaction:', error);
            return;
        }
        setFinance(prev => prev.filter(t => t.id !== id));
    };

    // Shipment CRUD operations (Blink module)
    const addShipment = async (shipment) => {
        const newShipment = {
            ...shipment,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_shipments').insert([newShipment]);
        if (error) {
            console.error('Error adding shipment:', error);
            return;
        }

        setShipments(prev => [...prev, newShipment]);
        return newShipment;
    };

    const updateShipment = async (id, updatedShipment) => {
        const { error } = await supabase.from('freight_shipments').update(updatedShipment).eq('id', id);
        if (error) {
            console.error('Error updating shipment:', error);
            return;
        }
        setShipments(prev => prev.map(s => s.id === id ? { ...s, ...updatedShipment } : s));
    };

    const deleteShipment = async (id) => {
        const { error } = await supabase.from('freight_shipments').delete().eq('id', id);
        if (error) {
            console.error('Error deleting shipment:', error);
            return;
        }
        setShipments(prev => prev.filter(s => s.id !== id));
    };

    // Cascade delete for Shipments in Blink module
    const deleteShipmentCascade = async (shipmentIds, options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete('blink_shipments'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus shipment.');
            return false;
        }

        try {
            const assertNoError = (error, context) => {
                if (error) {
                    throw new Error(`${context}: ${error.message || error}`);
                }
            };

            const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
            emitProgress(onProgress, { stage: 1, totalStages: 6, label: `Memproses ${ids.length} shipment...` });

            // Find invoices linked to shipments
            const { data: invoices, error: invErr } = await supabase.from('blink_invoices').select('id').in('shipment_id', ids);
            assertNoError(invErr, 'Gagal membaca invoice terkait shipment');
            const invoiceIds = (invoices || []).map(i => i.id);

            // Find POs linked to shipments
            const { data: pos, error: poErr } = await supabase.from('blink_purchase_orders').select('id').in('shipment_id', ids);
            assertNoError(poErr, 'Gagal membaca PO terkait shipment');
            const poIds = (pos || []).map(p => p.id);
            emitProgress(onProgress, { stage: 2, totalStages: 6, label: 'Menghapus jurnal dan payment...' });

            // AR / AP
            let arIds = [];
            if (invoiceIds.length > 0) {
                const { data: ars, error: arErr } = await supabase.from('blink_ar_transactions').select('id').in('invoice_id', invoiceIds);
                assertNoError(arErr, 'Gagal membaca AR terkait shipment');
                arIds = (ars || []).map(a => a.id);
            }

            let apIds = [];
            if (poIds.length > 0) {
                const { data: aps, error: apErr } = await supabase.from('blink_ap_transactions').select('id').in('po_id', poIds);
                assertNoError(apErr, 'Gagal membaca AP terkait shipment');
                apIds = (aps || []).map(a => a.id);
            }

            // Payments referencing any of above
            let paymentRefKeys = [];
            paymentRefKeys.push(...invoiceIds, ...poIds, ...arIds, ...apIds);
            let paymentIds = [];
            if (paymentRefKeys.length > 0) {
                const { data: payments, error: payErr } = await supabase.from('blink_payments').select('id').in('reference_id', paymentRefKeys);
                assertNoError(payErr, 'Gagal membaca payment terkait shipment');
                paymentIds = (payments || []).map(p => p.id);
            }

            const journalRefIds = [...ids, ...invoiceIds, ...poIds, ...arIds, ...apIds, ...paymentIds];

            if (journalRefIds.length > 0) {
                const { error: delJErr } = await supabase.from('blink_journal_entries').delete().in('reference_id', journalRefIds);
                assertNoError(delJErr, 'Gagal menghapus jurnal terkait shipment');
            }
            if (paymentIds.length > 0) {
                const { error: delPayErr } = await supabase.from('blink_payments').delete().in('id', paymentIds);
                assertNoError(delPayErr, 'Gagal menghapus payment terkait shipment');
            }
            emitProgress(onProgress, { stage: 3, totalStages: 6, label: 'Menghapus AR/AP/Invoice/PO...' });
            if (arIds.length > 0) {
                const { error: delArErr } = await supabase.from('blink_ar_transactions').delete().in('id', arIds);
                assertNoError(delArErr, 'Gagal menghapus AR terkait shipment');
            }
            if (apIds.length > 0) {
                const { error: delApErr } = await supabase.from('blink_ap_transactions').delete().in('id', apIds);
                assertNoError(delApErr, 'Gagal menghapus AP terkait shipment');
            }
            if (invoiceIds.length > 0) {
                const { error: delInvErr } = await supabase.from('blink_invoices').delete().in('id', invoiceIds);
                assertNoError(delInvErr, 'Gagal menghapus invoice terkait shipment');
            }
            if (poIds.length > 0) {
                const { error: delPoErr } = await supabase.from('blink_purchase_orders').delete().in('id', poIds);
                assertNoError(delPoErr, 'Gagal menghapus PO terkait shipment');
            }

            // delete BL documents and shipments
            emitProgress(onProgress, { stage: 4, totalStages: 6, label: 'Menghapus BL documents...' });
            const { error: delBlErr } = await supabase.from('blink_bl_documents').delete().in('shipment_id', ids);
            assertNoError(delBlErr, 'Gagal menghapus BL terkait shipment');
            emitProgress(onProgress, { stage: 5, totalStages: 6, label: 'Menghapus shipment utama...' });
            const { error: delShipErr } = await supabase.from('blink_shipments').delete().in('id', ids);
            assertNoError(delShipErr, 'Gagal menghapus shipment utama');

            if (journalRefIds.length > 0) {
                const { error: delLogErr } = await supabase
                    .from('blink_transaction_logs')
                    .delete()
                    .in('transaction_id', journalRefIds);
                assertNoError(delLogErr, 'Gagal menghapus transaction record terkait shipment');
            }

            setShipments(prev => prev ? prev.filter(s => !ids.includes(s.id)) : prev);
            logActivity('blink_shipments', 'delete', 'shipment', ids.join(','), ids.join(','), `Deleted shipments ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 6, totalStages: 6, label: 'Cleansing shipment selesai.' });
            return true;
        } catch (err) {
            console.error('Error deleting shipments cascade:', err);
            alert('Gagal menghapus shipment: ' + (err.message || err));
            return false;
        }
    };

    // Asset CRUD operations (Bridge module)
    const addAsset = async (asset) => {
        const newAsset = {
            ...asset,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_assets').insert([newAsset]);
        if (error) {
            console.error('Error adding asset:', error);
            return;
        }

        setAssets(prev => [...prev, newAsset]);
        return newAsset;
    };

    const updateAsset = async (id, updatedAsset) => {
        const { error } = await supabase.from('freight_assets').update(updatedAsset).eq('id', id);
        if (error) {
            console.error('Error updating asset:', error);
            return;
        }
        setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updatedAsset } : a));
    };

    const deleteAsset = async (id) => {
        const { error } = await supabase.from('freight_assets').delete().eq('id', id);
        if (error) {
            console.error('Error deleting asset:', error);
            return;
        }
        setAssets(prev => prev.filter(a => a.id !== id));
    };

    // Event CRUD operations (Big module)
    const addEvent = async (event) => {
        // Prepare event data - let database generate UUID for id
        const eventData = {
            event_name: event.event_name,
            client_id: event.client_id || null,
            event_date: event.event_date || null,
            event_end_date: event.event_end_date || null,
            venue: event.venue || null,
            status: event.status || 'planning',
            description: event.description || null,
        };

        const { data, error } = await supabase.from('big_events').insert([eventData]).select();
        if (error) {
            console.error('Error adding event:', error);
            return;
        }

        const newEvent = data[0];
        setEvents(prev => [...prev, newEvent]);
        return newEvent;
    };

    const updateEvent = async (id, updatedEvent) => {
        const { error } = await supabase.from('big_events').update(updatedEvent).eq('id', id);
        if (error) {
            console.error('Error updating event:', error);
            return;
        }
        setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updatedEvent } : e));
    };

    const deleteEvent = async (id) => {
        const { error } = await supabase.from('big_events').delete().eq('id', id);
        if (error) {
            console.error('Error deleting event:', error);
            return;
        }
        setEvents(prev => prev.filter(e => e.id !== id));
    };

    // Inbound Transaction operations (Bridge TPPB)
    const addInboundTransaction = async (transaction) => {
        // Calculate total operational cost
        const opCosts = transaction.operationalCosts || {};
        const totalOperationalCost = Object.keys(opCosts)
            .filter(key => key !== 'notes')
            .reduce((sum, key) => sum + (Number(opCosts[key]) || 0), 0);

        const newTransaction = {
            ...transaction,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            status: 'completed',
            totalOperationalCost,
            totalCost: Number(transaction.value) + totalOperationalCost,
        };

        // Auto-create customs document
        const customsDoc = {
            id: (Date.now() + 1).toString(),
            docType: transaction.customsDocType,
            docNumber: transaction.customsDocNumber,
            docDate: transaction.customsDocDate,
            transactionType: 'inbound',
            transactionId: newTransaction.id,
            assetName: transaction.assetName,
            quantity: transaction.quantity,
            value: transaction.value,
            status: 'approved',
            createdAt: new Date().toISOString(),
        };

        // Map to snake_case for DB (Strictly match freight_customs schema)
        // Table columns: id, quotation_id, document_type, document_number, document_date, status, notes, documents (jsonb)
        const customsDocPayload = {
            id: customsDoc.id,
            // mapping keys to match schema
            document_type: customsDoc.docType,
            document_number: customsDoc.docNumber,
            document_date: customsDoc.docDate,
            status: customsDoc.status,
            created_at: customsDoc.createdAt,
            // Missing columns in schema: transaction_type, transaction_id, asset_name, quantity, value
            // Solution: Store extra metadata in 'documents' JSONB column or 'notes', or just omit if not needed there.
            // Storing in 'notes' for visibility or 'documents' JSONB
            notes: `Auto-generated for ${customsDoc.transactionType}. Asset: ${customsDoc.assetName}, Qty: ${customsDoc.quantity}`,
            documents: {
                transactionType: customsDoc.transactionType,
                transactionId: customsDoc.transactionId,
                assetName: customsDoc.assetName,
                quantity: customsDoc.quantity,
                value: customsDoc.value
            }
        };

        // Persist Customs Document
        const { error: customsError } = await supabase.from('freight_customs').insert([customsDocPayload]);
        if (!customsError) {
            setCustomsDocuments(prev => [...prev, customsDoc]);
        }

        // Map transaction to snake_case for DB (Strictly match freight_inbound schema)
        const inboundPayload = {
            id: newTransaction.id,
            // pengajuan_id? newTransaction.quotationId ?
            // Schema has: pengajuan_id, pengajuan_number, customs_doc_type, customs_doc_number, customs_doc_date...
            asset_name: newTransaction.assetName,
            // item_code? asset_id? Schema has 'item_code'
            item_code: newTransaction.assetId,
            quantity: newTransaction.quantity,
            unit: newTransaction.unit,
            value: newTransaction.value,
            customs_doc_number: newTransaction.customsDocNumber,
            customs_doc_date: newTransaction.customsDocDate,
            customs_doc_type: newTransaction.customsDocType, // Not doc_type
            sender: newTransaction.sender,
            notes: newTransaction.notes,
            created_at: newTransaction.createdAt,
            date: newTransaction.date, // Add date column mapping (NOT NULL)

            // Map new fields to DB columns
            hs_code: newTransaction.hsCode,
            serial_number: newTransaction.serialNumber,
            currency: newTransaction.currency,
            receipt_number: newTransaction.receiptNumber,

            documents: {
                totalOperationalCost: newTransaction.totalOperationalCost,
                totalCost: newTransaction.totalCost,
                status: newTransaction.status
            }
        };

        // Persist Inbound Transaction
        const { error: inboundError } = await supabase.from('freight_inbound').insert([inboundPayload]);

        if (inboundError) {
            console.error('Error adding inbound transaction:', inboundError);
            return;
        }

        // NOTE: Inventory creation is now handled by updateQuotation when status changes to 'approved'
        // This prevents duplicate inventory creation and 406 errors from conflicting queries
        // await updateInventoryStock(transaction.assetId, transaction.assetName, transaction.quantity, transaction.unit, 'inbound', newTransaction.id, transaction.value);

        // Auto-generate finance invoice for goods value
        const goodsInvoice = {
            type: 'expense',
            category: 'Equipment',
            amount: transaction.value,
            description: `Inbound - ${transaction.assetName} (${transaction.quantity} ${transaction.unit}) - Goods Value - BC: ${transaction.customsDocNumber} `,
            module: 'bridge',
            date: transaction.date,
            referenceType: 'inbound',
            referenceId: newTransaction.id,
        };
        addFinanceTransaction(goodsInvoice);

        // Auto-generate finance invoice for operational costs (if any)
        if (totalOperationalCost > 0) {
            const opCostInvoice = {
                type: 'expense',
                category: 'Operational',
                amount: totalOperationalCost,
                description: `Inbound - ${transaction.assetName} - Operational Costs(Handling: ${opCosts.handling || 0}, Storage: ${opCosts.storage || 0}, Customs: ${opCosts.customsProcessing || 0}, Transport: ${opCosts.transportation || 0})`,
                module: 'bridge',
                date: transaction.date,
                referenceType: 'inbound-operational',
                referenceId: newTransaction.id,
            };
            addFinanceTransaction(opCostInvoice);
        }

        newTransaction.invoiceId = goodsInvoice.id;

        setInboundTransactions(prev => [newTransaction, ...prev]);
        return newTransaction;
    };

    const updateInboundTransaction = (id, updatedTransaction) => {
        setInboundTransactions(inboundTransactions.map(t => t.id === id ? { ...t, ...updatedTransaction } : t));
    };

    const updateInboundItem = async (inboundId, itemIndex, updates) => {
        try {
            const inbound = inboundTransactions.find(t => t.id === inboundId);
            if (!inbound) throw new Error('Transaction not found');

            const newItems = [...(inbound.items || [])];
            if (itemIndex >= 0 && itemIndex < newItems.length) {
                newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
            }

            // Prepare payload for Supabase
            // We need to fetch the current documents first to merge items back in
            const { data: current, error: fetchErr } = await supabase.from('freight_inbound').select('documents').eq('id', inboundId).single();
            if (fetchErr) throw fetchErr;

            const docs = typeof current.documents === 'string' ? JSON.parse(current.documents) : (current.documents || {});
            docs.items = newItems;

            const { error: updateErr } = await supabase.from('freight_inbound').update({
                documents: JSON.stringify(docs),
                updated_at: new Date().toISOString()
            }).eq('id', inboundId);

            if (updateErr) throw updateErr;

            // Update local state
            setInboundTransactions(prev => prev.map(t => 
                t.id === inboundId ? { ...t, items: newItems } : t
            ));

            return { success: true };
        } catch (error) {
            console.error('❌ Error updating inbound item:', error);
            return { success: false, error: error.message };
        }
    };

    const deleteInboundTransaction = (id) => {
        setInboundTransactions(inboundTransactions.filter(t => t.id !== id));
    };

    // Outbound Transaction operations (Bridge TPPB)
    const addOutboundTransaction = async (transaction) => {
        // Check stock availability from Database (Real-time)
        let query = supabase
            .from('freight_warehouse')
            .select('quantity, asset_name, package_number')
            .eq('item_code', transaction.assetId);

        if (transaction.sourcePengajuanId) {
            query = query.eq('pengajuan_id', transaction.sourcePengajuanId);
        }

        // Add package_number filter if provided for more specific stock check
        if (transaction.packageNumber) {
            query = query.eq('package_number', transaction.packageNumber);
        }

        const { data: dbInventory, error: inventoryError } = await query;

        if (inventoryError) {
            console.error('Error fetching inventory for stock check:', inventoryError);
            alert(`Create Transaction Error: Gagal memeriksa stok untuk item ${transaction.assetName}`);
            return;
        }

        // Sum available quantity across all matching records
        const currentQty = dbInventory ? dbInventory.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;

        console.log(`📊 Stock check for ${transaction.assetName} (${transaction.assetId}):`, {
            found: dbInventory?.length || 0,
            currentQty,
            requested: transaction.quantity,
            packageNumber: transaction.packageNumber,
            sourcePengajuanId: transaction.sourcePengajuanId
        });

        if (currentQty < transaction.quantity) {
            console.error('Insufficient stock:', dbInventory);
            alert(`Stok tidak mencukupi untuk item: ${transaction.assetName}.\n\nStok Tersedia (DB): ${currentQty}\nDiminta: ${transaction.quantity}`);
            return;
        }

        // Calculate total operational cost
        const opCosts = transaction.operationalCosts || {};
        const totalOperationalCost = Object.keys(opCosts)
            .filter(key => key !== 'notes')
            .reduce((sum, key) => sum + (Number(opCosts[key]) || 0), 0);

        const newTransaction = {
            ...transaction,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            status: 'completed',
            totalOperationalCost,
            netRevenue: Number(transaction.value) - totalOperationalCost,
        };

        // Auto-create customs document
        const customsDoc = {
            id: (Date.now() + 1).toString(),
            docType: transaction.customsDocType,
            docNumber: transaction.customsDocNumber,
            docDate: transaction.customsDocDate,
            transactionType: 'outbound',
            transactionId: newTransaction.id,
            assetName: transaction.assetName,
            quantity: transaction.quantity,
            value: transaction.value,
            status: 'approved',
            createdAt: new Date().toISOString(),
        };

        // Map to snake_case (Strictly match freight_customs schema)
        const customsDocPayload = {
            id: customsDoc.id,
            document_type: customsDoc.docType,
            document_number: customsDoc.docNumber,
            document_date: customsDoc.docDate,
            status: customsDoc.status,
            created_at: customsDoc.createdAt,
            // Store extra metadata in 'documents' JSONB
            documents: {
                transactionType: customsDoc.transactionType,
                transactionId: customsDoc.transactionId,
                assetName: customsDoc.assetName,
                quantity: customsDoc.quantity,
                value: customsDoc.value
            }
        };

        // Persist Customs Document
        const { error: customsError } = await supabase.from('freight_customs').insert([customsDocPayload]);
        if (!customsError) {
            setCustomsDocuments(prev => [...prev, customsDoc]);
        } else {
            console.error("Error adding outbound customs doc:", customsError);
        }

        // Map to snake_case (Strictly match freight_outbound schema)
        // Schema: id, pengajuan_id, pengajuan_number, customs_doc_type, customs_doc_number, customs_doc_date, receipt_number, date, destination, receiver, item_code, asset_name, quantity, unit, value, currency, records(jsonb?)
        const outboundPayload = {
            id: newTransaction.id,
            // pengajuan_id?
            item_code: newTransaction.assetId,
            asset_name: newTransaction.assetName,
            quantity: newTransaction.quantity,
            unit: newTransaction.unit,
            value: newTransaction.value,
            customs_doc_number: newTransaction.customsDocNumber,
            customs_doc_date: newTransaction.customsDocDate,
            customs_doc_type: newTransaction.customsDocType,
            destination: newTransaction.destination,
            receiver: newTransaction.receiver, // or customer?
            notes: newTransaction.notes,
            created_at: newTransaction.createdAt,
            date: newTransaction.date || new Date().toISOString().split('T')[0], // Add date column mapping (NOT NULL)
            currency: newTransaction.currency || 'IDR',
            documents: {
                totalOperationalCost: newTransaction.totalOperationalCost,
                netRevenue: newTransaction.netRevenue,
                status: newTransaction.status
            }
        };

        // Persist Outbound Transaction
        const { error: outboundError } = await supabase.from('freight_outbound').insert([outboundPayload]);

        if (outboundError) {
            console.error("Error adding outbound transaction:", outboundError);
            return;
        }

        // Auto-update warehouse inventory (reduce stock)
        await updateInventoryStock(transaction.assetId, transaction.assetName, -transaction.quantity, transaction.unit, 'outbound', newTransaction.id, transaction.value);

        // Auto-generate finance invoice for sales income
        const salesInvoice = {
            type: 'income',
            category: 'Service',
            amount: transaction.value,
            description: `Outbound - ${transaction.assetName} (${transaction.quantity} ${transaction.unit}) - Sales Revenue - BC: ${transaction.customsDocNumber} `,
            module: 'bridge',
            date: transaction.date,
            referenceType: 'outbound',
            referenceId: newTransaction.id,
        };
        addFinanceTransaction(salesInvoice);

        // Auto-generate finance invoice for operational costs (if any)
        if (totalOperationalCost > 0) {
            const opCostInvoice = {
                type: 'expense',
                category: 'Operational',
                amount: totalOperationalCost,
                description: `Outbound - ${transaction.assetName} - Operational Costs(Handling: ${opCosts.handling || 0}, Customs: ${opCosts.customsProcessing || 0}, Transport: ${opCosts.transportation || 0})`,
                module: 'bridge',
                date: transaction.date,
                referenceType: 'outbound-operational',
                referenceId: newTransaction.id,
            };
            addFinanceTransaction(opCostInvoice);
        }

        newTransaction.invoiceId = salesInvoice.id;

        setOutboundTransactions([...outboundTransactions, newTransaction]);
        return newTransaction;
    };

    const updateOutboundTransaction = (id, updatedTransaction) => {
        setOutboundTransactions(outboundTransactions.map(t => t.id === id ? { ...t, ...updatedTransaction } : t));
    };

    const deleteOutboundTransaction = (id) => {
        setOutboundTransactions(outboundTransactions.filter(t => t.id !== id));
    };

    // Warehouse Inventory helper function
    const updateInventoryStock = async (assetId, assetName, quantity, unit, type, transactionId, value) => {
        // Query DB directly first for source of truth
        let { data: existingInventory, error } = await supabase
            .from('freight_warehouse')
            .select('*')
            .eq('item_code', assetId)
            .single();

        // Fallback to local state if DB query fails or returns nothing
        if (!existingInventory && !error) {
            existingInventory = warehouseInventory.find(i => i.assetId === assetId);
        }

        const existingStock = existingInventory ? (existingInventory.current_stock ?? existingInventory.currentStock ?? 0) : 0;
        const existsId = existingInventory ? existingInventory.id : null;
        const existingMovements = existingInventory ? (existingInventory.movements || []) : [];

        if (existsId) {
            const newStock = Number(existingStock) + Number(quantity);
            const movement = {
                type,
                transactionId,
                quantity: Math.abs(quantity),
                date: new Date().toISOString(),
            };

            const updatedDataPayload = {
                quantity: newStock,
                value: value || existingInventory.value,
                updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase.from('freight_warehouse').update(updatedDataPayload).eq('id', existsId);

            if (!updateError) {
                setWarehouseInventory(prev => prev.map(i => i.id === existsId ? { ...i, currentStock: newStock, lastUpdated: new Date().toISOString(), movements: [...(i.movements || []), movement] } : i));
            } else {
                console.error("Error updating warehouse stock:", updateError);
            }
        } else if (quantity > 0) {
            // Create new inventory item
            const newInventoryState = {
                id: Date.now().toString(),
                assetId: assetId,
                assetName: assetName,
                currentStock: quantity,
                unit: unit,
                minStock: 10,
                maxStock: 1000,
                value: value,
                category: unit === 'kg' || unit === 'ton' ? 'Raw Material' : 'Finished Goods',
                location: 'Zone A',
                lastUpdated: new Date().toISOString(),
                movements: [{
                    type,
                    transactionId,
                    quantity: quantity,
                    date: new Date().toISOString()
                }]
            };

            const newInventoryPayload = {
                id: newInventoryState.id,
                item_code: newInventoryState.assetId,
                asset_name: newInventoryState.assetName,
                quantity: newInventoryState.currentStock,
                unit: newInventoryState.unit,
                value: newInventoryState.value,
                location: JSON.stringify({ zone: newInventoryState.location }),
                updated_at: newInventoryState.lastUpdated,
                notes: `Auto-created from ${type} transaction ${transactionId}`
            };

            const { error: insertError } = await supabase.from('freight_warehouse').insert([newInventoryPayload]);

            if (!insertError) {
                setWarehouseInventory(prev => [...prev, newInventoryState]);
            } else {
                console.error("Error creating warehouse inventory:", insertError);
            }
        }
    };

    // ========== ITEM CHECKOUT (Mark items as checked out from warehouse) ==========
    const updateItemCheckout = async (itemId, checkedOut, bcNumber = null) => {
        try {
            const checkoutDate = checkedOut ? new Date().toISOString().split('T')[0] : null;

            const updatePayload = {
                checked_out: checkedOut,
                checkout_date: checkoutDate,
                checkout_bc_number: bcNumber,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('freight_warehouse')
                .update(updatePayload)
                .eq('id', itemId);

            if (error) {
                console.error('Error updating item checkout status:', error);
                throw error;
            }

            // Update local state
            setWarehouseInventory(prev => prev.map(item =>
                item.id === itemId
                    ? {
                        ...item,
                        checkedOut: checkedOut,
                        checkoutDate: checkoutDate,
                        checkoutBcNumber: bcNumber
                    }
                    : item
            ));

            console.log(`✅ Item ${itemId} checkout status updated: ${checkedOut}`);
            return { success: true };
        } catch (error) {
            console.error('Failed to update item checkout:', error);
            return { success: false, error };
        }
    };

    // ========== MUTATION LOGS ==========
    const addMutationLog = async (mutationData) => {
        try {
            const newLog = {
                ...mutationData,
                createdAt: new Date().toISOString()
            };

            // Save to Supabase freight_mutation_logs table
            // Generate unique ID
            const mutationId = `MUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const { data, error } = await supabase
                .from('freight_mutation_logs')
                .insert([{
                    id: mutationId,
                    pengajuan_id: mutationData.pengajuanId || null,
                    pengajuan_number: mutationData.pengajuanNumber || mutationData.pengajuan_number || null,
                    bc_document_number: mutationData.bcDocumentNumber || null,
                    // package_number, item_code, etc. are NOT in schema? 
                    // Verify schema: id, pengajuan_id, pengajuan_number, bc_document_number, item_code, item_name, serial_number, date, time, pic, total_stock, mutated_qty, remaining_stock, origin, destination, remarks, documents, created_at, updated_at

                    item_code: mutationData.itemCode || null,
                    item_name: mutationData.itemName || mutationData.assetName || null,
                    serial_number: mutationData.serialNumber || null,
                    date: mutationData.date || new Date().toISOString().split('T')[0],
                    time: mutationData.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    pic: mutationData.pic || null,
                    total_stock: mutationData.totalStock || 0,
                    mutated_qty: mutationData.mutatedQty || 0,
                    remaining_stock: mutationData.remainingStock || 0,
                    origin: mutationData.origin || 'warehouse',
                    destination: mutationData.destination || 'warehouse',
                    // condition is NOT in schema based on my read? Wait.
                    // Line 284: CREATE TABLE freight_mutation_logs
                    // Cols: id, pengajuan_id, ..., remarks, documents, created_at, updated_at
                    // missing: condition, uom, sender, package_number, hs_code, mutation_location, storage_location

                    remarks: mutationData.remarks || null,

                    // Store ALL extra fields in documents JSONB
                    documents: {
                        files: Array.isArray(mutationData.documents) ? mutationData.documents : [],
                        sender: mutationData.sender,
                        uom: mutationData.uom || 'pcs',
                        mutationLocation: mutationData.mutationLocation,
                        storageLocation: mutationData.storageLocation,
                        packageNumber: mutationData.packageNumber,
                        hsCode: mutationData.hsCode,
                        condition: mutationData.condition // saving condition here too since it might be missing
                    }
                }])
                .select();

            if (error) {
                console.error('❌ Error saving mutation to Supabase:', error);
                console.error('❌ Error details:', JSON.stringify(error, null, 2));
                throw error;
            }

            console.log('✅ Mutation log saved to Supabase:', data);

            // Manual state update to ensure immediate UI refresh
            // Format the saved data to match state structure
            const savedLog = data[0];
            const docs = savedLog.documents || {};
            const isMeta = docs && !Array.isArray(docs);
            const meta = isMeta ? docs : {};
            const files = isMeta ? (docs.files || []) : (Array.isArray(docs) ? docs : []);

            const formattedLog = {
                id: savedLog.id?.toString(),
                pengajuanId: savedLog.pengajuan_id,
                pengajuanNumber: savedLog.pengajuan_number,
                bcDocumentNumber: savedLog.bc_document_number,
                packageNumber: savedLog.package_number || meta.packageNumber,
                itemCode: savedLog.item_code,
                itemName: savedLog.item_name,
                assetName: savedLog.item_name,
                hsCode: savedLog.hs_code || meta.hsCode,
                serialNumber: savedLog.serial_number,
                sender: savedLog.sender || meta.sender, // Added for Pabean Barang Mutasi
                totalStock: savedLog.total_stock,
                mutatedQty: savedLog.mutated_qty,
                remainingStock: savedLog.remaining_stock,
                origin: savedLog.origin,
                destination: savedLog.destination,
                condition: savedLog.condition || meta.condition || 'Baik',
                date: savedLog.date,
                time: savedLog.time,
                pic: savedLog.pic,
                remarks: savedLog.remarks,
                documents: files,
                uom: savedLog.uom || meta.uom || 'pcs',
                mutationLocation: savedLog.mutation_location || meta.mutationLocation,
                storageLocation: savedLog.storage_location || meta.storageLocation,
                createdAt: savedLog.created_at
            };

            // Add to state immediately
            setMutationLogs(prev => [...prev, formattedLog]);
            console.log('📦 Mutation log added to state:', formattedLog);

            return data[0];
        } catch (error) {
            console.error('❌ Failed to add mutation log:', error);
            throw error;
        }
    };

    const updateMutationLog = async (id, updates) => {
        try {
            // Update in Supabase
            const { data, error } = await supabase
                .from('freight_mutation_logs')
                .update({
                    destination: updates.destination,
                    condition: updates.condition,
                    pic: updates.pic,
                    date: updates.date,
                    time: updates.time,
                    remarks: updates.remarks,
                    documents: updates.documents,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();

            if (error) {
                console.error('❌ Error updating mutation in Supabase:', error);
                throw error;
            }

            console.log('✅ Mutation log updated in Supabase:', data);

            // Update local state
            const savedLog = data[0];
            const docs = savedLog.documents || {};
            const isMeta = docs && !Array.isArray(docs);
            const meta = isMeta ? docs : {};
            const files = isMeta ? (docs.files || []) : (Array.isArray(docs) ? docs : []);

            const formattedLog = {
                id: savedLog.id?.toString(),
                pengajuanId: savedLog.pengajuan_id,
                pengajuanNumber: savedLog.pengajuan_number,
                bcDocumentNumber: savedLog.bc_document_number,
                packageNumber: savedLog.package_number || meta.packageNumber,
                itemCode: savedLog.item_code,
                itemName: savedLog.item_name,
                assetName: savedLog.item_name,
                hsCode: savedLog.hs_code || meta.hsCode,
                totalStock: savedLog.total_stock,
                mutatedQty: savedLog.mutated_qty,
                remainingStock: savedLog.remaining_stock,
                origin: savedLog.origin,
                destination: savedLog.destination,
                condition: savedLog.condition || meta.condition || 'Baik',
                date: savedLog.date,
                time: savedLog.time,
                pic: savedLog.pic,
                remarks: savedLog.remarks,
                documents: files,
                uom: savedLog.uom || meta.uom || 'pcs',
                mutationLocation: savedLog.mutation_location || meta.mutationLocation,
                storageLocation: savedLog.storage_location || meta.storageLocation,
                sender: savedLog.sender || meta.sender,
                createdAt: savedLog.created_at
            };

            setMutationLogs(prev => prev.map(log => log.id === id ? formattedLog : log));

            console.log('📦 Mutation log updated in state:', formattedLog);
            return formattedLog;
        } catch (error) {
            console.error('❌ Failed to update mutation log:', error);
            throw error;
        }
    };

    const deleteMutationLog = async (id) => {
        try {
            // Delete from Supabase
            const { error } = await supabase
                .from('freight_mutation_logs')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('❌ Error deleting mutation from Supabase:', error);
                throw error;
            }

            console.log('✅ Mutation log deleted from Supabase:', id);

            // Update local state
            setMutationLogs(prev => prev.filter(log => log.id !== id.toString()));

            console.log('📦 Mutation log removed from state:', id);
            return true;
        } catch (error) {
            console.error('❌ Failed to delete mutation log:', error);
            throw error;
        }
    };

    // Warehouse Inventory CRUD operations
    const addWarehouseInventory = async (inventory) => {
        const newInventory = {
            ...inventory,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
            movements: [],
        };

        const { error } = await supabase.from('freight_warehouse').insert([newInventory]);
        if (error) {
            console.error('Error adding inventory:', error);
            alert('Failed to add inventory');
            return;
        }

        setWarehouseInventory(prev => [...prev, newInventory]);
        return newInventory;
    };

    const updateWarehouseInventory = async (id, updatedInventory) => {
        const { error } = await supabase
            .from('freight_warehouse')
            .update(updatedInventory)
            .eq('id', id);

        if (error) {
            console.error('Error updating inventory:', error);
            alert('Failed to update inventory');
            return;
        }
        setWarehouseInventory(prev => prev.map(i => i.id === id ? { ...i, ...updatedInventory } : i));
    };

    const deleteWarehouseInventory = async (id) => {
        const { error } = await supabase.from('freight_warehouse').delete().eq('id', id);
        if (error) {
            console.error('Error deleting inventory:', error);
            alert('Failed to delete inventory');
            return;
        }
        setWarehouseInventory(prev => prev.filter(i => i.id !== id));
    };

    // Customs Document CRUD operations
    const addCustomsDocument = async (document) => {
        const newDocument = {
            ...document,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
        };

        // Map to snake_case (Strictly match freight_customs schema)
        const payload = {
            id: newDocument.id,
            document_type: newDocument.docType,
            document_number: newDocument.docNumber,
            document_date: newDocument.docDate,
            status: newDocument.status,
            created_at: newDocument.created_at,
            notes: newDocument.notes,
            documents: {
                transactionType: newDocument.transactionType,
                transactionId: newDocument.transactionId,
                assetName: newDocument.assetName,
                quantity: newDocument.quantity,
                value: newDocument.value
            }
        };

        const { error } = await supabase.from('freight_customs').insert([payload]);
        if (error) {
            console.error('Error adding customs document:', error);
            return;
        }

        setCustomsDocuments(prev => [...prev, newDocument]);
        return newDocument;
    };

    const updateCustomsDocument = async (id, updatedDocument) => {
        const { error } = await supabase
            .from('freight_customs')
            .update(updatedDocument)
            .eq('id', id);

        if (error) {
            console.error('Error updating customs document:', error);
            return;
        }
        setCustomsDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updatedDocument } : d));
    };

    const deleteCustomsDocument = async (id) => {
        const { error } = await supabase.from('freight_customs').delete().eq('id', id);
        if (error) {
            console.error('Error deleting customs document:', error);
            return;
        }
        setCustomsDocuments(prev => prev.filter(d => d.id !== id));
    };

    // ===== TPPB Workflow Methods =====

    const addQuotation = async (quotation) => {
        console.log('🔵 addQuotation called with:', quotation);

        // Generate quotation number based on submission date (Strictly)
        const submissionDate = quotation.submissionDate || new Date().toISOString().split('T')[0];
        // Format: BRGYYMM-XXXXXX
        // Ensure we parse year/month from submissionDate string correctly (YYYY-MM-DD expected)
        const year = submissionDate.substring(2, 4); // YY (from YYYY)
        const month = submissionDate.substring(5, 7); // MM

        // Count existing quotations for the same month/year to determine Sequence?
        // Current logic uses total length. Better might be to count filtered list, but stick to length + 1 for now to avoid complexity change unless requested.
        const quotationNumber = `BRG${year}${month}-${String(quotations.length + 1).padStart(6, '0')}`;

        const newQuotation = {
            // ID and basic info
            id: `QT-${Date.now()}`,
            quotation_number: quotationNumber,

            // Map camelCase to snake_case for database columns
            customer: quotation.customer,
            customer_id: quotation.customerId || null,
            bc_document_number: quotation.bcDocumentNumber || null,
            bc_document_date: quotation.bcDocumentDate || null,
            bc_document_type: quotation.bcDocType || quotation.bcDocumentType || null,

            // Dates
            date: quotation.date || new Date().toISOString().split('T')[0],
            submission_date: quotation.submissionDate || new Date().toISOString().split('T')[0],

            // Status fields
            status: quotation.status || 'draft',
            document_status: quotation.documentStatus || 'pengajuan',
            customs_status: quotation.customsStatus || 'pending',

            // Type and details
            type: quotation.type,
            item_code: quotation.itemCode || null,
            shipper: quotation.shipper || null,
            origin: quotation.origin || null,
            destination: quotation.destination || null,
            // Source References (Outbound History)
            source_pengajuan_id: quotation.sourcePengajuanId || null,
            source_pengajuan_number: quotation.sourcePengajuanNumber || null,
            source_bc_document_number: quotation.sourceBcDocumentNumber || null,
            source_bc_document_date: quotation.sourceBcDocumentDate || null,

            // JSONB fields
            packages: quotation.packages || [],
            documents: quotation.documents || [],
            bc_supporting_documents: quotation.bcSupportingDocuments || [],

            // Additional fields
            notes: quotation.notes || null,
            rejection_reason: quotation.rejectionReason || null,
            rejection_date: quotation.rejectionDate || null,
            pic: quotation.pic || null,

            // Invoice / Currency fields
            bl_number: quotation.blNumber || null,
            bl_date: quotation.blDate || null,
            invoice_number: quotation.invoiceNumber || null,
            invoice_value: quotation.invoiceValue ? Number(quotation.invoiceValue) : null,
            invoice_currency: quotation.invoiceCurrency || 'IDR',
            exchange_rate: quotation.exchangeRate ? Number(quotation.exchangeRate) : null,
            exchange_rate_date: quotation.exchangeRateDate || null,

            // Timestamps
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Handle documents JSONB - ensuring we save separate fields or wrap in object if needed
        // Current logic mostly sends array of files. We'll upgrade this to object if source info exists.
        if (quotation.sourcePengajuanId) {
            newQuotation.documents = {
                files: Array.isArray(quotation.documents) ? quotation.documents : [],
                sourcePengajuanId: quotation.sourcePengajuanId,
                sourcePengajuanNumber: quotation.sourcePengajuanNumber,
                // Keep backward compatibility if other fields exist
                ...(typeof quotation.documents === 'object' && !Array.isArray(quotation.documents) ? quotation.documents : {})
            };
            console.log('🔗 Linking Outbound to Inbound:', quotation.sourcePengajuanNumber);
        }

        console.log('🔵 Inserting quotation with data:', newQuotation);

        // Only include `item_date` if caller provided a non-empty value.
        // This prevents Supabase/PostgREST schema cache errors when the DB
        // schema does not include the optional `item_date` column.
        if (quotation.itemDate !== undefined && quotation.itemDate !== null && quotation.itemDate !== '') {
            newQuotation.item_date = quotation.itemDate;
        }

        const { data, error } = await supabase
            .from('freight_quotations')
            .insert([newQuotation])
            .select();

        if (error) {
            console.error('❌ Error adding quotation:', error);

            // Fallback: some Supabase/PostgREST deployments may not have
            // the optional `item_date` column in their schema cache yet.
            // Detect that specific error and retry the insert without the
            // `item_date` field so the UI still works on databases that
            // haven't been migrated.
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('item_date') && msg.includes('schema')) {
                console.warn('⚠️ Schema cache missing item_date — retrying without it');
                const safeQuotation = { ...newQuotation };
                delete safeQuotation.item_date;
                const { data: data2, error: error2 } = await supabase
                    .from('freight_quotations')
                    .insert([safeQuotation])
                    .select();
                if (error2) {
                    console.error('❌ Retry without item_date failed:', error2);
                    alert(`Failed to add quotation: ${error2.message}`);
                    return;
                }
                // Continue using the retried result
                if (data2 && data2[0]) {
                    const created = data2[0];
                    setQuotations(prev => [normalizeQuotation(created), ...prev]);
                }
                return;
            }

            alert(`Failed to add quotation: ${error.message}`);
            return;
        }

        console.log('✅ Quotation created successfully:', quotationNumber);

        // Fix: Use the actual data returned from DB (with correct ID) but merge with input to keep UI helpers if any
        const savedData = data[0];
        // Use normalized data to ensure consistent camelCase properties
        const finalQuotation = normalizeQuotation(savedData);

        setQuotations(prev => [...prev, finalQuotation]);
        return finalQuotation;
    };

    const deleteQuotation = async (id) => {
        try {
            console.log('🗑️ [DELETE START] Deleting quotation:', id);

            // 0. Fetch quotation details for numbers
            console.log('📋 [STEP 0] Fetching quotation details...');
            const { data: quotation, error: fetchError } = await supabase
                .from('freight_quotations')
                .select('quotation_number')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('❌ [STEP 0] Fetch error:', fetchError);
            } else {
                console.log('✅ [STEP 0] Fetched quotation:', quotation);
            }

            // 0.5. CRITICAL: Delete linked outbound quotations that reference this inbound (Cascade Delete)
            // This handles the case where outbound submissions reference this inbound via source_pengajuan_id
            console.log('📋 [STEP 0.5] Checking for linked outbound quotations...');
            const { data: linkedOutbound, error: linkedFetchError } = await supabase
                .from('freight_quotations')
                .select('id, quotation_number')
                .eq('source_pengajuan_id', id);

            if (linkedFetchError) {
                console.error('❌ [STEP 0.5] Error fetching linked outbound:', linkedFetchError);
            } else if (linkedOutbound && linkedOutbound.length > 0) {
                console.log(`📋 [STEP 0.5] Found ${linkedOutbound.length} linked outbound quotations to delete:`,
                    linkedOutbound.map(q => q.quotation_number).join(', '));

                // Recursively delete each linked outbound first
                for (const linked of linkedOutbound) {
                    console.log(`🔄 [STEP 0.5] Recursively deleting linked outbound: ${linked.quotation_number}`);
                    await deleteQuotation(linked.id);
                }
                console.log('✅ [STEP 0.5] All linked outbound quotations deleted');
            } else {
                console.log('✅ [STEP 0.5] No linked outbound quotations found');
            }

            // 1. Delete dependent customs documents (Cascade Delete)
            console.log('📋 [STEP 1] Deleting customs documents...');
            const { error: customsError } = await supabase
                .from('freight_customs')
                .delete()
                .eq('quotation_id', id);

            if (customsError) {
                console.error('❌ [STEP 1] Customs delete error:', customsError);
            } else {
                console.log('✅ [STEP 1] Customs documents deleted');
            }

            // 2. Unlink (set null) or Delete related Invoices
            console.log('📋 [STEP 2] Unlinking invoices...');
            const { error: invoiceError } = await supabase
                .from('freight_invoices')
                .update({ quotation_id: null })
                .eq('quotation_id', id);

            if (invoiceError) {
                console.error('❌ [STEP 2] Invoice unlink error:', invoiceError);
            } else {
                console.log('✅ [STEP 2] Invoices unlinked');
            }

            // 3. Unlink related Purchases
            console.log('📋 [STEP 3] Unlinking purchases...');
            const { error: purchaseError } = await supabase
                .from('freight_purchases')
                .update({ quotation_id: null })
                .eq('quotation_id', id);

            if (purchaseError) {
                console.error('❌ [STEP 3] Purchase unlink error:', purchaseError);
            } else {
                console.log('✅ [STEP 3] Purchases unlinked');
            }

            // 4. Delete Warehouse Inventory
            console.log('📋 [STEP 4] Deleting warehouse inventory...');
            const { error: inventoryError } = await supabase
                .from('warehouse_inventory')
                .delete()
                .eq('pengajuan_id', id);

            if (inventoryError) {
                console.error('❌ [STEP 4] Inventory delete error:', inventoryError);
            } else {
                console.log('✅ [STEP 4] Warehouse inventory deleted');
            }

            // 5. Unlink Freight Shipments (if any)
            console.log('📋 [STEP 5] Unlinking shipments...');
            const { error: shipmentError } = await supabase
                .from('freight_shipments')
                .update({ quotation_id: null })
                .eq('quotation_id', id);

            if (shipmentError) {
                console.error('❌ [STEP 5] Shipment unlink error:', shipmentError);
            } else {
                console.log('✅ [STEP 5] Shipments unlinked');
            }

            // 6. Delete Mutation Logs
            if (quotation?.quotation_number) {
                console.log('📋 [STEP 6a] Deleting mutation logs by number:', quotation.quotation_number);
                const { error: gmError } = await supabase
                    .from('freight_mutation_logs')
                    .delete()
                    .eq('pengajuan_number', quotation.quotation_number);

                if (gmError) {
                    console.error('❌ [STEP 6a] Mutation logs delete error (by number):', gmError);
                } else {
                    console.log('✅ [STEP 6a] Mutation logs deleted (by number)');
                }
            }

            // Also try by ID just in case
            console.log('📋 [STEP 6b] Deleting mutation logs by ID...');
            const { error: gmIdError } = await supabase
                .from('freight_mutation_logs')
                .delete()
                .eq('pengajuan_id', id);

            if (gmIdError) {
                console.error('❌ [STEP 6b] Mutation logs delete error (by ID):', gmIdError);
            } else {
                console.log('✅ [STEP 6b] Mutation logs deleted (by ID)');
            }


            // 7. Delete Pabean Module Data (Inbound/Outbound/Reject)
            console.log('📋 [STEP 7a] Deleting Pabean inbound transactions...');
            const { error: inboundError } = await supabase
                .from('freight_inbound')
                .delete()
                .eq('pengajuan_id', id);

            if (inboundError) {
                console.error('❌ [STEP 7a] Inbound delete error:', inboundError);
            } else {
                console.log('✅ [STEP 7a] Inbound transactions deleted');
            }

            console.log('📋 [STEP 7b] Deleting Pabean outbound transactions...');
            const { error: outboundError } = await supabase
                .from('freight_outbound')
                .delete()
                .eq('pengajuan_id', id);

            if (outboundError) {
                console.error('❌ [STEP 7b] Outbound delete error:', outboundError);
            } else {
                console.log('✅ [STEP 7b] Outbound transactions deleted');
            }

            console.log('📋 [STEP 7c] Deleting Pabean reject transactions...');
            const { error: rejectError } = await supabase
                .from('freight_reject')
                .delete()
                .eq('pengajuan_id', id);

            if (rejectError) {
                console.error('❌ [STEP 7c] Reject delete error:', rejectError);
            } else {
                console.log('✅ [STEP 7c] Reject transactions deleted');
            }

            console.log('📋 [STEP 7d] Deleting Warehouse inventory logs...');
            const { error: whError } = await supabase
                .from('freight_warehouse')
                .delete()
                .eq('pengajuan_id', id);

            if (whError) {
                console.error('❌ [STEP 7d] Warehouse delete error:', whError);
            } else {
                console.log('✅ [STEP 7d] Warehouse inventory logs deleted');
            }

            // 8. Finally, Delete the quotation
            console.log('📋 [STEP 8] FINAL STEP: Deleting the quotation itself...');
            const { error, data: deleteResult } = await supabase
                .from('freight_quotations')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('❌❌❌ [STEP 8] CRITICAL: Quotation delete FAILED:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                throw error;
            } else {
                console.log('✅✅✅ [STEP 8] Quotation successfully deleted from database!');
            }

            // 9. Update LOCAL STATE to reflect deletion in UI
            console.log('📋 [STEP 9] Updating local state...');

            // Remove from quotations list
            setQuotations(prev => prev.filter(q => q.id !== id));

            // Remove from Pabean module states
            setInboundTransactions(prev => prev.filter(t => t.pengajuanId !== id && t.pengajuan_id !== id));
            setOutboundTransactions(prev => prev.filter(t => t.pengajuanId !== id && t.pengajuan_id !== id));
            setRejectTransactions(prev => prev.filter(t => t.pengajuanId !== id && t.pengajuan_id !== id));

            // Remove from warehouse inventory
            setWarehouseInventory(prev => prev.filter(inv => inv.pengajuanId !== id && inv.pengajuan_id !== id));

            // Remove from customs documents
            setCustomsDocuments(prev => prev.filter(doc => doc.quotationId !== id && doc.quotation_id !== id));

            console.log('✅ [STEP 9] Local state updated - all related data removed from UI');
            console.log('✅ Quotation deleted successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting quotation:', error);
            return { success: false, error };
        }
    };

    const confirmQuotation = async (quotationId) => {
        console.log('🟢 confirmQuotation called with ID:', quotationId);

        const quotation = quotations.find(q => q.id === quotationId);
        if (!quotation) {
            console.log('🔴 Quotation not found!');
            return;
        }

        // Create BC document
        console.log('🟢 Creating BC document for quotation:', quotation.id);
        const bcDoc = {
            id: `BC-${Date.now()}`,
            bcType: quotation.type === 'inbound' ? 'BC 2.3' : 'BC 2.7',
            bcNumber: `${quotation.type === 'inbound' ? 'BC23' : 'BC27'}-${Date.now().toString().slice(-6)}`,
            submittedDate: new Date().toISOString().split('T')[0],
            quotationId: quotation.id,
            type: quotation.type,
            customer: quotation.customer,
            origin: quotation.origin || '',
            destination: quotation.destination || '',
            items: quotation.items,
            totalItems: quotation.items.reduce((s, i) => s + i.quantity, 0),
            totalValue: quotation.items.reduce((s, i) => s + (i.value || 0), 0),
            status: 'pending',
            approvedDate: null,
            approvedBy: null,
            rejectionReason: null,
            notes: '',
            created_at: new Date().toISOString()
        };

        // Update Quotation Status in Supabase
        const { error: quotError } = await supabase
            .from('freight_quotations')
            .update({ status: 'confirmed' })
            .eq('id', quotationId);

        if (quotError) {
            console.error('Error confirming quotation:', quotError);
            alert('Failed to confirm quotation');
            return;
        }

        // Create BC Document in Supabase
        // Create BC Document in Supabase with correct snake_case mapping
        const bcDocPayload = {
            doc_type: quotation.type === 'inbound' ? 'BC 2.3' : 'BC 2.7', // Assumed snake_case key based on standard
            doc_number: `${quotation.type === 'inbound' ? 'BC23' : 'BC27'}-${Date.now().toString().slice(-6)}`,
            // Use submission date from quotation, not current date
            doc_date: quotation.submissionDate || quotation.submission_date || quotation.date || new Date().toISOString().split('T')[0],
            quotation_id: quotation.id,
            transaction_type: quotation.type, // 'inbound' or 'outbound'
            customer_id: quotation.customerId || null,
            supplier: quotation.shipper || '', // Mapping shipper to supplier for inbound

            // JSONB or Text fields
            asset_name: JSON.stringify(quotation.items || []), // Store items summary or raw
            quantity: quotation.items ? quotation.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0,
            value: quotation.items ? quotation.items.reduce((s, i) => s + (Number(i.value) || 0), 0) : 0,

            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error: bcError } = await supabase
            .from('freight_customs')
            .insert([bcDocPayload]);

        // Note: Check if freight_customs structure matches bcDoc, if not, might need adjustment or dedicated table. 
        // For now trusting schema matches or flexible JSONB columns.

        console.log('🟢 BC document created:', bcDoc);

        setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: 'confirmed' } : q));
        setCustomsDocuments(prev => [...prev, bcDoc]);
    };

    const updateQuotation = async (quotationId, updatedData) => {
        console.log('🔄 updateQuotation called with ID:', quotationId, 'Data:', updatedData);

        const quotation = quotations.find(q => q.id === quotationId);
        if (!quotation) {
            console.log('🔴 Quotation not found!');
            return;
        }

        const previousStatus = quotation.document_status || quotation.documentStatus;
        console.log('🔄 Previous document status:', previousStatus, '→ New:', updatedData.documentStatus);

        // Map camelCase to snake_case for database update
        const dbUpdateData = {};

        // Map all possible fields
        if (updatedData.documentStatus !== undefined) dbUpdateData.document_status = updatedData.documentStatus;
        if (updatedData.customsStatus !== undefined) dbUpdateData.customs_status = updatedData.customsStatus;
        if (updatedData.bcDocumentNumber !== undefined) dbUpdateData.bc_document_number = updatedData.bcDocumentNumber;
        if (updatedData.bcDocumentDate !== undefined) dbUpdateData.bc_document_date = updatedData.bcDocumentDate || null;
        if (updatedData.bcDocType !== undefined) dbUpdateData.bc_document_type = updatedData.bcDocType;
        if (updatedData.approvedDate !== undefined) dbUpdateData.approved_date = updatedData.approvedDate || null;
        if (updatedData.approvedBy !== undefined) dbUpdateData.approved_by = updatedData.approvedBy;
        if (updatedData.rejectionReason !== undefined) dbUpdateData.rejection_reason = updatedData.rejectionReason;
        if (updatedData.rejectionDate !== undefined) dbUpdateData.rejection_date = updatedData.rejectionDate || null;
        if (updatedData.packages !== undefined) dbUpdateData.packages = updatedData.packages;
        if (updatedData.documents !== undefined) dbUpdateData.documents = updatedData.documents;
        if (updatedData.bcSupportingDocuments !== undefined) dbUpdateData.bc_supporting_documents = updatedData.bcSupportingDocuments;
        if (updatedData.notes !== undefined) dbUpdateData.notes = updatedData.notes;
        if (updatedData.pic !== undefined) dbUpdateData.pic = updatedData.pic;
        if (updatedData.status !== undefined) dbUpdateData.status = updatedData.status;
        // Source References
        if (updatedData.sourcePengajuanId !== undefined) dbUpdateData.source_pengajuan_id = updatedData.sourcePengajuanId;
        if (updatedData.sourcePengajuanNumber !== undefined) dbUpdateData.source_pengajuan_number = updatedData.sourcePengajuanNumber;
        if (updatedData.sourceBcDocumentNumber !== undefined) dbUpdateData.source_bc_document_number = updatedData.sourceBcDocumentNumber;
        if (updatedData.sourceBcDocumentDate !== undefined) dbUpdateData.source_bc_document_date = updatedData.sourceBcDocumentDate || null;
        // Invoice / Currency fields
        if (updatedData.invoiceNumber !== undefined) dbUpdateData.invoice_number = updatedData.invoiceNumber;
        if (updatedData.invoiceValue !== undefined) dbUpdateData.invoice_value = updatedData.invoiceValue ? Number(updatedData.invoiceValue) : null;
        if (updatedData.invoiceCurrency !== undefined) dbUpdateData.invoice_currency = updatedData.invoiceCurrency;
        if (updatedData.exchangeRate !== undefined) dbUpdateData.exchange_rate = updatedData.exchangeRate ? Number(updatedData.exchangeRate) : null;
        if (updatedData.exchangeRateDate !== undefined) dbUpdateData.exchange_rate_date = updatedData.exchangeRateDate || null;
        if (updatedData.blNumber !== undefined) dbUpdateData.bl_number = updatedData.blNumber;
        if (updatedData.blDate !== undefined) dbUpdateData.bl_date = updatedData.blDate || null;
        if (updatedData.itemDate !== undefined && updatedData.itemDate !== null && updatedData.itemDate !== '') {
            dbUpdateData.item_date = updatedData.itemDate;
        }

        // Always update timestamp
        dbUpdateData.updated_at = new Date().toISOString();

        console.log('📝 Mapped update data:', dbUpdateData);

        // Update Quotation in Supabase
        const { error: updateError } = await supabase
            .from('freight_quotations')
            .update(dbUpdateData)
            .eq('id', quotationId);

        if (updateError) {
            console.error('❌ Error updating quotation:', updateError);

            // If the schema cache is missing `item_date`, retry without it
            const msg = (updateError.message || '').toLowerCase();
            if (msg.includes('item_date') && msg.includes('schema')) {
                console.warn('⚠️ Schema cache missing item_date on update — retrying without it');
                const safeUpdate = { ...dbUpdateData };
                delete safeUpdate.item_date;
                const { error: updateError2 } = await supabase
                    .from('freight_quotations')
                    .update(safeUpdate)
                    .eq('id', quotationId);
                if (updateError2) {
                    console.error('❌ Retry update without item_date failed:', updateError2);
                    alert(`Failed to update quotation: ${updateError2.message}`);
                    return;
                }
                return;
            }

            alert(`Failed to update quotation: ${updateError.message}`);
            return;
        }

        console.log('✅ Quotation updated successfully');

        // Check if status changed to approved
        if (updatedData.documentStatus === 'approved' && previousStatus !== 'approved') {
            console.log('✅ Status changed to APPROVED - Creating warehouse inventory...');

            // Extract all items from all packages with enhanced data - mapped to freight_warehouse schema
            const allItems = (updatedData.packages || []).flatMap((pkg, pkgIdx) =>
                (pkg.items || []).map((item, itemIdx) => ({
                    // Primary key
                    id: `INV-${quotationId}-P${pkgIdx}-I${itemIdx}-${Date.now()}`,

                    // Foreign key and references - snake_case for Supabase
                    pengajuan_id: quotationId,
                    pengajuan_number: updatedData.quotationNumber || quotation.quotation_number || quotationId,
                    bc_document_number: updatedData.bcDocumentNumber,
                    package_number: pkg.packageNumber,

                    // Item details
                    item_code: item.itemCode || null,
                    item_name: item.name || item.itemName,
                    asset_name: item.name || item.itemName,
                    serial_number: (itemIdx + 1).toString(),
                    quantity: item.quantity || 1,
                    unit: item.uom || 'pcs',
                    condition: item.condition || 'new',
                    value: item.value || (item.price * (item.quantity || 1)) || 0,

                    // Location as JSONB
                    location: JSON.stringify({
                        room: 'Ruang Utama',
                        rack: 'To be assigned',
                        slot: 'To be assigned'
                    }),

                    // Dates - Use submission date from Pengajuan, not current date
                    entry_date: updatedData.submissionDate || quotation.submission_date || quotation.date || new Date().toISOString().split('T')[0],
                    submission_date: updatedData.submissionDate || quotation.submission_date || quotation.date,

                    // Additional info
                    remarks: `Auto-created from pengajuan ${updatedData.quotationNumber || quotation.quotation_number || quotationId}`,
                    notes: item.notes || '',

                    // Timestamps
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }))
            );

            console.log(`📦 Creating ${allItems.length} inventory items in Supabase...`);

            // Insert into Supabase - CORRECT table: freight_warehouse
            const { error: invError } = await supabase.from('freight_warehouse').insert(allItems);
            if (invError) console.error('Error creating inventory in Supabase:', invError);
            else {
                // Determine if we need to add to Inbound/Outbound Transaction Logs
                const updatedQuotation = { ...quotation, ...updatedData };

                // Flatten all items from packages for Pabean display
                const flatItems = (updatedQuotation.packages || []).flatMap((pkg, pkgIdx) =>
                    (pkg.items || []).map((item, itemIdx) => ({
                        itemCode: item.itemCode || null,
                        hsCode: item.hsCode || null,
                        serialNumber: (itemIdx + 1).toString(),
                        goodsType: item.name || item.itemName, // For BarangMasuk.jsx display
                        assetName: item.name || item.itemName,
                        quantity: item.quantity || 1,
                        unit: item.uom || 'pcs',
                        value: item.value || (item.price * (item.quantity || 1)) || 0,
                        packageNumber: pkg.packageNumber
                    }))
                );

                // Transaction data for freight_inbound - use snake_case for DB columns
                const transactionData = {
                    id: `TRX-${quotationId}-${Date.now()}`,
                    pengajuan_id: quotationId,
                    pengajuan_number: updatedQuotation.quotationNumber || updatedQuotation.quotation_number,
                    // FIX: Use submission date from Pengajuan first to maintain consistency with Bridge module
                    date: updatedQuotation.submissionDate || updatedQuotation.submission_date || quotation.submission_date || quotation.date,
                    customs_doc_type: updatedQuotation.bcDocType || updatedQuotation.bc_document_type,
                    customs_doc_number: updatedQuotation.bcDocumentNumber || updatedQuotation.bc_document_number,
                    customs_doc_date: updatedQuotation.bcDocumentDate || updatedQuotation.bc_document_date,
                    receipt_number: updatedQuotation.quotationNumber || updatedQuotation.quotation_number,
                    sender: updatedQuotation.shipper || updatedQuotation.customer,

                    item_code: updatedQuotation.itemCode || flatItems[0]?.itemCode || null,
                    asset_name: flatItems[0]?.assetName || 'Bulk Items',
                    quantity: flatItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
                    unit: 'pcs',
                    value: flatItems.reduce((sum, i) => sum + (i.value || 0), 0),
                    currency: updatedQuotation.invoiceCurrency || updatedQuotation.invoice_currency || quotation.invoice_currency || 'IDR',

                    pic: updatedQuotation.pic || updatedQuotation.approvedBy,
                    documents: JSON.stringify({
                        bcSupportingDocuments: updatedQuotation.bcSupportingDocuments || [],
                        // Include items array in JSONB for Pabean display
                        items: flatItems
                    }),

                    notes: updatedQuotation.notes || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                // For local state - add camelCase aliases and items array for BarangMasuk.jsx
                const transactionForState = {
                    ...transactionData,
                    // CamelCase aliases for local state/UI
                    pengajuanId: quotationId,
                    pengajuanNumber: transactionData.pengajuan_number,
                    customsDocType: transactionData.customs_doc_type,
                    customsDocNumber: transactionData.customs_doc_number,
                    customsDocDate: transactionData.customs_doc_date,
                    receiptNumber: transactionData.receipt_number,
                    itemCode: transactionData.item_code,
                    assetName: transactionData.asset_name,
                    receiver: updatedQuotation.customer,
                    supplier: updatedQuotation.shipper,
                    destination: updatedQuotation.destination,
                    // Items array for BarangMasuk.jsx flatMap
                    items: flatItems,
                    status: 'completed'
                };

                if (updatedQuotation.type === 'inbound') {
                    console.log('✅ Approved Inbound - Inserting to Supabase Inbound Log');
                    await supabase.from('freight_inbound').insert([transactionData]);
                    // Use transactionForState with items array for local state (Pabean display)
                    setInboundTransactions(prev => [transactionForState, ...prev]);
                } else if (updatedQuotation.type === 'outbound') {
                    console.log('✅ Approved Outbound - Inserting to Supabase Outbound Log');
                    await supabase.from('freight_outbound').insert([transactionData]);
                    // Use transactionForState with items array for local state
                    setOutboundTransactions(prev => [transactionForState, ...prev]);
                }

                // Update local warehouse inventory state with allItems for UI
                const allItemsForState = allItems.map(item => ({
                    ...item,
                    // Add camelCase aliases for WarehouseInventory.jsx
                    pengajuanId: item.pengajuan_id,
                    pengajuanNumber: item.pengajuan_number,
                    bcDocumentNumber: item.bc_document_number,
                    packageNumber: item.package_number,
                    itemName: item.item_name,
                    assetName: item.asset_name,
                    serialNumber: item.serial_number,
                    entryDate: item.entry_date,
                    submissionDate: item.submission_date,
                    location: typeof item.location === 'string' ? JSON.parse(item.location) : item.location
                }));
                setWarehouseInventory(prev => [...prev, ...allItemsForState]);
            }

        } else if (updatedData.documentStatus === 'rejected' && previousStatus !== 'rejected') {
            console.log('❌ Rejected - Inserting to Supabase Reject Log');
            const updatedQuotation = { ...quotation, ...updatedData };
            const rejectData = {
                id: `REJ-${quotationId}-${Date.now()}`,
                pengajuanId: quotationId,
                // Use rejection date if provided, otherwise use submission date from quotation
                date: updatedQuotation.rejectionDate || updatedQuotation.rejection_date || updatedQuotation.submissionDate || updatedQuotation.submission_date || quotation.date,
                customsDocType: updatedQuotation.bcDocType,
                customsDocNumber: updatedQuotation.bcDocumentNumber || '-',
                receiptNumber: updatedQuotation.quotationNumber || '-',
                rejectReason: updatedQuotation.rejectionReason,

                itemCode: updatedQuotation.itemCode,
                assetName: updatedQuotation.packages?.[0]?.items?.[0]?.name || 'Rejected Items',
                quantity: updatedQuotation.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0,
                unit: 'pcs',
                value: updatedQuotation.packages?.reduce((sum, pkg) => sum + (pkg.items?.reduce((s, i) => s + (i.value || 0), 0) || 0), 0) || 0,
                currency: updatedQuotation.invoiceCurrency || updatedQuotation.invoice_currency || quotation.invoice_currency || 'IDR',

                pic: updatedQuotation.pic || 'Admin',
                notes: updatedQuotation.notes,
                documents: updatedQuotation.bcSupportingDocuments || [],

                status: 'rejected',
                created_at: new Date().toISOString()
            };

            await supabase.from('freight_reject').insert([rejectData]);
            setRejectTransactions(prev => [rejectData, ...prev]);
        }

        // IMPORTANT: Refetch the updated quotation from database to ensure consistency
        // This solves snake_case/camelCase mapping issues
        const { data: updatedQuotation, error: fetchError } = await supabase
            .from('freight_quotations')
            .select('*')
            .eq('id', quotationId)
            .single();

        if (fetchError) {
            console.error('❌ Error refetching updated quotation:', fetchError);
            // Fallback to local update if refetch fails
            setQuotations(prev => prev.map(q => (q.id === quotationId ? { ...q, ...updatedData } : q)));
        } else {
            console.log('✅ Refetched updated quotation from database:', updatedQuotation);
            // Update with fresh database data
            setQuotations(prev => prev.map(q => (q.id === quotationId ? updatedQuotation : q)));
        }

        // IMPORTANT: Sync inventory data when BC document details are updated (Post-approval edits)
        if (updatedData.bcDocumentNumber || updatedData.bcDocumentDate) {
            // Logic to update existing inventory if BC info changes
            // For now, complicated to do bulk update in Supabase efficiently without multiple calls
            // We will skip auto-sync to DB for now to avoid errors, assuming approval is the main event.
            console.log('📝 Inventory sync for BC update skipped for DB performance (Todo)');
        }
    };

    const approveBC = (bcDocId, approvedBy) => {
        console.log('🟢 approveBC called for:', bcDocId);

        setCustomsDocuments(prev => {
            const updated = prev.map(doc => {
                if (doc.id === bcDocId) {
                    console.log('🟢 Approving BC document:', doc);

                    // Auto-create Goods Movement after BC approval
                    const goodsMovement = {
                        id: `GM - ${Date.now()} `,
                        bcDocId: doc.id,
                        bcNumber: doc.bcNumber || doc.docNumber,
                        bcType: doc.bcType || doc.docType,
                        customer: doc.customer,
                        type: doc.type, // inbound or outbound
                        origin: doc.origin || '',
                        destination: doc.destination || '',
                        items: doc.items || [],
                        totalItems: doc.totalItems || (doc.items?.length || 0),
                        arrivalDate: doc.type === 'inbound' ? new Date().toISOString().split('T')[0] : null,
                        departureDate: doc.type === 'outbound' ? new Date().toISOString().split('T')[0] : null,
                        status: doc.type === 'inbound' ? 'arrived' : 'dispatched',
                        notes: `Auto - generated from BC ${doc.bcNumber || doc.docNumber} `,
                        createdAt: new Date().toISOString()
                    };

                    console.log('🟢 Creating goods movement:', goodsMovement);
                    setGoodsMovements(prevMovements => [...prevMovements, goodsMovement]);

                    return {
                        ...doc,
                        status: 'approved',
                        approvedDate: new Date().toISOString().split('T')[0],
                        approvedBy
                    };
                }
                return doc;
            });

            console.log('🟢 Updated customs documents:', updated);
            return updated;
        });
    };

    const rejectBC = (bcDocId, reason) => {
        setCustomsDocuments(prev => prev.map(doc => doc.id === bcDocId ? {
            ...doc, status: 'rejected', rejectionReason: reason
        } : doc));
    };

    const addGoodsMovement = async (movement) => {
        const newMovement = {
            ...movement,
            id: `GM-${Date.now()}`,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('freight_movements').insert([newMovement]);
        if (error) {
            console.error('Error adding goods movement:', error);
            return;
        }

        setGoodsMovements(prev => [...prev, newMovement]);
        return newMovement;
    };

    const addInventoryMovement = (inventoryItemId, movementData) => {
        console.log('📦 addInventoryMovement called for item:', inventoryItemId, 'Data:', movementData);

        let mutationLogToAdd = null;

        setWarehouseInventory(prevInventory => {
            const updatedInventory = prevInventory.map(item => {
                if (item.id !== inventoryItemId) return item;

                // Calculate remaining stock
                const previousStock = item.currentStock || 0;
                const quantity = movementData.quantity || 0;
                const remainingStock = movementData.movementType === 'in'
                    ? previousStock + quantity
                    : previousStock - quantity;

                // Create movement record
                const newMovement = {
                    id: `MOV-${Date.now()}-${item.movements?.length || 0}`,
                    date: movementData.date || new Date().toISOString().split('T')[0],
                    time: movementData.time || new Date().toLocaleTimeString('id-ID'),
                    quantity: quantity,
                    movementType: movementData.movementType,
                    origin: movementData.origin || 'gudang',
                    destination: movementData.destination || movementData.position,
                    position: movementData.position,
                    condition: movementData.condition || item.condition,
                    remainingStock: remainingStock,
                    pic: movementData.pic,
                    notes: movementData.notes || '',
                    documents: movementData.documents || []
                };

                console.log('📝 New movement:', newMovement);
                console.log('📊 Stock change:', previousStock, '→', remainingStock);

                // Prepare mutation log entry (but don't add yet)
                mutationLogToAdd = {
                    id: `MUTLOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    pengajuanNumber: item.pengajuanNumber || '-',
                    bcDocumentNumber: item.bcDocumentNumber || '-',
                    itemName: item.itemName || item.assetName,
                    serialNumber: item.serialNumber || '-',
                    date: movementData.date || new Date().toISOString().split('T')[0],
                    time: movementData.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    pic: movementData.pic || 'System',
                    totalStock: previousStock,
                    mutatedQty: quantity,
                    remainingStock: remainingStock,
                    origin: movementData.origin || 'gudang',
                    destination: movementData.destination || movementData.position || 'gudang',
                    remarks: movementData.notes || '',
                    documents: movementData.documents || [],
                    submittedBy: 'Current User',
                    submittedAt: new Date().toISOString()
                };

                // Update item - DON'T change currentStock, only add movement history
                return {
                    ...item,
                    // Keep currentStock same as original quantity for repeated mutations
                    // currentStock: remainingStock, // REMOVED - let quantity stay as is
                    status: movementData.position === 'gudang' ? 'in_warehouse' :
                        movementData.position === 'pameran' ? 'in_exhibition' :
                            movementData.position === 'rusak' ? 'damaged' : 'sold',
                    movements: [...(item.movements || []), newMovement]
                };
            });

            return updatedInventory;
        });

        // Add mutation log AFTER inventory update, OUTSIDE the map
        if (mutationLogToAdd) {
            console.log('💾 Adding mutation log:', mutationLogToAdd.id);
            setMutationLogs(prev => [mutationLogToAdd, ...prev]);
        }
    };
    const addInspection = (inspection) => {
        const newInspection = { ...inspection, id: `INS - ${Date.now()} `, createdAt: new Date().toISOString() };
        setInspections(prev => [...prev, newInspection]);
        setGoodsMovements(prev => prev.map(m => m.id === inspection.goodsMovementId ? { ...m, status: 'stored' } : m));
        return newInspection;
    };

    // Helper functions for invoice integration
    const getApprovedPengajuan = () => {
        return quotations.filter(q => q.status === 'approved' || q.status === 'confirmed');
    };

    const getActiveCustomers = () => {
        return customers.filter(c => c.status !== 'inactive');
    };

    const getActiveVendors = () => {
        return vendors.filter(v => v.status !== 'inactive');
    };

    // Company Settings operations
    const fetchCompanySettings = async (module = 'blink') => {
        let retrievedSettings = null;
        
        // Handle 'central' as 'blink' globally for backend matching
        const actualModule = module === 'central' ? 'blink' : module;
        
        let settingsTable = 'company_settings'; // Default blink/central
        let bankTable = 'company_bank_accounts';
        
        if (actualModule === 'bridge') {
            settingsTable = 'bridge_company_settings';
            bankTable = 'bridge_company_bank_accounts';
        } else if (actualModule === 'big') {
            settingsTable = 'big_company_settings';
            bankTable = 'big_company_bank_accounts';
        }

        try {
            console.log(`🔄 Fetching company settings for ${actualModule}...`);
            try {
                const { data: settingsData, error: settingsError } = await supabase
                    .from(settingsTable)
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (settingsError) {
                    console.warn(`Warning: Could not fetch ${settingsTable}:`, settingsError.message);
                } else if (settingsData && settingsData.length > 0) {
                    retrievedSettings = settingsData[0];
                    if (actualModule === 'bridge') setBridgeSettings(settingsData[0]);
                    else if (actualModule === 'big') setBigSettings(settingsData[0]);
                    else setCompanySettings(settingsData[0]); // default
                }
            } catch (e) {
                console.warn(`${settingsTable} table may not exist:`, e.message);
            }

            try {
                const { data: bankData, error: bankError } = await supabase
                    .from(bankTable)
                    .select('*')
                    .order('display_order', { ascending: true });

                if (bankError) {
                    console.warn(`Warning: Could not fetch ${bankTable}:`, bankError.message);
                } else if (bankData) {
                    if (actualModule === 'bridge') setBridgeBankAccounts(bankData);
                    else if (actualModule === 'big') setBigBankAccounts(bankData);
                    else setBankAccounts(bankData); // default
                }
            } catch (e) {
                console.warn(`${bankTable} table may not exist:`, e.message);
            }
        } catch (error) {
            console.warn('Error in fetchCompanySettings (non-critical):', error);
        }

        return retrievedSettings;
    };

    const updateCompanySettings = async (settings, module = 'blink') => {
        try {
            const actualModule = module === 'central' ? 'blink' : module;
            let settingsTable = 'company_settings';
            
            let currentSettings = companySettings;
            if (actualModule === 'bridge') {
                settingsTable = 'bridge_company_settings';
                currentSettings = bridgeSettings;
            } else if (actualModule === 'big') {
                settingsTable = 'big_company_settings';
                currentSettings = bigSettings;
            }

            if (currentSettings?.id) {
                const { data, error } = await supabase
                    .from(settingsTable)
                    .update({
                        company_name: settings.company_name || null,
                        company_address: settings.company_address || null,
                        company_phone: settings.company_phone || null,
                        company_fax: settings.company_fax || null,
                        company_email: settings.company_email || null,
                        company_npwp: settings.company_npwp || null,
                        logo_url: settings.logo_url || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentSettings.id)
                    .select();

                if (error) throw error;

                if (actualModule === 'bridge') setBridgeSettings({ ...bridgeSettings, ...settings });
                else if (actualModule === 'big') setBigSettings({ ...bigSettings, ...settings });
                else setCompanySettings({ ...companySettings, ...settings });
            } else {
                const newSettings = {
                    company_name: settings.company_name || null,
                    company_address: settings.company_address || null,
                    company_phone: settings.company_phone || null,
                    company_fax: settings.company_fax || null,
                    company_email: settings.company_email || null,
                    company_npwp: settings.company_npwp || null,
                    logo_url: settings.logo_url || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from(settingsTable)
                    .insert([newSettings])
                    .select()
                    .single();

                if (error) throw error;

                if (actualModule === 'bridge') setBridgeSettings(data);
                else if (actualModule === 'big') setBigSettings(data);
                else setCompanySettings(data);
            }
        } catch (error) {
            console.error('Error updating company settings:', error);
            throw error;
        }
    };

    const uploadCompanyLogo = async (file, module = 'blink') => {
        try {
            // Validate file
            const validation = validateImage(file);
            if (!validation.isValid) {
                throw new Error(validation.errors.join('\n'));
            }

            // Convert to base64 and store directly in DB
            const base64 = await fileToBase64(file);
            
            const actualModule = module === 'central' ? 'blink' : module;
            let currentSettings = companySettings;
            if (actualModule === 'bridge') currentSettings = bridgeSettings;
            else if (actualModule === 'big') currentSettings = bigSettings;

            await updateCompanySettings({
                ...currentSettings,
                logo_url: base64
            }, module);

            return base64;
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    };

    const addBankAccount = async (bankAccount, module = 'blink') => {
        try {
            const actualModule = module === 'central' ? 'blink' : module;
            let currentSettings = companySettings;
            let currentBanks = bankAccounts;
            let bankTable = 'company_bank_accounts';
            
            if (actualModule === 'bridge') {
                currentSettings = bridgeSettings;
                currentBanks = bridgeBankAccounts;
                bankTable = 'bridge_company_bank_accounts';
            } else if (actualModule === 'big') {
                currentSettings = bigSettings;
                currentBanks = bigBankAccounts;
                bankTable = 'big_company_bank_accounts';
            }

            if (!currentSettings?.id) {
                currentSettings = await fetchCompanySettings(actualModule);
            }

            if (!currentSettings?.id) {
                throw new Error('Company settings not found. Please save company information first.');
            }

            const normalizedBankAccount = {
                bank_name: bankAccount.bank_name || null,
                bank_code: bankAccount.bank_code || null,
                account_number: bankAccount.account_number || null,
                account_holder: bankAccount.account_holder || null,
                branch_name: bankAccount.branch || bankAccount.branch_name || null,
                currency: bankAccount.currency || 'IDR',
                swift_code: bankAccount.swift_code || null,
                company_settings_id: currentSettings.id,
                display_order: currentBanks.length + 1,
                coa_id: bankAccount.coa_id || null,
                coa_code: bankAccount.coa_code || null,
                coa_name: bankAccount.coa_name || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from(bankTable)
                .insert([normalizedBankAccount])
                .select()
                .single();

            if (error) throw error;

            if (actualModule === 'bridge') setBridgeBankAccounts([...currentBanks, data]);
            else if (actualModule === 'big') setBigBankAccounts([...currentBanks, data]);
            else setBankAccounts([...currentBanks, data]);
        } catch (error) {
            console.error('Error adding bank account:', error);
            throw error;
        }
    };

    const updateBankAccount = async (id, updatedBankAccount, module = 'blink') => {
        try {
            const actualModule = module === 'central' ? 'blink' : module;
            let bankTable = 'company_bank_accounts';
            
            if (actualModule === 'bridge') bankTable = 'bridge_company_bank_accounts';
            else if (actualModule === 'big') bankTable = 'big_company_bank_accounts';

            const normalizedUpdate = {
                bank_name: updatedBankAccount.bank_name || null,
                bank_code: updatedBankAccount.bank_code || null,
                account_number: updatedBankAccount.account_number || null,
                account_holder: updatedBankAccount.account_holder || null,
                branch_name: updatedBankAccount.branch || updatedBankAccount.branch_name || null,
                currency: updatedBankAccount.currency || 'IDR',
                swift_code: updatedBankAccount.swift_code || null,
                coa_id: updatedBankAccount.coa_id || null,
                coa_code: updatedBankAccount.coa_code || null,
                coa_name: updatedBankAccount.coa_name || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from(bankTable)
                .update(normalizedUpdate)
                .eq('id', id);

            if (error) throw error;

            if (actualModule === 'bridge') {
                setBridgeBankAccounts(prev => prev.map(bank => bank.id === id ? { ...bank, ...normalizedUpdate } : bank));
            } else if (actualModule === 'big') {
                setBigBankAccounts(prev => prev.map(bank => bank.id === id ? { ...bank, ...normalizedUpdate } : bank));
            } else {
                setBankAccounts(prev => prev.map(bank => bank.id === id ? { ...bank, ...normalizedUpdate } : bank));
            }
        } catch (error) {
            console.error('Error updating bank account:', error);
            throw error;
        }
    };

    const deleteBankAccount = async (id, module = 'blink') => {
        try {
            const actualModule = module === 'central' ? 'blink' : module;
            let bankTable = 'company_bank_accounts';
            
            if (actualModule === 'bridge') bankTable = 'bridge_company_bank_accounts';
            else if (actualModule === 'big') bankTable = 'big_company_bank_accounts';

            const { error } = await supabase
                .from(bankTable)
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (actualModule === 'bridge') setBridgeBankAccounts(prev => prev.filter(bank => bank.id !== id));
            else if (actualModule === 'big') setBigBankAccounts(prev => prev.filter(bank => bank.id !== id));
            else setBankAccounts(prev => prev.filter(bank => bank.id !== id));
        } catch (error) {
            console.error('Error deleting bank account:', error);
            throw error;
        }
    };


    // BC Code CRUD operations
    const addBCCode = async (bcCodeData) => {
        const newBCCode = {
            id: `bc-${Date.now()}`,
            code: bcCodeData.code,
            name: bcCodeData.name,
            category: bcCodeData.category,
            description: bcCodeData.description || null,
            is_active: bcCodeData.isActive !== undefined ? bcCodeData.isActive : true,
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_bc_codes').insert([newBCCode]);
        if (error) {
            console.error('Error adding BC code:', error);
            alert('Gagal menambahkan BC code ke database');
            return;
        }

        setBcCodes(prev => [...prev, newBCCode]);
        return newBCCode;
    };

    const updateBCCode = async (id, updatedData) => {
        const dbUpdate = {
            code: updatedData.code,
            name: updatedData.name,
            category: updatedData.category,
            description: updatedData.description || null,
            is_active: updatedData.isActive,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('freight_bc_codes')
            .update(dbUpdate)
            .eq('id', id);

        if (error) {
            console.error('Error updating BC code:', error);
            alert('Gagal mengupdate BC code');
            return;
        }

        setBcCodes(prev => prev.map(bc => bc.id === id ? { ...bc, ...dbUpdate } : bc));
    };

    const deleteBCCode = async (id) => {
        const { error } = await supabase
            .from('freight_bc_codes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting BC code:', error);
            alert('Gagal menghapus BC code');
            return;
        }

        setBcCodes(prev => prev.filter(bc => bc.id !== id));
    };

    // HS Code CRUD operations
    const addHSCode = async (hsData) => {
        const { data, error } = await supabase
            .from('freight_hs_codes')
            .insert([{
                hs_code: hsData.hsCode,
                description: hsData.description
            }])
            .select();

        if (error) {
            console.error('Error adding HS code:', error);
            alert('Failed to add HS code');
            return;
        }

        if (data) {
            const newHS = {
                id: data[0].id,
                hsCode: data[0].hs_code,
                description: data[0].description
            };
            setHSCodes(prev => [...prev, newHS]);
            return newHS;
        }
    };

    const updateHSCode = async (id, hsData) => {
        const { error } = await supabase
            .from('freight_hs_codes')
            .update({
                hs_code: hsData.hsCode,
                description: hsData.description
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating HS code:', error);
            alert('Failed to update HS code');
            return;
        }

        setHSCodes(prev => prev.map(item =>
            item.id === id ? { ...item, ...hsData } : item
        ));
    };

    const deleteHSCode = async (id) => {
        const { error } = await supabase.from('freight_hs_codes').delete().eq('id', id);
        if (error) {
            console.error('Error deleting HS code:', error);
            alert('Failed to delete HS code');
            return;
        }
        setHSCodes(prev => prev.filter(item => item.id !== id));
    };

    // Item Master CRUD operations
    const addItemCode = async (itemData) => {
        const newItem = {
            id: Date.now().toString(),
            item_code: itemData.itemCode,
            item_type: itemData.itemType,
            description: itemData.description || null,
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_inventory').insert([newItem]);
        if (error) {
            console.error('Error adding item code:', error);
            alert('Failed to add item code to database');
            return;
        }

        // Update local state with camelCase for UI compatibility
        const uiItem = {
            id: newItem.id,
            itemCode: newItem.item_code,
            itemType: newItem.item_type,
            description: newItem.description
        };
        setItemMaster(prev => [...prev, uiItem]);
        return uiItem;
    };

    const updateItemCode = async (id, updatedData) => {
        const dbUpdate = {
            item_code: updatedData.itemCode,
            item_type: updatedData.itemType,
            description: updatedData.description || null,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('freight_inventory')
            .update(dbUpdate)
            .eq('id', id);

        if (error) {
            console.error('Error updating item code:', error);
            alert('Failed to update item code');
            return;
        }

        setItemMaster(prev => prev.map(item =>
            item.id === id ? { ...item, ...updatedData } : item
        ));
    };

    const deleteItemCode = async (id) => {
        const { error } = await supabase
            .from('freight_inventory')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting item code:', error);
            alert('Failed to delete item code');
            return;
        }

        setItemMaster(prev => prev.filter(item => item.id !== id));
    };

    // ========== PIC MASTER CRUD OPERATIONS ==========
    const addPIC = async (picData) => {
        const newPIC = {
            id: Date.now().toString(),
            nik: picData.nik,
            nama: picData.nama,
            jabatan: picData.jabatan,
            is_active: picData.isActive ?? true,
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('freight_pic').insert([newPIC]);
        if (error) {
            console.error('Error adding PIC:', error);
            alert('Failed to add PIC to database');
            return;
        }

        const uiPIC = {
            id: newPIC.id,
            nik: newPIC.nik,
            nama: newPIC.nama,
            jabatan: newPIC.jabatan,
            isActive: newPIC.is_active
        };
        setPicMaster(prev => [...prev, uiPIC]);
        return uiPIC;
    };

    const updatePIC = async (id, updatedData) => {
        const dbUpdate = {
            nama: updatedData.nama,
            jabatan: updatedData.jabatan,
            is_active: updatedData.isActive ?? updatedData.is_active ?? true,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('freight_pic')
            .update(dbUpdate)
            .eq('id', id);

        if (error) {
            console.error('Error updating PIC:', error);
            alert('Failed to update PIC');
            return;
        }

        setPicMaster(prev => prev.map(pic =>
            pic.id === id ? { ...pic, ...updatedData } : pic
        ));
    };

    const deletePIC = async (id) => {
        const { error } = await supabase
            .from('freight_pic')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting PIC:', error);
            alert('Failed to delete PIC');
            return;
        }

        setPicMaster(prev => prev.filter(pic => pic.id !== id));
    };


    // Invoice CRUD operations
    const addInvoice = (invoiceData) => {
        console.log('💾 addInvoice called with data:', invoiceData);

        // Validate and get references
        let pengajuanRef = null;
        let customerRef = null;
        let vendorRef = null;

        // Get pengajuan if provided
        if (invoiceData.pengajuanId) {
            pengajuanRef = quotations.find(q => q.id === invoiceData.pengajuanId);
            if (pengajuanRef) {
                console.log('✅ Found pengajuan:', pengajuanRef.quotationNumber);
            }
        }

        // Get customer if provided
        if (invoiceData.customerId) {
            customerRef = customers.find(c => c.id === invoiceData.customerId);
            if (customerRef) {
                console.log('✅ Found customer:', customerRef.name);
            }
        }

        // Get vendor if provided  
        if (invoiceData.vendorId) {
            vendorRef = vendors.find(v => v.id === invoiceData.vendorId);
            if (vendorRef) {
                console.log('✅ Found vendor:', vendorRef.name);
            }
        }

        const newInvoice = {
            ...invoiceData,
            id: `INV-${Date.now()}`,
            // Use custom invoice number if provided, otherwise auto-generate
            invoiceNumber: invoiceData.customInvoiceNumber || `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
            // Pengajuan reference
            pengajuanId: pengajuanRef?.id || null,
            pengajuanNumber: pengajuanRef?.quotationNumber || null,
            bcDocumentNumber: pengajuanRef?.bcDocumentNumber || null,
            // Customer reference
            customerId: customerRef?.id || null,
            customerName: customerRef?.name || invoiceData.customerName || null,
            // Vendor reference
            vendorId: vendorRef?.id || null,
            vendorName: vendorRef?.name || invoiceData.vendorName || null,
            createdAt: new Date().toISOString()
        };

        console.log('💾 Creating new invoice:', newInvoice);
        setInvoices(prev => {
            const updated = [...prev, newInvoice];
            console.log('💾 Updated invoices array:', updated);
            return updated;
        });
        return newInvoice;
    };

    const updateInvoice = (invoiceId, updates) => {
        console.log('💾 updateInvoice called for:', invoiceId, updates);
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...updates } : inv));
    };

    const deleteInvoice = (invoiceId) => {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    };

    // Purchase CRUD operations
    const addPurchase = (purchaseData) => {
        const newPurchase = {
            ...purchaseData,
            id: `PUR - ${Date.now()} `,
            documentNumber: `PUR - ${new Date().getFullYear()} -${String(purchases.length + 1).padStart(3, '0')} `,
            createdAt: new Date().toISOString()
        };
        setPurchases(prev => [...prev, newPurchase]);
        return newPurchase;
    };

    const updatePurchase = (purchaseId, updates) => {
        setPurchases(prev => prev.map(pur => pur.id === purchaseId ? { ...pur, ...updates } : pur));
    };

    const deletePurchase = (purchaseId) => {
        setPurchases(prev => prev.filter(pur => pur.id !== purchaseId));
    };

    const chunkArray = (arr, size = 500) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
    };

    // Cascade delete for Invoices in Blink module
    const deleteInvoiceCascade = async (invoiceIds, options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete('blink_invoices'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus Invoice.');
            return false;
        }

        try {
            const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];

            const collectByIn = async (table, selectCol, filterCol, values, stage, stageLabel, totalStages = 6) => {
                const rows = [];
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { data, error } = await supabase.from(table).select(selectCol).in(filterCol, chunk);
                    if (error) throw error;
                    rows.push(...(data || []));
                }
                return rows;
            };

            const deleteByIn = async (table, filterCol, values, stage, stageLabel, totalStages = 6) => {
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { error } = await supabase.from(table).delete().in(filterCol, chunk);
                    if (error) throw error;
                }
            };

            // Find related ARs
            emitProgress(onProgress, { stage: 1, totalStages: 6, label: 'Mencari AR terkait...' });
            const ars = await collectByIn('blink_ar_transactions', 'id', 'invoice_id', ids, 1, 'Mencari AR terkait', 6);
            const arIds = ars.map(a => a.id);

            // Find related payments (by invoice or AR reference)
            const paymentRefs = [...ids, ...arIds];
            let paymentIds = [];
            if (paymentRefs.length > 0) {
                emitProgress(onProgress, { stage: 2, totalStages: 6, label: 'Mencari payment terkait...' });
                const payments = await collectByIn('blink_payments', 'id', 'reference_id', paymentRefs, 2, 'Mencari payment terkait', 6);
                paymentIds = payments.map(p => p.id);
            }

            const journalRefIds = [...ids, ...arIds, ...paymentIds];

            emitProgress(onProgress, { stage: 3, totalStages: 6, label: 'Menghapus jurnal...' });
            if (journalRefIds.length > 0) await deleteByIn('blink_journal_entries', 'reference_id', journalRefIds, 3, 'Menghapus jurnal', 6);
            emitProgress(onProgress, { stage: 4, totalStages: 6, label: 'Menghapus payment dan AR...' });
            if (paymentIds.length > 0) await deleteByIn('blink_payments', 'id', paymentIds, 4, 'Menghapus payment', 6);
            if (arIds.length > 0) await deleteByIn('blink_ar_transactions', 'id', arIds, 4, 'Menghapus AR', 6);

            emitProgress(onProgress, { stage: 5, totalStages: 6, label: 'Menghapus invoice utama...' });
            await deleteByIn('blink_invoices', 'id', ids, 5, 'Menghapus invoice utama', 6);

            setInvoices(prev => prev ? prev.filter(inv => !ids.includes(inv.id)) : prev);
            logActivity('blink_invoices', 'delete', 'invoice', ids.join(','), ids.join(','), `Deleted invoices ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 6, totalStages: 6, label: 'Cleansing invoice selesai.' });
            return true;
        } catch (err) {
            console.error('Error deleting invoice cascade:', err);
            alert('Gagal menghapus Invoice: ' + (err.message || err));
            return false;
        }
    };

    // Purchase Order CRUD operations
    const addPurchaseOrder = (poData) => {
        const newPO = {
            ...poData,
            id: `PO-${Date.now()}`,
            poNumber: `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        setPurchaseOrders(prev => [...prev, newPO]);
        return newPO;
    };

    const updatePurchaseOrder = (poId, updates) => {
        setPurchaseOrders(prev => prev.map(po =>
            po.id === poId ? { ...po, ...updates, updated_at: new Date().toISOString() } : po
        ));
    };

    const deletePurchaseOrder = (poId) => {
        setPurchaseOrders(prev => prev.filter(po => po.id !== poId));
    };

    // Cascade delete for Purchase Orders in Blink module
    const deletePurchaseOrderCascade = async (poIds, options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete('blink_purchase_order'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus PO.');
            return false;
        }

        try {
            const ids = Array.isArray(poIds) ? poIds : [poIds];

            const collectByIn = async (table, selectCol, filterCol, values, stage, stageLabel, totalStages = 5) => {
                const rows = [];
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { data, error } = await supabase.from(table).select(selectCol).in(filterCol, chunk);
                    if (error) throw error;
                    rows.push(...(data || []));
                }
                return rows;
            };

            const deleteByIn = async (table, filterCol, values, stage, stageLabel, totalStages = 5) => {
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { error } = await supabase.from(table).delete().in(filterCol, chunk);
                    if (error) throw error;
                }
            };

            // Find related APs
            emitProgress(onProgress, { stage: 1, totalStages: 5, label: 'Mencari AP terkait...' });
            const aps = await collectByIn('blink_ap_transactions', 'id', 'po_id', ids, 1, 'Mencari AP terkait', 5);
            const apIds = aps.map(a => a.id);

            // Find related payments referencing POs
            let paymentIds = [];
            if (ids.length > 0) {
                emitProgress(onProgress, { stage: 2, totalStages: 5, label: 'Mencari payment terkait...' });
                const payments = await collectByIn('blink_payments', 'id', 'reference_id', ids, 2, 'Mencari payment terkait', 5);
                paymentIds = payments.map(p => p.id);
            }

            // Delete all journals linked to PO, AP, and PO payments
            emitProgress(onProgress, { stage: 3, totalStages: 5, label: 'Menghapus jurnal/AP/payment...' });
            const journalRefs = [...ids, ...apIds, ...paymentIds];
            if (journalRefs.length > 0) await deleteByIn('blink_journal_entries', 'reference_id', journalRefs, 3, 'Menghapus jurnal PO/AP', 5);
            // Delete payments
            if (paymentIds.length > 0) await deleteByIn('blink_payments', 'id', paymentIds, 3, 'Menghapus payment PO', 5);
            // Delete APs
            if (apIds.length > 0) await deleteByIn('blink_ap_transactions', 'id', apIds, 3, 'Menghapus AP', 5);

            // Delete transaction records so Finance Record module stays in sync.
            if (journalRefs.length > 0) {
                await deleteByIn('blink_transaction_logs', 'transaction_id', journalRefs, 3, 'Menghapus transaction record PO', 5);
            }

            // Finally delete POs
            emitProgress(onProgress, { stage: 4, totalStages: 5, label: 'Menghapus PO utama...' });
            await deleteByIn('blink_purchase_orders', 'id', ids, 4, 'Menghapus PO utama', 5);

            // Update local cache if present
            setPurchaseOrders(prev => prev ? prev.filter(p => !ids.includes(p.id)) : prev);
            logActivity('blink_purchase_order', 'delete', 'purchase_order', ids.join(','), ids.join(','), `Deleted POs ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 5, totalStages: 5, label: 'Cleansing PO selesai.' });
            return true;
        } catch (err) {
            console.error('Error deleting PO cascade:', err);
            alert('Gagal menghapus PO: ' + (err.message || err));
            return false;
        }
    };

    // Cascade delete for Purchase Orders in Bridge module (chunk-safe)
    const deleteBridgePurchaseOrderCascade = async (poIds, options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete('bridge_finance'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus PO Bridge.');
            return false;
        }

        try {
            const ids = Array.isArray(poIds) ? poIds : [poIds];

            const collectByIn = async (table, selectCol, filterCol, values, stage, stageLabel, totalStages = 5) => {
                const rows = [];
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { data, error } = await supabase.from(table).select(selectCol).in(filterCol, chunk);
                    if (error) throw error;
                    rows.push(...(data || []));
                }
                return rows;
            };

            const deleteByIn = async (table, filterCol, values, stage, stageLabel, totalStages = 5) => {
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { error } = await supabase.from(table).delete().in(filterCol, chunk);
                    if (error) throw error;
                }
            };

            emitProgress(onProgress, { stage: 1, totalStages: 5, label: 'Mencari AP Bridge terkait...' });
            const aps = await collectByIn('bridge_ap_transactions', 'id', 'po_id', ids, 1, 'Mencari AP Bridge', 5);
            const apIds = aps.map(a => a.id);

            const paymentRefs = [...ids, ...apIds];
            let paymentIds = [];
            if (paymentRefs.length > 0) {
                emitProgress(onProgress, { stage: 2, totalStages: 5, label: 'Mencari payment Bridge terkait...' });
                const payments = await collectByIn('bridge_payments', 'id', 'reference_id', paymentRefs, 2, 'Mencari payment Bridge', 5);
                paymentIds = payments.map(p => p.id);
            }

            const journalRefs = [...ids, ...apIds, ...paymentIds];
            emitProgress(onProgress, { stage: 3, totalStages: 5, label: 'Menghapus jurnal/AP/payment Bridge...' });
            if (journalRefs.length > 0) await deleteByIn('bridge_journal_entries', 'reference_id', journalRefs, 3, 'Menghapus jurnal Bridge', 5);
            if (paymentIds.length > 0) await deleteByIn('bridge_payments', 'id', paymentIds, 3, 'Menghapus payment Bridge', 5);
            if (apIds.length > 0) await deleteByIn('bridge_ap_transactions', 'id', apIds, 3, 'Menghapus AP Bridge', 5);

            emitProgress(onProgress, { stage: 4, totalStages: 5, label: 'Menghapus PO Bridge utama...' });
            await deleteByIn('bridge_pos', 'id', ids, 4, 'Menghapus PO Bridge', 5);

            logActivity('bridge_finance', 'delete', 'bridge_purchase_order', ids.join(','), ids.join(','), `Deleted bridge POs ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 5, totalStages: 5, label: 'Cleansing PO Bridge selesai.' });
            return true;
        } catch (err) {
            console.error('Error deleting bridge PO cascade:', err);
            alert('Gagal menghapus PO Bridge: ' + (err.message || err));
            return false;
        }
    };

    // Cascade delete for Invoices in Bridge module (chunk-safe)
    const deleteBridgeInvoiceCascade = async (invoiceIds, options = {}) => {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
        if (!(isAdmin() || canDelete('bridge_finance'))) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus Invoice Bridge.');
            return false;
        }

        try {
            const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];

            const collectByIn = async (table, selectCol, filterCol, values, stage, stageLabel, totalStages = 6) => {
                const rows = [];
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { data, error } = await supabase.from(table).select(selectCol).in(filterCol, chunk);
                    if (error) throw error;
                    rows.push(...(data || []));
                }
                return rows;
            };

            const deleteByIn = async (table, filterCol, values, stage, stageLabel, totalStages = 6) => {
                const chunks = chunkArray(values);
                for (let i = 0; i < chunks.length; i += 1) {
                    const chunk = chunks[i];
                    emitProgress(onProgress, {
                        stage,
                        totalStages,
                        label: stageLabel,
                        batchIndex: i + 1,
                        totalBatches: chunks.length
                    });
                    const { error } = await supabase.from(table).delete().in(filterCol, chunk);
                    if (error) throw error;
                }
            };

            emitProgress(onProgress, { stage: 1, totalStages: 6, label: 'Mencari AR Bridge terkait...' });
            const ars = await collectByIn('bridge_ar_transactions', 'id', 'invoice_id', ids, 1, 'Mencari AR Bridge', 6);
            const arIds = ars.map(a => a.id);

            const paymentRefs = [...ids, ...arIds];
            let paymentIds = [];
            if (paymentRefs.length > 0) {
                emitProgress(onProgress, { stage: 2, totalStages: 6, label: 'Mencari payment Bridge terkait...' });
                const payments = await collectByIn('bridge_payments', 'id', 'reference_id', paymentRefs, 2, 'Mencari payment Bridge', 6);
                paymentIds = payments.map(p => p.id);
            }

            const journalRefs = [...ids, ...arIds, ...paymentIds];
            emitProgress(onProgress, { stage: 3, totalStages: 6, label: 'Menghapus jurnal Bridge...' });
            if (journalRefs.length > 0) await deleteByIn('bridge_journal_entries', 'reference_id', journalRefs, 3, 'Menghapus jurnal Bridge', 6);
            emitProgress(onProgress, { stage: 4, totalStages: 6, label: 'Menghapus payment dan AR Bridge...' });
            if (paymentIds.length > 0) await deleteByIn('bridge_payments', 'id', paymentIds, 4, 'Menghapus payment Bridge', 6);
            if (arIds.length > 0) await deleteByIn('bridge_ar_transactions', 'id', arIds, 4, 'Menghapus AR Bridge', 6);

            emitProgress(onProgress, { stage: 5, totalStages: 6, label: 'Menghapus invoice Bridge utama...' });
            await deleteByIn('bridge_invoices', 'id', ids, 5, 'Menghapus invoice Bridge', 6);

            logActivity('bridge_finance', 'delete', 'bridge_invoice', ids.join(','), ids.join(','), `Deleted bridge invoices ${ids.join(',')}`);
            emitProgress(onProgress, { stage: 6, totalStages: 6, label: 'Cleansing invoice Bridge selesai.' });
            return true;
        } catch (err) {
            console.error('Error deleting bridge invoice cascade:', err);
            alert('Gagal menghapus Invoice Bridge: ' + (err.message || err));
            return false;
        }
    };

    const value = {
        // Centralized data
        vendors, // Deprecated: use businessPartners.filter(p => p.is_vendor)
        customers, // Deprecated: use businessPartners.filter(p => p.is_customer)
        businessPartners, // NEW: Unified partner management
        bridgeBusinessPartners, // Bridge-specific partners
        finance,
        companySettings,
        bankAccounts,
        bridgeSettings,
        bridgeBankAccounts,
        bigSettings,
        bigBankAccounts,

        // Module-specific data
        shipments,
        assets,
        events,

        // Bridge TPPB data
        quotations,
        customsDocuments,
        goodsMovements,
        inspections,
        inboundTransactions,
        outboundTransactions,
        warehouseInventory,
        setWarehouseInventory,
        mutationLogs,
        setMutationLogs,
        addMutationLog,
        updateMutationLog,
        deleteMutationLog,
        bcCodes,
        invoices,
        purchases,
        itemMaster,
        rejectTransactions,
        activityLogs,
        logActivity,
        pendingApprovals,
        requestApproval,
        approveRequest,
        rejectRequest,

        // Vendor operations (Deprecated)
        addVendor,
        updateVendor,
        deleteVendor,

        // Customer operations (Deprecated)
        addCustomer,
        updateCustomer,
        deleteCustomer,

        // Business Partner operations (NEW - Use these for new code)
        addBusinessPartner,
        updateBusinessPartner,
        deleteBusinessPartner,
        deleteBusinessPartnersBulk,
        deleteAllBusinessPartners,

        // Finance operations
        addFinanceTransaction,
        updateFinanceTransaction,
        deleteFinanceTransaction,

        // Shipment operations
        addShipment,
        updateShipment,
        deleteShipment,
        deleteShipmentCascade,

        // Asset operations
        addAsset,
        updateAsset,
        deleteAsset,

        // Event operations
        addEvent,
        updateEvent,
        deleteEvent,

        // Inbound Transaction operations
        addInboundTransaction,
        updateInboundTransaction,
        deleteInboundTransaction,

        // Outbound Transaction operations
        addOutboundTransaction,
        updateOutboundTransaction,
        deleteOutboundTransaction,

        // Warehouse Inventory operations
        addWarehouseInventory,
        updateWarehouseInventory,
        deleteWarehouseInventory,
        updateInventoryStock,
        updateItemCheckout,

        // Customs Document operations
        addCustomsDocument,
        updateCustomsDocument,
        deleteCustomsDocument,
        addQuotation,
        updateQuotation,
        deleteQuotation,
        // Cascade delete helper for blink quotations (permission checked)
        deleteBlinkQuotationCascade,
        confirmQuotation,
        approveBC,
        rejectBC,
        addGoodsMovement,
        addInventoryMovement,
        addInspection,

        // BC Code operations
        addBCCode,
        updateBCCode,
        deleteBCCode,

        // HS Code operations
        hsCodes,
        addHSCode,
        updateHSCode,
        deleteHSCode,

        // Invoice operations
        addInvoice,
        updateInvoice,
        deleteInvoice,
        deleteInvoiceCascade,
        deleteBridgeInvoiceCascade,

        // Purchase operations
        addPurchase,
        updatePurchase,
        deletePurchase,

        // Purchase Order operations
        purchaseOrders,
        addPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,
        deletePurchaseOrderCascade,
        deleteBridgePurchaseOrderCascade,

        // COA delete helpers
        deleteCOA,
        deleteBridgeCOA,

        // Item Master operations
        addItemCode,
        updateItemCode,
        deleteItemCode,

        // PIC Master operations
        picMaster,
        addPIC,
        updatePIC,
        deletePIC,

        // Helper functions
        getApprovedPengajuan,
        getActiveCustomers,
        getActiveVendors,

        // Company Settings operations
        fetchCompanySettings,
        updateCompanySettings,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        uploadCompanyLogo,

        // Locations & Inbound item update
        locations,
        getExhibitionLocation: () => {
            if (locations && locations.length) {
                // Prefer an explicit exhibition flag first
                const byExhibition = locations.find(l => !!l.is_exhibition);
                if (byExhibition) return byExhibition.value;

                // Fallback: find a 'Hall' label/value
                const p = locations.find(l => (String(l.value || l.label || '').toLowerCase().includes('hall')));
                if (p) return p.value;

                // Final fallback: first non-default location (avoid returning Gudang if it's marked default)
                const nonDefault = locations.find(l => !l.is_default);
                if (nonDefault) return nonDefault.value;

                return locations[0].value;
            }
            return 'Gudang'; // Default fallback
        },
        isExhibitionLocation: (val) => {
            if (!val) return false;
            const v = String(val).toLowerCase();
            if (locations && locations.length) {
                const found = locations.find(l => String(l.value).toLowerCase() === v || String(l.label).toLowerCase() === v);
                if (found) return !!found.is_exhibition || String(found.value).toLowerCase().includes('hall') || String(found.label).toLowerCase().includes('hall');
                return v.includes('hall') || v.includes('pameran');
            }
            return v.includes('hall') || v.includes('pameran');
        },
        updateInboundItem,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// TPPB Workflow CRUD methods (added inline)
