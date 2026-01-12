import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
    const [vendors, setVendors] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [finance, setFinance] = useState([]);
    const [companySettings, setCompanySettings] = useState(null);
    const [bankAccounts, setBankAccounts] = useState([]);

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
    const [inboundTransactions, setInboundTransactions] = useState([]);
    const [outboundTransactions, setOutboundTransactions] = useState([]);
    const [rejectTransactions, setRejectTransactions] = useState([]);

    // Activity Logs for audit tracking
    const [activityLogs, setActivityLogs] = useState([]);

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

    // Pending Approvals
    const [pendingApprovals, setPendingApprovals] = useState([]);

    const requestApproval = (type, module, entityType, entityId, entityName, changes, details, requestedBy = 'User') => {
        const newRequest = { id: `approval-${Date.now()}`, requestDate: new Date().toISOString(), type, module, entityType, entityId, entityName, requestedBy, changes, details, status: 'pending' };
        setPendingApprovals(prev => [newRequest, ...prev]);
        logActivity(module, 'approval_request', entityType, entityId, entityName, `Requested ${type}: ${details}`, requestedBy);
        return newRequest.id;
    };

    const approveRequest = (requestId, approvedBy = 'Manager') => {
        setPendingApprovals(prev => prev.map(req => req.id === requestId ? { ...req, status: 'approved', approvedBy, approvalDate: new Date().toISOString() } : req));
        const request = pendingApprovals.find(r => r.id === requestId);
        if (request) logActivity(request.module, 'approved', request.entityType, request.entityId, request.entityName, `Approved ${request.type}`, approvedBy);
    };

    const rejectRequest = (requestId, rejectedBy = 'Manager', reason = '') => {
        setPendingApprovals(prev => prev.map(req => req.id === requestId ? { ...req, status: 'rejected', rejectedBy, rejectionDate: new Date().toISOString(), rejectionReason: reason } : req));
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

                // Load Customers from Supabase (with Debug Logging)
                console.log('🔄 Fetching customers from Supabase...');
                const { data: customerData, error: customerError } = await supabase
                    .from('freight_customers')
                    .select('*');

                if (customerError) {
                    console.error('❌ Error fetching customers:', customerError);
                } else if (customerData) {
                    console.log(`✅ Loaded ${customerData.length} customers from Supabase:`, customerData);
                    setCustomers(customerData);
                }

                // Load Vendors from Supabase
                const { data: vendorData, error: vendorError } = await supabase
                    .from('freight_vendors')
                    .select('*');

                if (vendorError) console.error('Error fetching vendors:', vendorError);
                else if (vendorData) setVendors(vendorData);

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
                    const mappedLogs = (mLogData || []).map(log => ({
                        id: log.id?.toString(),
                        pengajuanId: log.pengajuan_id,
                        pengajuanNumber: log.pengajuan_number,
                        bcDocumentNumber: log.bc_document_number,
                        packageNumber: log.package_number,
                        itemCode: log.item_code,
                        itemName: log.item_name,
                        assetName: log.item_name,
                        hsCode: log.hs_code,
                        serialNumber: log.serial_number,
                        totalStock: log.total_stock,
                        mutatedQty: log.mutated_qty,
                        remainingStock: log.remaining_stock,
                        origin: log.origin,
                        destination: log.destination,
                        condition: log.condition || 'Baik',
                        date: log.date,
                        time: log.time,
                        pic: log.pic,
                        remarks: log.remarks,
                        documents: log.documents || [],
                        uom: log.uom || 'pcs',
                        createdAt: log.created_at,
                        submissionDate: log.date,
                        approvedDate: log.date
                    }));
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

                // Load Company Settings
                await fetchCompanySettings();


            } catch (error) {
                console.error("Failed to load data from Supabase:", error);
            }
        };
        loadData();
    }, []);

    // Save to localStorage whenever data changes
    // Vendors and Customers now managed by Supabase - removed localStorage sync
    /*
    useEffect(() => {
        localStorage.setItem('freight_vendors', JSON.stringify(vendors));
    }, [vendors]);

    useEffect(() => {
        localStorage.setItem('freight_customers', JSON.stringify(customers));
    }, [customers]);
    */

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase.channel('postgres_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_customers' }, (payload) => {
                console.log('⚡ Realtime Customer Update:', payload);
                if (payload.eventType === 'INSERT') setCustomers(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setCustomers(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setCustomers(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_vendors' }, (payload) => {
                console.log('⚡ Realtime Vendor Update:', payload);
                if (payload.eventType === 'INSERT') setVendors(prev => [...prev, payload.new]);
                else if (payload.eventType === 'UPDATE') setVendors(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                else if (payload.eventType === 'DELETE') setVendors(prev => prev.filter(item => item.id !== payload.old.id));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_quotations' }, (payload) => {
                console.log('⚡ Realtime Quotation Update:', payload);
                if (payload.eventType === 'INSERT') setQuotations(prev => [...prev, normalizeQuotation(payload.new)]);
                else if (payload.eventType === 'UPDATE') setQuotations(prev => prev.map(item => item.id === payload.new.id ? normalizeQuotation(payload.new) : item));
                // Delete typically not used for quotations, but handled if needed
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
                const mapRealtimeLog = (log) => ({
                    id: log.id?.toString(),
                    pengajuanId: log.pengajuan_id,
                    pengajuanNumber: log.pengajuan_number,
                    bcDocumentNumber: log.bc_document_number,
                    packageNumber: log.package_number,
                    itemCode: log.item_code,
                    itemName: log.item_name,
                    assetName: log.item_name, // fallback or same
                    hsCode: log.hs_code,
                    serialNumber: log.serial_number,
                    totalStock: log.total_stock,
                    mutatedQty: log.mutated_qty,
                    remainingStock: log.remaining_stock,
                    origin: log.origin,
                    destination: log.destination,
                    condition: log.condition || 'Baik',
                    date: log.date,
                    time: log.time,
                    pic: log.pic,
                    remarks: log.remarks,
                    documents: log.documents || [],
                    uom: log.uom || 'pcs',
                    createdAt: log.created_at,
                    submissionDate: log.date,
                    approvedDate: log.date
                });

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

    const deleteInboundTransaction = (id) => {
        setInboundTransactions(inboundTransactions.filter(t => t.id !== id));
    };

    // Outbound Transaction operations (Bridge TPPB)
    const addOutboundTransaction = async (transaction) => {
        // Check stock availability
        const inventory = warehouseInventory.find(i => i.assetId === transaction.assetId);
        if (!inventory || (inventory.currentStock || 0) < transaction.quantity) {
            console.error('Insufficient stock:', inventory);
            alert('Insufficient stock for outbound transaction');
            // Just return or throw but better to alert
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
                    package_number: mutationData.packageNumber || null,
                    item_code: mutationData.itemCode || null,
                    item_name: mutationData.itemName || mutationData.assetName || null,
                    hs_code: mutationData.hsCode || null,
                    serial_number: mutationData.serialNumber || null,
                    sender: mutationData.sender || null, // Added for Pabean Barang Mutasi
                    date: mutationData.date || new Date().toISOString().split('T')[0],
                    time: mutationData.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    pic: mutationData.pic || null,
                    total_stock: mutationData.totalStock || 0,
                    mutated_qty: mutationData.mutatedQty || 0,
                    remaining_stock: mutationData.remainingStock || 0,
                    origin: mutationData.origin || 'warehouse',
                    destination: mutationData.destination || 'warehouse',
                    condition: mutationData.condition || null,
                    remarks: mutationData.remarks || null,
                    documents: mutationData.documents || [],
                    uom: mutationData.uom || 'pcs'
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
            const formattedLog = {
                id: savedLog.id?.toString(),
                pengajuanId: savedLog.pengajuan_id,
                pengajuanNumber: savedLog.pengajuan_number,
                bcDocumentNumber: savedLog.bc_document_number,
                packageNumber: savedLog.package_number,
                itemCode: savedLog.item_code,
                itemName: savedLog.item_name,
                assetName: savedLog.item_name,
                hsCode: savedLog.hs_code,
                serialNumber: savedLog.serial_number,
                sender: savedLog.sender, // Added for Pabean Barang Mutasi
                totalStock: savedLog.total_stock,
                mutatedQty: savedLog.mutated_qty,
                remainingStock: savedLog.remaining_stock,
                origin: savedLog.origin,
                destination: savedLog.destination,
                condition: savedLog.condition,
                date: savedLog.date,
                time: savedLog.time,
                pic: savedLog.pic,
                remarks: savedLog.remarks,
                documents: savedLog.documents,
                uom: savedLog.uom,
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
            const formattedLog = {
                id: savedLog.id?.toString(),
                pengajuanId: savedLog.pengajuan_id,
                pengajuanNumber: savedLog.pengajuan_number,
                bcDocumentNumber: savedLog.bc_document_number,
                packageNumber: savedLog.package_number,
                itemCode: savedLog.item_code,
                itemName: savedLog.item_name,
                assetName: savedLog.item_name,
                hsCode: savedLog.hs_code,
                totalStock: savedLog.total_stock,
                mutatedQty: savedLog.mutated_qty,
                remainingStock: savedLog.remaining_stock,
                origin: savedLog.origin,
                destination: savedLog.destination,
                condition: savedLog.condition,
                date: savedLog.date,
                time: savedLog.time,
                pic: savedLog.pic,
                remarks: savedLog.remarks,
                documents: savedLog.documents,
                uom: savedLog.uom,
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

            // JSONB fields
            packages: quotation.packages || [],
            documents: quotation.documents || [],
            bc_supporting_documents: quotation.bcSupportingDocuments || [],

            // Additional fields
            notes: quotation.notes || null,
            rejection_reason: quotation.rejectionReason || null,
            rejection_date: quotation.rejectionDate || null,
            pic: quotation.pic || null,

            // Timestamps
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        console.log('🔵 Inserting quotation with data:', newQuotation);

        const { data, error } = await supabase
            .from('freight_quotations')
            .insert([newQuotation])
            .select();

        if (error) {
            console.error('❌ Error adding quotation:', error);
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
                    currency: 'IDR',

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
                currency: 'IDR',

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
    const fetchCompanySettings = async () => {
        try {
            console.log('🔄 Fetching company settings...');
            // Fetch company settings - use limit(1) instead of single() to avoid error
            try {
                const { data: settingsData, error: settingsError } = await supabase
                    .from('company_settings')
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(1);

                console.log('📦 Company settings response:', { settingsData, settingsError });

                if (settingsError) {
                    console.warn('Warning: Could not fetch company settings:', settingsError.message);
                } else if (settingsData && settingsData.length > 0) {
                    console.log('✅ Company settings loaded:', settingsData[0]);
                    setCompanySettings(settingsData[0]);
                } else {
                    console.log('ℹ️ No company settings found');
                }
            } catch (e) {
                console.warn('company_settings table may not exist:', e.message);
            }

            // Fetch bank accounts - wrapped in try-catch to handle missing table
            try {
                const { data: bankData, error: bankError } = await supabase
                    .from('company_bank_accounts')
                    .select('*')
                    .order('display_order', { ascending: true });

                if (bankError) {
                    console.warn('Warning: Could not fetch bank accounts:', bankError.message);
                } else if (bankData) {
                    setBankAccounts(bankData);
                }
            } catch (e) {
                console.warn('company_bank_accounts table may not exist:', e.message);
            }
        } catch (error) {
            console.warn('Error in fetchCompanySettings (non-critical):', error);
        }
    };

    const updateCompanySettings = async (settings) => {
        try {
            console.log('📝 updateCompanySettings called:', settings);
            console.log('📝 Current companySettings:', companySettings);

            if (companySettings?.id) {
                // Update existing
                console.log('📝 Updating existing settings with ID:', companySettings.id);
                const { data, error } = await supabase
                    .from('company_settings')
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
                    .eq('id', companySettings.id)
                    .select();

                if (error) {
                    console.error('❌ Update error:', error);
                    throw error;
                }

                console.log('✅ Settings updated successfully:', data);
                setCompanySettings({ ...companySettings, ...settings });
            } else {
                // Insert new
                console.log('📝 Inserting new settings...');
                const newSettings = {
                    company_name: settings.company_name || null,
                    company_address: settings.company_address || null,
                    company_phone: settings.company_phone || null,
                    company_fax: settings.company_fax || null,
                    company_email: settings.company_email || null,
                    company_npwp: settings.company_npwp || null,
                    logo_url: settings.logo_url || null
                };

                const { data, error } = await supabase
                    .from('company_settings')
                    .insert([newSettings])
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Insert error:', error);
                    throw error;
                }

                console.log('✅ New settings inserted:', data);
                setCompanySettings(data);
            }
        } catch (error) {
            console.error('Error updating company settings:', error);
            throw error;
        }
    };

    const uploadCompanyLogo = async (file) => {
        try {
            const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('company-logos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('company-logos')
                .getPublicUrl(filePath);

            // Update company settings with new logo URL
            await updateCompanySettings({
                ...companySettings,
                logo_url: publicUrl
            });

            return publicUrl;
        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    };

    const addBankAccount = async (bankAccount) => {
        try {
            if (!companySettings?.id) {
                throw new Error('Company settings not found. Please save company information first.');
            }

            const newBankAccount = {
                ...bankAccount,
                company_settings_id: companySettings.id,
                display_order: bankAccounts.length + 1,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('company_bank_accounts')
                .insert([newBankAccount])
                .select()
                .single();

            if (error) throw error;

            setBankAccounts([...bankAccounts, data]);
        } catch (error) {
            console.error('Error adding bank account:', error);
            throw error;
        }
    };

    const updateBankAccount = async (id, updatedBankAccount) => {
        try {
            const { error } = await supabase
                .from('company_bank_accounts')
                .update({
                    ...updatedBankAccount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            setBankAccounts(prev =>
                prev.map(bank => bank.id === id ? { ...bank, ...updatedBankAccount } : bank)
            );
        } catch (error) {
            console.error('Error updating bank account:', error);
            throw error;
        }
    };

    const deleteBankAccount = async (id) => {
        try {
            const { error } = await supabase
                .from('company_bank_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setBankAccounts(prev => prev.filter(bank => bank.id !== id));
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

    const value = {
        // Centralized data
        vendors,
        customers,
        finance,

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

        // Vendor operations
        addVendor,
        updateVendor,
        deleteVendor,

        // Customer operations
        addCustomer,
        updateCustomer,
        deleteCustomer,

        // Finance operations
        addFinanceTransaction,
        updateFinanceTransaction,
        deleteFinanceTransaction,

        // Shipment operations
        addShipment,
        updateShipment,
        deleteShipment,

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

        // Purchase operations
        addPurchase,
        updatePurchase,
        deletePurchase,

        // Purchase Order operations
        purchaseOrders,
        addPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,

        // Item Master operations
        addItemCode,
        updateItemCode,
        deleteItemCode,

        // Helper functions
        getApprovedPengajuan,
        getActiveCustomers,
        getActiveVendors,

        // Company Settings operations
        companySettings,
        bankAccounts,
        fetchCompanySettings,
        updateCompanySettings,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        uploadCompanyLogo,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// TPPB Workflow CRUD methods (added inline)
