import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Plus, ArrowLeft, DollarSign } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import LineItemManager from '../../components/Common/LineItemManager';
import ServiceBreakdown from '../../components/Common/ServiceBreakdown';
import DirectCosts from '../../components/Common/DirectCosts';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/currencyFormatter';

const OutboundManagement = () => {
    const { outboundTransactions, addOutboundTransaction } = useData();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        bcDocNumber: '',
        bcDocDate: new Date().toISOString().split('T')[0],
        recipient: '',
        destination: '',
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
        const serviceSubtotal = Object.values(formData.serviceBreakdown).reduce((sum, s) => sum + (s.total || 0), 0);
        const serviceTax = serviceSubtotal * 0.11;
        const serviceGrandTotal = serviceSubtotal + serviceTax;
        const totalDirectCosts = formData.directCosts.total || 0;

        // Calculate profit
        const grossProfit = serviceGrandTotal - totalDirectCosts;
        const profitMargin = serviceGrandTotal > 0 ? (grossProfit / serviceGrandTotal) * 100 : 0;

        // Derive header info from items for consistency
        const primaryItem = formData.items[0];
        const derivedAssetName = primaryItem ? (formData.items.length > 1 ? `${primaryItem.goodsType} (+${formData.items.length - 1} items)` : primaryItem.goodsType) : 'Unknown';

        const transactionData = {
            ...formData,
            // Header-level fields derived from items
            assetName: derivedAssetName,
            itemCode: primaryItem?.itemCode || '',
            hsCode: primaryItem?.hsCode || '',
            quantity: totalItems,
            unit: primaryItem?.unit || 'mixed',

            date: formData.bcDocDate,
            type: 'outbound',
            value: totalValue,
            serviceSubtotal: serviceSubtotal,
            serviceTax: serviceTax,
            serviceGrandTotal: serviceGrandTotal,
            totalDirectCosts: totalDirectCosts,
            grossProfit: grossProfit,
            profitMargin: profitMargin
        };

        addOutboundTransaction(transactionData);

        // Reset form
        setFormData({
            bcDocNumber: '',
            bcDocDate: new Date().toISOString().split('T')[0],
            recipient: '',
            destination: '',
            officer: '',
            status: 'pending',
            items: [],
            serviceBreakdown: {},
            directCosts: {},
            notes: ''
        });

        alert('Outbound transaction & invoice created successfully!');
    };

    const totalItems = formData.items.reduce((sum, item) => sum + item.quantity, 0);
    const serviceSubtotal = Object.values(formData.serviceBreakdown).reduce((sum, s) => sum + (s.total || 0), 0);
    const serviceTax = serviceSubtotal * 0.11;
    const serviceGrandTotal = serviceSubtotal + serviceTax;
    const totalDirectCosts = formData.directCosts.total || 0;
    const grossProfit = serviceGrandTotal - totalDirectCosts;
    const profitMargin = serviceGrandTotal > 0 ? (grossProfit / serviceGrandTotal) * 100 : 0;

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
                    <h1 className="text-4xl font-bold gradient-text mb-2">Outbound Transactions</h1>
                    <p className="text-silver-dark">Goods Exit & Service Invoicing</p>
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
                                placeholder="BC 2.7-001/2024"
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
                            <label className="block text-sm font-medium text-silver mb-2">Recipient/Customer *</label>
                            <input
                                type="text"
                                required
                                value={formData.recipient}
                                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                                placeholder="Company name"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Destination Country</label>
                            <input
                                type="text"
                                value={formData.destination}
                                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                placeholder="e.g., Singapore, Malaysia"
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
                        {/* Service Breakdown (Invoice to Customer) */}
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

                {/* Profit Summary */}
                {serviceGrandTotal > 0 && (
                    <div className="glass-card p-6 rounded-lg border-2 border-accent-green">
                        <h3 className="text-lg font-semibold text-silver-light mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-accent-green" />
                            Profit Summary
                        </h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-dark-surface rounded-lg">
                                <span className="text-silver-dark">Service Revenue (incl. tax):</span>
                                <span className="text-xl font-bold text-accent-green">
                                    Rp {formatCurrency(serviceGrandTotal)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-dark-surface rounded-lg">
                                <span className="text-silver-dark">Direct Costs (COGS):</span>
                                <span className="text-xl font-bold text-accent-orange">
                                    - Rp {formatCurrency(totalDirectCosts)}
                                </span>
                            </div>

                            <div className="border-t-2 border-dark-border pt-3"></div>

                            <div className="flex justify-between items-center p-4 bg-accent-green bg-opacity-10 rounded-lg border border-accent-green">
                                <div>
                                    <p className="text-sm text-silver-dark">Gross Profit</p>
                                    <p className="text-xs text-silver-dark">Margin: {profitMargin.toFixed(2)}%</p>
                                </div>
                                <span className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                                    Rp {formatCurrency(grossProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

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
                        Create Outbound Transaction & Invoice
                    </Button>
                </div>
            </form>

            {/* Transaction List */}
            <div className="glass-card p-6 rounded-lg mt-8">
                <h3 className="text-xl font-semibold text-silver-light mb-4">Recent Outbound Transactions</h3>

                {outboundTransactions.length === 0 ? (
                    <div className="text-center py-8 text-silver-dark">
                        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No outbound transactions yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {outboundTransactions.slice(0, 5).map(trans => (
                            <div key={trans.id} className="p-4 bg-dark-surface rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <p className="font-semibold text-silver-light">{trans.bcDocNumber}</p>
                                        <p className="text-sm text-silver-dark">
                                            {trans.recipient} • {trans.items?.length || 0} items • {new Date(trans.date).toLocaleDateString('id-ID')}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${trans.status === 'cleared' ? 'bg-green-500/20 text-green-400' :
                                        trans.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        {trans.status}
                                    </span>
                                </div>
                                {trans.grossProfit !== undefined && (
                                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-dark-border">
                                        <span className="text-silver-dark">Profit:</span>
                                        <span className={`font-bold ${trans.grossProfit >= 0 ? 'text-accent-green' : 'text-red-500'}`}>
                                            Rp {formatCurrency(trans.grossProfit)} ({trans.profitMargin?.toFixed(1)}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OutboundManagement;
