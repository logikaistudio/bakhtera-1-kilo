import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useData } from '../../context/DataContext';
import StatCard from '../../components/Common/StatCard';

const PabeanDashboard = () => {
    const { inboundTransactions = [], outboundTransactions = [], rejectTransactions = [], quotations = [] } = useData();

    // Calculate totals
    const totalInbound = inboundTransactions.length;
    const totalOutbound = outboundTransactions.length;
    const totalReject = rejectTransactions.length;

    // Filter quotations by status
    const pendingDocs = quotations.filter(q => q.status === 'pending' || q.status === 'draft');
    const approvedDocs = quotations.filter(q => q.status === 'approved');
    const rejectedDocs = quotations.filter(q => q.status === 'rejected');

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Dashboard Pabean</h1>
                <p className="text-silver-dark mt-1">Monitoring Transaksi & Status Dokumen Kepabeanan</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="Total Barang Masuk"
                    value={totalInbound}
                    icon={ArrowDownCircle}
                    iconColor="text-accent-blue"
                    borderColor="border-accent-blue"
                />
                <StatCard
                    title="Total Barang Keluar"
                    value={totalOutbound}
                    icon={ArrowUpCircle}
                    iconColor="text-accent-orange"
                    borderColor="border-accent-orange"
                />
                <StatCard
                    title="Total Barang Reject"
                    value={totalReject}
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                    borderColor="border-red-500"
                />
            </div>



            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <Clock className="w-10 h-10 text-yellow-400" />
                        <div>
                            <p className="text-xs text-silver-dark">Pending</p>
                            <p className="text-2xl font-bold text-yellow-400">{pendingDocs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green/30">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-10 h-10 text-accent-green" />
                        <div>
                            <p className="text-xs text-silver-dark">Approved</p>
                            <p className="text-2xl font-bold text-accent-green">{approvedDocs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3">
                        <XCircle className="w-10 h-10 text-red-400" />
                        <div>
                            <p className="text-xs text-silver-dark">Rejected</p>
                            <p className="text-2xl font-bold text-red-400">{rejectedDocs.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PabeanDashboard;
