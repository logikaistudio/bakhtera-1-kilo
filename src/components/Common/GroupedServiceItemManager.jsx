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
        return <div className="text-sm text-gray-800 truncate px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-md">{selected?.name || '-'}</div>;
    }

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
                className={`w-full flex items-center justify-between gap-1 px-3 py-2 text-sm border bg-white text-gray-800 border-gray-200 hover:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md text-left transition-all shadow-sm ${isOpen ? 'border-blue-400 ring-2 ring-blue-100' : ''}`}
            >
                <span className="truncate">
                    {selected ? selected.name : <span className="text-gray-400">Select COA...</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 right-0 border border-gray-200 rounded-lg shadow-xl overflow-hidden flex flex-col bg-white" style={{ minWidth: '320px', maxHeight: '280px' }}>
                    <div className="p-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search code or name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-gray-800 transition-all bg-white"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 rounded-md mb-1 transition-colors border border-transparent hover:border-gray-200"
                        >
                            <span className="italic">— Clear selection —</span>
                        </button>
                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">No matching COA found</div>
                        ) : (
                            filtered.map(acc => (
                                <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => { onChange(acc.code); setIsOpen(false); }}
                                    className={`w-full px-3 py-2 text-left rounded-md mb-0.5 transition-colors ${acc.code === value ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-mono text-[11px] text-blue-600 font-semibold">{acc.code}</span>
                                        <span className="text-sm text-gray-800 leading-tight">{acc.name}</span>
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
        if (decimals > 0) {
             return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        return parseInt(num).toLocaleString('en-US');
    };

    const { totalIdr, totalUsd } = calculateGrandTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quotation Items</h2>
                    <p className="text-sm text-gray-500 mt-1">Group and manage your service items and costs</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                        <span className="text-sm text-gray-500">Global Rate:</span>
                        <span className="text-sm font-bold text-blue-600">Rp {formatNumber(exchangeRate)} / USD</span>
                    </div>
                    {!readOnly && (
                        <button
                            type="button" 
                            onClick={addGroup}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Group</span>
                        </button>
                    )}
                </div>
            </div>

            {groups.length === 0 && !readOnly && (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl">
                    <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-gray-200">
                        <Plus className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-base font-medium text-gray-700">No item groups added yet</p>
                    <p className="text-sm text-gray-500 mt-1">Click "Add Group" to structure your quotation items.</p>
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
                    <div key={group.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
                        {/* Group Header */}
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                            <div className="flex items-center gap-3 flex-1">
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab hover:text-gray-600 transition-colors" />
                                {readOnly ? (
                                    <h3 className="font-bold text-gray-800 text-lg">{group.groupName}</h3>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={group.groupName} 
                                        onChange={(e) => updateGroupName(group.id, e.target.value)}
                                        className="bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md text-gray-900 font-semibold outline-none px-3 py-1.5 w-1/2 md:w-1/3 transition-all shadow-sm"
                                        placeholder="Group Name (e.g., A. Handling Import)"
                                    />
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 justify-end">
                                {readOnly ? (
                                    <div className="text-sm text-gray-500">
                                        Rate: <span className="font-medium text-gray-800">Rp {formatNumber(currentGroupRate)}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate:</label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                                            <input
                                                type="number"
                                                value={group.groupExchangeRate || ''}
                                                onChange={(e) => updateGroupExchangeRate(group.id, e.target.value)}
                                                placeholder={formatNumber(exchangeRate)}
                                                className="w-28 pl-8 pr-3 py-1.5 bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md text-gray-900 outline-none text-sm font-medium transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm">
                                    <div className="text-xs text-gray-500">
                                        Sub (IDR): <span className="font-bold text-green-600 text-sm">{formatNumber(groupTotalIdr)}</span>
                                    </div>
                                    <div className="w-px h-4 bg-gray-300"></div>
                                    <div className="text-xs text-gray-500">
                                        Sub (USD): <span className="font-bold text-blue-600 text-sm">{formatNumber(groupTotalUsd, 2)}</span>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => addItemToGroup(group.id)} 
                                            className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 hover:text-blue-600 text-sm font-medium rounded-md transition-colors shadow-sm flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Item
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => deleteGroup(group.id)} 
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all border border-transparent hover:border-red-100"
                                            title="Delete Group"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Sub-table using modern Grid */}
                        <div className="p-4 bg-white flex-1">
                            {group.items && group.items.length > 0 ? (
                                <div className="space-y-3">
                                    {/* Grid Header */}
                                    <div className="hidden lg:grid grid-cols-[1.5fr_2fr_0.5fr_0.5fr_0.5fr_1fr_1fr_1fr_min-content] gap-3 px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <div>COA Account</div>
                                        <div>Description</div>
                                        <div className="text-right">Qty</div>
                                        <div className="text-center">Unit</div>
                                        <div className="text-center">Curr</div>
                                        <div className="text-right">Rate/Price</div>
                                        <div className="text-right">Amount (IDR)</div>
                                        <div className="text-right">Amount (USD)</div>
                                        {!readOnly && <div className="w-8"></div>}
                                    </div>
                                    
                                    {/* Grid Body */}
                                    <div className="space-y-2.5">
                                        {group.items.map((item) => {
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
                                                <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr_0.5fr_0.5fr_0.5fr_1fr_1fr_1fr_min-content] gap-3 items-center p-3 lg:p-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group/row relative">
                                                    
                                                    {/* Mobile Labels (Hidden on Desktop) */}
                                                    <div className="lg:hidden text-xs font-bold text-gray-400 uppercase mb-1">Item Details</div>

                                                    <div className="min-w-0">
                                                        <ItemPicker 
                                                            value={item.itemCode || ''} 
                                                            onChange={(code) => updateItem(group.id, item.id, 'itemCode', code)} 
                                                            accounts={accounts} 
                                                            readOnly={readOnly}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <textarea
                                                            value={item.description}
                                                            onChange={(e) => updateItem(group.id, item.id, 'description', e.target.value)}
                                                            placeholder="Item description..."
                                                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all resize-y min-h-[38px] text-gray-800 shadow-sm placeholder-gray-400"
                                                            readOnly={readOnly}
                                                            rows={1}
                                                        />
                                                    </div>
                                                    
                                                    {/* Row 2 on Mobile */}
                                                    <div className="grid grid-cols-3 lg:contents gap-3">
                                                        <div>
                                                            <div className="lg:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1">Qty</div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(group.id, item.id, 'quantity', e.target.value)}
                                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-right text-gray-800 shadow-sm"
                                                                readOnly={readOnly}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="lg:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1">Unit</div>
                                                            <input
                                                                type="text"
                                                                value={item.unit}
                                                                onChange={(e) => updateItem(group.id, item.id, 'unit', e.target.value)}
                                                                placeholder="Unit"
                                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-center text-gray-800 shadow-sm placeholder-gray-400"
                                                                readOnly={readOnly}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="lg:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1">Curr</div>
                                                            {readOnly ? (
                                                                <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-center text-gray-800">{item.currency}</div>
                                                            ) : (
                                                                <select
                                                                    value={item.currency}
                                                                    onChange={(e) => updateItem(group.id, item.id, 'currency', e.target.value)}
                                                                    className="w-full px-2 py-2 text-sm bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-800 shadow-sm font-medium"
                                                                >
                                                                    <option value="IDR">IDR</option>
                                                                    <option value="USD">USD</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="lg:hidden text-[10px] font-semibold text-gray-400 uppercase mb-1 mt-2">Rate / Price</div>
                                                        <input
                                                            type="text"
                                                            value={item.unitPrice ? (item.currency==='IDR'? formatNumber(item.unitPrice) : item.unitPrice) : ''}
                                                            onChange={(e) => updateItem(group.id, item.id, 'unitPrice', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-right font-mono text-gray-800 shadow-sm"
                                                            readOnly={readOnly}
                                                        />
                                                    </div>

                                                    <div className="flex justify-between lg:block items-center bg-gray-50 lg:bg-transparent p-2 lg:p-0 rounded border border-gray-100 lg:border-none mt-2 lg:mt-0">
                                                        <div className="lg:hidden text-xs font-semibold text-gray-500">Amount (IDR)</div>
                                                        <div className="text-right text-sm font-mono font-bold text-green-600">
                                                            {idrEq > 0 ? formatNumber(idrEq) : '-'}
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between lg:block items-center bg-gray-50 lg:bg-transparent p-2 lg:p-0 rounded border border-gray-100 lg:border-none">
                                                        <div className="lg:hidden text-xs font-semibold text-gray-500">Amount (USD)</div>
                                                        <div className="text-right text-sm font-mono font-bold text-blue-600">
                                                            {usdEq > 0 ? formatNumber(usdEq, 2) : '-'}
                                                        </div>
                                                    </div>

                                                    {!readOnly && (
                                                        <div className="absolute top-2 right-2 lg:static lg:text-center opacity-100 lg:opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            <button 
                                                                type="button"
                                                                onClick={() => deleteItem(group.id, item.id)} 
                                                                className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200"
                                                                title="Delete Item"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                    <p className="text-sm text-gray-500 font-medium italic">This group is currently empty.</p>
                                    <button 
                                        type="button" 
                                        onClick={() => addItemToGroup(group.id)} 
                                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-semibold underline-offset-2 hover:underline"
                                    >
                                        Add your first item
                                    </button>
                                </div>
                            )}
                            
                            {/* Mobile Group Totals (Visible only on mobile) */}
                            <div className="sm:hidden mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Sub Total (IDR)</div>
                                    <div className="text-sm font-bold text-green-600">{formatNumber(groupTotalIdr)}</div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Sub Total (USD)</div>
                                    <div className="text-sm font-bold text-blue-600">{formatNumber(groupTotalUsd, 2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Grand Total */}
            {groups.length > 0 && (
                <div className="glass-card bg-gradient-to-br from-white to-blue-50/30 border-t-4 border-t-blue-500 rounded-xl p-6 mt-8 flex flex-col md:flex-row items-center justify-between shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold border border-blue-200 shadow-sm">
                            Σ
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900 uppercase tracking-wider">Grand Total</div>
                            <div className="text-xs text-gray-500 font-medium mt-0.5">Estimated quotation value</div>
                        </div>
                    </div>
                    
                    <div className="flex gap-8 mt-5 md:mt-0 w-full md:w-auto justify-between md:justify-end bg-white md:bg-transparent p-4 md:p-0 rounded-xl border md:border-none border-gray-100 shadow-sm md:shadow-none">
                        <div className="text-left md:text-right">
                            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total (IDR)</div>
                            <div className="text-2xl font-black text-green-600">Rp {formatNumber(totalIdr)}</div>
                        </div>
                        <div className="w-px bg-gray-200 hidden md:block"></div>
                        <div className="text-right">
                            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total (USD)</div>
                            <div className="text-2xl font-black text-blue-600">$ {formatNumber(totalUsd, 2)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedServiceItemManager;
