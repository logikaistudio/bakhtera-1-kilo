import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronDown, Search, GripVertical } from 'lucide-react';
import Button from './Button';
import { supabase } from '../../lib/supabase';

// ─── Custom Item Picker ───────────────────────────────────────────────────────
const ItemPicker = ({ value, onChange, accounts, readOnly }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = accounts.find(acc => acc.code === value);

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

    if (readOnly) {
        return <div className="text-sm text-silver-light truncate">{selected?.name || '-'}</div>;
    }

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
                className="w-full flex items-center justify-between gap-1 px-2 py-1.5 text-sm border border-dark-border rounded bg-dark-surface text-silver-light text-left"
            >
                <span className="truncate">
                    {selected ? selected.name : <span className="text-silver-dark">Select COA...</span>}
                </span>
                <ChevronDown className={`w-3 h-3 text-silver-dark flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 border border-gray-300 rounded-lg shadow-2xl overflow-hidden flex flex-col" style={{ minWidth: '320px', maxHeight: '260px', backgroundColor: '#ffffff' }}>
                    <div className="p-2 border-b border-gray-200 flex-shrink-0 bg-gray-50">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search kode atau nama..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded outline-none text-gray-800"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="w-full px-3 py-1.5 text-left text-xs border-b border-gray-100 text-gray-400 hover:bg-gray-100"
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
                                    className={`w-full px-3 py-2 text-left border-b border-gray-50 last:border-0 hover:bg-blue-50 ${acc.code === value ? 'bg-blue-50' : ''}`}
                                >
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

// ─── Main Component ────────────────────────────────────────────────────────────
const GroupedServiceItemManager = ({ 
    items = [], 
    onChange, 
    exchangeRate = 16000, 
    readOnly = false,
    coaType = 'REVENUE' // Can be REVENUE or COST
}) => {
    // items format: [{ id: 'g1', groupName: '...', items: [...] }]
    const [groups, setGroups] = useState(Array.isArray(items) && items.length > 0 && items[0].groupName !== undefined ? items : []);
    const [accounts, setAccounts] = useState([]);

    useEffect(() => {
        // If items changed externally and it's an array of groups, update
        if (Array.isArray(items) && items.length > 0 && items[0].groupName !== undefined) {
            setGroups(items);
        } else if (Array.isArray(items) && items.length > 0 && items[0].groupName === undefined) {
            // Legacy flat items conversion to one default group
             setGroups([{
                id: 'default-group-' + Date.now(),
                groupName: 'General Items',
                items: items.map(item => ({
                    ...item,
                    currency: item.currency || 'USD',
                    unit: item.unit || 'Unit'
                }))
             }]);
        } else if (items.length === 0) {
            setGroups([]);
        }
    }, [items]);

    useEffect(() => {
        fetchAccounts();
    }, [coaType]);

    const fetchAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', coaType)
                .order('code');
            if (!error && data) {
                setAccounts(data);
            }
        } catch (error) {
            console.error('Error fetching COA:', error);
        }
    };

    const notifyChange = (newGroups) => {
        setGroups(newGroups);
        onChange(newGroups);
    };

    const addGroup = () => {
        const newGroup = {
            id: 'group-' + Date.now(),
            groupName: 'New Group',
            items: []
        };
        notifyChange([...groups, newGroup]);
    };

    const updateGroupName = (groupId, newName) => {
        const updated = groups.map(g => g.id === groupId ? { ...g, groupName: newName } : g);
        notifyChange(updated);
    };

    const updateGroupExchangeRate = (groupId, rate) => {
        const updated = groups.map(g => g.id === groupId ? { ...g, groupExchangeRate: parseFloat(rate) || exchangeRate } : g);
        notifyChange(updated);
    };

    const deleteGroup = (groupId) => {
        const updated = groups.filter(g => g.id !== groupId);
        notifyChange(updated);
    };

    const addItemToGroup = (groupId) => {
        const newItem = {
            id: 'item-' + Date.now(),
            itemCode: '',
            description: '',
            quantity: 1,
            unit: 'Unit',
            currency: 'IDR', // Default IDR
            unitPrice: 0,
            amount: 0,
            remarks: ''
        };
        const updated = groups.map(g => {
            if (g.id === groupId) {
                return { ...g, items: [...(g.items || []), newItem] };
            }
            return g;
        });
        notifyChange(updated);
    };

    const updateItem = (groupId, itemId, field, value) => {
        const updated = groups.map(g => {
            if (g.id === groupId) {
                const newItems = g.items.map(item => {
                    if (item.id === itemId) {
                        const updatedItem = { ...item, [field]: value };
                        
                        // Auto-calculate amount if quantity or unitPrice changes
                        if (field === 'quantity' || field === 'unitPrice' || field === 'currency') {
                            const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
                            let priceStr = field === 'unitPrice' ? value.toString() : item.unitPrice.toString();
                            // Handle formatting: remove dots, change comma to dot, or just parse
                            const price = parseFloat(priceStr.replace(/\./g, '').replace(/,/g, '.')) || 0;
                            updatedItem.amount = qty * price;
                            if (field === 'unitPrice') {
                                updatedItem.unitPrice = price; // Store numeric
                            }
                        }
                        return updatedItem;
                    }
                    return item;
                });
                return { ...g, items: newItems };
            }
            return g;
        });
        notifyChange(updated);
    };

    const deleteItem = (groupId, itemId) => {
        const updated = groups.map(g => {
            if (g.id === groupId) {
                return { ...g, items: g.items.filter(i => i.id !== itemId) };
            }
            return g;
        });
        notifyChange(updated);
    };

    // Calculate totals over all groups
    const calculateGrandTotals = () => {
        let totalIdr = 0;
        let totalUsd = 0;

        groups.forEach(g => {
            const groupRate = g.groupExchangeRate || exchangeRate;
            (g.items || []).forEach(item => {
                const amt = parseFloat(item.amount) || 0;
                if (item.currency === 'IDR') {
                    totalIdr += amt;
                    totalUsd += amt / groupRate;
                } else if (item.currency === 'USD') {
                    totalUsd += amt;
                    totalIdr += amt * groupRate;
                }
            });
        });

        return { totalIdr, totalUsd };
    };

    const formatNumber = (num, decimals = 0) => {
        if (num === null || num === undefined) return '';
        // Return string with requested decimals and id-ID formatting
        if (decimals > 0) {
             return parseFloat(num).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        return parseInt(num).toLocaleString('id-ID');
    };

    const { totalIdr, totalUsd } = calculateGrandTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-silver">
                    Quotation Details (Grouped)
                </label>
                <div className="flex gap-2">
                    <div className="bg-dark-surface px-3 py-1.5 rounded border border-dark-border text-xs text-silver-light">
                        Kurs: <span className="font-bold text-accent-orange ml-1">Rp {formatNumber(exchangeRate)} / USD</span>
                    </div>
                    {!readOnly && (
                        <Button type="button" onClick={addGroup} icon={Plus} variant="secondary" size="sm">
                            Add Group
                        </Button>
                    )}
                </div>
            </div>

            {groups.length === 0 && !readOnly && (
                <div className="text-center py-8 border-2 border-dashed border-dark-border rounded-lg">
                    <p className="text-sm text-silver-dark">No item groups added yet.</p>
                    <p className="text-xs text-silver-dark mt-1">Click "Add Group" to begin creating structure.</p>
                </div>
            )}

            {groups.map((group, groupIndex) => {
                // Group totals
                let groupTotalIdr = 0;
                let groupTotalUsd = 0;
                const currentGroupRate = group.groupExchangeRate || exchangeRate;
                
                (group.items || []).forEach(item => {
                    const amt = parseFloat(item.amount) || 0;
                    if (item.currency === 'IDR') {
                        groupTotalIdr += amt;
                        groupTotalUsd += amt / currentGroupRate;
                    } else if (item.currency === 'USD') {
                        groupTotalUsd += amt;
                        groupTotalIdr += amt * currentGroupRate;
                    }
                });

                return (
                    <div key={group.id} className="border border-dark-border rounded-lg overflow-hidden bg-dark-card shadow-sm">
                        {/* Group Header */}
                        <div className="bg-dark-surface px-4 py-3 flex items-center justify-between border-b border-dark-border">
                            <div className="flex items-center gap-3 flex-1">
                                <GripVertical className="w-4 h-4 text-silver-dark cursor-grab" />
                                {readOnly ? (
                                    <h3 className="font-semibold text-silver-light">{group.groupName}</h3>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={group.groupName} 
                                        onChange={(e) => updateGroupName(group.id, e.target.value)}
                                        className="bg-transparent border-b border-gray-600 focus:border-accent-orange text-silver-light font-semibold outline-none px-1 w-1/2"
                                        placeholder="Group Name (e.g. A. Handling Import)"
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {readOnly ? (
                                    <div className="text-xs text-silver-dark mr-2 border-r border-dark-border pr-2">
                                        Rate: Rp {formatNumber(currentGroupRate)}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 mr-2 border-r border-dark-border pr-2">
                                        <label className="text-xs text-silver-dark">Rate:</label>
                                        <input
                                            type="number"
                                            value={group.groupExchangeRate || ''}
                                            onChange={(e) => updateGroupExchangeRate(group.id, e.target.value)}
                                            placeholder={formatNumber(exchangeRate)}
                                            className="w-20 px-1.5 py-1 bg-transparent border-b border-gray-600 focus:border-accent-orange text-silver-light outline-none text-xs text-right"
                                        />
                                    </div>
                                )}
                                <div className="text-xs text-silver">
                                    Sub IDR: <span className="font-semibold text-silver-light">{formatNumber(groupTotalIdr)}</span> | 
                                    Sub USD: <span className="font-semibold text-silver-light ml-1">{formatNumber(groupTotalUsd, 2)}</span>
                                </div>
                                {!readOnly && (
                                    <>
                                        <Button type="button" onClick={() => addItemToGroup(group.id)} icon={Plus} size="sm" variant="secondary" className="h-8">
                                            Item
                                        </Button>
                                        <button onClick={() => deleteGroup(group.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Items Table within Group */}
                        {group.items && group.items.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[#1a1f2e]">
                                        <tr>
                                            <th className="text-left text-[11px] font-semibold text-silver px-3 py-2 w-[220px]">COA</th>
                                            <th className="text-left text-[11px] font-semibold text-silver px-3 py-2">Description</th>
                                            <th className="text-right text-[11px] font-semibold text-silver px-3 py-2 w-20">Qty</th>
                                            <th className="text-center text-[11px] font-semibold text-silver px-3 py-2 w-20">Unit</th>
                                            <th className="text-center text-[11px] font-semibold text-silver px-3 py-2 w-24">Currency</th>
                                            <th className="text-right text-[11px] font-semibold text-silver px-3 py-2 w-32">Rate/Price</th>
                                            <th className="text-right text-[11px] font-semibold text-silver px-3 py-2 w-32">Amount (IDR)</th>
                                            <th className="text-right text-[11px] font-semibold text-silver px-3 py-2 w-32">Amount (USD)</th>
                                            {!readOnly && <th className="px-3 py-2 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border/50">
                                        {group.items.map((item) => {
                                            // Calculate equivalent
                                            const amt = parseFloat(item.amount) || 0;
                                            let idrEq = 0;
                                            let usdEq = 0;
                                            if (item.currency === 'IDR') {
                                                idrEq = amt;
                                                usdEq = amt / currentGroupRate;
                                            } else {
                                                usdEq = amt;
                                                idrEq = amt * currentGroupRate;
                                            }

                                            return (
                                                <tr key={item.id} className="hover:bg-dark-surface/50 transition-colors">
                                                    <td className="px-3 py-2">
                                                        <ItemPicker 
                                                            value={item.itemCode || ''} 
                                                            onChange={(code) => updateItem(group.id, item.id, 'itemCode', code)} 
                                                            accounts={accounts} 
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <textarea
                                                            value={item.description}
                                                            onChange={(e) => updateItem(group.id, item.id, 'description', e.target.value)}
                                                            placeholder="Description"
                                                            className="w-full px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded text-silver-light resize-y min-h-[32px]"
                                                            readOnly={readOnly}
                                                            rows={1}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(group.id, item.id, 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded text-silver-light text-right"
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(group.id, item.id, 'unit', e.target.value)}
                                                            placeholder="Unit"
                                                            className="w-full px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded text-silver-light text-center"
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {readOnly ? (
                                                            <div className="text-xs text-center text-silver-light">{item.currency}</div>
                                                        ) : (
                                                            <select
                                                                value={item.currency}
                                                                onChange={(e) => updateItem(group.id, item.id, 'currency', e.target.value)}
                                                                className="w-full px-1 py-1 text-xs bg-dark-bg border border-dark-border rounded text-silver-light"
                                                            >
                                                                <option value="IDR">IDR</option>
                                                                <option value="USD">USD</option>
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.unitPrice ? (item.currency==='IDR'? formatNumber(item.unitPrice) : item.unitPrice) : ''}
                                                            onChange={(e) => {
                                                                // Allow raw string input. updateItem will clean it depending on currency logic if needed, 
                                                                // but simpler: just treat it as generic text that gets parsed on change.
                                                                updateItem(group.id, item.id, 'unitPrice', e.target.value);
                                                            }}
                                                            placeholder="0"
                                                            className="w-full px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded text-silver-light text-right font-mono"
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className={`text-xs font-mono font-medium ${item.currency === 'IDR' ? 'text-green-400' : 'text-silver-dark'}`}>
                                                            {idrEq > 0 ? formatNumber(idrEq) : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className={`text-xs font-mono font-medium ${item.currency === 'USD' ? 'text-blue-400' : 'text-silver-dark'}`}>
                                                            {usdEq > 0 ? formatNumber(usdEq, 2) : '-'}
                                                        </div>
                                                    </td>
                                                    {!readOnly && (
                                                        <td className="px-3 py-2 text-center">
                                                            <button onClick={() => deleteItem(group.id, item.id)} className="text-red-400 hover:text-red-300 transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-4 py-3 text-xs text-silver-dark italic bg-dark-bg/50 text-center">
                                No items in this group.
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Grand Total */}
            {groups.length > 0 && (
                <div className="bg-dark-card border border-dark-border rounded-lg p-4 mt-6 flex flex-col md:flex-row items-center justify-between shadow-lg">
                    <div className="text-sm font-semibold text-silver">GRAND TOTAL ESTIMATION</div>
                    <div className="flex gap-8 mt-3 md:mt-0">
                        <div className="text-right">
                            <div className="text-xs text-silver-dark mb-1">Total IDR Equivalent</div>
                            <div className="text-xl font-bold text-green-400">Rp {formatNumber(totalIdr)}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-silver-dark mb-1">Total USD Equivalent</div>
                            <div className="text-xl font-bold text-blue-400">$ {(totalUsd).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedServiceItemManager;
