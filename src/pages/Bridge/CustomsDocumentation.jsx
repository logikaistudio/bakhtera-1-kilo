import React, { useState } from 'react';
import { FileText, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import { formatCurrency, getCurrencySymbol } from '../../utils/currencyFormatter';

const CustomsDocuments = () => {
    const { customsDocuments = [], approveBC, rejectBC } = useData();
    const { canEdit } = useAuth();
    const hasEdit = canEdit('bridge_docs');
    const [filter, setFilter] = useState('all');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [approveDialog, setApproveDialog] = useState({ show: false, docId: null, docNumber: '' });

    const filteredDocs = customsDocuments.filter(doc => {
        if (filter === 'all') return true;
        return doc.status === filter;
    });

    const handleApprove = (doc) => {
        console.log('🟢 Opening approval dialog for:', doc);
        setApproveDialog({ show: true, docId: doc.id, docNumber: doc.bcNumber });
    };

    const handleConfirmApprove = () => {
        console.log('🟢 User confirmed approval for:', approveDialog.docId);
        approveBC(approveDialog.docId, 'System Admin');
        setApproveDialog({ show: false, docId: null, docNumber: '' });
        console.log('🟢 BC Document approved!');
    };

    const handleCancelApprove = () => {
        console.log('🟢 User cancelled approval');
        setApproveDialog({ show: false, docId: null, docNumber: '' });
    };

    const handleReject = (docId) => {
        if (!rejectionReason.trim()) {
            alert('Please provide rejection reason');
            return;
        }

        rejectBC(docId, rejectionReason);
        setRejectionReason('');
        setSelectedDoc(null);
        alert('BC Document rejected.');
    };

    const getBCTypeLabel = (type) => {
        if (type === 'inbound') return 'BC 2.3 (Inbound)';
        if (type === 'outbound') return 'BC 2.7 (Outbound)';
        return type;
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold gradient-text">Customs Documents (BC)</h1>
                <p className="text-silver-dark mt-1">BC Document Submission & Approval Management</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${filter === 'all'
                        ? 'bg-accent-blue text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    All ({customsDocuments.length})
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${filter === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Pending ({customsDocuments.filter(d => d.status === 'pending').length})
                </button>
                <button
                    onClick={() => setFilter('approved')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${filter === 'approved'
                        ? 'bg-green-500 text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Approved ({customsDocuments.filter(d => d.status === 'approved').length})
                </button>
                <button
                    onClick={() => setFilter('rejected')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${filter === 'rejected'
                        ? 'bg-red-500 text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Rejected ({customsDocuments.filter(d => d.status === 'rejected').length})
                </button>
            </div>

            {/* Documents List */}
            <div className="space-y-3">
                {filteredDocs.length === 0 ? (
                    <div className="glass-card p-8 rounded-lg text-center">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50 text-silver-dark" />
                        <p className="text-silver-dark">No BC documents found</p>
                    </div>
                ) : (
                    filteredDocs.map(doc => (
                        <div key={doc.id} className="glass-card p-5 rounded-lg">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="w-5 h-5 text-accent-blue" />
                                        <h3 className="text-lg font-bold text-silver-light">{doc.bcNumber}</h3>
                                    </div>
                                    <p className="text-sm text-silver-dark mb-1">
                                        {getBCTypeLabel(doc.type)} • {doc.customer}
                                    </p>
                                    <p className="text-xs text-silver-dark">
                                        Submitted: {new Date(doc.submittedDate).toLocaleDateString('id-ID')}
                                    </p>
                                    {doc.approvedDate && (
                                        <p className="text-xs text-accent-green mt-1">
                                            Approved: {new Date(doc.approvedDate).toLocaleDateString('id-ID')} by {doc.approvedBy}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${doc.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                        doc.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        {doc.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Items Summary */}
                            <div className="bg-dark-surface p-3 rounded-lg mb-4">
                                <p className="text-sm text-silver-dark mb-2">
                                    <strong>{doc.items?.length || 0}</strong> items •
                                    <strong className="ml-2">{doc.totalItems || 0}</strong> total units •
                                    <strong className="ml-2 text-accent-green">
                                        {getCurrencySymbol(doc.currency || 'IDR')} {formatCurrency(doc.totalValue || 0)}
                                    </strong>
                                </p>
                                {doc.items && doc.items.length > 0 && (
                                    <div className="text-xs text-silver-dark space-y-1">
                                        {doc.items.slice(0, 3).map((item, idx) => (
                                            <div key={idx}>
                                                • {item.goodsType} ({item.quantity} {item.unit})
                                                {item.packageNumber && ` - Package: ${item.packageNumber}`}
                                            </div>
                                        ))}
                                        {doc.items.length > 3 && (
                                            <div className="text-silver-dark/50">
                                                + {doc.items.length - 3} more items
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Rejection Reason */}
                            {doc.status === 'rejected' && doc.rejectionReason && (
                                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg mb-4">
                                    <p className="text-sm text-red-400 font-semibold mb-1">Rejection Reason:</p>
                                    <p className="text-sm text-silver-dark">{doc.rejectionReason}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {hasEdit && doc.status === 'pending' && (
                                <div className="flex gap-2 pt-3 border-t border-dark-border">
                                    <Button
                                        size="sm"
                                        onClick={() => handleApprove(doc)}
                                        icon={CheckCircle}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setSelectedDoc(doc)}
                                        icon={XCircle}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            )}

                            {doc.status === 'approved' && (
                                <div className="pt-3 border-t border-dark-border">
                                    <p className="text-sm text-accent-green">
                                        ✓ Physical goods movement allowed. Proceed to Goods Movement page.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Approval Confirmation Modal */}
            {approveDialog.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-card p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-silver-light mb-4">
                            Approve BC Document
                        </h3>
                        <p className="text-sm text-silver mb-2">
                            BC Number: <strong>{approveDialog.docNumber}</strong>
                        </p>
                        <p className="text-silver mb-6">
                            Approving this BC document will allow physical goods movement.
                            A new entry will be created in Goods Movement automatically.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="secondary"
                                onClick={handleCancelApprove}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirmApprove}
                                icon={CheckCircle}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Approve Document
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-card p-6 rounded-lg max-w-md w-full mx-4 border border-dark-border">
                        <h3 className="text-xl font-bold text-silver-light mb-4">Reject BC Document</h3>
                        <p className="text-sm text-silver-dark mb-4">
                            Nomor BC: <strong>{selectedDoc.bcNumber}</strong>
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-silver mb-2">
                                Rejection Reason *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g., Incomplete documents, incorrect HS code, missing signatures..."
                                rows={4}
                                className="w-full"
                                required
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setSelectedDoc(null);
                                    setRejectionReason('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => handleReject(selectedDoc.id)}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Confirm Rejection
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomsDocuments;
