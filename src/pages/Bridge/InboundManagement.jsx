import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, ArrowLeft } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import LineItemManager from '../../components/Common/LineItemManager';
import ServiceBreakdown from '../../components/Common/ServiceBreakdown';
import DirectCosts from '../../components/Common/DirectCosts';
import { useNavigate } from 'react-router-dom';

const InboundManagement = () => {
    const { inboundTransactions, addInboundTransaction } = useData();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        bcDocNumber: '',
        bcDocDate: new Date().toISOString().split('T')[0],
        supplier: '',
        origin: '',
        officer: '',
        status: 'pending',
        items: [],
        serviceBreakdown: {},
        directCosts: {},
        notes: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        // Calculate totals
        const totalValue = formData.items.reduce((sum, item) => sum + item.value, 0);
        const serviceTotal = Object.values(formData.serviceBreakdown).reduce((sum, s) => sum + (s.total || 0), 0);
        const serviceTax = serviceTotal * 0.11;
        const serviceGrandTotal = serviceTotal + serviceTax;

        // Derive header info from items for consistency
        const primaryItem = formData.items[0];
        const derivedAssetName = primaryItem ? (formData.items.length > 1 ? `${primaryItem.goodsType} (+${formData.items.length - 1} items)` : primaryItem.goodsType) : 'Unknown';

        const transactionData = {
            ...formData,
            // Header-level fields derived from items
            assetName: derivedAssetName,
            itemCode: primaryItem?.itemCode || '',
            hsCode: primaryItem?.hsCode || '',
            quantity: totalItems, // Total quantity for header
            unit: primaryItem?.unit || 'mixed', // Unit for header

            date: formData.bcDocDate,
            type: 'inbound',
            value: totalValue,
            serviceSubtotal: serviceTotal,
            serviceTax: serviceTax,
            serviceGrandTotal: serviceGrandTotal,
            totalDirectCosts: formData.directCosts.total || 0
        };

        addInboundTransaction(transactionData);

        // Reset form
        setFormData({
            bcDocNumber: '',
            bcDocDate: new Date().toISOString().split('T')[0],
            supplier: '',
            origin: '',
            officer: '',
            status: 'pending',
            items: [],
            serviceBreakdown: {},
            directCosts: {},
            notes: ''
        });

        alert('Inbound transaction added successfully!');
    };

    const totalItems = formData.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/bridge')}
                    className="p-2 rounded-lg hover:bg-dark-surface smooth-transition text-silver-dark hover:text-silver"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-4xl font-bold gradient-text mb-2">Inbound Transactions</h1>
                    <p className="text-silver-dark">Goods Entry & BC Documentation</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* BC Document Info */}
                <div className="glass-card p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-silver-light mb-4">BC Document Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">BC Document Number *</label>
                            <input
                                type="text"
                                required
                                value={formData.bcDocNumber}
                                onChange={(e) => setFormData({ ...formData, bcDocNumber: e.target.value })}
                                placeholder="BC 2.3-001/2024"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">BC Document Date *</label>
                            <input
                                type="date"
                                required
                                value={formData.bcDocDate}
                                onChange={(e) => setFormData({ ...formData, bcDocDate: e.target.value })}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Supplier/Customer *</label>
                            <input
                                type="text"
                                required
                                value={formData.supplier}
                                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                placeholder="Company name"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Origin Country</label>
                            <input
                                type="text"
                                value={formData.origin}
                                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                placeholder="e.g., China, USA"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Customs Officer</label>
                            <input
                                type="text"
                                value={formData.officer}
                                onChange={(e) => setFormData({ ...formData, officer: e.target.value })}
                                placeholder="Officer name"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full"
                            >
                                <option value="pending">Pending</option>
                                <option value="cleared">Cleared</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <LineItemManager
                    items={formData.items}
                    onChange={(items) => setFormData({ ...formData, items })}
                />

                {/* Financial Details Section */}
                <div className="glass-card p-6 rounded-lg border border-dark-border">
                    <h3 className="text-lg font-semibold text-silver-light mb-4">Financial Details</h3>
                    <div className="space-y-6">
                        {/* Service Breakdown */}
                        <ServiceBreakdown
                            services={formData.serviceBreakdown}
                            onChange={(services) => setFormData({ ...formData, serviceBreakdown: services })}
                            totalItems={totalItems}
                        />

                        <div className="border-t border-dark-border my-4"></div>

                        {/* Direct Costs (COGS) */}
                        <DirectCosts
                            costs={formData.directCosts}
                            onChange={(costs) => setFormData({ ...formData, directCosts: costs })}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="glass-card p-4 rounded-lg">
                    <label className="block text-sm font-medium text-silver mb-2">Additional Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Any additional information..."
                        rows={3}
                        className="w-full"
                    />
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={() => navigate('/bridge')}>
                        Cancel
                    </Button>
                    <Button type="submit" icon={Plus}>
                        Create Inbound Transaction
                    </Button>
                </div>
            </form>

            {/* Transaction List */}
            <div className="glass-card p-6 rounded-lg mt-8">
                <h3 className="text-xl font-semibold text-silver-light mb-4">Recent Inbound Transactions</h3>

                {inboundTransactions.length === 0 ? (
                    <div className="text-center py-8 text-silver-dark">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No inbound transactions yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {inboundTransactions.slice(0, 5).map(trans => (
                            <div key={trans.id} className="p-4 bg-dark-surface rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-silver-light">{trans.bcDocNumber}</p>
                                    <p className="text-sm text-silver-dark">
                                        {trans.supplier} • {trans.items?.length || 0} items • {new Date(trans.date).toLocaleDateString('id-ID')}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${trans.status === 'cleared' ? 'bg-green-500/20 text-green-400' :
                                    trans.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                    }`}>
                                    {trans.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InboundManagement;
