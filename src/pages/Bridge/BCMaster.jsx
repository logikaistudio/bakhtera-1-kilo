import React, { useState } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const BCMaster = () => {
    const { bcCodes, addBCCode, updateBCCode, deleteBCCode } = useData();

    const [showForm, setShowForm] = useState(false);
    const [editingCode, setEditingCode] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'inbound',
        description: '',
        isActive: true
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (editingCode) {
            updateBCCode(editingCode.id, formData);
            setEditingCode(null);
        } else {
            addBCCode(formData);
        }

        setFormData({
            code: '',
            name: '',
            category: 'inbound',
            description: '',
            isActive: true
        });
        setShowForm(false);
    };

    const handleEdit = (bcCode) => {
        setEditingCode(bcCode);
        setFormData({
            code: bcCode.code,
            name: bcCode.name,
            category: bcCode.category,
            description: bcCode.description,
            isActive: bcCode.is_active ?? bcCode.isActive  // Map from snake_case
        });
        setShowForm(true);
    };

    const handleRemove = (id) => {
        if (window.confirm('Remove kode BC ini?')) {
            deleteBCCode(id);
        }
    };

    const getCategoryBadge = (category) => {
        const badges = {
            inbound: 'bg-green-500/20 text-green-400',
            outbound: 'bg-blue-500/20 text-blue-400',
            monitoring: 'bg-purple-500/20 text-purple-400'
        };
        return badges[category] || 'bg-gray-500/20 text-gray-400';
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'code', header: 'Kode BC' },
            { key: 'name', header: 'Nama Dokumen' },
            { key: 'category', header: 'Kategori' },
            { key: 'description', header: 'Deskripsi' },
            { key: 'isActive', header: 'Status' }
        ];

        exportToCSV(bcCodes, 'Master_Kode_BC', columns);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Master Kode BC</h1>
                    <p className="text-silver-dark mt-1">CEISA 4.0 - Jenis Dokumen Pabean</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} icon={Plus}>
                    {showForm ? 'Batal' : 'Tambah Kode BC'}
                </Button>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                <p className="text-sm text-blue-400">
                    <strong>CEISA 4.0:</strong> Sistem customs Indonesia. BC Code digunakan untuk dokumen pabean TPPB.
                </p>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="glass-card p-6 rounded-lg space-y-4">
                    <h3 className="text-lg font-semibold text-silver-light">
                        {editingCode ? 'Edit Kode BC' : 'Tambah Kode BC Baru'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Kode BC *</label>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="contoh: BC 2.3"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Kategori *</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full"
                            >
                                <option value="inbound">Masuk</option>
                                <option value="outbound">Keluar</option>
                                <option value="monitoring">Monitoring/Laporan</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-silver mb-2">Nama Dokumen *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="contoh: Pemberitahuan Pabean Masuk Barang"
                                className="w-full"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-silver mb-2">Deskripsi</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Tujuan dan penggunaan jenis dokumen BC ini"
                                rows={2}
                                className="w-full"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <label className="text-sm text-silver">Aktif</label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => {
                            setShowForm(false);
                            setEditingCode(null);
                            setFormData({
                                code: '',
                                name: '',
                                category: 'inbound',
                                description: '',
                                isActive: true
                            });
                        }}>
                            Batal
                        </Button>
                        <Button type="submit" icon={editingCode ? Edit2 : Plus}>
                            {editingCode ? 'Perbarui' : 'Tambah'} Kode BC
                        </Button>
                    </div>
                </form>
            )}

            {/* Daftar BC Code */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-silver-light flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-accent-blue" />
                        Daftar BC Code ({bcCodes.length})
                    </h3>
                    <Button
                        onClick={handleExportCSV}
                        variant="secondary"
                        icon={Download}
                    >
                        Export CSV
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Kode BC</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Nama Dokumen</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Kategori</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">Deskripsi</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-white">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {bcCodes.map(bc => (
                                <tr
                                    key={bc.id}
                                    className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                    onClick={() => handleEdit(bc)}
                                >
                                    <td className="px-4 py-3 text-sm font-bold text-accent-blue">{bc.code}</td>
                                    <td className="px-4 py-3 text-sm text-silver-light font-medium">{bc.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadge(bc.category)}`}>
                                            {bc.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-silver-dark">{bc.description}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${(bc.is_active ?? bc.isActive) ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {(bc.is_active ?? bc.isActive) ? 'Aktif' : 'Tidak Aktif'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Usage Guide */}
            <div className="glass-card p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-silver-light mb-3">Panduan BC Code untuk TPPB</h3>
                <div className="space-y-2 text-sm text-silver-dark">
                    <p><strong className="text-accent-blue">BC 2.3:</strong> Pemasukan Barang Impor ke TPPB (dari luar negeri)</p>
                    <p><strong className="text-accent-blue">BC 2.7:</strong> Pemindahan Antar TPB (inbound/outbound)</p>
                    <p><strong className="text-accent-blue">BC 2.5:</strong> Pengeluaran ke Dalam Negeri (TLDDP)</p>
                    <p><strong className="text-accent-blue">BC 4.0:</strong> Pemasukan Barang Lokal ke TPPB (dari dalam negeri)</p>
                    <p><strong className="text-accent-blue">BC 4.1:</strong> Pengeluaran Barang Lokal dari TPPB</p>
                    <p><strong className="text-accent-green">BC 2.6.1:</strong> Pengeluaran Sementara (demo/uji coba)</p>
                    <p><strong className="text-accent-green">BC 2.6.2:</strong> Pemasukan Kembali (setelah keluar sementara)</p>
                    <p><strong className="text-accent-blue">BC 2.8:</strong> Re-ekspor ke Luar Negeri</p>
                </div>
            </div>
        </div>
    );
};

export default BCMaster;
