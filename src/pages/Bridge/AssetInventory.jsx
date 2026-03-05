import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, Edit, Trash, Package, X } from 'lucide-react';

const AssetInventory = () => {
    const { canCreate, canEdit, canDelete } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const initialFormState = {
        name: '',
        brand: '',
        type: '',
        serial_number: '',
        quantity: 1,
        condition: 'Baik',
        location: 'Warehouse',
        operational_date: '',
        notes: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    // Fetch data
    const fetchAssets = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('bridge_assets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code !== '42P01') { // Ignore relation does not exist yet (before migration runs)
                    console.error('Error fetching assets:', error);
                }
            } else {
                setAssets(data || []);
            }
        } catch (error) {
            console.error('Error in fetchAssets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    // Handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleEdit = (asset) => {
        if (!canEdit('bridge_asset_inventory')) {
            alert('Anda tidak memiliki izin untuk mengedit aset ini.');
            return;
        }
        setFormData(asset);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!canDelete('bridge_asset_inventory')) {
            alert('Anda tidak memiliki izin untuk menghapus aset ini.');
            return;
        }

        if (window.confirm('Apakah Anda yakin ingin menghapus aset ini?')) {
            try {
                const { error } = await supabase
                    .from('bridge_assets')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                fetchAssets();
            } catch (error) {
                console.error('Error deleting asset:', error);
                alert('Gagal menghapus aset: ' + error.message);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (isEditing) {
                if (!canEdit('bridge_asset_inventory')) return;
                const { id, created_at, updated_at, ...updateData } = formData;

                const { error } = await supabase
                    .from('bridge_assets')
                    .update(updateData)
                    .eq('id', id);

                if (error) throw error;
            } else {
                if (!canCreate('bridge_asset_inventory')) return;
                const { error } = await supabase
                    .from('bridge_assets')
                    .insert([formData]);

                if (error) throw error;
            }

            setShowModal(false);
            setFormData(initialFormState);
            setIsEditing(false);
            fetchAssets();
        } catch (error) {
            console.error('Error saving asset:', error);
            alert('Gagal menyimpan aset: ' + error.message);
        }
    };

    const openCreateModal = () => {
        setFormData(initialFormState);
        setIsEditing(false);
        setShowModal(true);
    };

    // Filtered assets
    const filteredAssets = assets.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.brand && asset.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Asset Inventory</h1>
                    <p className="text-silver-dark mt-1">Kelola data inventaris aset operasional harian.</p>
                </div>
                {canCreate('bridge_asset_inventory') && (
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 smooth-transition"
                    >
                        <Plus className="w-5 h-5" />
                        Tambah Aset
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    placeholder="Cari aset berdasarkan nama, merk, atau serial number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:outline-none focus:border-accent-blue smooth-transition"
                />
            </div>

            {/* Table */}
            <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-dark-surface border-b border-dark-border text-xs uppercase tracking-wider text-silver">
                                <th className="px-4 py-3 font-medium text-center">No</th>
                                <th className="px-4 py-3 font-medium">Nama Aset</th>
                                <th className="px-4 py-3 font-medium">Merk / Tipe</th>
                                <th className="px-4 py-3 font-medium">Serial Number</th>
                                <th className="px-4 py-3 font-medium text-center">Jumlah</th>
                                <th className="px-4 py-3 font-medium">Kondisi</th>
                                <th className="px-4 py-3 font-medium">Lokasi</th>
                                <th className="px-4 py-3 font-medium">Tgl Operasional</th>
                                <th className="px-4 py-3 font-medium">Keterangan</th>
                                <th className="px-4 py-3 font-medium text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-8 text-center text-silver-dark">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mb-4"></div>
                                            <p>Memuat data aset...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAssets.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-12 text-center text-silver-dark">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-lg">Belum ada aset terdaftar.</p>
                                        {canCreate('bridge_asset_inventory') && (
                                            <p className="text-sm mt-1">Klik "Tambah Aset" untuk memulai memasukkan data inventaris.</p>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredAssets.map((asset, index) => (
                                    <tr key={asset.id} className="hover:bg-dark-surface/50 smooth-transition text-sm">
                                        <td className="px-4 py-3 text-center text-silver-dark">{index + 1}</td>
                                        <td className="px-4 py-3 font-medium text-silver-light">{asset.name}</td>
                                        <td className="px-4 py-3 text-silver">
                                            <div>{asset.brand || '-'}</div>
                                            <div className="text-xs text-silver-dark">{asset.type || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-silver-dark">{asset.serial_number || '-'}</td>
                                        <td className="px-4 py-3 text-center text-silver">{asset.quantity}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${asset.condition === 'Baik' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
                                                {asset.condition}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-silver">
                                            {asset.location || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-silver">
                                            {asset.operational_date ? new Date(asset.operational_date).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-silver-dark max-w-xs truncate" title={asset.notes}>
                                            {asset.notes || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {canEdit('bridge_asset_inventory') && (
                                                    <button
                                                        onClick={() => handleEdit(asset)}
                                                        className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg smooth-transition"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canDelete('bridge_asset_inventory') && (
                                                    <button
                                                        onClick={() => handleDelete(asset.id)}
                                                        className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg smooth-transition"
                                                        title="Hapus"
                                                    >
                                                        <Trash className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-gray-800">
                                {isEditing ? 'Edit Aset' : 'Tambah Aset Baru'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 smooth-transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Nama Aset <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Serial Number</label>
                                    <input
                                        type="text"
                                        name="serial_number"
                                        value={formData.serial_number}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Merk</label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Tipe</label>
                                    <input
                                        type="text"
                                        name="type"
                                        value={formData.type}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Jumlah <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        min="1"
                                        required
                                        value={formData.quantity}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Tanggal Operasional</label>
                                    <input
                                        type="date"
                                        name="operational_date"
                                        value={formData.operational_date}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Kondisi</label>
                                    <select
                                        name="condition"
                                        value={formData.condition}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    >
                                        <option value="Baik">Baik</option>
                                        <option value="Rusak">Rusak</option>
                                        <option value="Dalam Perbaikan">Dalam Perbaikan</option>
                                        <option value="Hilang">Hilang</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-700">Lokasi</label>
                                    <select
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition"
                                    >
                                        <option value="Warehouse">Warehouse</option>
                                        <option value="Event">Event</option>
                                        <option value="Kantor">Kantor</option>
                                        <option value="Outdoor">Outdoor</option>
                                    </select>
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Keterangan</label>
                                    <textarea
                                        name="notes"
                                        rows="3"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue smooth-transition resize-none"
                                        placeholder="Tambahkan catatan jika diperlukan..."
                                    ></textarea>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg smooth-transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white font-medium rounded-lg smooth-transition"
                                >
                                    Simpan Aset
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetInventory;
