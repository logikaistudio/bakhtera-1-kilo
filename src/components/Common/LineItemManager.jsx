import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import Button from './Button';
import { useData } from '../../context/DataContext';
import { formatCurrency } from '../../utils/currencyFormatter';

const LineItemManager = ({ items = [], onChange }) => {
    const { itemMaster = [], hsCodes = [] } = useData();
    const [editingItem, setEditingItem] = useState(null);

    // Initial State
    const [formData, setFormData] = useState({
        packageNumber: '',
        sequenceNumber: '1',
        itemCode: '',
        itemName: '',
        hsCode: '',
        quantity: '',
        unit: 'pcs',
        price: '',
        currency: 'IDR',
        exchangeRate: '1',
        dimension: '',
        weight: '',
        notes: ''
    });

    const unitOptions = ['pcs', 'kg', 'ton', 'm', 'm2', 'm3', 'set', 'box', 'pallet', 'ctn'];
    const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'CNY', 'JPY'];

    // Auto-fill Item Name when Code Selected
    useEffect(() => {
        if (formData.itemCode) {
            const selected = itemMaster.find(i => i.itemCode === formData.itemCode);
            if (selected) {
                setFormData(prev => ({
                    ...prev,
                    itemName: selected.itemName || selected.itemType || prev.itemName,
                    unit: selected.unit || prev.unit
                }));
            }
        }
    }, [formData.itemCode, itemMaster]);

    const handleAdd = () => {
        if (!formData.itemName || !formData.quantity || !formData.price) {
            alert('Nama Item, Jumlah, dan Harga Satuan wajib diisi');
            return;
        }

        const qty = Number(formData.quantity) || 0;
        const price = Number(formData.price) || 0;
        const rate = Number(formData.exchangeRate) || 1;
        const totalPrice = qty * price;
        const valueIDR = totalPrice * rate;

        const newItem = {
            ...formData,
            id: editingItem?.id || `item-${Date.now()}`,
            quantity: qty,
            price: price,
            exchangeRate: rate,
            totalPrice: totalPrice,
            value: valueIDR, // System standard for value
            goodsType: formData.itemName // Mapping for backward compatibility
        };

        if (editingItem) {
            onChange(items.map(item => item.id === editingItem.id ? newItem : item));
            setEditingItem(null);
        } else {
            onChange([...items, newItem]);
        }

        // Smart Reset
        setFormData(prev => ({
            ...prev,
            sequenceNumber: String(Number(prev.sequenceNumber || 0) + 1),
            // Maintain Context (Package, HS, Currency)
            // Reset Item Details
            itemCode: '',
            itemName: '',
            quantity: '',
            price: '',
            dimension: '',
            weight: '',
            notes: ''
            // Keep: packageNumber, hsCode, currency, exchangeRate, unit
        }));
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            ...item,
            // Ensure fields exist for old data
            itemName: item.itemName || item.goodsType || '',
            price: item.price || (item.value / item.quantity) || '',
            currency: item.currency || 'IDR',
            exchangeRate: item.exchangeRate || '1'
        });
    };

    const handleRemove = (itemId) => {
        onChange(items.filter(item => item.id !== itemId));
    };

    const handleCancel = () => {
        setEditingItem(null);
        setFormData(prev => ({
            ...prev,
            // Reset specific fields only or full reset?
            // Let's reset to clean state but keep Sequence logic active if desired, 
            // but usually Cancel implies stop editing.
            // We'll reset item fields.
            itemCode: '',
            itemName: '',
            quantity: '',
            price: '',
            dimension: '',
            weight: '',
            notes: ''
        }));
    };

    // Calculations for Display
    const currentTotal = (Number(formData.quantity) || 0) * (Number(formData.price) || 0);

    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalValIDR = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-accent-blue" />
                    <h3 className="text-lg font-semibold text-silver-light">Detail Item Barang</h3>
                    <span className="text-sm text-silver-dark">
                        ({items.length} items, {totalQty} unit)
                    </span>
                </div>
            </div>

            <div className="glass-card p-4 rounded-lg border border-dark-border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Row 1: Identification */}
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">No. Paket</label>
                        <input
                            type="text"
                            value={formData.packageNumber}
                            onChange={(e) => setFormData({ ...formData, packageNumber: e.target.value })}
                            placeholder="PKG-..."
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">No. Urut</label>
                        <input
                            type="number"
                            value={formData.sequenceNumber}
                            onChange={(e) => setFormData({ ...formData, sequenceNumber: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-silver mb-2">Kode HS</label>
                        <select
                            value={formData.hsCode}
                            onChange={(e) => setFormData({ ...formData, hsCode: e.target.value })}
                            className="w-full"
                        >
                            <option value="">-- Optional --</option>
                            {hsCodes.map(hs => (
                                <option key={hs.id} value={hs.hsCode}>
                                    {hs.hsCode} - {hs.description?.substring(0, 30)}...
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Row 2: Item Details */}
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Kode Barang</label>
                        <select
                            value={formData.itemCode}
                            onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                            className="w-full"
                        >
                            <option value="">-- Optional --</option>
                            {itemMaster.map(item => (
                                <option key={item.id} value={item.itemCode}>
                                    {item.itemCode}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-silver mb-2">Nama Item / Barang *</label>
                        <input
                            type="text"
                            value={formData.itemName}
                            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                            placeholder="Nama barang..."
                            className="w-full"
                        />
                    </div>

                    {/* Row 3: Physical & Qty */}
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Jumlah *</label>
                        <input
                            type="number"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Satuan</label>
                        <select
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            className="w-full"
                        >
                            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Dimensi (PxLxT)</label>
                        <input
                            type="text"
                            value={formData.dimension}
                            onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                            placeholder="cm"
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Berat (kg)</label>
                        <input
                            type="number"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            placeholder="0.0"
                            className="w-full"
                        />
                    </div>

                    {/* Row 4: Pricing */}
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Mata Uang</label>
                        <div className="flex gap-2">
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-2/3"
                            >
                                {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Kurs (IDR)</label>
                        <input
                            type="number"
                            value={formData.exchangeRate}
                            onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                            disabled={formData.currency === 'IDR'}
                            className="w-full bg-dark-bg/50"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Harga Satuan</label>
                        <input
                            type="number"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-silver mb-2">Total Harga</label>
                        <input
                            type="text"
                            value={formatCurrency(currentTotal)}
                            readOnly
                            className="w-full bg-dark-surface/50 text-accent-green font-semibold"
                        />
                    </div>

                    {/* Row 5: Notes */}
                    <div className="lg:col-span-4">
                        <label className="block text-sm font-medium text-silver mb-2">Deskripsi / Keterangan</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    {editingItem && (
                        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
                    )}
                    <Button type="button" onClick={handleAdd} icon={editingItem ? null : Plus}>
                        {editingItem ? 'Update Item' : 'Tambah Item'}
                    </Button>
                </div>
            </div>

            {items.length > 0 && (
                <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-blue/10 border-b border-accent-blue/20">
                            <tr>
                                <th className="px-3 py-2 text-left text-silver-light">No. Urut</th>
                                <th className="px-3 py-2 text-left text-silver-light">Paket</th>
                                <th className="px-3 py-2 text-left text-silver-light">HS Code</th>
                                <th className="px-3 py-2 text-left text-silver-light">Kode/Nama Barang</th>
                                <th className="px-3 py-2 text-right text-silver-light">Amount</th>
                                <th className="px-3 py-2 text-right text-silver-light">Harga (@)</th>
                                <th className="px-3 py-2 text-right text-silver-light">Total</th>
                                <th className="px-3 py-2 text-left text-silver-light">Dim/Berat</th>
                                <th className="px-3 py-2 text-left text-silver-light">Ket.</th>
                                <th className="px-3 py-2 text-center text-silver-light">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-dark-surface/50">
                                    <td className="px-3 py-2 text-center text-silver">{item.sequenceNumber || (idx + 1)}</td>
                                    <td className="px-3 py-2 text-silver">{item.packageNumber || '-'}</td>
                                    <td className="px-3 py-2 text-silver">{item.hsCode || '-'}</td>
                                    <td className="px-3 py-2 text-silver">
                                        <div className="font-medium text-silver-light">{item.itemName}</div>
                                        <div className="text-xs text-silver-dark">{item.itemCode}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-silver">
                                        {item.quantity} {item.unit}
                                    </td>
                                    <td className="px-3 py-2 text-right text-silver">
                                        {item.currency} {formatCurrency(item.price)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-accent-green">
                                        {item.currency} {formatCurrency(item.totalPrice || (item.quantity * item.price))}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-silver">
                                        <div>{item.dimension && `${item.dimension}`}</div>
                                        <div>{item.weight && `${item.weight} kg`}</div>
                                    </td>
                                    <td className="px-3 py-2 text-silver truncate max-w-[150px]">{item.notes}</td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEdit(item)} className="text-accent-blue hover:text-white">Edit</button>
                                            <button onClick={() => handleRemove(item.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-dark-surface font-semibold text-silver">
                            <tr>
                                <td colSpan={6} className="px-3 py-2 text-right">Grand Total (IDR Est):</td>
                                <td className="px-3 py-2 text-right text-accent-green">Rp {formatCurrency(totalValIDR)}</td>
                                <td colSpan={3}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LineItemManager;
