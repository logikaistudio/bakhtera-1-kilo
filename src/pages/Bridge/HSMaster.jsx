import React, { useState } from 'react';
import { FileText, Search, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const HSMaster = () => {
    const { hsCodes = [], addHSCode, updateHSCode, deleteHSCode } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        hsCode: '',
        description: ''
    });

    // Filter items
    const filteredItems = hsCodes.filter(item =>
        item.hsCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingItem) {
            updateHSCode(editingItem.id, formData);
        } else {
            addHSCode(formData);
        }
        setShowModal(false);
        setFormData({ hsCode: '', description: '' });
        setEditingItem(null);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({ hsCode: item.hsCode, description: item.description });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus Kode HS ini?')) {
            deleteHSCode(id);
        }
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'hsCode', header: 'Kode HS' },
            { key: 'description', header: 'Deskripsi' }
        ];

        exportToCSV(filteredItems, 'Master_Kode_HS', columns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Master Kode HS</h1>
                    <p className="text-silver-dark mt-1">Manajemen Kode HS</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Kode HS
                </Button>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari Kode HS atau deskripsi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total Kode HS</p>
                    <p className="text-2xl font-bold text-accent-blue">{hsCodes.length}</p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden mt-4">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar Kode HS</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredItems.length} entri</span>
                        <Button
                            onClick={handleExportCSV}
                            variant="secondary"
                            icon={Download}
                            className="ml-2"
                        >
                            Export CSV
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue/10">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver">No</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">Kode HS</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">Deskripsi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-4 py-12 text-center">
                                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada Kode HS</p>
                                        <p className="text-sm text-silver-dark mt-2">Tambahkan Kode HS untuk memulai</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleEdit(item)}
                                        className="border-t border-dark-border hover:bg-dark-surface/50 cursor-pointer"
                                    >
                                        <td className="px-4 py-3 text-sm text-center text-silver-light">{idx + 1}</td>
                                        <td className="px-4 py-3 text-sm text-accent-blue font-mono">{item.hsCode}</td>
                                        <td className="px-4 py-3 text-sm text-silver-light">{item.description || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="glass-card rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold gradient-text mb-4">
                            {editingItem ? 'Edit Kode HS' : 'Tambah Kode HS'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-silver-light mb-2">Kode HS *</label>
                                <input
                                    type="text"
                                    value={formData.hsCode}
                                    onChange={(e) => setFormData({ ...formData, hsCode: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Contoh: 8517.12.00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-silver-light mb-2">Deskripsi</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Contoh: Telepon Seluler"
                                />
                            </div>
                            <div className="flex gap-2 justify-between mt-6">
                                {editingItem && (
                                    <Button
                                        type="button"
                                        variant="danger"
                                        onClick={() => {
                                            setShowModal(false);
                                            setEditingItem(null);
                                            handleDelete(editingItem.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Hapus
                                    </Button>
                                )}
                                <div className="flex gap-2 ml-auto">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            setShowModal(false);
                                            setFormData({ hsCode: '', description: '' });
                                            setEditingItem(null);
                                        }}
                                    >
                                        Batal
                                    </Button>
                                    <Button type="submit">
                                        Simpan
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HSMaster;
