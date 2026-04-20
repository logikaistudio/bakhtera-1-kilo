import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Search, FileText, Edit, Trash2, Eye, X, User, Calendar, ArrowRightLeft, Package } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

/**
 * ✅ BRIDGE APPROVAL MANAGER
 * ──────────────────────────────────────────────
 * This component handles BRIDGE MODULE approvals ONLY.
 * Completely isolated from Blink (Sales/Operations) approvals.
 * 
 * Data Source: approval_requests table (module = 'bridge')
 * Approval Types: Warehouse mutations, inventory operations
 * 
 * Blink Approvals are handled separately in:
 * - BlinkApproval.jsx (uses blink_approval_history table)
 *   - blink_sales: Quotations, Invoices
 *   - blink_operations: Shipments, Purchase Orders
 */

const ApprovalManager = () => {
    const { pendingApprovals = [], approveRequest, rejectRequest } = useData();
    const { canEdit, canApprove, user } = useAuth();
    const hasApprove = canApprove('bridge_approval') || canEdit('bridge_approval');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('pending');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // ✅ ISOLATION: Filter ONLY Bridge approvals (exclude Blink)
    const bridgeApprovals = pendingApprovals.filter(req => {
        const moduleLower = (req.module || '').toLowerCase();
        return moduleLower === 'bridge' || !req.module;  // Include bridge module or legacy (no module field)
    });

    // Filter approvals
    const filteredApprovals = bridgeApprovals.filter(req => {
        const matchesSearch =
            req.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.requestedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.module?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.entityType?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Stats
    const pendingCount = bridgeApprovals.filter(r => r.status === 'pending').length;
    const approvedCount = bridgeApprovals.filter(r => r.status === 'approved').length;
    const rejectedCount = bridgeApprovals.filter(r => r.status === 'rejected').length;

    // Handle approve
    const handleApprove = (requestId) => {
        const approverName = user?.full_name || user?.username || 'Manager';
        approveRequest(requestId, approverName);
        setSelectedRequest(null);
        setShowDetailModal(false);
    };

    // Handle reject
    const handleReject = () => {
        if (selectedRequest && rejectReason.trim()) {
            const approverName = user?.full_name || user?.username || 'Manager';
            rejectRequest(selectedRequest.id, approverName, rejectReason);
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectReason('');
            setShowDetailModal(false);
        }
    };

    // Get type config
    const getTypeConfig = (type) => {
        const configs = {
            edit: { icon: Edit, color: 'text-accent-blue', bg: 'bg-accent-blue/20', label: 'Edit' },
            delete: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Delete' },
            mutation_out: { icon: ArrowRightLeft, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Mutasi Keluar' },
            mutation_in: { icon: ArrowRightLeft, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Mutasi Masuk' },
            outbound: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Outbound' },
            inbound: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Inbound' },
        };
        return configs[type] || configs.edit;
    };

    // Get status config
    const getStatusConfig = (status) => {
        const configs = {
            pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', label: 'Pending' },
            approved: { icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/20', border: 'border-accent-green/30', label: 'Approved' },
            rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', label: 'Rejected' }
        };
        return configs[status] || configs.pending;
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return { date: '-', time: '-' };
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
    };

    // Open detail modal
    const handleViewDetail = (req) => {
        setSelectedRequest(req);
        setShowDetailModal(true);
    };

    // Render changes detail
    const renderChangesDetail = (changes) => {
        if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
            return <p className="text-sm text-silver-dark italic">Tidak ada detail perubahan</p>;
        }

        return (
            <div className="space-y-2">
                {Object.entries(changes).map(([key, value]) => (
                    <div key={key} className="flex gap-3 py-2 px-3 bg-dark-surface/50 rounded-lg">
                        <span className="text-xs font-medium text-silver-dark min-w-[140px] capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-silver-light flex-1">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Approval Manager</h1>
                <p className="text-silver-dark mt-1">Persetujuan untuk masuk & keluar barang dari warehouse</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                    className={`glass-card p-4 rounded-lg border cursor-pointer transition-all ${filterStatus === 'pending' ? 'border-yellow-400 ring-1 ring-yellow-400/30' : 'border-yellow-500/40'}`}
                    onClick={() => setFilterStatus('pending')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Clock className="w-8 h-8 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Menunggu Persetujuan</p>
                            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                        </div>
                    </div>
                </div>
                <div
                    className={`glass-card p-4 rounded-lg border cursor-pointer transition-all ${filterStatus === 'approved' ? 'border-accent-green ring-1 ring-accent-green/30' : 'border-accent-green/40'}`}
                    onClick={() => setFilterStatus('approved')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-green/20 rounded-lg">
                            <CheckCircle className="w-8 h-8 text-accent-green" />
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Disetujui</p>
                            <p className="text-2xl font-bold text-accent-green">{approvedCount}</p>
                        </div>
                    </div>
                </div>
                <div
                    className={`glass-card p-4 rounded-lg border cursor-pointer transition-all ${filterStatus === 'rejected' ? 'border-red-500 ring-1 ring-red-500/30' : 'border-red-500/40'}`}
                    onClick={() => setFilterStatus('rejected')}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <XCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Ditolak</p>
                            <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search */}
                <div className="glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari berdasarkan nama, submitter, modul..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>

                {/* Status Filter */}
                <div className="glass-card p-4 rounded-lg">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                    >
                        <option value="pending">⏳ Pending</option>
                        <option value="approved">✅ Approved</option>
                        <option value="rejected">❌ Rejected</option>
                        <option value="all">📋 Semua Status</option>
                    </select>
                </div>
            </div>

            {/* Approval Requests Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-accent-purple" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Approval</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredApprovals.length} request</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-purple/10">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase">No</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase">Tgl Submit</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase">Tipe</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase">Modul</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase">Entity</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase">Submitter</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase">Tgl Approve</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredApprovals.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-12 text-center">
                                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Tidak ada approval request</p>
                                        <p className="text-sm text-silver-dark/50 mt-1">
                                            {filterStatus === 'pending' ? 'Tidak ada permintaan yang menunggu persetujuan' : `Tidak ada request dengan status "${filterStatus}"`}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredApprovals.map((req, idx) => {
                                    const typeConfig = getTypeConfig(req.type);
                                    const statusConfig = getStatusConfig(req.status);
                                    const TypeIcon = typeConfig.icon;
                                    const StatusIcon = statusConfig.icon;
                                    const submitTs = formatTimestamp(req.requestDate);
                                    const approveTs = req.approvalDate ? formatTimestamp(req.approvalDate) : null;
                                    const rejectTs = req.rejectionDate ? formatTimestamp(req.rejectionDate) : null;

                                    return (
                                        <tr key={req.id} className="hover:bg-dark-surface/50 smooth-transition cursor-pointer" onClick={() => handleViewDetail(req)}>
                                            <td className="px-4 py-3 text-sm text-center text-silver-light font-medium">{idx + 1}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{submitTs.date}</span>
                                                    <span className="text-xs text-silver-dark">{submitTs.time}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                                                    <TypeIcon className="w-3 h-3" />
                                                    {typeConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded">{req.module}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light max-w-xs truncate">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{req.entityName}</span>
                                                    <span className="text-xs text-silver-dark font-mono">{req.entityType}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center">
                                                        <User className="w-3 h-3 text-accent-blue" />
                                                    </div>
                                                    <span className="text-silver-light font-medium">{req.requestedBy}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">
                                                {approveTs ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-accent-green">{approveTs.date}</span>
                                                        <span className="text-xs text-silver-dark">{approveTs.time}</span>
                                                    </div>
                                                ) : rejectTs ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-red-400">{rejectTs.date}</span>
                                                        <span className="text-xs text-silver-dark">{rejectTs.time}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-silver-dark italic text-xs">Belum diproses</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {statusConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleViewDetail(req)}
                                                        className="p-1.5 hover:bg-accent-blue/10 text-accent-blue rounded-lg transition-colors"
                                                        title="Lihat Detail"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {hasApprove && req.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(req.id)}
                                                                className="p-1.5 hover:bg-accent-green/10 text-accent-green rounded-lg transition-colors"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedRequest(req);
                                                                    setShowRejectModal(true);
                                                                }}
                                                                className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                                                                title="Reject"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ==================== Detail Modal ==================== */}
            {showDetailModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
                    <div className="bg-dark-card rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-dark-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex-shrink-0 flex justify-between items-start p-5 border-b border-dark-border">
                            <div>
                                <h3 className="text-xl font-bold text-white">Detail Approval Request</h3>
                                <p className="text-sm text-silver-dark mt-1">{selectedRequest.entityName}</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-dark-surface rounded-lg transition-colors">
                                <X className="w-5 h-5 text-silver-dark" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Status Badge */}
                            {(() => {
                                const sc = getStatusConfig(selectedRequest.status);
                                const Ic = sc.icon;
                                return (
                                    <div className={`flex items-center gap-3 p-4 rounded-lg ${sc.bg} border ${sc.border}`}>
                                        <Ic className={`w-8 h-8 ${sc.color}`} />
                                        <div>
                                            <p className={`text-lg font-bold ${sc.color}`}>{sc.label}</p>
                                            <p className="text-xs text-silver-dark">
                                                {selectedRequest.status === 'approved' && selectedRequest.approvedBy
                                                    ? `Disetujui oleh ${selectedRequest.approvedBy}`
                                                    : selectedRequest.status === 'rejected'
                                                        ? `Ditolak${selectedRequest.rejectionReason ? `: ${selectedRequest.rejectionReason}` : ''}`
                                                        : 'Menunggu persetujuan manager'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Submitter Info */}
                                <div className="bg-dark-surface/60 rounded-lg p-4 space-y-3">
                                    <h4 className="text-sm font-bold text-silver-light flex items-center gap-2">
                                        <User className="w-4 h-4 text-accent-blue" /> Informasi Submitter
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-silver-dark">Nama</span>
                                            <span className="text-xs text-silver-light font-medium">{selectedRequest.requestedBy || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-silver-dark">Tanggal Submit</span>
                                            <span className="text-xs text-silver-light">
                                                {(() => {
                                                    const ts = formatTimestamp(selectedRequest.requestDate);
                                                    return `${ts.date} ${ts.time}`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Approval Info */}
                                <div className="bg-dark-surface/60 rounded-lg p-4 space-y-3">
                                    <h4 className="text-sm font-bold text-silver-light flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-accent-green" /> Informasi Approval
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-silver-dark">Approver</span>
                                            <span className="text-xs text-silver-light font-medium">{selectedRequest.approvedBy || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-silver-dark">Tanggal Approve</span>
                                            <span className="text-xs text-silver-light">
                                                {selectedRequest.approvalDate
                                                    ? (() => {
                                                        const ts = formatTimestamp(selectedRequest.approvalDate);
                                                        return `${ts.date} ${ts.time}`;
                                                    })()
                                                    : '-'}
                                            </span>
                                        </div>
                                        {selectedRequest.rejectionDate && (
                                            <div className="flex justify-between">
                                                <span className="text-xs text-silver-dark">Tanggal Reject</span>
                                                <span className="text-xs text-red-400">
                                                    {(() => {
                                                        const ts = formatTimestamp(selectedRequest.rejectionDate);
                                                        return `${ts.date} ${ts.time}`;
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Request Details */}
                            <div className="bg-dark-surface/60 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-bold text-silver-light flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-accent-purple" /> Detail Permintaan
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-silver-dark">Tipe</span>
                                        {(() => {
                                            const tc = getTypeConfig(selectedRequest.type);
                                            const TI = tc.icon;
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium w-fit ${tc.bg} ${tc.color}`}>
                                                    <TI className="w-3 h-3" /> {tc.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-silver-dark">Modul</span>
                                        <span className="text-xs text-accent-purple font-medium">{selectedRequest.module}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-silver-dark">Entity</span>
                                        <span className="text-xs text-silver-light font-medium">{selectedRequest.entityName}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-silver-dark">Entity Type</span>
                                        <span className="text-xs text-silver-light font-mono">{selectedRequest.entityType}</span>
                                    </div>
                                </div>
                                {selectedRequest.details && (
                                    <div className="mt-3 pt-3 border-t border-dark-border">
                                        <span className="text-xs text-silver-dark block mb-1">Keterangan</span>
                                        <p className="text-sm text-silver-light">{selectedRequest.details}</p>
                                    </div>
                                )}
                            </div>

                            {/* Changes Detail */}
                            <div className="bg-dark-surface/60 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-bold text-silver-light flex items-center gap-2">
                                    <Edit className="w-4 h-4 text-accent-blue" /> Data Perubahan
                                </h4>
                                {renderChangesDetail(selectedRequest.changes)}
                            </div>

                            {/* Rejection Reason */}
                            {selectedRequest.rejectionReason && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                    <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                                        <XCircle className="w-4 h-4" /> Alasan Penolakan
                                    </h4>
                                    <p className="text-sm text-silver-light">{selectedRequest.rejectionReason}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer - Action Buttons */}
                        <div className="flex-shrink-0 p-4 border-t border-dark-border bg-dark-surface/30 flex justify-end gap-3">
                            {hasApprove && selectedRequest.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            setShowRejectModal(true);
                                        }}
                                        className="px-5 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium border border-red-500/30"
                                    >
                                        Tolak
                                    </button>
                                    <button
                                        onClick={() => handleApprove(selectedRequest.id)}
                                        className="px-5 py-2 bg-accent-green text-white rounded-lg hover:bg-accent-green/80 transition-colors text-sm font-medium"
                                    >
                                        Setujui
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-5 py-2 bg-dark-surface text-silver-light rounded-lg hover:bg-dark-card transition-colors text-sm font-medium"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* ==================== Reject Modal ==================== */}
            {
                showRejectModal && selectedRequest && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setShowRejectModal(false)}>
                        <div className="glass-card p-6 rounded-lg max-w-md w-full mx-4 border border-dark-border" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-silver-light mb-4 flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-400" />
                                Tolak Request
                            </h3>
                            <p className="text-silver-dark mb-4">
                                Tolak request untuk {selectedRequest.type} <span className="text-accent-blue font-medium">{selectedRequest.entityName}</span>?
                            </p>
                            <div className="mb-4">
                                <label className="block text-silver-light text-sm font-medium mb-2">
                                    Alasan Penolakan <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Masukkan alasan penolakan..."
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                    }}
                                    className="px-4 py-2 bg-dark-surface text-silver-light rounded-lg hover:bg-dark-card transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectReason.trim()}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Tolak
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default ApprovalManager;
