import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronDown, Search } from 'lucide-react';
import Button from './Button';
import { supabase } from '../../lib/supabase';
import { getCurrencySymbol } from '../../utils/currencyFormatter';

// ─── Custom Item Picker ───────────────────────────────────────────────────────
// Dropdown list shows "code – name" for easy identification
// Selected field shows only "name"  (no code)
const ItemPicker = ({ value, onChange, accounts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = accounts.find(acc => acc.code === value);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = accounts.filter(acc => {
        if (!search) return true;
        const q = search.toLowerCase();
        return acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q);
    });

    return (
        <div ref={ref} className="relative">
            {/* Trigger — shows only name when selected */}
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
                className="w-full flex items-center justify-between gap-1 px-2 py-1.5 text-sm border border-dark-border rounded bg-dark-surface text-silver-light text-left"
            >
                <span className="truncate">
                    {selected ? selected.name : <span className="text-silver-dark">Select Item...</span>}
                </span>
                <ChevronDown className={`w-3 h-3 text-silver-dark flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown — shows code + name */}
            {isOpen && (
                <div
                    className="absolute z-50 mt-1 left-0 border border-gray-300 rounded-lg shadow-2xl overflow-hidden flex flex-col"
                    style={{ minWidth: '320px', maxHeight: '260px', backgroundColor: '#ffffff' }}
                >
                    {/* Search */}
                    <div className="p-2 border-b border-gray-200 flex-shrink-0" style={{ backgroundColor: '#f9fafb' }}>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search kode atau nama..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                style={{ backgroundColor: '#ffffff', color: '#1f2937' }}
                                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {/* Clear option */}
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="w-full px-3 py-1.5 text-left text-xs border-b border-gray-100"
                            style={{ backgroundColor: '#ffffff', color: '#9ca3af' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                        >
                            — Clear selection —
                        </button>

                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">Tidak ditemukan</div>
                        ) : (
                            filtered.map(acc => (
                                <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => { onChange(acc.code); setIsOpen(false); }}
                                    className="w-full px-3 py-2 text-left border-b border-gray-50 last:border-0"
                                    style={{
                                        backgroundColor: acc.code === value ? '#eff6ff' : '#ffffff',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = acc.code === value ? '#eff6ff' : '#ffffff'; }}
                                >
                                    {/* code + name inside dropdown */}
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-mono text-[10px] text-blue-600 font-semibold flex-shrink-0">{acc.code}</span>
                                        <span className="text-xs text-gray-800 leading-tight">{acc.name}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

const ServiceItemManager = ({ items = [], onChange, currency = 'USD', readOnly = false }) => {
    const [serviceItems, setServiceItems] = useState(items);
    const [revenueAccounts, setRevenueAccounts] = useState([]);

    // Sync with parent when items change
    useEffect(() => {
        setServiceItems(items);
    }, [items]);

    useEffect(() => {
        fetchRevenueAccounts();
    }, []);

    const fetchRevenueAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', 'REVENUE')
                .order('code');
            if (!error && data) {
                setRevenueAccounts(data);
            }
        } catch (error) {
            console.error('Error fetching revenue accounts:', error);
        }
    };

    const addItem = () => {
        const newItem = {
            id: Date.now(),
            itemCode: '',
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

    // Returns only the name for a given code — used in read-only & print
    const getItemName = (code) => {
        if (!code) return '-';
        return revenueAccounts.find(acc => acc.code === code)?.name || code;
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

            {/* Table */}
            {serviceItems.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue/10">
                            <tr className="border-b border-dark-border">
                                <th className="text-left text-xs font-bold text-white px-2 py-2 w-48">Kode</th>
                                <th className="text-left text-xs font-bold text-white px-2 py-2 w-48">Item</th>
                                <th className="text-left text-xs font-bold text-white px-2 py-2">Service / Description</th>
                                <th className="text-right text-xs font-bold text-white px-2 py-2 w-20">Qty</th>
                                <th className="text-right text-xs font-bold text-white px-2 py-2 w-32">Unit Price</th>
                                <th className="text-right text-xs font-bold text-white px-2 py-2 w-32">Amount</th>
                                {!readOnly && <th className="w-12 px-2 py-2"></th>}
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {serviceItems.map((item, index) => (
                                <tr key={item.id} className={`${index > 0 ? 'border-t border-dark-border/50' : ''}`}>
                                    <td className="py-2 px-2">
                                        <span className="text-xs font-mono text-accent-blue">{item.itemCode || '-'}</span>
                                    </td>
                                    <td className="py-2 px-2">
                                        {readOnly ? (
                                            /* Read-only / print: show only name */
                                            <div className="text-sm text-silver-light">
                                                {getItemName(item.itemCode)}
                                            </div>
                                        ) : (
                                            /* Editable: custom picker — dropdown shows code+name, field shows name only */
                                            <ItemPicker
                                                value={item.itemCode || ''}
                                                onChange={(code) => updateItem(item.id, 'itemCode', code)}
                                                accounts={revenueAccounts}
                                            />
                                        )}
                                    </td>
                                    <td className="py-2 px-2">
                                        <textarea
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            placeholder="e.g., Ocean Freight, THC, Documentation"
                                            className="w-full px-2 py-1.5 text-sm bg-dark-surface border border-dark-border rounded text-silver-light resize-y min-h-[40px] max-h-[150px]"
                                            readOnly={readOnly}
                                            rows={2}
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
                                            {getCurrencySymbol(currency)} {formatNumber(item.amount)}
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
                                    {getCurrencySymbol(currency)} {formatNumber(total)}
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
