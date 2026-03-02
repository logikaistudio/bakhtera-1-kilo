import React from 'react';
import { DollarSign } from 'lucide-react';
import { formatCurrency, parseCurrency } from '../../utils/currencyFormatter';

const ServiceBreakdown = ({ services = {}, onChange, totalItems = 0 }) => {
    const handleServiceChange = (serviceType, field, value) => {
        const numericValue = field === 'description' ? value : parseCurrency(value);

        const updatedService = {
            ...services[serviceType],
            [field]: numericValue
        };

        // Auto-calculate total for this service
        if (field === 'quantity' || field === 'unitPrice' || field === 'days' || field === 'dailyRate') {
            if (serviceType === 'storage' && updatedService.days && updatedService.dailyRate) {
                updatedService.total = updatedService.days * updatedService.dailyRate;
            } else if (updatedService.quantity && updatedService.unitPrice) {
                updatedService.total = updatedService.quantity * updatedService.unitPrice;
            }
        }

        onChange({
            ...services,
            [serviceType]: updatedService
        });
    };

    const calculateSubtotal = () => {
        return Object.values(services).reduce((sum, service) => sum + (service.total || 0), 0);
    };

    const subtotal = calculateSubtotal();
    const tax = subtotal * 0.11; // PPN 11%
    const grandTotal = subtotal + tax;

    const defaultServices = {
        handling: services.handling || { description: 'Loading/Unloading', quantity: totalItems, unitPrice: 0, total: 0 },
        storage: services.storage || { description: 'Warehouse Storage', days: 0, dailyRate: 0, total: 0 },
        customsProcessing: services.customsProcessing || { description: 'Proses Pabean', quantity: 1, unitPrice: 0, total: 0 },
        transportation: services.transportation || { description: 'Transportation', quantity: 1, unitPrice: 0, total: 0 },
        insurance: services.insurance || { description: 'Cargo Insurance', quantity: 1, unitPrice: 0, total: 0 },
        documentation: services.documentation || { description: 'Admin & Documentation', quantity: 1, unitPrice: 0, total: 0 },
        other: services.other || { description: 'Other Services', quantity: 1, unitPrice: 0, total: 0 }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-accent-green" />
                <h3 className="text-lg font-semibold text-silver-light">Rincian Layanan</h3>
                <span className="text-xs text-silver-dark">(Biaya yang dikenakan ke pelanggan)</span>
            </div>

            <div className="glass-card p-4 rounded-lg border border-dark-border space-y-3">
                {/* Handling */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Description</label>
                        <input
                            type="text"
                            value={defaultServices.handling.description}
                            onChange={(e) => handleServiceChange('handling', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.handling.quantity)}
                            onChange={(e) => handleServiceChange('handling', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.handling.unitPrice)}
                            onChange={(e) => handleServiceChange('handling', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Storage */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Penyimpanan</label>
                        <input
                            type="text"
                            value={defaultServices.storage.description}
                            onChange={(e) => handleServiceChange('storage', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Hari</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.storage.days)}
                            onChange={(e) => handleServiceChange('storage', 'days', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Tarif Harian</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.storage.dailyRate)}
                            onChange={(e) => handleServiceChange('storage', 'dailyRate', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Customs Processing */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Proses Pabean</label>
                        <input
                            type="text"
                            value={defaultServices.customsProcessing.description}
                            onChange={(e) => handleServiceChange('customsProcessing', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.customsProcessing.quantity)}
                            onChange={(e) => handleServiceChange('customsProcessing', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.customsProcessing.unitPrice)}
                            onChange={(e) => handleServiceChange('customsProcessing', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Transportation */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Transportasi</label>
                        <input
                            type="text"
                            value={defaultServices.transportation.description}
                            onChange={(e) => handleServiceChange('transportation', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.transportation.quantity)}
                            onChange={(e) => handleServiceChange('transportation', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.transportation.unitPrice)}
                            onChange={(e) => handleServiceChange('transportation', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Insurance */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Asuransi Kargo</label>
                        <input
                            type="text"
                            value={defaultServices.insurance.description}
                            onChange={(e) => handleServiceChange('insurance', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.insurance.quantity)}
                            onChange={(e) => handleServiceChange('insurance', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.insurance.unitPrice)}
                            onChange={(e) => handleServiceChange('insurance', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Documentation */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Admin & Dokumentasi</label>
                        <input
                            type="text"
                            value={defaultServices.documentation.description}
                            onChange={(e) => handleServiceChange('documentation', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.documentation.quantity)}
                            onChange={(e) => handleServiceChange('documentation', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.documentation.unitPrice)}
                            onChange={(e) => handleServiceChange('documentation', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Other Services */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-silver mb-1">Layanan Lainnya</label>
                        <input
                            type="text"
                            value={defaultServices.other.description}
                            onChange={(e) => handleServiceChange('other', 'description', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.other.quantity)}
                            onChange={(e) => handleServiceChange('other', 'quantity', e.target.value)}
                            className="w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                        <input
                            type="text"
                            value={formatCurrency(defaultServices.other.unitPrice)}
                            onChange={(e) => handleServiceChange('other', 'unitPrice', e.target.value)}
                            className="w-full text-sm"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Summary */}
                <div className="border-t border-dark-border pt-3 mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-silver-dark">Subtotal:</span>
                        <span className="font-semibold text-silver-light">Rp {formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-silver-dark">Pajak (PPN 11%):</span>
                        <span className="font-semibold text-accent-orange">Rp {formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-dark-border pt-2">
                        <span className="font-bold text-silver-light">Total Keseluruhan:</span>
                        <span className="text-xl font-bold text-accent-green">Rp {formatCurrency(grandTotal)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceBreakdown;
