import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    CheckCircle, XCircle, Clock, FileText, User, Calendar, 
    ChevronRight, RefreshCw, AlertCircle, Check, MapPin, 
    Ship, Activity
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
            reason: reason
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

    // Is the user an approver? (Admin, Super Admin, Manager)
    const isApprover = isSuperAdmin() || isAdmin() || user?.user_level === 'bridge_manager' || user?.user_level === 'manager';

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
                dueDate: '-',
                amount: sq.revenue_amount || sq.total_revenue || sq.grand_total || 0,
                costAmount: sq.cost_amount || sq.total_cost || 0,
                currency: sq.currency || 'IDR',
                status: sq.status,
                createdAt: sq.created_at,
                updatedAt: sq.updated_at,
                notes: sq.notes || '',
                serviceItems: sq.service_items || sq.revenue_items || [],
                commodity: sq.commodity || '',
                cargoType: sq.cargo_type || '',
            }));

            setSubmissions(mappedItems);

            // Fetch History
            const { data: historyData, error: histErr } = await supabase
                .from('blink_approval_history')
                .select('*')
                .eq('document_type', 'sales_quotation')
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

            const { error } = await supabase
                .from('blink_sales_quotations')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', item.id);
            if (error) throw error;

            await recordApprovalHistory(item, 'approved', null, user?.name || user?.email || 'Manager');

            setSubmissions(prev => prev.filter(i => i.id !== item.id));
            setShowDetailModal(false);
            setSelectedItem(null);
            fetchSubmissions();

            alert(`✅ Sales Quotation ${item.refNumber} berhasil disetujui!`);
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

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                        Sales Approval Center
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Review and approve sales quotations and marketing workflows.</p>
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
                        {submissions.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                                {submissions.length}
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
                        <Activity className="w-4 h-4" />
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

            {loading ? (
                <div className="flex items-center justify-center h-64 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-gray-500 font-medium">Checking documents...</p>
                    </div>
                </div>
            ) : activeTab === 'pending' ? (
                /* PENDING TAB */
                submissions.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Semua Bersih!</h3>
                        <p className="text-gray-500">Tidak ada dokumen Sales yang menunggu persetujuan Anda saat ini.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {submissions.map((item) => {
                            const ItemIcon = item.typeIcon;
                            const statusStyle = statusConfig[item.status] || statusConfig.manager_approval;

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 group flex flex-col"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${item.typeColor} group-hover:scale-110 transition-transform`}>
                                                <ItemIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{item.typeLabel}</p>
                                                <h3 className="font-bold text-gray-900">{item.refNumber}</h3>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl rounded-tr-none relative">
                                            <div className="absolute -top-3 -right-3 w-6 h-6 bg-white rotate-45 transform" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 mb-1">Customer / Partner</p>
                                                <p className="font-semibold text-gray-900 line-clamp-1">{item.partnerName}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Revenue Value</p>
                                                <p className="font-bold text-blue-600">
                                                    {formatCurrency(item.amount, item.currency)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1 text-right">Tanggal</p>
                                                <p className="text-sm font-medium text-gray-700">
                                                    {new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}
                                        className="mt-5 w-full py-2.5 px-4 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-100"
                                    >
                                        Review Detail <ChevronRight className="w-4 h-4" />
                                    </button>
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
                                                {new Date(log.approved_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{log.document_number}</td>
                                            <td className="px-6 py-4 text-gray-600">Sales Quotation</td>
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

            {/* DETAIL MODAL */}
            {showDetailModal && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => !processing && setShowDetailModal(false)} />
                    <div className="bg-white rounded-2xl w-full max-w-2xl relative shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${selectedItem.typeColor}`}>
                                    <selectedItem.typeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{selectedItem.refNumber}</h2>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">{selectedItem.typeLabel} Review</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !processing && setShowDetailModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto w-full">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 mb-1">Customer</p>
                                    <p className="font-semibold text-gray-900">{selectedItem.partnerName}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tanggal Dibuat</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(selectedItem.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                    <p className="text-xs text-blue-600/70 mb-1">Total Revenue</p>
                                    <p className="font-bold text-blue-700 text-lg">
                                        {formatCurrency(selectedItem.amount, selectedItem.currency)}
                                    </p>
                                </div>
                                <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                                    <p className="text-xs text-orange-600/70 mb-1">Total Cost Estimate</p>
                                    <p className="font-bold text-orange-700 text-lg">
                                        {formatCurrency(selectedItem.costAmount, selectedItem.currency)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <FileText className="w-4 h-4 text-gray-400" /> Revenue Items
                                </h3>
                                {selectedItem.serviceItems?.length > 0 ? (
                                    <div className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold w-1/2">Description</th>
                                                    <th className="px-4 py-3 font-semibold text-right">Qty</th>
                                                    <th className="px-4 py-3 font-semibold text-right">Price</th>
                                                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-gray-600 divide-gray-100">
                                                {selectedItem.serviceItems.map((st, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 text-sm">
                                                        <td className="px-4 py-3 font-medium text-gray-900">
                                                            {st.description || st.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">{st.quantity}</td>
                                                        <td className="px-4 py-3 text-right">{formatCurrency(st.price || st.unit_price, selectedItem.currency)}</td>
                                                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(st.total || st.subtotal, selectedItem.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm italic py-2 bg-gray-50 text-center rounded-lg border border-gray-100">Belum ada rincian item / item kosong.</p>
                                )}
                            </div>

                            {selectedItem.notes && (
                                <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                    <p className="text-xs font-semibold text-yellow-800 mb-1 uppercase tracking-wider flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3"/> Notes
                                    </p>
                                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">{selectedItem.notes}</p>
                                </div>
                            )}

                            {showRejectInput && (
                                <div className="mt-6 p-4 border border-red-200 rounded-xl bg-red-50 animate-fade-in relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                    <label className="block text-sm font-semibold text-red-900 mb-2">Rejection Reason <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full text-sm p-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                                        rows="3"
                                        placeholder="Pesan Anda untuk tim sales terkait alasan penolakan dokumen ini..."
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Approver Actions */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/80 sticky bottom-0 z-10 flex items-center justify-between gap-4">
                            {!isApprover ? (
                                <div className="text-amber-600 bg-amber-50 px-4 py-2 border border-amber-200 rounded-lg text-sm flex gap-2 items-center w-full">
                                    <AlertCircle className="w-4 h-4" />
                                    Anda tidak memiliki hak akses sebagai Approver.
                                </div>
                            ) : (
                                <>
                                    {!showRejectInput ? (
                                        <button
                                            onClick={() => setShowRejectInput(true)}
                                            disabled={processing}
                                            className="px-6 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                                                disabled={processing}
                                                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleReject(selectedItem)}
                                                disabled={processing || !rejectReason.trim()}
                                                className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                            >
                                                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                Confirm Reject
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleApprove(selectedItem)}
                                        disabled={processing || showRejectInput}
                                        className={`px-8 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm ${
                                            showRejectInput ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        {processing && !showRejectInput ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Approve Document
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesBlinkApproval;
