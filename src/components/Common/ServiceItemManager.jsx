import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import Button from './Button';

const ServiceItemManager = ({ items = [], onChange, currency = 'USD', readOnly = false }) => {
    const [serviceItems, setServiceItems] = useState(items);

    // Sync with parent when items change
    useEffect(() => {
        setServiceItems(items);
    }, [items]);

    const addItem = () => {
        const newItem = {
            id: Date.now(),
            description: '',
            quantity: 1,
            unitPrice: '',
            amount: 0
        };
        const updated = [...serviceItems, newItem];
        setServiceItems(updated);
        onChange(updated);
    };

    const updateItem = (id, field, value) => {
        const updated = serviceItems.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };

                // Auto-calculate amount when quantity or unitPrice changes
                if (field === 'quantity' || field === 'unitPrice') {
                    const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
                    const price = field === 'unitPrice' ? parseFloat(value.toString().replace(/\./g, '')) || 0 : parseFloat(item.unitPrice) || 0;
                    updatedItem.amount = qty * price;
                }

                return updatedItem;
            }
            return item;
        });
        setServiceItems(updated);
        onChange(updated);
    };

    const deleteItem = (id) => {
        const updated = serviceItems.filter(item => item.id !== id);
        setServiceItems(updated);
        onChange(updated);
    };

    const calculateTotal = () => {
        return serviceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    };

    const formatNumber = (num) => {
        if (!num && num !== 0) return '';
        return parseInt(num).toLocaleString('id-ID');
    };

    const total = calculateTotal();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-silver">
                    Cost Breakdown / Service Items
                </label>
                {!readOnly && (
                    <Button
                        type="button"
                        onClick={addItem}
                        icon={Plus}
                        variant="secondary"
                        className="text-xs"
                    >
                        Add Item
                    </Button>
                )}
            </div>

            {/* Table Header */}
            {serviceItems.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-dark-border">
                                <th className="text-left text-xs font-medium text-silver-dark pb-2">Service / Description</th>
                                <th className="text-right text-xs font-medium text-silver-dark pb-2 w-20">Qty</th>
                                <th className="text-right text-xs font-medium text-silver-dark pb-2 w-32">Unit Price</th>
                                <th className="text-right text-xs font-medium text-silver-dark pb-2 w-32">Amount</th>
                                {!readOnly && <th className="w-20"></th>}
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {serviceItems.map((item, index) => (
                                <tr key={item.id} className={`${index > 0 ? 'border-t border-dark-border/50' : ''}`}>
                                    <td className="py-2 pr-2">
                                        <textarea
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            placeholder="e.g., Ocean Freight, THC, Documentation"
                                            className="w-full px-2 py-1.5 text-sm bg-dark-surface border border-dark-border rounded text-silver-light resize-y min-h-[60px] max-h-[300px]"
                                            readOnly={readOnly}
                                            rows={4}
                                        />
                                    </td>
                                    <td className="py-2 px-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm bg-dark-surface border border-dark-border rounded text-silver-light text-right"
                                            readOnly={readOnly}
                                        />
                                    </td>
                                    <td className="py-2 px-2">
                                        <input
                                            type="text"
                                            value={item.unitPrice ? formatNumber(item.unitPrice) : ''}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\./g, '');
                                                if (value === '' || /^\d+$/.test(value)) {
                                                    updateItem(item.id, 'unitPrice', value);
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-full px-2 py-1.5 text-sm bg-dark-surface border border-dark-border rounded text-silver-light text-right"
                                            readOnly={readOnly}
                                        />
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="text-sm text-silver-light text-right font-medium">
                                            {currency === 'USD' ? '$' : 'Rp'} {formatNumber(item.amount)}
                                        </div>
                                    </td>
                                    {!readOnly && (
                                        <td className="py-2 pl-2">
                                            <button
                                                type="button"
                                                onClick={() => deleteItem(item.id)}
                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded smooth-transition"
                                                title="Delete item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Total Row */}
                    <div className="mt-4 pt-4 border-t border-dark-border flex justify-end">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-8">
                                <span className="text-sm font-medium text-silver">Total:</span>
                                <span className="text-lg font-bold text-accent-orange">
                                    {currency === 'USD' ? '$' : 'Rp'} {formatNumber(total)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {serviceItems.length === 0 && !readOnly && (
                <div className="text-center py-8 border-2 border-dashed border-dark-border rounded-lg">
                    <p className="text-sm text-silver-dark">No service items added yet</p>
                    <p className="text-xs text-silver-dark mt-1">Click "Add Item" to add cost breakdown</p>
                </div>
            )}

            {serviceItems.length === 0 && readOnly && (
                <div className="text-center py-4">
                    <p className="text-sm text-silver-dark">No cost breakdown provided</p>
                </div>
            )}
        </div>
    );
};

export default ServiceItemManager;
