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

const BlinkApproval = () => {
    const navigate = useNavigate();
    const { user, isSuperAdmin, isAdmin } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const isApprover = isSuperAdmin() || isAdmin() ||
        ['manager', 'blink_manager', 'approver'].includes(user?.user_level);

    useEffect(() => {
        fetchSubmissions();
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
                .in('status', ['submitted', 'manager_approval'])
                .order('created_at', { ascending: false });
            if (poErr) console.error('Error fetching POs:', poErr);

            // Fetch pending Shipments
            const { data: shipments, error: shErr } = await supabase
                .from('blink_shipments')
                .select('*')
                .eq('status', 'manager_approval')
                .order('created_at', { ascending: false });
            if (shErr) console.error('Error fetching shipments:', shErr);

            // Fetch pending Invoices
            const { data: invoices, error: invErr } = await supabase
                .from('blink_invoices')
                .select('*')
                .eq('status', 'manager_approval')
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
                status: s.status,
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
                submittedBy: inv.sales_person || '-',
                serviceType: 'invoice',
                origin: inv.job_number || '-',
                destination: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('id-ID') : '-',
                amount: inv.total_amount || 0,
                currency: inv.currency || inv.billing_currency || 'IDR',
                status: inv.status,
                createdAt: inv.created_at,
                updatedAt: inv.updated_at,
                notes: inv.notes || '',
                rejectionReason: inv.rejection_reason || '',
                serviceItems: inv.invoice_items || [],
                commodity: '',
                cargoType: '',
            }));

            setSubmissions([...mappedShipments, ...mappedPOs, ...mappedQuotations, ...mappedInvoices]);
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
                        approved_at: new Date().toISOString(),
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
                        approved_by: user?.name || user?.email || 'Manager',
                        approved_at: new Date().toISOString()
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

                const apEntry = {
                    ap_number: apNumber,
                    po_id: item.id,
                    po_number: item.refNumber,
                    vendor_id: item.vendor_id || null,
                    vendor_name: item.customerName,
                    bill_date: billDate,
                    due_date: dueDateStr,
                    original_amount: item.amount,
                    paid_amount: 0,
                    outstanding_amount: item.amount,
                    currency: item.currency || 'IDR',
                    status: 'outstanding',
                    notes: `Auto-created from PO approval: ${item.refNumber}`
                };

                const { data: apData, error: apError } = await supabase
                    .from('blink_ap_transactions')
                    .insert([apEntry])
                    .select();

                if (apError) throw apError;

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

                // 3. Auto-create AR (Piutang Usaha) transaction
                const arNumber = generateARNumber();

                const arEntry = {
                    ar_number: arNumber,
                    invoice_id: item.id,
                    invoice_number: item.refNumber,
                    customer_id: invData?.customer_id || null,
                    customer_name: item.customerName,
                    transaction_date: billDate,        // schema column is transaction_date
                    due_date: invData?.due_date || billDate,
                    original_amount: item.amount,
                    paid_amount: 0,
                    outstanding_amount: item.amount,
                    currency: item.currency || 'IDR',
                    status: 'outstanding',
                    notes: `Auto-created from Invoice approval: ${item.refNumber}`
                };

                // Try to insert AR transaction (table may be blink_ar_transactions or similar)
                const { data: arData, error: arError } = await supabase
                    .from('blink_ar_transactions')
                    .insert([arEntry])
                    .select();

                if (arError) console.warn('AR transaction creation warning (non-fatal):', arError.message);

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
                    sales_person: quotationData.sales_person || '',
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
                    status: 'pending',
                    created_from: 'sales_order',
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

                await fetchSubmissions();
                setShowDetailModal(false);
                setSelectedItem(null);

                alert(`✅ Quotation ${item.refNumber} disetujui!\n\n📦 Sales Order ${soNumber} berhasil dibuat dan dikirim ke halaman SO Management.`);
                setTimeout(() => navigate('/blink/shipments'), 1000);
                return; // skip the generic alert below
            }

            await fetchSubmissions();
            setShowDetailModal(false);
            setSelectedItem(null);
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
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', item.id);
                if (error) throw error;
                // Try to save rejection reason (column may not exist yet)
                await supabase.from('blink_shipments')
                    .update({ rejection_reason: rejectReason })
                    .eq('id', item.id)
                    .then(() => { }).catch(() => { });

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

            await fetchSubmissions();
            setShowDetailModal(false);
            setSelectedItem(null);
            setRejectReason('');
            setShowRejectInput(false);
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
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 style={{ color: '#111827' }} className="text-2xl font-bold">Approval Center</h1>
                        {pendingCount > 0 && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-full border border-yellow-200">
                                <Bell className="w-3.5 h-3.5" />
                                {pendingCount} Pending
                            </span>
                        )}
                    </div>
                    <p style={{ color: '#4B5563' }} className="text-sm mt-1">
                        Manage all submissions requiring approval in the BLINK module
                    </p>
                </div>
                <button
                    onClick={fetchSubmissions}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
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
            ) : filtered.length === 0 ? (
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
                        const isPending = item.status === 'manager_approval' || item.status === 'submitted';

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
                                (selectedItem.status === 'manager_approval' || selectedItem.status === 'submitted') && (
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
                                (selectedItem.status === 'manager_approval' || selectedItem.status === 'submitted') &&
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
