import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import { exportPartnerTemplate, parsePartnerImportFile, bulkImportPartners } from '../../utils/partnerExport';
import { getActiveDivision } from '../../utils/divisionContext';
import {
    Users, Plus, Search, Edit, Trash2, Building2, User,
    Phone, Mail, MapPin, CreditCard, Filter, X, Check, Download, Upload
} from 'lucide-react';

const PartnerManagement = () => {
    const activeDivision = getActiveDivision();
    const isBxpoDivision = activeDivision === 'bxpo';
    const partnerMenuCode = isBxpoDivision ? 'bxpo_partners' : 'blink_partners';
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'customer', 'vendor', 'agent'
    const [showModal, setShowModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const fileInputRef = useRef(null);
    const [isCleansing, setIsCleansing] = useState(false);
    const [cleanseProgress, setCleanseProgress] = useState('');

    const [formData, setFormData] = useState({
        partner_name: '',
        partner_type: 'company',
        contact_person: '',
        email: '',
        phone: '',
        status: 'active',
        mobile: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        country: 'Indonesia',
        tax_id: '',
        // Roles
        is_shared: false,
        is_customer: true,
        is_vendor: false,
        is_agent: false,
        is_transporter: false,
        is_consignee: false,
        is_shipper: false,
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
        const initPage = async () => {
            await autoFixLegacyBxpoPartners();
            await fetchPartners();
        };
        initPage();
    }, [activeDivision]);

    const getAutoFixStorageKey = () => {
        const userId = user?.id || 'anonymous';
        return `partner-autofix-bxpo-v1-${userId}`;
    };

    const getCutoffIso = (daysBack = 180) => {
        const cutoff = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
        return cutoff.toISOString();
    };

    const loadReferencedPartnerIds = async () => {
        const [opsRes, salesRes] = await Promise.all([
            supabase.from('blink_quotations').select('partner_id').not('partner_id', 'is', null),
            supabase.from('blink_sales_quotations').select('partner_id').not('partner_id', 'is', null)
        ]);

        if (opsRes.error) throw opsRes.error;
        if (salesRes.error) throw salesRes.error;

        const ids = [
            ...(opsRes.data || []).map(r => r.partner_id).filter(Boolean),
            ...(salesRes.data || []).map(r => r.partner_id).filter(Boolean)
        ];

        return new Set(ids);
    };

    const updateDivisionInChunks = async (ids = [], targetDivision = 'bxpo') => {
        if (!ids.length) return 0;
        const chunkSize = 100;
        let moved = 0;

        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('blink_business_partners')
                .update({ owner_division: targetDivision, updated_at: new Date().toISOString() })
                .in('id', chunk);

            if (error) throw error;
            moved += chunk.length;
        }

        return moved;
    };

    const autoFixLegacyBxpoPartners = async () => {
        if (!isBxpoDivision) return;

        const storageKey = getAutoFixStorageKey();
        if (typeof window !== 'undefined' && window.localStorage?.getItem(storageKey) === 'done') {
            return;
        }

        try {
            const referencedPartnerIds = await loadReferencedPartnerIds();
            const cutoffIso = getCutoffIso(180);

            const { data: candidates, error } = await supabase
                .from('blink_business_partners')
                .select('id, owner_division, is_shared, is_customer, status, created_at')
                .eq('owner_division', 'blink')
                .eq('is_shared', false)
                .eq('is_customer', true)
                .eq('status', 'active')
                .gte('created_at', cutoffIso)
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) throw error;

            const moveIds = (candidates || [])
                .map(p => p.id)
                .filter(Boolean)
                .filter(id => !referencedPartnerIds.has(id));

            if (moveIds.length > 0) {
                const movedCount = await updateDivisionInChunks(moveIds, 'bxpo');
                console.log(`[PartnerAutoFix] moved ${movedCount} legacy partners to BXPO division`);
            }

            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(storageKey, 'done');
            }
        } catch (fixError) {
            console.warn('[PartnerAutoFix] skipped due to error:', fixError?.message || fixError);
        }
    };

    const fetchPartners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_business_partners')
                .select('*')
                .or(isAdminUser() ? 'id.not.is.null' : `owner_division.eq.${activeDivision},is_shared.eq.true`)
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

    const { user, isAdmin: isAdminUser, canDelete, isSuperAdmin } = useAuth();
    const { deleteBusinessPartner, deleteBusinessPartnersBulk, deleteAllBusinessPartners, addBusinessPartner, updateBusinessPartner } = useData();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingPartner) {
                const success = await updateBusinessPartner(editingPartner.id, {
                    ...formData,
                    is_shared: isAdminUser() ? Boolean(formData.is_shared) : Boolean(editingPartner.is_shared)
                });
                if (!success) throw new Error('Failed to update partner');
                alert('✅ Partner updated successfully');
            } else {
                const inserted = await addBusinessPartner({
                    ...formData,
                    owner_division: getActiveDivision(),
                    is_shared: isAdminUser() ? Boolean(formData.is_shared) : false,
                });
                if (!inserted) throw new Error('Failed to create partner');
                alert('✅ Partner created successfully');
            }

            fetchPartners();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving partner:', error);
            alert('❌ Failed to save partner: ' + error.message);
        }
    };

    const canDeletePartner = isAdminUser() || canDelete(partnerMenuCode);
    const canRunSuperAdminBatch = isSuperAdmin();

    const handleDelete = async (partnerId) => {
        if (!canDeletePartner) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus partner.');
            return;
        }

        if (!confirm('Are you sure you want to delete mitra ini? Data transaksi terkait tidak akan terhapus.')) return;

        try {
            const success = await deleteBusinessPartner(partnerId, 'blink_business_partners', partnerMenuCode);
            if (!success) return;
            alert('✅ Partner deleted');
            fetchPartners();
        } catch (error) {
            console.error('Error deleting partner:', error);
            alert('❌ Failed to delete: ' + (error.message || error));
        }
    };

    const handleCleanseAll = async () => {
        if (!canRunSuperAdminBatch) {
            alert('Akses Ditolak: Hanya Super Admin yang dapat cleansing data partner.');
            return;
        }
        if (partners.length === 0) {
            alert('Tidak ada data mitra untuk dihapus.');
            return;
        }

        const firstConfirm = confirm(`Cleansing akan menghapus SEMUA data mitra (${partners.length} baris). Lanjutkan?`);
        if (!firstConfirm) return;

        const secondConfirm = confirm('Konfirmasi terakhir: semua data mitra akan dihapus permanen. Yakin lanjut?');
        if (!secondConfirm) return;

        try {
            setIsCleansing(true);
            setCleanseProgress('Memulai proses cleansing mitra...');
            const success = await deleteAllBusinessPartners('blink_business_partners', partnerMenuCode, {
                onProgress: (message) => setCleanseProgress(message)
            });
            if (!success) return;
            alert('✅ Cleansing selesai: semua data mitra berhasil dihapus.');
            fetchPartners();
        } catch (error) {
            console.error('Error cleansing business partners:', error);
            alert('❌ Gagal cleansing data mitra: ' + (error.message || error));
        } finally {
            setIsCleansing(false);
        }
    };

    const toggleSelectAll = () => {
        if (filteredPartners.length === 0) return;
        if (selectedIds.length === filteredPartners.length) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(filteredPartners.map(p => p.id));
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleDeleteSelected = async () => {
        if (!canRunSuperAdminBatch || selectedIds.length === 0) return;
        if (!confirm(`Yakin hapus ${selectedIds.length} mitra terpilih? Data transaksi terkait tidak akan terhapus.`)) return;

        try {
            const success = await deleteBusinessPartnersBulk(selectedIds, 'blink_business_partners', partnerMenuCode);
            if (!success) return;
            alert(`✅ ${selectedIds.length} mitra berhasil dihapus`);
            setSelectedIds([]);
            fetchPartners();
        } catch (error) {
            console.error('Error bulk delete partners:', error);
            alert('❌ Gagal menghapus mitra terpilih: ' + error.message);
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
            status: 'active',
            is_shared: false,
            is_customer: true,
            is_vendor: false,
            is_agent: false,
            is_transporter: false,
            is_consignee: false,
            is_shipper: false,
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
            (roleFilter === 'transporter' && p.is_transporter) ||
            (roleFilter === 'consignee' && p.is_consignee) ||
            (roleFilter === 'shipper' && p.is_shipper);

        return matchesSearch && matchesRole;
    });

    const getRoleBadges = (partner) => {
        const roles = [];
        if (partner.is_customer) roles.push({ label: 'Customer', color: 'bg-green-500/20 text-green-400' });
        if (partner.is_vendor) roles.push({ label: 'Vendor', color: 'bg-blue-500/20 text-blue-400' });
        if (partner.is_agent) roles.push({ label: 'Agent', color: 'bg-purple-500/20 text-purple-400' });
        if (partner.is_transporter) roles.push({ label: 'Transporter', color: 'bg-orange-500/20 text-orange-400' });
        if (partner.is_consignee) roles.push({ label: 'Consignee', color: 'bg-teal-500/20 text-teal-400' });
        if (partner.is_shipper) roles.push({ label: 'Shipper', color: 'bg-indigo-500/20 text-indigo-400' });
        return roles;
    };

    // Export partners to Excel template
    const handleExportTemplate = () => {
        const result = exportPartnerTemplate(partners);
        if (result.success) {
            alert(`✅ Exported ${result.recordCount} partners to ${result.fileName}`);
        }
    };

    // Export empty template for import
    const handleExportEmptyTemplate = () => {
        const result = exportPartnerTemplate([]);
        if (result.success) {
            alert(`✅ Downloaded import template: ${result.fileName}`);
        }
    };

    // Handle file import
    const handleImportFile = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await parsePartnerImportFile(file);

            if (!result.success) {
                alert('❌ ' + result.error);
                return;
            }

            if (result.errors.length > 0) {
                const errorMsg = result.errors.map(e => `Row ${e.row}: ${e.error}`).join('\n');
                if (!confirm(`Found ${result.errors.length} error(s):\n${errorMsg}\n\nContinue importing ${result.validRows} valid rows?`)) {
                    return;
                }
            }

            if (result.partners.length === 0) {
                alert('❌ No valid partners to import');
                return;
            }

            // Confirm import
            if (!confirm(`Import ${result.partners.length} partners?`)) {
                return;
            }

            // Resilient import with duplicate filtering/merge and division defaults
            const importResult = await bulkImportPartners(supabase, result.partners, {
                defaults: {
                    owner_division: getActiveDivision(),
                    is_shared: isAdminUser() ? true : false
                }
            });

            if (importResult.success) {
                const summary = [
                    `✅ Import selesai`,
                    `- Data baru: ${importResult.imported || 0}`,
                    `- Duplikat difilter/merge: ${importResult.merged || 0}`,
                    `- Skip invalid: ${importResult.skipped || 0}`,
                    `- Gagal: ${importResult.failed || 0}`
                ];

                if ((importResult.errors || []).length > 0) {
                    const preview = importResult.errors
                        .slice(0, 10)
                        .map((err) => `Row ${err.row}: ${err.error}`)
                        .join('\n');
                    summary.push('', 'Detail error (maks 10):', preview);
                }

                alert(summary.join('\n'));
                fetchPartners(); // Refresh list
            } else {
                alert('❌ Import failed: ' + importResult.error);
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('❌ Failed to import: ' + error.message);
        } finally {
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    if (loading) return <div className="p-12 text-center text-silver-dark">Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Manajemen Mitra Bisnis</h1>
                    <p className="text-silver-dark mt-1">Kelola Customer, Vendor, Agent, dan Partner lainnya</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30">
                        <span className="text-[11px] font-semibold tracking-wide text-indigo-300 uppercase">Konteks Divisi Aktif</span>
                        <span className="text-xs font-bold text-indigo-200 uppercase">{activeDivision}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {canRunSuperAdminBatch && (
                        <>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.length === 0 || isCleansing}
                                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${selectedIds.length > 0
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-dark-surface text-silver-dark cursor-not-allowed opacity-60'
                                    }`}
                                title="Hapus mitra terpilih"
                            >
                                <Trash2 className="w-4 h-4" />
                                Hapus Terpilih ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleCleanseAll}
                                disabled={partners.length === 0 || isCleansing}
                                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${partners.length > 0
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-dark-surface text-silver-dark cursor-not-allowed opacity-60'
                                    }`}
                                title="Hapus semua data mitra"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isCleansing ? 'Cleansing...' : 'Bersihkan Semua Data'}
                            </button>
                        </>
                    )}
                    <div className="relative">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleImportFile}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2 text-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Import Excel
                        </button>
                    </div>
                    <button
                        onClick={handleExportEmptyTemplate}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Template
                    </button>
                    <button
                        onClick={handleExportTemplate}
                        className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export All
                    </button>
                    <Button onClick={() => setShowModal(true)} icon={Plus}>
                        Tambah Mitra Baru
                    </Button>
                </div>
            </div>

            {isCleansing && (
                <div className="glass-card px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <p className="text-xs text-amber-300">Progress Cleansing: {cleanseProgress || 'Sedang memproses...'}</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
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
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Consignee</p>
                    <p className="text-2xl font-bold text-teal-400 mt-1">
                        {partners.filter(p => p.is_consignee).length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Shipper</p>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">
                        {partners.filter(p => p.is_shipper).length}
                    </p>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search nama, kode, atau email..."
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
                    <option value="consignee">Consignee</option>
                    <option value="shipper">Shipper</option>
                </select>
            </div>

            {/* Partners Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <p className="text-xs text-silver-dark px-4 py-2 bg-dark-surface/50 border-b border-dark-border">
                    💡 Klik baris untuk edit • Gunakan tombol hapus di kanan baris
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">
                                    <input
                                        type="checkbox"
                                        checked={filteredPartners.length > 0 && selectedIds.length === filteredPartners.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Nama Mitra</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Kontak</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Role</th>
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
                                        className="hover:bg-dark-surface/50 transition-colors cursor-pointer"
                                        onClick={() => handleEdit(partner)}
                                    >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(partner.id)}
                                                onChange={() => toggleSelectOne(partner.id)}
                                                className="w-4 h-4"
                                            />
                                        </td>
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
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex flex-wrap gap-1">
                                                {getRoleBadges(partner).map((role, idx) => (
                                                    <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-bold ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!canDeletePartner}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${canDeletePartner
                                                        ? 'text-red-400 border-red-500/30 hover:text-red-300 hover:bg-red-500/10'
                                                        : 'text-silver-dark border-dark-border cursor-not-allowed opacity-60'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!canDeletePartner) return;
                                                        handleDelete(partner.id);
                                                    }}
                                                    title={canDeletePartner ? 'Hapus Mitra' : 'Tidak ada akses hapus'}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Hapus
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

                                    {isAdminUser() && (
                                        <div className="md:col-span-2">
                                            <label className="flex items-center gap-2 text-sm text-silver-light">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(formData.is_shared)}
                                                    onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                                Shared lintas divisi (Blink & BXPO)
                                            </label>
                                        </div>
                                    )}
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
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                    {[
                                        { key: 'is_customer', label: 'Customer', desc: 'Bisa ditagih Invoice' },
                                        { key: 'is_vendor', label: 'Vendor', desc: 'Bisa terima PO' },
                                        { key: 'is_agent', label: 'Agent', desc: 'Partner agent' },
                                        { key: 'is_transporter', label: 'Transporter', desc: 'Trucking/Airline' },
                                        { key: 'is_consignee', label: 'Consignee', desc: 'Penerima barang' },
                                        { key: 'is_shipper', label: 'Shipper', desc: 'Pengirim barang' }
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
                                <label className="block text-xs text-silver-dark mb-1">Notes</label>
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
