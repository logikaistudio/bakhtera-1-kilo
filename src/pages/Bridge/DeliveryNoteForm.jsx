import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../lib/supabase';
import { X, Plus, Trash2, Save, Send, Package, Truck, User, MapPin, FileText, Calendar } from 'lucide-react';

const DeliveryNoteForm = ({ note, onClose, onSave, mode = 'create' }) => {
    const { quotations, mutationLogs } = useData();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        delivery_note_number: '',
        date: new Date().toISOString().split('T')[0],
        destination: '',
        consignee: '',
        seal_number: '',
        truck_number: '',
        driver_name: '',
        driver_phone: '',
        pengajuan_id: '',
        mutation_log_id: '',
        bc_document_number: '',
        items: [],
        status: 'draft',
        sender_name: '',
        sender_position: '',
        remarks: '',
        notes: '',
    });

    // Initialize form data
    useEffect(() => {
        if (mode === 'edit' && note) {
            setFormData({
                ...note,
                items: note.items || [],
            });
        } else if (mode === 'create') {
            // Generate delivery note number
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const deliveryNoteNumber = `SJ-001/${month}/${year}`; // Will be properly generated in parent
            setFormData(prev => ({
                ...prev,
                delivery_note_number: deliveryNoteNumber,
            }));
        }
    }, [note, mode]);

    // Handle input change
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Handle item change
    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    // Add new item
    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    item_code: '',
                    item_name: '',
                    quantity: 0,
                    unit: 'pcs',
                    remarks: '',
                }
            ]
        }));
    };

    // Remove item
    const removeItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    // Load from pengajuan
    const loadFromPengajuan = (pengajuanId) => {
        const pengajuan = quotations.find(q => q.id === pengajuanId);
        if (!pengajuan) return;

        // Extract items from packages
        const items = [];
        (pengajuan.packages || []).forEach(pkg => {
            (pkg.items || []).forEach(item => {
                items.push({
                    item_code: item.itemCode || item.item_code || '',
                    item_name: item.itemName || item.item_name || item.assetName || '',
                    quantity: item.quantity || 0,
                    unit: item.unit || 'pcs',
                    remarks: item.condition || '',
                });
            });
        });

        setFormData(prev => ({
            ...prev,
            pengajuan_id: pengajuanId,
            consignee: pengajuan.customer || '',
            destination: pengajuan.destination || '',
            bc_document_number: pengajuan.bcDocumentNumber || pengajuan.bc_document_number || '',
            items: items,
        }));
    };

    // Handle save
    const handleSave = async (status = 'draft') => {
        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                status,
                items: JSON.stringify(formData.items),
                updated_at: new Date().toISOString(),
            };

            if (mode === 'edit') {
                const { error } = await supabase
                    .from('freight_delivery_notes')
                    .update(dataToSave)
                    .eq('id', note.id);

                if (error) throw error;
            } else {
                dataToSave.id = `dn-${Date.now()}`;
                dataToSave.created_at = new Date().toISOString();

                const { error } = await supabase
                    .from('freight_delivery_notes')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving delivery note:', error);
            alert('Gagal menyimpan surat jalan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-silver-light flex items-center gap-2">
                            <FileText className="w-6 h-6 text-accent-blue" />
                            {mode === 'edit' ? 'Edit Surat Jalan' : 'Buat Surat Jalan Baru'}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-silver-dark mt-1">
                            {formData.delivery_note_number}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Section 1: Header Dokumen */}
                    <div className="glass-card p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-silver-light mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-accent-blue" />
                            Header Dokumen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    No. Surat Jalan <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.delivery_note_number}
                                    onChange={(e) => handleChange('delivery_note_number', e.target.value)}
                                    className="input-field"
                                    disabled={mode === 'edit'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Tanggal <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => handleChange('date', e.target.value)}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    TO (Tujuan) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.destination}
                                    onChange={(e) => handleChange('destination', e.target.value)}
                                    className="input-field"
                                    placeholder="Alamat/lokasi tujuan"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Informasi Pengiriman */}
                    <div className="glass-card p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-silver-light mb-4 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-accent-blue" />
                            Informasi Pengiriman
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Consignee <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.consignee}
                                    onChange={(e) => handleChange('consignee', e.target.value)}
                                    className="input-field"
                                    placeholder="Nama penerima barang"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Seal No.
                                </label>
                                <input
                                    type="text"
                                    value={formData.seal_number}
                                    onChange={(e) => handleChange('seal_number', e.target.value)}
                                    className="input-field"
                                    placeholder="Nomor segel"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Truck No. <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.truck_number}
                                    onChange={(e) => handleChange('truck_number', e.target.value)}
                                    className="input-field"
                                    placeholder="B 1234 CD"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Driver <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.driver_name}
                                    onChange={(e) => handleChange('driver_name', e.target.value)}
                                    className="input-field"
                                    placeholder="Nama pengemudi"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    No. HP Driver
                                </label>
                                <input
                                    type="text"
                                    value={formData.driver_phone}
                                    onChange={(e) => handleChange('driver_phone', e.target.value)}
                                    className="input-field"
                                    placeholder="08xx xxxx xxxx"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Load from Source (Optional) */}
                    <div className="glass-card p-4 bg-blue-50 dark:bg-blue-900/10">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-silver-light mb-3">
                            📋 Load Data dari Sumber (Opsional)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    Dari Pengajuan
                                </label>
                                <select
                                    value={formData.pengajuan_id}
                                    onChange={(e) => {
                                        handleChange('pengajuan_id', e.target.value);
                                        if (e.target.value) loadFromPengajuan(e.target.value);
                                    }}
                                    className="input-field"
                                >
                                    <option value="">-- Pilih Pengajuan --</option>
                                    {quotations.filter(q => q.type === 'outbound' || q.status === 'approved').map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.quotationNumber || q.quotation_number} - {q.customer}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                    No. BC Dokumen
                                </label>
                                <input
                                    type="text"
                                    value={formData.bc_document_number}
                                    onChange={(e) => handleChange('bc_document_number', e.target.value)}
                                    className="input-field"
                                    placeholder="Nomor dokumen BC"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Detail Barang */}
                    <div className="glass-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-silver-light flex items-center gap-2">
                                <Package className="w-5 h-5 text-accent-blue" />
                                Detail Barang
                            </h3>
                            <button
                                onClick={addItem}
                                className="btn-secondary flex items-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Tambah Item
                            </button>
                        </div>

                        {formData.items.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                Belum ada item. Klik "Tambah Item" atau load dari pengajuan.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100 dark:bg-dark-surface">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-silver-light">No</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-silver-light">Kode Barang</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-silver-light">Nama Barang</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-silver-light">Qty</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-silver-light">Satuan</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-silver-light">Keterangan</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 dark:text-silver-light">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                        {formData.items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-3 py-2 text-sm text-gray-700 dark:text-silver-light">{index + 1}</td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.item_code}
                                                        onChange={(e) => handleItemChange(index, 'item_code', e.target.value)}
                                                        className="input-field text-sm"
                                                        placeholder="ABC-001"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.item_name}
                                                        onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                                                        className="input-field text-sm"
                                                        placeholder="Nama barang"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                                        className="input-field text-sm text-center w-20"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={item.unit}
                                                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                                        className="input-field text-sm w-24"
                                                    >
                                                        <option value="pcs">pcs</option>
                                                        <option value="unit">unit</option>
                                                        <option value="box">box</option>
                                                        <option value="kg">kg</option>
                                                        <option value="set">set</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.remarks}
                                                        onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                                                        className="input-field text-sm"
                                                        placeholder="Kondisi/catatan"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Section 5: Keterangan & Pengirim */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-card p-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-silver-light mb-4">
                                Keterangan
                            </h3>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => handleChange('remarks', e.target.value)}
                                className="input-field"
                                rows="4"
                                placeholder="Catatan umum tentang pengiriman..."
                            />
                        </div>

                        <div className="glass-card p-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-silver-light mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-accent-blue" />
                                Pengirim
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                        Hormat kami <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sender_name}
                                        onChange={(e) => handleChange('sender_name', e.target.value)}
                                        className="input-field"
                                        placeholder="Nama pengirim"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-light mb-1">
                                        Jabatan
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sender_position}
                                        onChange={(e) => handleChange('sender_position', e.target.value)}
                                        className="input-field"
                                        placeholder="Jabatan pengirim"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-dark-border">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                        disabled={loading}
                    >
                        Batal
                    </button>
                    {formData.status === 'draft' && (
                        <button
                            onClick={() => handleSave('draft')}
                            className="btn-secondary flex items-center gap-2"
                            disabled={loading}
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Menyimpan...' : 'Simpan Draft'}
                        </button>
                    )}
                    <button
                        onClick={() => handleSave('sent')}
                        className="btn-primary flex items-center gap-2"
                        disabled={loading}
                    >
                        <Send className="w-4 h-4" />
                        {loading ? 'Mengirim...' : 'Kirim Surat Jalan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryNoteForm;
