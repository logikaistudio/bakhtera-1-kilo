import React from 'react';
import { useData } from '../../../context/DataContext';

const PabeanDashboard = () => {
    const { inboundTransactions = [], outboundTransactions = [], quotations = [] } = useData();

    // 1. Calculate Totals (Detail Quantity)
    const totalInbound = inboundTransactions.reduce((sum, t) => {
        // Handle items array if present, else fallback to quantity
        if (t.items && Array.isArray(t.items) && t.items.length > 0) {
            return sum + t.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0);
        }
        return sum + (Number(t.quantity) || 0);
    }, 0);

    // FIX: Calculate totalOutbound from outboundTransactions (same logic as inbound)
    // FIX: Calculate totalOutbound from OUTBOUND QUOTATIONS (Bridge Source of Truth)
    // Simple logic: Mutasi = Barang Masuk - Barang Keluar
    const totalOutbound = quotations
        .filter(q => q.type === 'outbound' && ['submitted', 'approved', 'processed'].includes(q.outbound_status || q.documentStatus || q.document_status))
        .reduce((sum, q) => {
            return sum + (q.packages || []).reduce((pkgSum, pkg) => {
                return pkgSum + (pkg.items || []).reduce((itemSum, item) => {
                    const qty = item.outboundQuantity !== undefined ? Number(item.outboundQuantity) : (Number(item.quantity) || 0);
                    return itemSum + qty;
                }, 0);
            }, 0);
        }, 0);

    const stock = totalInbound - totalOutbound;

    // 2. Prepare Table Data (From Quotations)
    // Sort by date desc
    const sortedQuotations = [...quotations].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved': return 'text-accent-green bg-accent-green/10';
            case 'rejected': return 'text-red-400 bg-red-400/10';
            case 'pending': return 'text-yellow-400 bg-yellow-400/10';
            default: return 'text-silver-dark bg-silver-dark/10';
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Dashboard Pabean</h1>
                <p className="text-silver-dark mt-1">Ringkasan Aktivitas Kepabeanan</p>
            </div>

            {/* Compact Summary Boxes (No Icons) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Barang Masuk */}
                <div className="glass-card p-4 rounded-lg border-l-4 border-accent-blue bg-dark-bg/40">
                    <p className="text-xs font-semibold text-silver-dark uppercase tracking-wider mb-1">Total Barang Masuk</p>
                    <p className="text-2xl font-bold text-silver-light">{totalInbound.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-silver-dark mt-1">Total Quantity Detail</p>
                </div>

                {/* Barang Keluar */}
                <div className="glass-card p-4 rounded-lg border-l-4 border-accent-orange bg-dark-bg/40">
                    <p className="text-xs font-semibold text-silver-dark uppercase tracking-wider mb-1">Total Barang Keluar</p>
                    <p className="text-2xl font-bold text-silver-light">{totalOutbound.toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-silver-dark mt-1">Total Quantity Detail</p>
                </div>

                {/* Stok */}
                <div className="glass-card p-4 rounded-lg border-l-4 border-accent-green bg-dark-bg/40">
                    <p className="text-xs font-semibold text-silver-dark uppercase tracking-wider mb-1">Stok Tersedia</p>
                    <p className={`text-2xl font-bold ${stock < 0 ? 'text-red-400' : 'text-accent-green'}`}>
                        {stock.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-silver-dark mt-1">Masuk - Keluar</p>
                </div>
            </div>

            {/* Table Summary */}
            <div className="glass-card rounded-lg overflow-hidden border border-dark-border">
                <div className="px-6 py-4 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-silver-light">Ringkasan Status Pengajuan</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface/50 border-b border-dark-border">
                            <tr>
                                <th className="px-3 py-2 text-left text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">No. Pengajuan</th>
                                <th className="px-3 py-2 text-left text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">No. BC</th>
                                <th className="px-3 py-2 text-center text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">Tanggal Pengajuan</th>
                                <th className="px-3 py-2 text-center text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">Tanggal Approval</th>
                                <th className="px-3 py-2 text-center text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">Jenis Pengajuan</th>
                                <th className="px-3 py-2 text-center text-[11px] font-bold text-silver uppercase tracking-wider whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {sortedQuotations.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-silver-dark text-sm">
                                        Belum ada data pengajuan
                                    </td>
                                </tr>
                            ) : (
                                sortedQuotations.map((item, idx) => (
                                    <tr key={item.id || idx} className="hover:bg-dark-surface/30 transition-colors border-t border-dark-border">
                                        <td className="px-3 py-1.5 text-[11px] text-silver-light font-mono whitespace-nowrap">
                                            {item.quotationNumber || item.quotation_number || '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-silver-light font-mono whitespace-nowrap">
                                            {item.bcDocumentNumber || item.bc_document_number || '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {(item.date || item.submissionDate || item.submission_date) ? new Date(item.date || item.submissionDate || item.submission_date).toLocaleDateString('id-ID', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            }) : '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11px] text-center text-silver-light whitespace-nowrap">
                                            {item.approvedDate || item.approved_date ? new Date(item.approvedDate || item.approved_date).toLocaleDateString('id-ID', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            }) : '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize
                                                ${item.type === 'inbound' ? 'text-blue-400 bg-blue-400/10' : 'text-orange-400 bg-orange-400/10'}
                                            `}>
                                                {item.type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${getStatusColor(item.documentStatus || item.status)}`}>
                                                {item.documentStatus || item.status || 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PabeanDashboard;
