import React, { useState, useEffect } from 'react';
import { Plus, Package, X, Edit2, Save, Trash2, Check, Eye } from 'lucide-react';
import Button from './Button';
import { useData } from '../../context/DataContext';
import { formatCurrency, parseCurrency } from '../../utils/currencyFormatter';

const PackageItemManager = ({ items = [], onChange, readOnly = false }) => {
    const { itemMaster = [], hsCodes = [], addItemCode } = useData();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [manualItemCode, setManualItemCode] = useState(false); // Toggle for manual input mode
    const [formData, setFormData] = useState({
        itemCode: '',
        hsCode: '',
        name: '',
        quantity: '',
        unit: 'pcs',
        price: '', // Nominal
        currency: 'IDR',
        exchangeRate: '1',
        totalPrice: '', // Calculated
        notes: ''
    });

    const unitOptions = ['pcs', 'kg', 'ton', 'm', 'm2', 'm3', 'set', 'box', 'roll', 'btl'];
    const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'CNY', 'JPY'];

    // Auto-fill Logic
    useEffect(() => {
        if (formData.itemCode) {
            const selected = itemMaster.find(i => i.itemCode === formData.itemCode);
            if (selected) {
                setFormData(prev => ({
                    ...prev,
                    name: selected.itemName || selected.itemType || prev.name,
                    unit: selected.unit || prev.unit
                }));
            }
        }
    }, [formData.itemCode, itemMaster]);

    const calculateTotal = (qty, price) => {
        return (Number(qty) || 0) * (parseCurrency(price) || 0);
    };

    const handleAdd = async () => {
        if (readOnly) return;
        if (!formData.name || !formData.quantity) {
            alert('Nama Item dan Jumlah wajib diisi');
            return;
        }

        const qty = Number(formData.quantity) || 0;
        const price = parseCurrency(formData.price) || 0;
        const rate = Number(formData.exchangeRate) || 1;
        const total = qty * price;
        const valueIDR = total * rate;

        // Auto-save new item code to database if manual and doesn't exist in master
        if (manualItemCode && formData.itemCode && formData.itemCode.trim()) {
            const codeExists = itemMaster.some(i =>
                i.itemCode?.toLowerCase() === formData.itemCode.toLowerCase()
            );

            if (!codeExists && addItemCode) {
                try {
                    await addItemCode({
                        itemCode: formData.itemCode.trim().toUpperCase(),
                        itemType: formData.name || 'Barang', // Use item name as type
                        description: `Auto-added from pengajuan`
                    });
                    console.log('✅ New item code saved to master:', formData.itemCode);
                } catch (err) {
                    console.error('⚠️ Failed to save new item code:', err);
                    // Continue anyway - don't block the item addition
                }
            }
        }

        const newItem = {
            id: editingId || `item-${Date.now()}`,
            ...formData,
            itemCode: formData.itemCode?.trim()?.toUpperCase() || '', // Normalize
            quantity: qty,
            price: price, // Store as number
            exchangeRate: rate,
            totalPrice: total,
            value: valueIDR
        };

        if (editingId) {
            onChange(items.map(item => item.id === editingId ? newItem : item));
            setEditingId(null);
        } else {
            onChange([...items, newItem]);
        }

        // Reset but keep context
        setFormData(prev => ({
            ...prev,
            itemCode: '',
            name: '',
            quantity: '',
            price: '', // Reset to empty string
            totalPrice: '',
            // Keep HS Code, Unit, Currency, Rate
        }));
        // Don't close form automatically to allow rapid entry if adding new
        if (editingId) setShowForm(false);
    };

    const handleEdit = (item) => {
        if (readOnly) return;
        setFormData({
            itemCode: item.itemCode || '',
            hsCode: item.hsCode || '',
            name: item.name,
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            price: formatCurrency(item.price || (item.value / item.quantity) || 0), // Format for input
            currency: item.currency || 'IDR',
            exchangeRate: item.exchangeRate || '1',
            totalPrice: item.totalPrice || (item.quantity * item.price) || '',
            notes: item.notes || ''
        });
        setEditingId(item.id);
        setShowForm(true);
    };

    const handleRemove = (id) => {
        if (readOnly) return;
        if (window.confirm('Hapus item ini?')) {
            onChange(items.filter(i => i.id !== id));
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setManualItemCode(false); // Reset manual input mode
        setFormData({
            itemCode: '', hscode: '', name: '', quantity: '', unit: 'pcs', price: '', currency: 'IDR', exchangeRate: '1', totalPrice: '', notes: ''
        });
        setShowForm(false);
    };

    // Calculate Grand Total for Display
    const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const totalVal = items.reduce((sum, i) => sum + Number(i.value), 0);

    return (
        <div className="space-y-4">
            {/* Header / Summary */}
            <div className="flex items-center justify-between text-sm text-silver-dark px-2">
                <div className="flex items-center gap-2">
                    <span>Total: {items.length} item ({totalQty} unit)</span>
                    {readOnly && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full border border-yellow-300">
                            <Eye className="w-3 h-3 inline mr-1" />
                            Read Only
                        </span>
                    )}
                </div>
                <span className="text-emerald-600 dark:text-accent-green font-bold">Total Nilai: Rp {formatCurrency(totalVal)}</span>
            </div>

            {/* Main Table Layout */}
            <div className={`rounded overflow-hidden border ${readOnly ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                <table className="w-full text-xs">
                    <thead>
                        <tr className={`border-b-2 h-6 ${readOnly ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-600'}`}>
                            <th className="px-1 py-0.5 text-left w-6">No Urut</th>
                            <th className="px-1 py-0.5 text-left w-24">Kode</th>
                            <th className="px-1 py-0.5 text-left w-16">HS</th>
                            <th className="px-1 py-0.5 text-left">Item</th>
                            <th className="px-1 py-0.5 text-right w-12">Jml</th>
                            <th className="px-1 py-0.5 text-left w-12">Sat</th>
                            <th className="px-1 py-0.5 text-right w-24">Nominal</th>
                            <th className="px-1 py-0.5 text-right w-24 hidden md:table-cell">Total</th>
                            <th className="px-1 py-0.5 text-left w-12 hidden md:table-cell">Kurs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-100">
                        {items.map((item, idx) => (
                            <tr
                                key={item.id}
                                onClick={() => !readOnly && handleEdit(item)}
                                className={`smooth-transition group h-6 ${readOnly ? 'text-gray-700' : 'hover:bg-blue-50 cursor-pointer text-gray-800'}`}
                            >
                                <td className="px-1 py-0.5">{idx + 1}</td>
                                <td className="px-1 py-0.5 truncate">{item.itemCode || '-'}</td>
                                <td className="px-1 py-0.5 truncate">{item.hsCode || '-'}</td>
                                <td className="px-1 py-0.5 font-medium truncate max-w-[150px]">{item.name}</td>
                                <td className="px-1 py-0.5 text-right font-bold">{item.quantity}</td>
                                <td className="px-1 py-0.5">{item.unit}</td>
                                <td className="px-1 py-0.5 text-right font-medium">
                                    {formatCurrency(item.price)}
                                </td>
                                <td className="px-1 py-0.5 text-right font-medium text-emerald-600">
                                    {formatCurrency(item.totalPrice || (item.quantity * item.price))}
                                </td>
                                <td className="px-1 py-0.5 text-xs text-gray-500 hidden md:table-cell">
                                    {item.currency}
                                </td>
                            </tr>
                        ))}

                        {/* Input Row (Always visible or toggled?) - User asked for "Tambah Item" button. 
                            Let's make the Input Row appear when requested or always at bottom for quick entry?
                            Better: Have a dedicated "Add Row" button that reveals the row.
                        */}
                    </tbody>
                </table>

                {/* Form Section - Hidden in Read Only mode */}
                {!readOnly && showForm ? (
                    <div className="p-4 bg-accent-blue/5 border-t border-accent-blue/30 animate-fade-in-up">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Line 1: Identification */}
                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-silver-dark">Kode Barang</label>
                                    <button
                                        type="button"
                                        onClick={() => setManualItemCode(!manualItemCode)}
                                        className="text-[10px] text-accent-blue hover:text-blue-400 transition-colors"
                                    >
                                        {manualItemCode ? '📋 Pilih dari Master' : '✏️ Input Manual'}
                                    </button>
                                </div>
                                {manualItemCode ? (
                                    <input
                                        type="text"
                                        className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                        value={formData.itemCode}
                                        onChange={e => setFormData({ ...formData, itemCode: e.target.value })}
                                        placeholder="Ketik kode barang..."
                                    />
                                ) : (
                                    <select
                                        className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                        value={formData.itemCode}
                                        onChange={e => setFormData({ ...formData, itemCode: e.target.value })}
                                    >
                                        <option value="">Pilih...</option>
                                        {itemMaster.map(i => (
                                            <option key={i.id} value={i.itemCode}>
                                                {i.itemCode} {i.itemType ? `- ${i.itemType}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-silver-dark block mb-1">HS Code</label>
                                <select
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.hsCode}
                                    onChange={e => setFormData({ ...formData, hsCode: e.target.value })}
                                >
                                    <option value="">Optional...</option>
                                    {hsCodes.map(h => <option key={h.id} value={h.hsCode}>{h.hsCode}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-xs text-silver-dark block mb-1">Nama Item</label>
                                <input
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Nama barang..."
                                />
                            </div>

                            {/* Line 2: Quantities */}
                            <div className="md:col-span-1">
                                <label className="text-xs text-silver-dark block mb-1">Jml</label>
                                <input
                                    type="number"
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-xs text-silver-dark block mb-1">Satuan</label>
                                <select
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.unit}
                                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>

                            {/* Line 3: Pricing */}
                            <div className="md:col-span-1">
                                <label className="text-xs text-silver-dark block mb-1">Mata Uang</label>
                                <select
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-silver-dark block mb-1">Nominal (@)</label>
                                <input
                                    type="text"
                                    className="w-full text-sm p-2 bg-dark-bg border border-dark-border rounded focus:border-accent-blue"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: formatCurrency(e.target.value) })}
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Actions */}
                            <div className="md:col-span-12 flex justify-between gap-2 mt-2">
                                <div>
                                    {editingId && (
                                        <Button size="sm" variant="danger" onClick={() => handleRemove(editingId)} icon={Trash2}>
                                            Hapus
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={handleCancel}>Cancel</Button>
                                    <Button size="sm" onClick={handleAdd} icon={editingId ? Check : Plus}>
                                        {editingId ? 'Update' : 'Tambah'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !readOnly ? (
                    <div className="p-3 bg-white border-t border-gray-200 flex justify-center">
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors py-2 px-4 rounded hover:bg-blue-50"
                        >
                            <Plus className="w-4 h-4" /> Tambah Item
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default PackageItemManager;

