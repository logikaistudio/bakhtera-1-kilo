import React, { useState } from 'react';
import { FileText, X } from 'lucide-react';
import Button from '../Common/Button';
import LineItemManager from '../Common/LineItemManager';
import QuotationSummary from '../Common/QuotationSummary';
import { formatCurrency } from '../../utils/currencyFormatter';
import { useData } from '../../context/DataContext';

const POFormModal = ({ onClose, onSubmit, vendors }) => {
    const { quotations = [] } = useData();
    const approvedQuotations = quotations.filter(q => q.status === 'approved');

    const [formData, setFormData] = useState({
        quotationId: '',
        vendorId: '',
        poDate: new Date().toISOString().split('T')[0],
        title: '',
        items: [],
        discountType: 'percentage',
        discountValue: 0,
        taxRate: 11,
        notes: '',
        status: 'draft'
    });

    const selectedVendor = vendors.find(v => v.id === formData.vendorId);

    // Calculate totals
    const itemsSubtotal = formData.items.reduce((sum, item) => sum + (item.value || 0), 0);
    const discountAmount = formData.discountType === 'percentage'
        ? (itemsSubtotal * formData.discountValue) / 100
        : formData.discountValue;
    const subtotalAfterDiscount = itemsSubtotal - discountAmount;
    const taxAmount = (subtotalAfterDiscount * formData.taxRate) / 100;
    const grandTotal = subtotalAfterDiscount + taxAmount;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.items.length === 0) {
            alert('Harap tambahkan minimal satu item pembelian!');
            return;
        }

        if (!formData.vendorId) {
            alert('Harap pilih vendor!');
            return;
        }

        const selectedQuotation = formData.quotationId
            ? approvedQuotations.find(q => q.id === formData.quotationId)
            : null;

        const poData = {
            ...formData,
            vendorName: selectedVendor?.name || '',
            vendorNPWP: selectedVendor?.npwp || '',
            quotationNumber: selectedQuotation?.quotationNumber || '',
            customerName: selectedQuotation?.customer || '',
            itemsSubtotal,
            discountAmount,
            subtotalAfterDiscount,
            taxAmount,
            grandTotal
        };

        onSubmit(poData);
        alert('Purchase Order berhasil dibuat!');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 z-10 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">Buat Purchase Order</h2>
                        <p className="text-silver-dark text-sm mt-1">Lengkapi informasi PO dan item pembelian</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-dark-surface rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-silver-dark" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* PO HEADER */}
                    <div className="glass-card p-6 rounded-lg border border-accent-purple/30 bg-gradient-to-br from-accent-purple/5 to-transparent">
                        <h3 className="text-lg font-semibold text-silver-light mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-accent-purple" />
                            Informasi Purchase Order
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* No. PO (Auto-generated) */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    No. PO *
                                </label>
                                <div className="px-4 py-3 bg-dark-surface/50 border border-dark-border rounded-lg">
                                    <p className="text-silver-light font-mono">
                                        Auto: PO-{new Date().getFullYear()}-XXXX
                                    </p>
                                    <p className="text-xs text-silver-dark mt-1">Dibuat otomatis saat submit</p>
                                </div>
                            </div>

                            {/* PO Date */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Tanggal PO *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.poDate}
                                    onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-purple focus:outline-none"
                                />
                            </div>

                            {/* No. Pendaftaran (Quotation) - Optional */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    No. Pengajuan (Opsional)
                                </label>
                                <select
                                    value={formData.quotationId}
                                    onChange={(e) => setFormData({ ...formData, quotationId: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-purple focus:outline-none"
                                >
                                    <option value="">-- Tidak ada / Manual --</option>
                                    {approvedQuotations.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.quotationNumber} - {q.customer}
                                        </option>
                                    ))}
                                </select>
                                {formData.quotationId && (
                                    <p className="text-xs text-accent-purple mt-1">✓ PO akan terhubung dengan pengajuan ini</p>
                                )}
                            </div>

                            {/* Vendor Selection */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Nama Vendor *
                                </label>
                                <select
                                    required
                                    value={formData.vendorId}
                                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-purple focus:outline-none"
                                >
                                    <option value="">-- Pilih Vendor --</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* NPWP (Read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    NPWP Vendor
                                </label>
                                <input
                                    type="text"
                                    value={selectedVendor?.npwp || '-'}
                                    disabled
                                    className="w-full px-4 py-3 bg-dark-surface/50 border border-dark-border rounded-lg text-silver-light"
                                    placeholder="Otomatis dari vendor terpilih"
                                />
                                {selectedVendor && selectedVendor.npwp && (
                                    <p className="text-xs text-accent-purple mt-1">✓ NPWP tersedia</p>
                                )}
                            </div>

                            {/* Judul PO */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Judul PO *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-purple focus:outline-none"
                                    placeholder="Contoh: Purchase Order - Pembelian Office Supplies"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ITEMS SECTION */}
                    <div className="border-t border-dark-border pt-6">
                        <h3 className="text-lg font-semibold text-silver-light mb-4">Item Pembelian</h3>

                        <LineItemManager
                            items={formData.items}
                            onChange={(items) => setFormData({ ...formData, items })}
                        />

                        <QuotationSummary
                            itemsSubtotal={itemsSubtotal}
                            serviceSubtotal={0}
                            customCostsSubtotal={0}
                            discountType={formData.discountType}
                            discountValue={formData.discountValue}
                            taxRate={formData.taxRate}
                            onDiscountChange={({ type, value }) => setFormData({ ...formData, discountType: type, discountValue: value })}
                            onTaxRateChange={(rate) => setFormData({ ...formData, taxRate: rate })}
                        />

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Catatan</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="w-full"
                                placeholder="Catatan tambahan untuk PO ini..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="secondary" onClick={onClose}>
                                Batal
                            </Button>
                            <Button type="submit">
                                Simpan Purchase Order
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default POFormModal;
