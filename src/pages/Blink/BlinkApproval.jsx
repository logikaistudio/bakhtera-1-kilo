import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, Bell, Eye,
    FileText, User, Calendar, ChevronRight,
    RefreshCw, AlertCircle, Check, X, Ship, Plane, Truck, ShoppingBag, Receipt
} from 'lucide-react';
import { createPOApprovalJournal, createInvoiceJournal, getAllCOA } from '../../utils/journalHelper';
import { generateAPNumber, generateARNumber } from '../../utils/documentNumbers';

/**
 * ✅ BLINK APPROVAL CENTER
 * ──────────────────────────────────────────────
 * This component handles BLINK MODULE approvals ONLY.
 * Completely isolated from Bridge approvals.
 * 
 * Two separate approval flows within Blink:
 * 
 * 1️⃣ SALES APPROVALS (blink_sales):
 *    - Quotations → Shipments
 *    - Invoices
 *    Data Source: blink_approval_history table (module = 'blink_sales')
 * 
 * 2️⃣ OPERATIONS APPROVALS (blink_operations):
 *    - Shipments (for BL/AWB issuance)
 *    - Purchase Orders
 *    Data Source: blink_approval_history table (module = 'blink_operations')
 * 
 * Bridge Approvals are handled separately in:
 * - ApprovalManager.jsx (uses approval_requests table)
 */

const isMissingTableError = (error) => {
    const message = String(error?.message || error?.details || error || '').toLowerCase();
    return /relation .* does not exist|table .* does not exist|no such table|does not exist|could not find the table|column .* does not exist|missing column/.test(message);
};

const tryInsertTable = async (tableName, payload) => {
    const { error } = await supabase.from(tableName).insert([payload]);
    if (!error) return true;
    if (isMissingTableError(error)) return false;
    throw error;
};

const insertARTransaction = async (blinkRow, fallbackRow) => {
    try {
        if (await tryInsertTable('blink_ar_transactions', blinkRow)) return;
        const { error } = await supabase.from('big_ar_transactions').insert([fallbackRow]);
        if (error) throw error;
    } catch (e) {
        console.warn('AR transaction creation skipped (no valid DB table available):', e.message);
    }
};

const insertAPTransaction = async (blinkRow, fallbackRow) => {
    try {
        if (await tryInsertTable('blink_ap_transactions', blinkRow)) return;
        const { error } = await supabase.from('big_ap_transactions').insert([fallbackRow]);
        if (error) throw error;
    } catch (e) {
        console.warn('AP transaction creation skipped (no valid DB table available):', e.message);
    }
};

const recordApprovalHistory = async (item, action, reason = null, approverName = 'System') => {
    try {
        // Determine approval module: 'blink_sales' for quotations/invoices, 'blink_operations' for shipments/POs
        const approvalModule = ['quotation', 'invoice'].includes(item.type) ? 'blink_sales' : 'blink_operations';
        
        const payload = {
            document_number: item.refNumber || item.jobNumber || '-',
            document_type: item.type || '-',
            approved_at: new Date().toISOString(),
            approver: approverName,
            status: action, // 'approved' or 'rejected'
            reason: reason || '',
            module: approvalModule  // IMPORTANT: Isolate by module
        };
        
        // Insert ONLY into blink_approval_history - completely isolated from Bridge approvals
        const { data, error } = await supabase.from('blink_approval_history').insert([payload]).select();
        
        if (error) {
            console.error('❌ Failed to record approval history:', error);
            throw error;
        }
        
        console.log(`✅ ${approvalModule} approval history recorded:`, data);
        return true;
    } catch (e) {
        console.error('❌ Logging approval history failed:', e.message);
        // Don't throw - let approval proceed even if history fails
        return false;
    }
};

const BlinkApproval = () => {
    const navigate = useNavigate();
    const { user, isSuperAdmin, isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
    const [submissions, setSubmissions] = useState([]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const resolveShipmentStatus = (shipment = {}) => {
        const status = String(shipment.status || '').toLowerCase();
        const blStatus = String(shipment.bl_status || '').toLowerCase();
        const pendingStates = ['submitted', 'manager_approval', 'pending', 'pending_approval'];

        if (status === 'approved' || blStatus === 'approved') return 'approved';
        if (status === 'rejected' || blStatus === 'rejected') return 'rejected';
        if (pendingStates.includes(status) || pendingStates.includes(blStatus)) return 'submitted';
        return status || blStatus || 'draft';
    };

    const isApprovalPending = (status) => ['submitted', 'manager_approval', 'pending', 'pending_approval'].includes(status);

    const isApprover = isSuperAdmin() || isAdmin() ||
        ['manager', 'blink_manager', 'approver'].includes(user?.user_level);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    useEffect(() => {
        const channel = supabase.channel('approval-submissions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_quotations' }, () => fetchSubmissions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_purchase_orders' }, () => fetchSubmissions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_invoices' }, () => fetchSubmissions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_shipments' }, () => fetchSubmissions())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_approval_history' }, () => fetchSubmissions())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);

            // Fetch pending quotations
            const { data: quotations, error: qErr } = await supabase
                .from('blink_quotations')
                .select('*')
                .eq('status', 'manager_approval')
                .order('created_at', { ascending: false });
            if (qErr) console.error('Error fetching quotations:', qErr);

            // Fetch pending Purchase Orders
            const { data: purchaseOrders, error: poErr } = await supabase
                .from('blink_purchase_orders')
                .select('*')
                .in('status', ['submitted', 'manager_approval', 'pending', 'pending_approval'])
                .order('created_at', { ascending: false });
            if (poErr) console.error('Error fetching POs:', poErr);

            // Fetch pending Shipments
            const { data: shipments, error: shErr } = await supabase
                .from('blink_shipments')
                .select('*')
                .or('bl_status.in.(submitted,manager_approval,pending,pending_approval),status.in.(submitted,manager_approval,pending,pending_approval)')
                .order('created_at', { ascending: false });
            if (shErr) console.error('Error fetching shipments:', shErr);

            // Fetch pending Invoices
            const { data: invoices, error: invErr } = await supabase
                .from('blink_invoices')
                .select('*')
                .in('status', ['submitted', 'manager_approval', 'pending', 'pending_approval'])
                .order('created_at', { ascending: false });
            if (invErr) console.error('Error fetching invoices:', invErr);

            const mappedQuotations = (quotations || []).map(q => ({
                id: q.id,
                type: 'quotation',
                typeLabel: 'Quotation',
                refNumber: q.quotation_number || q.job_number,
                customerName: q.customer_name || '-',
                submittedBy: q.sales_person || '-',
                serviceType: q.service_type || 'general',
                origin: q.origin || '-',
                destination: q.destination || '-',
                amount: q.total_amount || 0,
                currency: q.currency || 'USD',
                status: q.status,
                createdAt: q.created_at,
                updatedAt: q.updated_at,
                notes: q.notes || '',
                rejectionReason: q.rejection_reason || '',
                serviceItems: q.service_items || [],
                commodity: q.commodity || '',
                quotationType: q.quotation_type || 'RG',
            }));

            const mappedPOs = (purchaseOrders || []).map(po => ({
                id: po.id,
                type: 'po',
                typeLabel: 'Purchase Order',
                refNumber: po.po_number,
                customerName: po.vendor_name || '-',
                submittedBy: po.notes ? po.notes.substring(0, 60) : '-',
                serviceType: 'purchase',
                origin: po.job_number ? `Job #${po.job_number}` : '-',
                destination: po.po_date ? new Date(po.po_date).toLocaleDateString('id-ID') : '-',
                amount: po.total_amount || 0,
                currency: po.currency || 'IDR',
                status: po.status,
                createdAt: po.created_at,
                updatedAt: po.updated_at,
                notes: po.notes || '',
                rejectionReason: po.rejection_reason || '',
                serviceItems: po.po_items || [],
                po_id: po.id,
                vendor_id: po.vendor_id,
                shipment_id: po.shipment_id,
            }));

            const mappedShipments = (shipments || []).map(s => ({
                id: s.id,
                type: 'shipment',
                typeLabel: 'Shipment',
                refNumber: s.job_number || s.so_number || '-',
                customerName: s.customer || '-',
                submittedBy: s.sales_person || 'Operations',
                serviceType: s.service_type || s.serviceType || 'sea',
                origin: s.origin || '-',
                destination: s.destination || '-',
                amount: s.quoted_amount || 0,
                currency: s.currency || 'USD',
                status: resolveShipmentStatus(s),
                createdAt: s.created_at,
                updatedAt: s.updated_at,
                notes: s.notes || '',
                rejectionReason: s.rejection_reason || '',
                serviceItems: [],
                commodity: s.commodity || '',
                cargoType: s.cargo_type || '',
            }));

            const mappedInvoices = (invoices || []).map(inv => ({
                id: inv.id,
                type: 'invoice',
                typeLabel: 'Invoice',
                refNumber: inv.invoice_number,
                customerName: inv.customer_name || '-',
                submittedBy: inv.sales_person || inv.created_by || '-',
                serviceType: 'invoice',
                jobNumber: inv.job_number || inv.so_number || '-',
                invoiceDate: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('id-ID') : '-',
                dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '-',
                amount: inv.total_amount || inv.grand_total || 0,
                currency: inv.currency || inv.billing_currency || 'IDR',
                status: inv.status,
                createdAt: inv.created_at,
                updatedAt: inv.updated_at,
                notes: inv.notes || inv.customer_notes || '',
                rejectionReason: inv.rejection_reason || '',
                serviceItems: inv.invoice_items || inv.items || [],
                commodity: '',
                cargoType: '',
            }));

            setSubmissions([...mappedShipments, ...mappedPOs, ...mappedQuotations, ...mappedInvoices]);

            // Fetch History - ISOLATED for Blink only
            const { data: historyData, error: histErr } = await supabase
                .from('blink_approval_history')
                .select('*')
                .in('module', ['blink_sales', 'blink_operations'])
                .order('approved_at', { ascending: false });
                
            if (histErr) {
                console.error('❌ Error fetching approval history:', histErr);
            } else {
                console.log('✅ Blink approval history loaded:', historyData?.length || 0, 'records');
                setHistoryLogs(historyData || []);
            }

        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
        }
    };


    const handleApprove = async (item) => {
        if (!isApprover) return;
        try {
            setProcessing(true);

            if (item.type === 'shipment') {
                // Approve Shipment → unlock PO & Invoice
                const { error } = await supabase
                    .from('blink_shipments')
                    .update({
                        status: 'approved',
                        bl_status: 'approved',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', item.id);
                if (error) throw error;

            } else if (item.type === 'po') {
                // Approve Purchase Order
                const { error } = await supabase
                    .from('blink_purchase_orders')
                    .update({
                        status: 'approved',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;

                // Auto-create AP transaction
                const today = new Date();
                const billDate = today.toISOString().split('T')[0];
                let daysToAdd = 30;
                const { data: poData, error: poFetchError } = await supabase.from('blink_purchase_orders').select('*').eq('id', item.id).single();

                if (poFetchError) throw poFetchError;

                if (poData?.payment_terms) {
                    const m = poData.payment_terms.match(/\d+/);
                    if (m) daysToAdd = parseInt(m[0]);
                }
                const dueDate = new Date(today);
                dueDate.setDate(dueDate.getDate() + daysToAdd);
                const dueDateStr = dueDate.toISOString().split('T')[0];

                const apNumber = generateAPNumber();

                const blinkAPRow = {
                    ap_number: apNumber,
                    po_id: poData.id,
                    po_number: poData.po_number,
                    vendor_id: poData.vendor_id,
                    vendor_name: poData.vendor_name,
                    bill_date: billDate,
                    due_date: dueDateStr,
                    original_amount: poData.total_amount || item.amount,
                    paid_amount: 0,
                    outstanding_amount: poData.total_amount || item.amount,
                    currency: poData.currency || 'IDR',
                    status: 'outstanding',
                    notes: `Auto-created from PO ${poData.po_number} (${poData.payment_terms || 'NET 30'})`
                };

                const bigAPRow = {
                    po_id: poData.id,
                    po_number: poData.po_number,
                    vendor_id: poData.vendor_id,
                    vendor_name: poData.vendor_name,
                    bill_date: billDate,
                    due_date: dueDateStr,
                    original_amount: poData.total_amount || item.amount,
                    paid_amount: 0,
                    outstanding_amount: poData.total_amount || item.amount,
                    currency: poData.currency || 'IDR',
                    status: 'outstanding',
                    notes: `Auto-created from PO ${poData.po_number} (${poData.payment_terms || 'NET 30'})`
                };

                try {
                    await insertAPTransaction(blinkAPRow, bigAPRow);
                    console.log('AP entry created successfully for PO', poData.po_number);
                } catch (apError) {
                    console.error('[Approval] AP creation failed:', apError.message || apError);
                }

                // Create Journal Entries - using the robust journalHelper.js
                try {
                    const coaList = await getAllCOA();
                    const fullPO = { ...poData, total_amount: poData.total_amount }; 
                    await createPOApprovalJournal({ po: fullPO, coaList });
                } catch (jeErr) {
                    console.warn('[Approval] Journal entry creation failed:', jeErr.message);
                }

            } else if (item.type === 'invoice') {
                // 1. Approve invoice
                const { error } = await supabase
                    .from('blink_invoices')
                    .update({
                        status: 'unpaid',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;

                // 2. Fetch full invoice data for journal creation
                const { data: invData, error: invFetchErr } = await supabase
                    .from('blink_invoices')
                    .select('*')
                    .eq('id', item.id)
                    .single();
                if (invFetchErr) throw invFetchErr;

                const today = new Date();
                const billDate = today.toISOString().split('T')[0];

                const blinkARRow = {
                    invoice_id: invData.id,
                    invoice_number: invData.invoice_number,
                    ar_number: generateARNumber(),
                    customer_id: invData.customer_id,
                    customer_name: invData.customer_name,
                    transaction_date: billDate,
                    due_date: invData.due_date || billDate,
                    original_amount: item.amount,
                    paid_amount: 0,
                    outstanding_amount: item.amount,
                    currency: invData.currency || 'IDR',
                    exchange_rate: invData.exchange_rate || 1,
                    status: 'outstanding',
                    notes: `Auto-created from Invoice ${invData.invoice_number}`
                };

                const bigARRow = {
                    invoice_id: invData.id,
                    client_id: invData.customer_id || null,
                    transaction_date: billDate,
                    due_date: invData.due_date || billDate,
                    original_amount: item.amount,
                    paid_amount: 0,
                    outstanding_amount: item.amount,
                    status: 'outstanding'
                };

                try {
                    await insertARTransaction(blinkARRow, bigARRow);
                    console.log('AR entry created successfully for Invoice', invData.invoice_number);
                } catch (arError) {
                    console.error('[Approval] AR creation failed:', arError.message || arError);
                }

                // 4. Auto-create Journal Entries: Debit AR, Credit Revenue
                try {
                    const coaList = await getAllCOA();
                    await createInvoiceJournal({ invoice: invData, coaList });
                } catch (jeErr) {
                    console.warn('[Approval] Invoice Journal creation failed:', jeErr.message);
                }
            } else {
                // Approve Quotation → Auto-create SO & Shipment
                // Fetch full quotation data first
                const { data: quotationData, error: fetchErr } = await supabase
                    .from('blink_quotations')
                    .select('*')
                    .eq('id', item.id)
                    .single();
                if (fetchErr) throw fetchErr;

                // Generate SO Number
                const { generateSONumber } = await import('../../utils/documentNumbers');
                const jobNumber = quotationData.job_number || quotationData.quotation_number;
                const soNumber = generateSONumber(jobNumber);

                // Update quotation status to 'converted' (since it automatically becomes an SO step)
                // BUT we do this AFTER the insert succeeds!

                // Determine BL type based on service type
                const isAirFreight = (quotationData.service_type || '').toLowerCase() === 'air';
                const blPrefix = isAirFreight ? 'AWB' : 'BL';
                const blNumber = `${blPrefix}-${soNumber}`;

                // Auto-create Shipment (minimal fields to avoid schema cache issues)
                const coreData = {
                    job_number: quotationData.job_number,
                    so_number: soNumber,
                    quotation_id: quotationData.id,
                    customer: quotationData.customer_name || '',
                    // Use pic_ops for operations quotations; sales_person for sales quotations
                    sales_person: quotationData.sales_person || '',
                    pic_ops: quotationData.sales_person || '',
                    quotation_type: quotationData.quotation_type || 'RG',
                    quotation_date: quotationData.quotation_date,
                    origin: quotationData.origin,
                    destination: quotationData.destination,
                    service_type: quotationData.service_type,
                    cargo_type: quotationData.cargo_type,
                    weight: quotationData.weight,
                    volume: quotationData.volume,
                    commodity: quotationData.commodity,
                    quoted_amount: quotationData.total_amount || 0,
                    currency: quotationData.currency || 'USD',
                    exchange_rate: quotationData.exchange_rate || null,
                    // 'pending' so the Ops team must still submit it to Approval Center
                    // before Generate PO / Create Invoice buttons unlock
                    status: 'pending',
                    created_from: 'ops_order',
                    service_items: quotationData.service_items || [],
                    selling_items: quotationData.service_items || [],
                    notes: quotationData.notes || '',
                    gross_weight: quotationData.gross_weight || null,
                    net_weight: quotationData.net_weight || null,
                    measure: quotationData.measure || null,
                    packages: quotationData.quantity && quotationData.package_type
                        ? `${quotationData.quantity} ${quotationData.package_type}`
                        : (quotationData.package_type || null),
                    incoterm: quotationData.incoterm || null,
                    payment_terms: quotationData.payment_terms || null,
                    customer_id: quotationData.customer_id || null,
                };

                const { error: shipErr } = await supabase
                    .from('blink_shipments')
                    .insert([coreData]);

                if (shipErr) throw shipErr;

                // Mark quotation as converted
                const { error: updateErr } = await supabase
                    .from('blink_quotations')
                    .update({ status: 'converted', updated_at: new Date().toISOString() })
                    .eq('id', item.id);
                if (updateErr) console.error('Warning: Error updating quotation status to converted:', updateErr);

                // Add to history
                await recordApprovalHistory(item, 'approved', null, user?.name || user?.email || 'Manager');

                setSubmissions(prev => prev.filter(i => i.id !== item.id));
                setShowDetailModal(false);
                setSelectedItem(null);
                // Also fetch again just in case
                fetchSubmissions();

                alert(`✅ Quotation ${item.refNumber} disetujui!\n\n📦 Shipment ${soNumber} berhasil dibuat.\n\n⚠️ Langkah berikutnya: Buka Shipment Management → Submit for Approval → setelah disetujui manajer, tombol Generate PO & Invoice akan terbuka.`);
                setTimeout(() => navigate('/blink/shipments'), 1000);
                return; // skip the generic alert below
            }

            // For other types: shipment, po, invoice
            await recordApprovalHistory(item, 'approved', null, user?.name || user?.email || 'Manager');
            
            setSubmissions(prev => prev.filter(i => i.id !== item.id));
            setShowDetailModal(false);
            setSelectedItem(null);
            fetchSubmissions();
            
            alert(`✅ ${item.typeLabel} ${item.refNumber} berhasil disetujui!`);
        } catch (err) {
            alert('Failed to approve: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (item) => {
        if (!isApprover) return;
        if (!rejectReason.trim()) { alert('Please provide a rejection reason'); return; }
        try {
            setProcessing(true);

            if (item.type === 'shipment') {
                const { error } = await supabase
                    .from('blink_shipments')
                    .update({
                        status: 'rejected',
                        bl_status: 'rejected',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', item.id);
                if (error) throw error;

            } else if (item.type === 'po') {
                const { error } = await supabase
                    .from('blink_purchase_orders')
                    .update({
                        status: 'draft',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;
            } else if (item.type === 'invoice') {
                const { error } = await supabase
                    .from('blink_invoices')
                    .update({
                        status: 'draft',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('blink_quotations')
                    .update({ status: 'rejected', rejection_reason: rejectReason, updated_at: new Date().toISOString() })
                    .eq('id', item.id);
                if (error) throw error;
            }

            // Log history
            await recordApprovalHistory(item, 'rejected', rejectReason, user?.name || user?.email || 'Manager');

            setSubmissions(prev => prev.filter(i => i.id !== item.id));
            setShowDetailModal(false);
            setSelectedItem(null);
            setRejectReason('');
            setShowRejectInput(false);
            fetchSubmissions();
        } catch (err) {
            alert('Failed to reject: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const statusConfig = {
        draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: FileText },
        submitted: { label: 'Pending Approval', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
        manager_approval: { label: 'Pending Approval', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
        sent: { label: 'Sent', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: Check },
        revision_requested: { label: 'Needs Revision', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertCircle },
        approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
        rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
        converted: { label: 'SO Created', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle },
    };

    const serviceIcons = { sea: Ship, air: Plane, land: Truck, purchase: ShoppingBag, shipment: Ship, invoice: Receipt };

    const filtered = submissions;
    const pendingCount = submissions.length;

    const formatCurrency = (val, currency) => {
        const sym = currency === 'IDR' ? 'Rp' : currency === 'USD' ? '$' : currency || '';
        return `${sym} ${(val || 0).toLocaleString('id-ID')}`;
    };

    const formatDate = (d) => d
        ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';

    const closeModal = () => {
        setShowDetailModal(false);
        setSelectedItem(null);
        setShowRejectInput(false);
        setRejectReason('');
    };

    return (
        <div className="space-y-6">
            {/* Header with Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 style={{ color: '#111827' }} className="text-2xl font-bold flex items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                            Operation Approval Center
                        </h1>
                    </div>
                    <p style={{ color: '#4B5563' }} className="text-sm mt-1">
                        Manage all operational document submissions in the BLINK module
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                            ${activeTab === 'pending'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Clock className="w-4 h-4" />
                        Pending Approvals
                        {pendingCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                            ${activeTab === 'history'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        Approval History
                    </button>
                    <button
                        onClick={fetchSubmissions}
                        className="p-2.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border-l border-gray-100 ml-1"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>


            {/* Non-approver warning */}
            {!isApprover && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p style={{ color: '#111827' }} className="text-sm font-semibold">Access Restricted</p>
                        <p style={{ color: '#4B5563' }} className="text-sm mt-0.5">
                            Only Manager/Admin can approve or reject submissions.
                        </p>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p style={{ color: '#4B5563' }} className="text-sm">Loading data...</p>
                    </div>
                </div>
            ) : activeTab === 'pending' ? (
                filtered.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p style={{ color: '#4B5563' }}>No submissions</p>
                        <p style={{ color: '#9CA3AF' }} className="text-sm mt-1">All submissions have been processed</p>
                    </div>
                ) : (
                <div className="space-y-3">
                    {filtered.map(item => {
                        const cfg = statusConfig[item.status] || statusConfig.draft;
                        const StatusIcon = cfg.icon;
                        const SvcIcon = serviceIcons[item.serviceType] || FileText;
                        const isPending = isApprovalPending(item.status);

                        return (
                            <div
                                key={item.id}
                                onClick={() => { setSelectedItem(item); setShowDetailModal(true); setRejectReason(''); setShowRejectInput(false); }}
                                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${isPending ? 'border-yellow-300 shadow-sm' : 'border-gray-200'}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon badge */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                                        <SvcIcon className={`w-5 h-5 ${isPending ? 'text-yellow-600' : 'text-gray-500'}`} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-sm font-bold" style={{ color: '#0070BB' }}>{item.refNumber}</span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {cfg.label}
                                            </span>
                                            {isPending && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-200 font-semibold">
                                                    ⚡ Action Needed
                                                </span>
                                            )}
                                        </div>

                                        <p style={{ color: '#111827' }} className="font-medium mt-1 truncate">{item.customerName}</p>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: '#4B5563' }}>
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {item.submittedBy}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <SvcIcon className="w-3 h-3" />
                                                {item.serviceType?.toUpperCase()} · {item.origin} → {item.destination}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(item.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right flex-shrink-0">
                                        <p style={{ color: '#111827' }} className="font-bold text-sm">{formatCurrency(item.amount, item.currency)}</p>
                                        <ChevronRight className="w-4 h-4 text-gray-400 mt-2 ml-auto" />
                                    </div>
                                </div>

                                {/* Quick actions for pending */}
                                {isPending && isApprover && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> View Details
                                        </button>
                                        <button
                                            onClick={() => handleApprove(item)}
                                            disabled={processing}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                                        >
                                            <Check className="w-3.5 h-3.5" /> Approve
                                        </button>
                                        <button
                                            onClick={() => { setSelectedItem(item); setShowDetailModal(true); setShowRejectInput(true); }}
                                            disabled={processing}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >
                                            <X className="w-3.5 h-3.5" /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                )
            ) : (
                /* HISTORY TAB */
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="font-semibold text-gray-800">Historical Operational Approvals</h2>
                        <div className="text-sm text-gray-500">Showing {historyLogs.length} records</div>
                    </div>
                    {historyLogs.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">Belum ada riwayat approval.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Tanggal</th>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">No Dokumen</th>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Tipe</th>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Approver</th>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                                        <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Alasan Reject</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {historyLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(log.approved_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{log.document_number}</td>
                                            <td className="px-6 py-4 text-gray-600 capitalize">{String(log.document_type || '-').replace('_', ' ')}</td>
                                            <td className="px-6 py-4 text-gray-600">{log.approver}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full font-medium text-xs border ${
                                                    log.status === 'approved' ? statusConfig.approved.bg + ' ' + statusConfig.approved.text + ' ' + statusConfig.approved.border :
                                                    statusConfig.rejected.bg + ' ' + statusConfig.rejected.text + ' ' + statusConfig.rejected.border
                                                }`}>
                                                    {log.status === 'approved' ? 'Approved' : 'Rejected'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 truncate max-w-[200px]" title={log.reason || '-'}>
                                                {log.reason ? <span className="text-red-500 italic">{log.reason}</span> : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Detail Modal ──────────────────────────────────────── */}
            {showDetailModal && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 style={{ color: '#111827' }} className="text-lg font-bold">Submission Details</h2>
                                <p style={{ color: '#4B5563' }} className="text-xs mt-0.5">{selectedItem.typeLabel} · {selectedItem.refNumber}</p>
                            </div>
                            <button onClick={closeModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Status badge */}
                            {(() => {
                                const cfg = statusConfig[selectedItem.status] || statusConfig.draft;
                                const StatusIcon = cfg.icon;
                                return (
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                        <StatusIcon className="w-4 h-4" />
                                        {cfg.label}
                                    </span>
                                );
                            })()}

                            {/* Info grid */}
                            {(() => {
                                const infoFields = selectedItem.type === 'po' ? [
                                    { label: 'PO Number', value: selectedItem.refNumber },
                                    { label: 'Vendor', value: selectedItem.customerName },
                                    { label: 'Job Number', value: selectedItem.origin },
                                    { label: 'PO Date', value: selectedItem.destination },
                                    { label: 'Currency', value: selectedItem.currency },
                                    { label: 'Total Amount', value: `${selectedItem.currency} ${(selectedItem.amount || 0).toLocaleString('id-ID')}`, highlight: true },
                                    { label: 'Submitted', value: formatDate(selectedItem.createdAt) },
                                ] : selectedItem.type === 'invoice' ? [
                                    { label: 'Invoice Number', value: selectedItem.refNumber },
                                    { label: 'Customer', value: selectedItem.customerName },
                                    { label: 'Job / SO', value: selectedItem.jobNumber },
                                    { label: 'Invoice Date', value: selectedItem.invoiceDate },
                                    { label: 'Due Date', value: selectedItem.dueDate },
                                    { label: 'Currency', value: selectedItem.currency },
                                    { label: 'Total Amount', value: `${selectedItem.currency} ${(selectedItem.amount || 0).toLocaleString('id-ID')}`, highlight: true },
                                    { label: 'Submitted', value: formatDate(selectedItem.createdAt) },
                                ] : [
                                    { label: 'Customer', value: selectedItem.customerName },
                                    { label: 'Person in Charge', value: selectedItem.submittedBy },
                                    { label: 'Service Type', value: selectedItem.serviceType?.toUpperCase() },
                                    { label: 'Quotation Type', value: selectedItem.quotationType },
                                    { label: 'Origin', value: selectedItem.origin },
                                    { label: 'Destination', value: selectedItem.destination },
                                    { label: 'Commodity', value: selectedItem.commodity || '-' },
                                    { label: 'Total Estimated', value: formatCurrency(selectedItem.amount, selectedItem.currency), highlight: true },
                                    { label: 'Created At', value: formatDate(selectedItem.createdAt) },
                                    { label: 'Updated At', value: formatDate(selectedItem.updatedAt) },
                                ];
                                return (
                                    <div className="grid grid-cols-2 gap-3">
                                        {infoFields.map((f, i) => (
                                            <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p style={{ color: '#4B5563' }} className="text-xs mb-1">{f.label}</p>
                                                <p className="text-sm font-medium" style={{ color: f.highlight ? '#EA580C' : '#111827' }}>{f.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Service items */}
                            {selectedItem.serviceItems?.length > 0 && (
                                <div>
                                    <h3 style={{ color: '#111827' }} className="text-sm font-semibold mb-2">Cost Breakdown</h3>
                                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left px-3 py-2">Item</th>
                                                    <th className="text-left px-3 py-2">Description</th>
                                                    <th className="text-right px-3 py-2">Qty</th>
                                                    <th className="text-right px-3 py-2">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedItem.serviceItems.map((si, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 font-mono text-xs" style={{ color: '#0070BB' }}>{si.itemCode || '-'}</td>
                                                        <td className="px-3 py-2">{si.description || si.name || '-'}</td>
                                                        <td className="px-3 py-2 text-right">{si.quantity || 1}</td>
                                                        <td className="px-3 py-2 text-right">{formatCurrency(si.amount || si.total || 0, selectedItem.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedItem.notes && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    <p style={{ color: '#4B5563' }} className="text-xs mb-1">Notes</p>
                                    <p style={{ color: '#111827' }} className="text-sm">{selectedItem.notes}</p>
                                </div>
                            )}

                            {/* Existing rejection reason */}
                            {selectedItem.rejectionReason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-xs text-red-600 mb-1 font-medium">Rejection Reason</p>
                                    <p className="text-sm text-red-700">{selectedItem.rejectionReason}</p>
                                </div>
                            )}

                            {/* Reject textarea */}
                            {showRejectInput && isApprover &&
                                isApprovalPending(selectedItem.status) && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                                        <p className="text-sm font-semibold text-red-700">Rejection Reason</p>
                                        <textarea
                                            rows={3}
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder="Explain reason for rejection..."
                                            className="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-sm resize-none focus:outline-none focus:border-red-500"
                                            style={{ color: '#111827' }}
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowRejectInput(false)}
                                                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                                Cancel
                                            </button>
                                            <button onClick={() => handleReject(selectedItem)} disabled={processing}
                                                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                                                {processing
                                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    : <XCircle className="w-4 h-4" />
                                                }
                                                Confirm Reject
                                            </button>
                                        </div>
                                    </div>
                                )}

                            {/* Approval action buttons */}
                            {isApprover &&
                                isApprovalPending(selectedItem.status) &&
                                !showRejectInput && (
                                    <div className="flex gap-3 pt-2 border-t border-gray-200">
                                        <button onClick={() => setShowRejectInput(true)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium">
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                        <button onClick={() => handleApprove(selectedItem)} disabled={processing}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-50">
                                            {processing
                                                ? <div className="w-4 h-4 border-2 border-green-400/40 border-t-green-600 rounded-full animate-spin" />
                                                : <CheckCircle className="w-4 h-4" />
                                            }
                                            Approve
                                        </button>
                                    </div>
                                )}

                            {/* Link to quotation/PO page */}
                            <button
                                onClick={() => {
                                    if (selectedItem?.type === 'po') {
                                        navigate('/blink/finance/purchase-orders');
                                    } else if (selectedItem?.type === 'invoice') {
                                        navigate('/blink/finance/invoices');
                                    } else {
                                        navigate('/blink/operations/quotations');
                                    }
                                    closeModal();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors"
                            >
                                <Eye className="w-4 h-4" />
                                View in {selectedItem?.type === 'po' ? 'Purchase Orders' : selectedItem?.type === 'invoice' ? 'Invoices' : 'Quotation'} Page
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlinkApproval;
