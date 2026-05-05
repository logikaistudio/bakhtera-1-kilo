// ============================================================================
// DETAIL PENGAJUAN MODAL - Ready to Paste
// Location: After line 1490 in PengajuanManagement.jsx
// Paste AFTER warehouse selector modal, BEFORE Item Editor Modal
// ============================================================================

{/* Detail Pengajuan Modal - NEW */ }
{
    showDetailModal && selectedPengajuan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
            <div className="glass-card rounded-lg max-w-4xl w-full max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-dark-border bg-accent-purple/10">
                    <div>
                        <h2 className="text-xl font-bold text-silver-light flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Detail Pengajuan Keluar
                        </h2>
                        <p className="text-sm text-silver-dark mt-1">
                            {selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowDetailModal(false)}
                        className="text-silver-dark hover:text-silver p-1"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-silver-dark font-medium">No. Pengajuan</label>
                            <p className="text-sm text-silver mt-1 font-semibold">
                                {selectedPengajuan.quotationNumber || selectedPengajuan.quotation_number}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Tanggal Pengajuan</label>
                            <p className="text-sm text-silver mt-1">
                                {new Date(selectedPengajuan.submissionDate || selectedPengajuan.submission_date).toLocaleDateString('id-ID')}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Pemilik Barang</label>
                            <p className="text-sm text-silver mt-1">{selectedPengajuan.customer}</p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Shipper</label>
                            <p className="text-sm text-silver mt-1">{selectedPengajuan.shipper || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Jenis Dokumen BC</label>
                            <p className="text-sm text-silver mt-1">{selectedPengajuan.bcDocType || selectedPengajuan.bc_document_type || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">No. Dokumen Pabean</label>
                            <p className="text-sm text-accent-purple mt-1 font-semibold">
                                {selectedPengajuan.bcDocumentNumber || selectedPengajuan.bc_document_number || '-'}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Tujuan</label>
                            <p className="text-sm text-silver mt-1">{selectedPengajuan.destination || '-'}</p>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark font-medium">Status Dokumen</label>
                            <p className="text-sm mt-1">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${(selectedPengajuan.documentStatus || selectedPengajuan.document_status) === 'approved'
                                        ? 'bg-green-500/20 text-green-400'
                                        : (selectedPengajuan.documentStatus || selectedPengajuan.document_status) === 'rejected'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {(selectedPengajuan.documentStatus || selectedPengajuan.document_status) === 'approved' ? 'Approved' :
                                        (selectedPengajuan.documentStatus || selectedPengajuan.document_status) === 'rejected' ? 'Rejected' : 'Pengajuan'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Packages */}
                    <div>
                        <h3 className="text-lg font-bold text-silver mb-3">📦 Detail Barang</h3>
                        <div className="space-y-3">
                            {(selectedPengajuan.packages || []).map((pkg, pkgIdx) => (
                                <div key={pkgIdx} className="glass-card p-3 rounded-lg border border-dark-border">
                                    <div className="font-semibold text-silver mb-2 text-sm">
                                        Package: {pkg.packageNumber}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-dark-surface">
                                                <tr>
                                                    <th className="px-2 py-1 text-left font-bold text-silver">Kode</th>
                                                    <th className="px-2 py-1 text-left font-bold text-silver">Nama Item</th>
                                                    <th className="px-2 py-1 text-center font-bold text-silver">Qty</th>
                                                    <th className="px-2 py-1 text-center font-bold text-silver">Unit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(pkg.items || []).map((item, itemIdx) => (
                                                    <tr key={itemIdx} className="border-t border-dark-border">
                                                        <td className="px-2 py-1 font-mono text-silver">{item.itemCode}</td>
                                                        <td className="px-2 py-1 text-silver">{item.name || item.itemName}</td>
                                                        <td className="px-2 py-1 text-center text-silver font-bold">{item.quantity}</td>
                                                        <td className="px-2 py-1 text-center text-silver">{item.uom || 'pcs'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="glass-card p-4 bg-accent-purple/10 border-2 border-accent-purple rounded-lg">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-silver-dark">Total Package</p>
                                <p className="text-lg font-bold text-accent-purple">
                                    {selectedPengajuan.packages?.length || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark">Total Item</p>
                                <p className="text-lg font-bold text-accent-purple">
                                    {selectedPengajuan.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark">Total Quantity</p>
                                <p className="text-lg font-bold text-accent-purple">
                                    {selectedPengajuan.packages?.reduce((sum, pkg) =>
                                        sum + pkg.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0
                                    ) || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center gap-3 p-4 border-t border-dark-border bg-dark-surface">
                    <Button
                        variant="secondary"
                        onClick={() => setShowDetailModal(false)}
                    >
                        Tutup
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            icon={Trash2}
                            onClick={() => {
                                setDeleteConfirmModal({ show: true, pengajuanId: selectedPengajuan.id });
                                setShowDetailModal(false);
                            }}
                            className="hover:bg-red-500/20 hover:text-red-400"
                        >
                            Hapus
                        </Button>
                        <Button
                            variant="primary"
                            icon={Edit2}
                            onClick={() => {
                                handleEditPengajuan(selectedPengajuan);
                                setShowDetailModal(false);
                            }}
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// END OF DETAIL MODAL
// ============================================================================
