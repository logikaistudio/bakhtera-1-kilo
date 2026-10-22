import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    Users, Plus, Search, Edit, Trash2, Building2, User,
    Phone, Mail, MapPin, CreditCard, Filter, X, Check, Download, Upload
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const BridgePartnerManagement = () => {
    const { t } = useLanguage();
    const { canCreate, canEdit, canDelete, isSuperAdmin } = useAuth();
    const hasCreate = canCreate('bridge_partners');
    const hasEdit = canEdit('bridge_partners');
    const hasDelete = canDelete('bridge_partners');
    const canClearAll = hasDelete && isSuperAdmin();
    const [partners, setPartners] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'customer', 'vendor', 'consignee', 'shipper'
    const [showModal, setShowModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const fileInputRef = useRef(null);
    const [isCleansing, setIsCleansing] = useState(false);
    const [cleanseProgress, setCleanseProgress] = useState('');

    const [formData, setFormData] = useState({
        partner_name: '',
        partner_type: 'company',
        contact_person: '',
        email: '',
        phone: '',
        mobile: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        country: 'Indonesia',
        tax_id: '',
        // Roles for Bridge (customs/warehouse context)
        is_customer: false,
        is_vendor: false,
        is_consignee: false, // Penerima barang
        is_shipper: false,   // Pengirim barang
        is_transporter: false,
        // Financial
        payment_terms: 'NET 30',
        credit_limit: 0,
        currency: 'IDR',
        // Banking
        bank_name: '',
        bank_account_number: '',
        bank_account_holder: '',
        notes: ''
    });

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('bridge_business_partners')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPartners(data || []);
        } catch (error) {
            console.error('Error fetching partners:', error);
            // If table doesn't exist, show empty list
            if (error.code === '42P01') {
                console.log('bridge_business_partners table not found, showing empty list');
                setPartners([]);
            } else {
                alert('Failed to load partners: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingPartner) {
                // Update
                const { error } = await supabase
                    .from('bridge_business_partners')
                    .update(formData)
                    .eq('id', editingPartner.id);

                if (error) throw error;
                alert(t("✅ Mitra berhasil diperbarui"));
            } else {
                // Create
                const { error } = await supabase
                    .from('bridge_business_partners')
                    .insert([formData]);

                if (error) throw error;
                alert(t("✅ Mitra baru berhasil ditambahkan"));
            }

            fetchPartners();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving partner:', error);
            alert('❌ Gagal menyimpan mitra: ' + error.message);
        }
    };


    const { deleteBusinessPartner, deleteBusinessPartnersBulk, deleteAllBusinessPartners } = useData();

    const handleDelete = async (partnerId) => {
        if (!hasDelete) return;
        if (!confirm(t("Yakin hapus mitra ini? Data transaksi terkait tidak akan terhapus."))) return;
        try {
            const success = await deleteBusinessPartner(partnerId, 'bridge_business_partners', 'bridge_partners');
            if (!success) return;
            alert(t("✅ Mitra berhasil dihapus"));
            fetchPartners();
        } catch (error) {
            console.error('Error deleting partner:', error);
            alert('❌ Gagal menghapus: ' + (error.message || error));
        }
    };

    // Multi-delete
    const handleSelectRow = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredPartners.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredPartners.map((p) => p.id));
        }
    };

    const handleMultiDelete = async () => {
        if (!hasDelete || selectedIds.length === 0) return;
        if (!confirm(`Yakin hapus ${selectedIds.length} mitra terpilih? Data transaksi terkait tidak akan terhapus.`)) return;
        try {
            const success = await deleteBusinessPartnersBulk(selectedIds, 'bridge_business_partners', 'bridge_partners');
            if (!success) return;
            alert(`✅ ${selectedIds.length} mitra berhasil dihapus`);
            setSelectedIds([]);
            fetchPartners();
        } catch (error) {
            console.error('Error multi-deleting partners:', error);
            alert('❌ Gagal menghapus: ' + (error.message || error));
        }
    };

    const handleCleanseAll = async () => {
        if (!canClearAll) {
            alert(t("Akses Ditolak: Anda tidak memiliki hak untuk cleansing data mitra."));
            return;
        }
        if (partners.length === 0) {
            alert(t("Tidak ada data mitra untuk dihapus."));
            return;
        }

        const firstConfirm = confirm(`Cleansing akan menghapus SEMUA data mitra Bridge (${partners.length} baris). Lanjutkan?`);
        if (!firstConfirm) return;

        const secondConfirm = confirm(t("Konfirmasi terakhir: semua data mitra Bridge akan dihapus permanen. Yakin lanjut?"));
        if (!secondConfirm) return;

        try {
            setIsCleansing(true);
            setCleanseProgress('Memulai proses cleansing mitra Bridge...');
            const success = await deleteAllBusinessPartners('bridge_business_partners', 'bridge_partners', {
                onProgress: (message) => setCleanseProgress(message)
            });
            if (!success) return;
            alert(t("✅ Cleansing selesai: semua data mitra Bridge berhasil dihapus."));
            setSelectedIds([]);
            fetchPartners();
        } catch (error) {
            console.error('Error cleansing bridge partners:', error);
            alert('❌ Gagal cleansing data mitra Bridge: ' + (error.message || error));
        } finally {
            setIsCleansing(false);
        }
    };

    const handleEdit = (partner) => {
        if (!hasEdit) return;
        setEditingPartner(partner);
        setFormData(partner);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingPartner(null);
        setFormData({
            partner_name: '',
            partner_type: 'company',
            contact_person: '',
            email: '',
            phone: '',
            mobile: '',
            address_line1: '',
            address_line2: '',
            city: '',
            postal_code: '',
            country: 'Indonesia',
            tax_id: '',
            is_customer: false,
            is_vendor: false,
            is_consignee: false,
            is_shipper: false,
            is_transporter: false,
            payment_terms: 'NET 30',
            credit_limit: 0,
            currency: 'IDR',
            bank_name: '',
            bank_account_number: '',
            bank_account_holder: '',
            notes: ''
        });
    };

    // Filtered partners
    const filteredPartners = partners.filter(p => {
        const matchesSearch = !searchTerm ||
            p.partner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.partner_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'all' ||
            (roleFilter === 'customer' && p.is_customer) ||
            (roleFilter === 'vendor' && p.is_vendor) ||
            (roleFilter === 'consignee' && p.is_consignee) ||
            (roleFilter === 'shipper' && p.is_shipper) ||
            (roleFilter === 'transporter' && p.is_transporter);

        return matchesSearch && matchesRole;
    });

    const getRoleBadges = (partner) => {
        const roles = [];
        if (partner.is_customer) roles.push({ label: 'Customer', color: 'bg-green-500/20 text-green-400' });
        if (partner.is_vendor) roles.push({ label: 'Vendor', color: 'bg-blue-500/20 text-blue-400' });
        if (partner.is_consignee) roles.push({ label: 'Consignee', color: 'bg-purple-500/20 text-purple-400' });
        if (partner.is_shipper) roles.push({ label: 'Shipper', color: 'bg-yellow-500/20 text-yellow-400' });
        if (partner.is_transporter) roles.push({ label: 'Transporter', color: 'bg-orange-500/20 text-orange-400' });
        return roles;
    };

    // Export partners to CSV
    const handleExportCSV = () => {
        if (partners.length === 0) {
            alert(t("Tidak ada data untuk diekspor"));
            return;
        }

        const headers = ['Kode', 'Nama', 'Tipe', 'Contact Person', 'Email', 'Phone', 'Alamat', 'Kota', 'NPWP', 'Customer', 'Vendor', 'Consignee', 'Shipper', 'Transporter'];
        const rows = partners.map(p => [
            p.partner_code || '',
            p.partner_name || '',
            p.partner_type || '',
            p.contact_person || '',
            p.email || '',
            p.phone || '',
            p.address_line1 || '',
            p.city || '',
            p.tax_id || '',
            p.is_customer ? 'Ya' : 'Tidak',
            p.is_vendor ? 'Ya' : 'Tidak',
            p.is_consignee ? 'Ya' : 'Tidak',
            p.is_shipper ? 'Ya' : 'Tidak',
            p.is_transporter ? 'Ya' : 'Tidak'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bridge_mitra_bisnis_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        alert(`✅ Diekspor ${partners.length} mitra ke CSV`);
    };

    if (loading) return <div className="p-12 text-center text-silver-dark">{t("Loading...")}</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">{t("Mitra Bisnis Bridge")}</h1>
                    <p className="text-silver-dark mt-1">{t("Kelola Customer, Vendor, Consignee, Shipper (TPB/Gudang Berikat)")}</p>
                </div>
                <div className="flex gap-2">
                    {canClearAll && (
                        <Button
                            onClick={handleCleanseAll}
                            disabled={partners.length === 0 || isCleansing}
                            className={`bg-red-600/20 text-red-400 hover:bg-red-600/30 ${partners.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isCleansing ? 'Cleansing...' : 'Bersihkan Semua Data'}
                        </Button>
                    )}
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        {t("Export CSV")}
                    </button>
                    {hasDelete && (
                        <Button
                            onClick={handleMultiDelete}
                            disabled={selectedIds.length === 0}
                            className={`bg-red-500/20 text-red-400 hover:bg-red-500/30 ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {t("Hapus Terpilih (")}{selectedIds.length})
                        </Button>
                    )}
                    {hasCreate && (
                        <Button onClick={() => setShowModal(true)} icon={Plus}>
                            {t("Tambah Mitra Baru")}
                        </Button>
                    )}
                </div>
            </div>

            {isCleansing && (
                <div className="glass-card px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <p className="text-xs text-amber-300">{t("Progress Cleansing:")} {cleanseProgress || 'Sedang memproses...'}</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Total Mitra")}</p>
                    <p className="text-2xl font-bold text-silver-light mt-1">{partners.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Customer")}</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                        {partners.filter(p => p.is_customer).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Vendor")}</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {partners.filter(p => p.is_vendor).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Consignee")}</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">
                        {partners.filter(p => p.is_consignee).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Shipper")}</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">
                        {partners.filter(p => p.is_shipper).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">{t("Transporter")}</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                        {partners.filter(p => p.is_transporter).length}
                    </p>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder={t("Cari nama, kode, atau email...")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                >
                    <option value="all">{t("Semua Role")}</option>
                    <option value="customer">{t("Customer")}</option>
                    <option value="vendor">{t("Vendor")}</option>
                    <option value="consignee">{t("Consignee")}</option>
                    <option value="shipper">{t("Shipper")}</option>
                    <option value="transporter">{t("Transporter")}</option>
                </select>
            </div>

            {/* Partners Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <p className="text-xs text-silver-dark px-4 py-2 bg-dark-surface/50 border-b border-dark-border">
                    {t("💡 Klik baris untuk edit • Klik kanan untuk hapus")}
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === filteredPartners.length && filteredPartners.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">{t("Kode")}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">{t("Nama Mitra")}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">{t("Kontak")}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">{t("Role")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredPartners.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-silver-dark">
                                        {searchTerm || roleFilter !== 'all' ? 'Tidak ada mitra yang cocok' : 'Belum ada mitra. Klik "Tambah Mitra Baru"'}
                                    </td>
                                </tr>
                            ) : (
                                filteredPartners.map((partner) => (
                                    <tr
                                        key={partner.id}
                                        className={`hover:bg-dark-surface/50 transition-colors ${hasEdit ? 'cursor-pointer' : ''}`}
                                        onClick={(e) => {
                                            // Only trigger edit if not clicking checkbox
                                            if (e.target.type !== 'checkbox' && hasEdit) handleEdit(partner);
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            hasDelete && handleDelete(partner.id);
                                        }}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(partner.id)}
                                                onChange={() => handleSelectRow(partner.id)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-blue-400">{partner.partner_code || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {partner.partner_type === 'company' ? (
                                                    <Building2 className="w-4 h-4 text-silver-dark" />
                                                ) : (
                                                    <User className="w-4 h-4 text-silver-dark" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-silver-light">{partner.partner_name}</p>
                                                    {partner.contact_person && (
                                                        <p className="text-xs text-silver-dark">CP: {partner.contact_person}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-silver-light">
                                            {partner.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{partner.email}</div>}
                                            {partner.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{partner.phone}</div>}
                                        </td>
                                        <td className="px-4 py-3 flex items-center justify-between">
                                            <div className="flex flex-wrap gap-1">
                                                {getRoleBadges(partner).map((role, idx) => (
                                                    <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-bold ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                ))}
                                            </div>
                                            {hasDelete && (
                                                <button
                                                    className="ml-4 text-red-500 hover:text-red-700"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(partner.id); }}
                                                    title={t("Hapus Mitra")}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <Modal isOpen={showModal} onClose={handleCloseModal} maxWidth="max-w-4xl">
                    <form onSubmit={handleSubmit} className="p-6">
                        <h2 className="text-2xl font-bold gradient-text mb-6">
                            {editingPartner ? 'Edit Mitra Bisnis' : 'Tambah Mitra Baru'}
                        </h2>

                        <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-blue-400 mb-3 uppercase">{t("Informasi Dasar")}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">{t("Nama Mitra *")}</label>
                                        <input
                                            type="text"
                                            value={formData.partner_name}
                                            onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">{t("Tipe")}</label>
                                        <select
                                            value={formData.partner_type}
                                            onChange={(e) => setFormData({ ...formData, partner_type: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        >
                                            <option value="company">{t("Company")}</option>
                                            <option value="individual">{t("Individual")}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">{t("Contact Person")}</label>
                                        <input
                                            type="text"
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">{t("NPWP")}</label>
                                        <input
                                            type="text"
                                            value={formData.tax_id}
                                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Roles - Bridge specific */}
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-purple-400 mb-3 uppercase">{t("Role Partner (bisa lebih dari 1)")}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { key: 'is_customer', label: 'Customer', desc: 'Bisa ditagih' },
                                        { key: 'is_vendor', label: 'Vendor', desc: 'Supplier barang' },
                                        { key: 'is_consignee', label: 'Consignee', desc: 'Penerima barang' },
                                        { key: 'is_shipper', label: 'Shipper', desc: 'Pengirim barang' },
                                        { key: 'is_transporter', label: 'Transporter', desc: 'Trucking/EMKL' }
                                    ].map(role => (
                                        <label key={role.key} className="flex items-start gap-2 p-2 rounded border border-dark-border hover:bg-dark-surface/50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData[role.key]}
                                                onChange={(e) => setFormData({ ...formData, [role.key]: e.target.checked })}
                                                className="mt-1"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-silver-light">{role.label}</p>
                                                <p className="text-[10px] text-silver-dark">{role.desc}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Email")}</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Phone")}</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Alamat")}</label>
                                    <textarea
                                        value={formData.address_line1}
                                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        rows="2"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder={t("Kota")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.postal_code}
                                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                        placeholder={t("Kode Pos")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        placeholder={t("Negara")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Financial */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Payment Terms")}</label>
                                    <select
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    >
                                        <option value="NET 7">{t("NET 7")}</option>
                                        <option value="NET 14">{t("NET 14")}</option>
                                        <option value="NET 30">{t("NET 30")}</option>
                                        <option value="NET 60">{t("NET 60")}</option>
                                        <option value="COD">COD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Currency")}</label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    >
                                        <option value="IDR">IDR</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">{t("Credit Limit")}</label>
                                    <input
                                        type="number"
                                        value={formData.credit_limit}
                                        onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Bank Info */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-green-400 mb-3 uppercase">{t("Informasi Bank (opsional)")}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                        placeholder={t("Nama Bank")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.bank_account_number}
                                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                                        placeholder={t("No Rekening")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.bank_account_holder}
                                        onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                                        placeholder={t("Nama Pemilik Rekening")}
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs text-silver-dark mb-1">{t("Catatan")}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    rows="3"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-dark-border">
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>
                                {t("Batal")}
                            </Button>
                            {(!editingPartner || hasEdit) && (
                                <Button type="submit" icon={editingPartner ? Edit : Plus}>
                                    {editingPartner ? 'Update Mitra' : 'Simpan Mitra'}
                                </Button>
                            )}
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default BridgePartnerManagement;
