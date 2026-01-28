import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import { exportPartnerTemplate, parsePartnerImportFile, bulkImportPartners } from '../../utils/partnerExport';
import {
    Users, Plus, Search, Edit, Trash2, Building2, User,
    Phone, Mail, MapPin, CreditCard, Filter, X, Check, Download, Upload
} from 'lucide-react';

const PartnerManagement = () => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'customer', 'vendor', 'agent'
    const [showModal, setShowModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const fileInputRef = useRef(null);

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
        // Roles
        is_customer: false,
        is_vendor: false,
        is_agent: false,
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
            alert('Failed to load partners: ' + error.message);
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
                alert('✅ Partner updated successfully');
            } else {
                // Create
                const { error } = await supabase
                    .from('bridge_business_partners')
                    .insert([formData]);

                if (error) throw error;
                alert('✅ Partner created successfully');
            }

            fetchPartners();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving partner:', error);
            alert('❌ Failed to save partner: ' + error.message);
        }
    };

    const handleDelete = async (partnerId) => {
        if (!confirm('Yakin hapus mitra ini? Data transaksi terkait tidak akan terhapus.')) return;

        try {
            const { error } = await supabase
                .from('bridge_business_partners')
                .delete()
                .eq('id', partnerId);

            if (error) throw error;
            alert('✅ Partner deleted');
            fetchPartners();
        } catch (error) {
            console.error('Error deleting partner:', error);
            alert('❌ Failed to delete: ' + error.message);
        }
    };

    const handleEdit = (partner) => {
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
            is_agent: false,
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
            (roleFilter === 'agent' && p.is_agent) ||
            (roleFilter === 'transporter' && p.is_transporter);

        return matchesSearch && matchesRole;
    });

    const getRoleBadges = (partner) => {
        const roles = [];
        if (partner.is_customer) roles.push({ label: 'Customer', color: 'bg-green-500/20 text-green-400' });
        if (partner.is_vendor) roles.push({ label: 'Vendor', color: 'bg-blue-500/20 text-blue-400' });
        if (partner.is_agent) roles.push({ label: 'Agent', color: 'bg-purple-500/20 text-purple-400' });
        if (partner.is_transporter) roles.push({ label: 'Transporter', color: 'bg-orange-500/20 text-orange-400' });
        return roles;
    };

    if (loading) return <div className="p-12 text-center text-silver-dark">Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Manajemen Mitra Bisnis</h1>
                    <p className="text-silver-dark mt-1">Kelola Customer, Vendor, Agent, dan Partner lainnya</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowModal(true)} icon={Plus}>
                        Tambah Mitra Baru
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Total Mitra</p>
                    <p className="text-2xl font-bold text-silver-light mt-1">{partners.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Customer</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                        {partners.filter(p => p.is_customer).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Vendor</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {partners.filter(p => p.is_vendor).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Agent</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">
                        {partners.filter(p => p.is_agent).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Transporter</p>
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
                        placeholder="Cari nama, kode, atau email..."
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
                    <option value="all">Semua Role</option>
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                    <option value="agent">Agent</option>
                    <option value="transporter">Transporter</option>
                </select>
            </div>

            {/* Partners Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Nama Mitra</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Kontak</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Role</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">Actions</th>
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
                                    <tr key={partner.id} className="hover:bg-dark-surface/50 transition-colors">
                                        <td className="px-4 py-3 text-xs font-mono text-blue-400">{partner.partner_code}</td>
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
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {getRoleBadges(partner).map((role, idx) => (
                                                    <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-bold ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(partner)}
                                                    className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(partner.id)}
                                                    className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
                                <h3 className="text-sm font-bold text-blue-400 mb-3 uppercase">Informasi Dasar</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Nama Mitra *</label>
                                        <input
                                            type="text"
                                            value={formData.partner_name}
                                            onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Tipe</label>
                                        <select
                                            value={formData.partner_type}
                                            onChange={(e) => setFormData({ ...formData, partner_type: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        >
                                            <option value="company">Company</option>
                                            <option value="individual">Individual</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Contact Person</label>
                                        <input
                                            type="text"
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">NPWP</label>
                                        <input
                                            type="text"
                                            value={formData.tax_id}
                                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Roles */}
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-purple-400 mb-3 uppercase">Role Partner (bisa lebih dari 1)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { key: 'is_customer', label: 'Customer', desc: 'Bisa ditagih Invoice' },
                                        { key: 'is_vendor', label: 'Vendor', desc: 'Bisa terima PO' },
                                        { key: 'is_agent', label: 'Agent', desc: 'Partner agent' },
                                        { key: 'is_transporter', label: 'Transporter', desc: 'Trucking/Airline' }
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
                                    <label className="block text-xs text-silver-dark mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">Phone</label>
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
                                    <label className="block text-xs text-silver-dark mb-1">Alamat</label>
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
                                        placeholder="Kota"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.postal_code}
                                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                        placeholder="Kode Pos"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        placeholder="Negara"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Financial */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">Payment Terms</label>
                                    <select
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    >
                                        <option value="NET 7">NET 7</option>
                                        <option value="NET 14">NET 14</option>
                                        <option value="NET 30">NET 30</option>
                                        <option value="NET 60">NET 60</option>
                                        <option value="COD">COD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-silver-dark mb-1">Currency</label>
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
                                    <label className="block text-xs text-silver-dark mb-1">Credit Limit</label>
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
                                <h3 className="text-sm font-bold text-green-400 mb-3 uppercase">Informasi Bank (opsional)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                        placeholder="Nama Bank"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.bank_account_number}
                                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                                        placeholder="No Rekening"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                    <input
                                        type="text"
                                        value={formData.bank_account_holder}
                                        onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                                        placeholder="Nama Pemilik Rekening"
                                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs text-silver-dark mb-1">Catatan</label>
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
                                Batal
                            </Button>
                            <Button type="submit" icon={editingPartner ? Edit : Plus}>
                                {editingPartner ? 'Update Mitra' : 'Simpan Mitra'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default PartnerManagement;
