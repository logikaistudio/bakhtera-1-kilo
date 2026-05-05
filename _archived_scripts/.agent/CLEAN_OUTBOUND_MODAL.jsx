// CLEAN UI MODAL - Outbound Inventory Detail
// Replace modal section (line 244-339) dengan kode ini:

{/* Detail Modal */ }
{
    showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Modal Header - White with actions */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Detail Inventaris</h2>
                        <p className="text-sm text-gray-500 mt-1">{selectedItem.quotationNumber || selectedItem.quotation_number || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                            Mutasi
                        </button>
                        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Trash2 className="w-4 h-4" />
                            Hapus Mutasi
                        </button>
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={() => setShowDetailModal(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[75vh] bg-gray-50 space-y-6">
                    {/* Data Inventaris Section */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            📦 Data Inventaris
                        </h3>
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-blue-600">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">NO. PENGAJUAN</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">NO. PABEAN</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">TGL MASUK GUDANG</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">JAM MASUK</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">JML PACKAGE</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">JML ITEM</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">PIC PENERIMA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900">{selectedItem.quotationNumber || selectedItem.quotation_number || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{selectedItem.bcDocumentNumber || selectedItem.bc_document_number || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{formatDate(selectedItem.approvedDate || selectedItem.approved_date)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{formatTime(selectedItem.approvedDate || selectedItem.approved_date)}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">{(selectedItem.packages || []).length}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-900 font-semibold">
                                            {(selectedItem.packages || []).reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">{selectedItem.pic || 'ABD'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Detail Items Section */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            📝 Detail Item
                        </h3>
                        <div className="space-y-4">
                            {(selectedItem.packages || []).map((pkg, pkgIndex) => (
                                <div key={pkgIndex}>
                                    {/* Package Header */}
                                    <div className="bg-gray-100 px-4 py-2 rounded-t-lg">
                                        <span className="text-sm font-semibold text-gray-700">Kode Packing: {pkg.packageNumber || `Paket_${pkgIndex + 1}`}</span>
                                    </div>
                                    {/* Items Table */}
                                    <div className="bg-white rounded-b-xl shadow-sm overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-blue-600">
                                                <tr>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-16">CHECKOUT</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-16">NO. URUT</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">KODE BARANG</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-20">HS CODE</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">ITEM</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-20">JUMLAH</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-20">SATUAN</th>
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-24">STATUS</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-24">LOKASI</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-20">KONDISI</th>
                                                    <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">KETERANGAN</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {(pkg.items || []).map((item, itemIdx) => (
                                                    <tr key={itemIdx} className="hover:bg-blue-50/50">
                                                        <td className="px-3 py-2 text-center">
                                                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-gray-900 font-medium">{itemIdx + 1}</td>
                                                        <td className="px-3 py-2 text-sm font-mono text-gray-900">{item.itemCode || '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-700">{item.hsCode || '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-700">{item.name || item.itemName || '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-center text-gray-900 font-semibold">{item.quantity || 0}</td>
                                                        <td className="px-3 py-2 text-sm text-center text-gray-700">{item.uom || 'pcs'}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                                {item.quantity || 0}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-gray-700">{item.location || 'warehouse'}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-700">{item.condition || 'Baik'}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-500">{item.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
