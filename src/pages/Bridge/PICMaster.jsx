import React, { useState } from 'react';
import { Users, Search, Plus, Edit2, Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import { exportToCSV } from '../../utils/exportCSV';

const PICMaster = () => {
    const { picMaster = [], addPIC, updatePIC, deletePIC } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPIC, setEditingPIC] = useState(null);
    const [formData, setFormData] = useState({
        nik: '',
        nama: '',
        jabatan: '',
        isActive: true
    });

    // Filter PIC
    const filteredPIC = picMaster.filter(pic =>
        pic.nik?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pic.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pic.jabatan?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Separate active and inactive
    const activePIC = filteredPIC.filter(pic => pic.isActive || pic.is_active);
    const inactivePIC = filteredPIC.filter(pic => !(pic.isActive || pic.is_active));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingPIC) {
            updatePIC(editingPIC.id, formData);
        } else {
            addPIC(formData);
        }
        setShowModal(false);
        setFormData({ nik: '', nama: '', jabatan: '', isActive: true });
        setEditingPIC(null);
    };

    const handleEdit = (pic) => {
        setEditingPIC(pic);
        setFormData({
            nik: pic.nik,
            nama: pic.nama,
            jabatan: pic.jabatan,
            isActive: pic.isActive ?? pic.is_active ?? true
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus PIC ini?')) {
            deletePIC(id);
        }
    };

    const toggleActive = (pic) => {
        const currentStatus = pic.isActive ?? pic.is_active ?? true;
        updatePIC(pic.id, { ...pic, isActive: !currentStatus });
    };

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'nik', header: 'NIK' },
            { key: 'nama', header: 'Nama' },
            { key: 'jabatan', header: 'Jabatan' },
            {
                key: 'isActive',
                header: 'Status',
                formatter: (value, row) => {
                    const isActive = value ?? row.is_active ?? true;
                    return isActive ? 'Aktif' : 'Tidak Aktif';
                }
            }
        ];

        exportToCSV(filteredPIC, 'Master_PIC', columns);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Master PIC</h1>
                    <p className="text-silver-dark mt-1">Manajemen Person In Charge (PIC)</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah PIC
                </Button>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder="Cari NIK, nama, atau jabatan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <p className="text-xs text-silver-dark">Total PIC</p>
                    <p className="text-2xl font-bold text-accent-blue">{picMaster.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <p className="text-xs text-silver-dark">PIC Aktif</p>
                    <p className="text-2xl font-bold text-accent-green">{activePIC.length}</p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-accent-blue" />
                        <h2 className="text-lg font-semibold text-silver-light">Daftar PIC</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredPIC.length} entri</span>
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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">NIK</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">Nama</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">Jabatan</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPIC.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center">
                                        <Users className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">Belum ada data PIC</p>
                                        <p className="text-sm text-silver-dark mt-2">Tambahkan PIC untuk memulai</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPIC.map((pic, idx) => {
                                    const isActive = pic.isActive ?? pic.is_active ?? true;
                                    return (
                                        <tr
                                            key={pic.id}
                                            className={`border-t border-dark-border hover:bg-dark-surface/50 ${!isActive ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-4 py-3 text-sm text-center text-silver-light">{idx + 1}</td>
                                            <td className="px-4 py-3 text-sm text-accent-blue font-mono">{pic.nik}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{pic.nama}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{pic.jabatan}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => toggleActive(pic)}
                                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isActive
                                                            ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                                                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                        }`}
                                                >
                                                    {isActive ? (
                                                        <>
                                                            <CheckCircle className="w-3 h-3" />
                                                            Aktif
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3" />
                                                            Tidak Aktif
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        onClick={() => handleEdit(pic)}
                                                        className="p-1 hover:bg-accent-blue/20 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-accent-blue" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(pic.id)}
                                                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
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
                            {editingPIC ? 'Edit PIC' : 'Tambah PIC'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-silver-light mb-2">NIK *</label>
                                <input
                                    type="text"
                                    value={formData.nik}
                                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Contoh: 3201012345678901"
                                    required
                                    disabled={editingPIC} // NIK tidak bisa diubah
                                />
                                {editingPIC && (
                                    <p className="text-xs text-silver-dark mt-1">NIK tidak dapat diubah</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-silver-light mb-2">Nama *</label>
                                <input
                                    type="text"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Contoh: John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-silver-light mb-2">Jabatan *</label>
                                <input
                                    type="text"
                                    value={formData.jabatan}
                                    onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Contoh: Manager Operasional"
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded border-dark-border"
                                    />
                                    <span className="text-sm text-silver-light">Status Aktif</span>
                                </label>
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ nik: '', nama: '', jabatan: '', isActive: true });
                                        setEditingPIC(null);
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button type="submit">
                                    {editingPIC ? 'Update' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PICMaster;
