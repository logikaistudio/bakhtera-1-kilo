import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, FileText, User, Calendar, 
    ChevronRight, RefreshCw, AlertCircle, Check, MapPin, 
    Ship, Activity, Plane, Truck, ShoppingBag, Receipt, Bell, Eye, X
} from 'lucide-react';

const isMissingTableError = (error) => {
    const message = String(error?.message || error?.details || error || '').toLowerCase();
    return /relation .* does not exist|table .* does not exist|no such table|does not exist/.test(message);
};

const tryInsertTable = async (tableName, payload) => {
    const { error } = await supabase.from(tableName).insert([payload]);
    if (!error) return true;
    if (isMissingTableError(error)) return false;
    throw error;
};

const recordApprovalHistory = async (item, action, reason = null, approverName = 'System') => {
    try {
        const payload = {
            document_number: item.refNumber || item.jobNumber || '-',
            document_type: 'sales_quotation',
            approved_at: new Date().toISOString(),
            approver: approverName,
            status: action,
            reason: reason,
            module: 'blink_sales'
        };
        await tryInsertTable('blink_approval_history', payload);
    } catch (e) {
        console.warn('Logging approval history failed:', e);
    }
};

const SalesBlinkApproval = () => {
    const navigate = useNavigate();
    const { user, isSuperAdmin, isAdmin } = useAuth();
    
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
    const [submissions, setSubmissions] = useState([]);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const normalizeServiceType = (value) => {
        const source = String(value || '').toLowerCase();
        if (source.includes('air')) return 'air';
        if (source.includes('land') || source.includes('truck')) return 'land';
        return 'sea';
    };

    // Is the user an approver? (Admin, Super Admin, Manager)
    const isApprover = isSuperAdmin() || isAdmin() || ['manager', 'blink_manager', 'bridge_manager'].includes(user?.user_level);

    // Financial calculations for Selected Item (Quotation) in Detail Modal
    let computedGrandTotalIDR = 0;
    let computedGrandTotalUSD = 0;
    let costGrandTotalIDR = 0;
    let costGrandTotalUSD = 0;
    let marginIDR = 0;
    let marginUSD = 0;
    let marginPct = 0;

    if (selectedItem) {
        const rate = selectedItem.exchange_rate || 16000;
        const revItems = selectedItem.serviceItems || [];
        revItems.forEach(group => {
            const isGroup = group.items !== undefined;
            const subItems = isGroup ? group.items : [group];
            const currentGroupRate = group.groupExchangeRate || rate;

            subItems.forEach(item => {
                const amt = parseFloat(item.amount) || 0;
                if (item.currency === 'IDR') {
                    computedGrandTotalIDR += amt;
                    computedGrandTotalUSD += amt / currentGroupRate;
                } else {
                    computedGrandTotalUSD += amt;
                    computedGrandTotalIDR += amt * currentGroupRate;
                }
            });
        });

        const cstItems = selectedItem.costItems || [];
        cstItems.forEach(group => {
            const isGroup = group.items !== undefined;
            const subItems = isGroup ? group.items : [group];
            const currentGroupRate = group.groupExchangeRate || rate;

            subItems.forEach(item => {
                const amt = parseFloat(item.amount) || 0;
                if (item.currency === 'IDR') {
                    costGrandTotalIDR += amt;
                    costGrandTotalUSD += amt / currentGroupRate;
                } else {
                    costGrandTotalUSD += amt;
                    costGrandTotalIDR += amt * currentGroupRate;
                }
            });
        });

        marginIDR = computedGrandTotalIDR - costGrandTotalIDR;
        marginUSD = computedGrandTotalUSD - costGrandTotalUSD;
        marginPct = computedGrandTotalIDR > 0 ? (marginIDR / computedGrandTotalIDR) * 100 : 0;
    }

    const fetchSubmissions = async () => {
        try {
            setLoading(true);

            // Fetch pending Sales Quotations
            const { data: salesQuots, error: sqErr } = await supabase
                .from('blink_sales_quotations')
                .select('*')
                .eq('status', 'manager_approval')
                .order('created_at', { ascending: false });

            if (sqErr) throw sqErr;

            const mappedItems = (salesQuots || []).map(sq => ({
                ...sq,
                type: 'sales_quotation',
                typeLabel: 'Sales Quotation',
                typeIcon: FileText,
                typeColor: 'text-blue-500 bg-blue-50',
                refNumber: sq.quotation_number,
                partnerName: sq.customer_name || 'Unknown Customer',
                customerName: sq.customer_name || 'Unknown Customer',
                submittedBy: sq.sales_person || 'Sales Team',
                serviceType: (sq.service_type || 'sea').toLowerCase(),
                origin: sq.origin || '-',
                destination: sq.destination || '-',
                quotationType: sq.quotation_type || 'RG',
                dueDate: '-',
                amount: sq.revenue_amount || sq.total_revenue || sq.grand_total || 0,
                costAmount: sq.cost_amount || sq.total_cost || 0,
                currency: sq.currency || 'IDR',
                status: sq.status,
                createdAt: sq.created_at,
                updatedAt: sq.updated_at,
                notes: sq.notes || '',
                serviceItems: sq.service_items || sq.revenue_items || [],
                costItems: sq.cost_items || [],
                exchange_rate: sq.exchange_rate || 16000,
                commodity: sq.commodity || '',
                cargoType: sq.cargo_type || '',
            }));

            setSubmissions(mappedItems);

            // Fetch History
            const { data: historyData, error: histErr } = await supabase
                .from('blink_approval_history')
                .select('*')
                .eq('module', 'blink_sales')
                .order('created_at', { ascending: false });
                
            if (histErr && !isMissingTableError(histErr)) {
                console.error('Error fetching history:', histErr);
            } else if (historyData) {
                setHistoryLogs(historyData);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();

        // Real-time subscription for table updates
        const channel = supabase.channel('sales_approvals_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_sales_quotations' }, fetchSubmissions)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blink_approval_history' }, fetchSubmissions)
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const handleApprove = async (item) => {
        if (!isApprover) return;
        try {
            setProcessing(true);

            // Fetch quotation data
            const { data: quotationData, error: fetchErr } = await supabase
                .from('blink_sales_quotations')
                .select('*')
                .eq('id', item.id)
                .single();
            if (fetchErr) throw fetchErr;

            // Generate SO Number
            const { generateSONumber } = await import('../../utils/documentNumbers');
            const jobNumber = quotationData.job_number || quotationData.quotation_number;
            const soNumber = generateSONumber(jobNumber);

            // --- AUTO-FLATTENING WITH SMART CURRENCY CONVERSION ---
            const baseCurrency = quotationData.currency || 'USD';
            const baseExchangeRate = quotationData.exchange_rate || 16000;

            const flattenItems = (groupedItems) => {
                const flatList = [];
                (groupedItems || []).forEach(groupOrItem => {
                    const isGroup = groupOrItem.items !== undefined;
                    const groupName = isGroup ? (groupOrItem.groupName || 'General') : 'General';
                    const groupRate = isGroup ? (groupOrItem.groupExchangeRate || baseExchangeRate) : baseExchangeRate;
                    const subItems = isGroup ? groupOrItem.items : [groupOrItem];

                    subItems.forEach(flatItem => {
                        const originalAmt = parseFloat(flatItem.amount) || 0;
                        const originalCurrency = flatItem.currency || 'USD';
                        let finalAmt = originalAmt;

                        if (originalCurrency !== baseCurrency) {
                            if (baseCurrency === 'IDR' && originalCurrency === 'USD') {
                                finalAmt = originalAmt * groupRate;
                            } else if (baseCurrency === 'USD' && originalCurrency === 'IDR') {
                                finalAmt = originalAmt / groupRate;
                            }
                        }

                        flatList.push({
                            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            description: isGroup ? `[${groupName}] ${flatItem.description || flatItem.name || 'Item'}` : (flatItem.description || flatItem.name || 'Item'),
                            qty: parseFloat(flatItem.quantity) || 1,
                            unit: flatItem.unit || 'Job',
                            rate: finalAmt / (parseFloat(flatItem.quantity) || 1),
                            amount: finalAmt,
                            coa_id: flatItem.coa_id || null,
                            vendor: flatItem.vendor || flatItem.supplier || '',
                            original_currency: originalCurrency,
                            original_amount: originalAmt,
                            exchange_rate_used: groupRate,
                            group_name: groupName,
                            item_name: flatItem.name || flatItem.description || 'Item'
                        });
                    });
                });
                return flatList;
            };

            const flatSellingItems = flattenItems(quotationData.service_items || []);
            const flatBuyingItems = flattenItems(quotationData.cost_items || []);

            const serviceType = normalizeServiceType(quotationData.service_type);
            const isAirFreight = serviceType === 'air';
            const blType = isAirFreight ? 'AWB' : 'MBL';
            const blPrefix = isAirFreight ? 'AWB' : 'BL';
            const blNumber = `${blPrefix}-${soNumber}`;

            const coreData = {
                shipper: quotationData.shipper || quotationData.shipper_name || quotationData.customer_name || '',
                shipper_name: quotationData.shipper_name || quotationData.shipper || quotationData.customer_name || '',
                quotation_shipper_name: quotationData.shipper_name || null,
                job_number: quotationData.job_number,
                so_number: soNumber,
                sales_quotation_id: quotationData.id,
                quotation_id: quotationData.id, // Fallback
                customer: quotationData.customer_name || '',
                customer_id: quotationData.partner_id || null,
                sales_person: quotationData.sales_person || '',
                quotation_type: quotationData.quotation_type || 'RG',
                quotation_date: quotationData.quotation_date,
                origin: quotationData.origin,
                destination: quotationData.destination,
                service_type: serviceType,
                cargo_type: quotationData.cargo_type,
                weight: quotationData.weight,
                volume: quotationData.volume,
                commodity: quotationData.commodity,
                quoted_amount: quotationData.total_amount || 0,
                currency: quotationData.currency || 'USD',
                exchange_rate: quotationData.currency === 'IDR' ? 1 : (quotationData.exchange_rate || 16000),
                status: 'pending',
                created_from: 'sales_order',
                service_items: flatSellingItems,
                selling_items: flatSellingItems,
                buying_items: flatBuyingItems,
                notes: quotationData.notes || '',
                gross_weight: quotationData.gross_weight || null,
                net_weight: quotationData.net_weight || null,
                measure: quotationData.measure || null,
                packages: quotationData.quantity && quotationData.package_type
                    ? `${quotationData.quantity} ${quotationData.package_type}`
                    : (quotationData.package_type || null),
                incoterm: quotationData.incoterm || null,
                payment_terms: quotationData.payment_terms || null,
                bl_number: blNumber,
                bl_type: blType,
                bl_status: 'draft',
                bl_subject: `${serviceType.toUpperCase()} Freight - ${quotationData.origin} to ${quotationData.destination}`,
                bl_shipper_name: quotationData.shipper_name || quotationData.shipper || quotationData.customer_name || '',
                bl_consignee_name: quotationData.consignee_name || quotationData.customer_name || '',
                bl_place_of_receipt: quotationData.origin || '',
                bl_place_of_delivery: quotationData.destination || '',
            };

            console.log('⏳ Creating shipment in blink_shipments...');
            const { error: shipErr } = await supabase
                .from('blink_shipments')
                .insert([coreData]);

            if (shipErr) throw shipErr;

            // Mark quotation as converted
            const { error: updateErr } = await supabase
                .from('blink_sales_quotations')
                .update({ status: 'converted', updated_at: new Date().toISOString() })
                .eq('id', item.id);
            if (updateErr) throw updateErr;

            await recordApprovalHistory(item, 'approved', null, user?.name || user?.email || 'Manager');

            setSubmissions(prev => prev.filter(i => i.id !== item.id));
            setShowDetailModal(false);
            setSelectedItem(null);
            fetchSubmissions();

            alert(`✅ Sales Order ${soNumber} created successfully!\n\n➡️ Navigating to Sales Order Management...`);
            setTimeout(() => navigate('/blink/shipments'), 1000);
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

            const { error } = await supabase
                .from('blink_sales_quotations')
                .update({ 
                    status: 'rejected', 
                    rejection_reason: rejectReason, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', item.id);
            if (error) throw error;

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
        manager_approval: { label: 'Pending Approval', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
        approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
        rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle }
    };

    const formatCurrency = (amount, curr) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: curr || 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const serviceIcons = { sea: Ship, air: Plane, land: Truck, purchase: ShoppingBag, shipment: Ship, invoice: Receipt };
    const isApprovalPending = (status) => ['submitted', 'manager_approval', 'pending', 'pending_approval'].includes(status);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    
    const closeModal = () => {
        setShowDetailModal(false);
        setSelectedItem(null);
        setShowRejectInput(false);
        setRejectReason('');
    };

    const normalizeItems = (items) => {
        let normalized = [];
        (items || []).forEach(groupOrItem => {
            if (groupOrItem.items) {
                normalized = normalized.concat(groupOrItem.items);
            } else {
                normalized.push(groupOrItem);
            }
        });
        return normalized;
    };

    const filtered = submissions;
    const pendingCount = submissions.length;

    return (
        <div className="space-y-6">
            {/* Header with Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 style={{ color: '#111827' }} className="text-2xl font-bold flex items-center gap-2">
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                            Sales Approval Center
                        </h1>
                    </div>
                    <p style={{ color: '#4B5563' }} className="text-sm mt-1">
                        Manage all sales quotation document submissions
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
                        const cfg = statusConfig[item.status] || statusConfig.manager_approval;
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
                        <h2 className="font-semibold text-gray-800">Historical Sales Approvals</h2>
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
                                                {new Date(log.approved_at || log.created_at || Date.now()).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{log.document_number}</td>
                                            <td className="px-6 py-4 text-gray-600 capitalize">Sales Quotation</td>
                                            <td className="px-6 py-4 text-gray-600">{log.approver}</td>
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const historyStatus = String(log.status || '').toLowerCase();
                                                    const historyStatusConfig = {
                                                        approved: statusConfig.approved,
                                                        rejected: statusConfig.rejected,
                                                        cancelled: {
                                                            bg: 'bg-gray-100',
                                                            text: 'text-gray-700',
                                                            border: 'border-gray-300',
                                                        }
                                                    };
                                                    const badge = historyStatusConfig[historyStatus] || statusConfig.manager_approval;
                                                    const label = historyStatus
                                                        ? historyStatus.charAt(0).toUpperCase() + historyStatus.slice(1)
                                                        : 'Unknown';

                                                    return (
                                                        <span className={`px-3 py-1 rounded-full font-medium text-xs border ${badge.bg} ${badge.text} ${badge.border}`}>
                                                            {label}
                                                        </span>
                                                    );
                                                })()}
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
                                const cfg = statusConfig[selectedItem.status] || statusConfig.manager_approval;
                                const StatusIcon = cfg.icon;
                                return (
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                        <StatusIcon className="w-4 h-4" />
                                        {cfg.label}
                                    </span>
                                );
                            })()}

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Customer', value: selectedItem.customerName },
                                    { label: 'Sales Person', value: selectedItem.submittedBy },
                                    { label: 'Service Type', value: selectedItem.serviceType?.toUpperCase() },
                                    { label: 'Quotation Type', value: selectedItem.quotationType },
                                    { label: 'Origin', value: selectedItem.origin },
                                    { label: 'Destination', value: selectedItem.destination },
                                    { label: 'Commodity', value: selectedItem.commodity || '-' },
                                    { label: 'Total Estimated', value: formatCurrency(selectedItem.amount, selectedItem.currency), highlight: true },
                                    { label: 'Created At', value: formatDate(selectedItem.createdAt) },
{ label: 'Updated At', value: formatDate(selectedItem.updatedAt) },
                                ].map((f, i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                        <p style={{ color: '#4B5563' }} className="text-xs mb-1">{f.label}</p>
                                        <p className="text-sm font-medium" style={{ color: f.highlight ? '#EA580C' : '#111827' }}>{f.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Financial Summary Card */}
                            <div className="p-4 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-emerald-500/10 border border-orange-200/50 rounded-xl space-y-3">
                                <h4 style={{ color: '#111827' }} className="text-xs font-bold uppercase tracking-wider">Financial Summary</h4>
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <p style={{ color: '#4B5563' }} className="mb-0.5 font-medium">Total Revenue (Selling)</p>
                                        <p className="font-semibold text-gray-900 font-mono">
                                            Rp {computedGrandTotalIDR.toLocaleString('id-ID')} <br/>
                                            $ {computedGrandTotalUSD.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: '#4B5563' }} className="mb-0.5 font-medium">Total Cost (Buying)</p>
                                        <p className="font-semibold text-gray-900 font-mono">
                                            Rp {costGrandTotalIDR.toLocaleString('id-ID')} <br/>
                                            $ {costGrandTotalUSD.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p style={{ color: '#4B5563' }} className="mb-0.5 font-medium">Estimated Margin</p>
                                        <p className={`font-bold font-mono ${marginIDR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            Rp {marginIDR.toLocaleString('id-ID')} <br/>
                                            {marginPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Service items */}
                            {selectedItem.serviceItems?.length > 0 && (
                                <div>
                                    <h3 style={{ color: '#111827' }} className="text-sm font-semibold mb-2">Revenue Breakdown (Selling)</h3>
                                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left px-3 py-2 bg-gray-50">Description</th>
                                                    <th className="text-right px-3 py-2 bg-gray-50">Qty</th>
                                                    <th className="text-right px-3 py-2 bg-gray-50">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {normalizeItems(selectedItem.serviceItems).map((si, i) => {
                                                    const itemTotal = si.amount || si.total || si.subtotal || ((si.quantity || 1) * (si.price || si.unitPrice || si.unit_price || 0));
                                                    return (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            <td className="px-3 py-2">{si.description || si.name || '-'}</td>
                                                            <td className="px-3 py-2 text-right">{si.quantity || 1}</td>
                                                            <td className="px-3 py-2 text-right">{formatCurrency(itemTotal, si.currency || selectedItem.currency)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Cost items */}
                            {selectedItem.costItems?.length > 0 && (
                                <div>
                                    <h3 style={{ color: '#111827' }} className="text-sm font-semibold mb-2">Cost Breakdown (Buying)</h3>
                                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left px-3 py-2 bg-gray-50">Description</th>
                                                    <th className="text-right px-3 py-2 bg-gray-50">Qty</th>
                                                    <th className="text-right px-3 py-2 bg-gray-50">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {normalizeItems(selectedItem.costItems).map((ci, i) => {
                                                    const itemTotal = ci.amount || ci.total || ci.subtotal || ((ci.quantity || 1) * (ci.price || ci.unitPrice || ci.unit_price || 0));
                                                    return (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            <td className="px-3 py-2">{ci.description || ci.name || '-'}</td>
                                                            <td className="px-3 py-2 text-right">{ci.quantity || 1}</td>
                                                            <td className="px-3 py-2 text-right">{formatCurrency(itemTotal, ci.currency || selectedItem.currency)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedItem.notes && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p style={{ color: '#4B5563' }} className="text-xs mb-1">Notes</p>
                                    <p style={{ color: '#111827' }} className="text-sm">{selectedItem.notes}</p>
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
                                    navigate(`/blink/sales-quotations?id=${selectedItem.id}`);
                                    closeModal();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-colors"
                            >
                                <Eye className="w-4 h-4" />
                                View in Quotation Page
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesBlinkApproval;
