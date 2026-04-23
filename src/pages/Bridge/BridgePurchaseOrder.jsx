import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    ShoppingCart, Plus, CheckCircle, XCircle, Clock,
    AlertCircle, Search, Trash, Edit, Send, DollarSign
} from 'lucide-react';

const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : '-';
const today = () => new Date().toISOString().split('T')[0];
const genNumber = () => `BRG-PO-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${String(Date.now()).slice(-5)}`;
const EMPTY_ITEM = { description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, tax_rate: 0, tax_amount: 0, coa_id: null };
const PAYMENT_TERMS = ['NET 7', 'NET 14', 'NET 30', 'NET 45', 'NET 60', 'COD'];

const STATUS_CONFIG = {
    draft:     { label: 'Draft',     color: 'bg-gray-500/20 text-gray-400' },
    submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400' },
    approved:  { label: 'Approved',  color: 'bg-green-500/20 text-green-400' },
    rejected:  { label: 'Rejected',  color: 'bg-red-500/20 text-red-400' },
    paid:      { label: 'Paid',      color: 'bg-emerald-500/20 text-emerald-400' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' },
};

// ─── PO Item Row ──────────────────────────────────────────────────────────────
const POItemRow = ({ item, idx, coaList, canEdit, onChange, onRemove }) => {
    const h = (field, val) => {
        const u = { ...item, [field]: val };
        if (field === 'qty' || field === 'unit_price') {
            u.amount = (parseFloat(u.qty) || 0) * (parseFloat(u.unit_price) || 0);
            u.tax_amount = u.amount * ((parseFloat(u.tax_rate) || 0) / 100);
        }
        if (field === 'tax_rate') u.tax_amount = (parseFloat(u.amount) || 0) * (parseFloat(val) / 100);
        onChange(idx, u);
    };
    return (
        <tr className="border-b border-dark-border/40 hover:bg-white/5">
            <td className="px-3 py-2">
                <input value={item.description} onChange={e => h('description', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm border-b border-dark-border focus:outline-none" placeholder="Deskripsi item / jasa" />
            </td>
            <td className="px-3 py-2 w-20">
                <input type="number" value={item.qty} min="0" step="any" onChange={e => h('qty', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-20">
                <input value={item.unit} onChange={e => h('unit', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-32">
                <input type="number" value={item.unit_price} min="0" step="any" onChange={e => h('unit_price', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-16">
                <input type="number" value={item.tax_rate} min="0" max="100" step="0.01" onChange={e => h('tax_rate', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-36 text-right text-silver-light text-sm font-mono">
                {fmtIDR((parseFloat(item.amount) || 0) + (parseFloat(item.tax_amount) || 0))}
            </td>
            <td className="px-3 py-2 w-48">
                <select value={item.coa_id || ''} disabled={!canEdit}
                    onChange={e => h('coa_id', e.target.value || null)}
                    className="w-full bg-dark-surface border border-dark-border rounded px-1 py-1 text-xs text-silver-light">
                    <option value="">— Pilih COA —</option>
                    {coaList.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                </select>
            </td>
            <td className="px-3 py-2 text-center">
                {canEdit && (
                    <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-300">
                        <Trash className="w-4 h-4" />
                    </button>
                )}
            </td>
        </tr>
    );
};

// ─── PO Form Modal ────────────────────────────────────────────────────────────
const POFormModal = ({ po, coaList, onClose, onSave }) => {
    const { canEdit } = useAuth();
    const isEdit = !!po;

    const [form, setForm] = useState({
        po_number: po?.po_number || genNumber(),
        po_date: po?.po_date || today(),
        due_date: po?.due_date || '',
        payment_terms: po?.payment_terms || 'NET 30',
        vendor_name: po?.vendor_name || '',
        vendor_address: po?.vendor_address || '',
        currency: po?.currency || 'IDR',
        notes: po?.notes || '',
        discount_amount: po?.discount_amount || 0,
        po_items: po?.po_items || [{ ...EMPTY_ITEM }],
    });
    const [saving, setSaving] = useState(false);

    const handleTermsChange = (terms) => {
        const days = parseInt(terms.replace('NET ', '')) || 0;
        const due = new Date(form.po_date);
        due.setDate(due.getDate() + days);
        setForm(p => ({ ...p, payment_terms: terms, due_date: due.toISOString().split('T')[0] }));
    };

    const updateItem = (idx, updated) => setForm(p => {
        const items = [...p.po_items]; items[idx] = updated; return { ...p, po_items: items };
    });
    const removeItem = (idx) => setForm(p => ({ ...p, po_items: p.po_items.filter((_, i) => i !== idx) }));
    const addItem = () => setForm(p => ({ ...p, po_items: [...p.po_items, { ...EMPTY_ITEM }] }));

    const subtotal = form.po_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const taxTotal = form.po_items.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0);
    const grandTotal = subtotal + taxTotal - (parseFloat(form.discount_amount) || 0);

    const handleSave = async (status = 'draft') => {
        if (!form.vendor_name.trim()) return alert('Nama vendor wajib diisi');
        if (form.po_items.length === 0) return alert('Tambah minimal 1 item');
        setSaving(true);
        try {
            const payload = {
                ...form,
                status,
                subtotal,
                tax_amount: taxTotal,
                grand_total: grandTotal,
                paid_amount: po?.paid_amount || 0,
                outstanding_amount: grandTotal - (po?.paid_amount || 0),
                approval_status: status === 'submitted' ? 'pending' : (po?.approval_status || 'draft'),
            };
            if (isEdit) {
                const { error } = await supabase.from('bridge_pos').update(payload).eq('id', po.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('bridge_pos').insert([payload]);
                if (error) throw error;
            }
            onSave();
        } catch (err) { alert('Error: ' + err.message); }
        finally { setSaving(false); }
    };

    return (
        <Modal isOpen onClose={onClose} maxWidth="max-w-6xl">
            <div className="p-6 space-y-6">
                <h2 className="text-2xl font-bold gradient-text">{isEdit ? 'Edit Purchase Order' : 'Buat Purchase Order Baru'}</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Nomor PO</label>
                        <input value={form.po_number} onChange={e => setForm(p => ({ ...p, po_number: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Tanggal PO *</label>
                        <input type="date" value={form.po_date} onChange={e => setForm(p => ({ ...p, po_date: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Term Pembayaran</label>
                        <select value={form.payment_terms} onChange={e => handleTermsChange(e.target.value)}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm">
                            {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Jatuh Tempo</label>
                        <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-silver-dark mb-1">Nama Vendor *</label>
                        <input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" placeholder="Nama vendor / pemasok" />
                    </div>
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Mata Uang</label>
                        <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm">
                            <option value="IDR">IDR</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-silver-dark mb-1">Alamat Vendor</label>
                        <input value={form.vendor_address} onChange={e => setForm(p => ({ ...p, vendor_address: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                </div>

                {/* Items */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0070BB]">
                        <span className="text-white font-semibold text-sm">Item PO</span>
                        <button onClick={addItem} className="flex items-center gap-1 text-white text-xs hover:text-yellow-300">
                            <Plus className="w-4 h-4" /> Tambah Item
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-dark-surface/60 text-silver-dark text-xs uppercase">
                                <tr>
                                    <th className="px-3 py-2 text-left">Deskripsi</th>
                                    <th className="px-3 py-2 text-right w-20">Qty</th>
                                    <th className="px-3 py-2 text-left w-20">Unit</th>
                                    <th className="px-3 py-2 text-right w-32">Harga Satuan</th>
                                    <th className="px-3 py-2 text-right w-16">PPN%</th>
                                    <th className="px-3 py-2 text-right w-36">Total</th>
                                    <th className="px-3 py-2 w-48">COA Bridge (Beban)</th>
                                    <th className="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.po_items.map((item, idx) => (
                                    <POItemRow key={idx} item={item} idx={idx} coaList={coaList}
                                        canEdit={canEdit('bridge_finance')} onChange={updateItem} onRemove={removeItem} />
                                ))}
                                {form.po_items.length === 0 && (
                                    <tr><td colSpan={8} className="text-center py-6 text-silver-dark text-sm italic">Belum ada item</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-dark-border px-6 py-4">
                        <div className="flex justify-end">
                            <div className="w-72 space-y-2 text-sm">
                                <div className="flex justify-between text-silver-dark">
                                    <span>Subtotal</span><span className="font-mono">{fmtIDR(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-silver-dark">
                                    <span>Total PPN</span><span className="font-mono">{fmtIDR(taxTotal)}</span>
                                </div>
                                <div className="flex justify-between text-silver-dark items-center gap-2">
                                    <span>Diskon</span>
                                    <input type="number" value={form.discount_amount} min="0"
                                        onChange={e => setForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 bg-dark-surface border border-dark-border rounded px-2 py-1 text-right text-silver-light text-sm font-mono" />
                                </div>
                                <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-dark-border">
                                    <span>Grand Total</span>
                                    <span className="font-mono text-accent-orange">{fmtIDR(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-silver-dark mb-1">Catatan</label>
                    <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button variant="ghost" onClick={() => handleSave('draft')} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan Draft'}
                    </Button>
                    <Button onClick={() => handleSave('submitted')} disabled={saving} icon={Send}>
                        {saving ? 'Mengirim...' : 'Submit untuk Approval'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const BridgePurchaseOrder = () => {
    const { canCreate, canEdit, canDelete, canApprove } = useAuth();
    const [pos, setPOs] = useState([]);
    const [coaList, setCoaList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editPO, setEditPO] = useState(null);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [{ data: poData }, { data: coa }] = await Promise.all([
                supabase.from('bridge_pos').select('*').order('created_at', { ascending: false }),
                supabase.from('bridge_coa').select('id,code,name,type').eq('is_active', true).order('code')
            ]);
            setPOs(poData || []);
            setCoaList(coa || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleApprove = async (id) => {
        if (!canApprove('bridge_finance')) return alert('Tidak ada akses untuk menyetujui PO.');
        await supabase.from('bridge_pos').update({ status: 'approved', approval_status: 'approved' }).eq('id', id);
        fetchAll();
    };

    const handleReject = async (id) => {
        if (!canApprove('bridge_finance')) return alert('Tidak ada akses.');
        await supabase.from('bridge_pos').update({ status: 'rejected', approval_status: 'rejected' }).eq('id', id);
        fetchAll();
    };

    const handleDelete = async (id) => {
        if (!canDelete('bridge_finance')) return alert('Tidak ada akses.');
        if (!confirm('Hapus PO ini?')) return;
        await supabase.from('bridge_pos').delete().eq('id', id);
        fetchAll();
    };

    const filtered = pos.filter(p => {
        const ms = !searchTerm ||
            p.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const mf = filterStatus === 'all' || p.status === filterStatus;
        return ms && mf;
    });

    const totalPO = filtered.filter(p => p.status !== 'cancelled').reduce((s, p) => s + (p.grand_total || 0), 0);
    const totalPaid = filtered.reduce((s, p) => s + (p.paid_amount || 0), 0);
    const totalOutstanding = filtered.filter(p => p.status === 'approved').reduce((s, p) => s + (p.outstanding_amount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <ShoppingCart className="w-8 h-8" /> Purchase Order Bridge
                    </h1>
                    <p className="text-silver-dark mt-1">Kelola pembelian dan pengeluaran Bridge module</p>
                </div>
                {canCreate('bridge_finance') && (
                    <Button icon={Plus} onClick={() => { setEditPO(null); setShowForm(true); }}>Buat PO</Button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total PO', value: fmtIDR(totalPO), color: 'text-blue-400' },
                    { label: 'Total Terbayar', value: fmtIDR(totalPaid), color: 'text-green-400' },
                    { label: 'Outstanding (Approved)', value: fmtIDR(totalOutstanding), color: 'text-red-400' },
                ].map(c => (
                    <div key={c.label} className="glass-card p-5 rounded-xl">
                        <p className="text-silver-dark text-sm">{c.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Cari nomor PO atau vendor..."
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light text-sm">
                    <option value="all">Semua Status</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-silver-dark">Memuat data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0070BB] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">No PO</th>
                                    <th className="px-4 py-3 text-left">Vendor</th>
                                    <th className="px-4 py-3 text-left">Tgl PO</th>
                                    <th className="px-4 py-3 text-left">Jatuh Tempo</th>
                                    <th className="px-4 py-3 text-right">Grand Total</th>
                                    <th className="px-4 py-3 text-right">Terbayar</th>
                                    <th className="px-4 py-3 text-right">Outstanding</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/40">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-10 text-silver-dark italic">Tidak ada data PO</td></tr>
                                ) : filtered.map(po => {
                                    const st = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                                    return (
                                        <tr key={po.id} className="hover:bg-white/5 smooth-transition">
                                            <td className="px-4 py-3 font-mono text-accent-orange text-xs">{po.po_number}</td>
                                            <td className="px-4 py-3 text-silver-light font-medium">{po.vendor_name}</td>
                                            <td className="px-4 py-3 text-silver-dark">{po.po_date}</td>
                                            <td className="px-4 py-3 text-silver-dark">{po.due_date || '-'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-silver-light">{fmtIDR(po.grand_total)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-green-400">{fmtIDR(po.paid_amount || 0)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-red-400">{fmtIDR(po.outstanding_amount || 0)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {canEdit('bridge_finance') && po.status === 'draft' && (
                                                        <button onClick={() => { setEditPO(po); setShowForm(true); }}
                                                            className="text-blue-400 hover:text-blue-300 p-1" title="Edit">
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canApprove('bridge_finance') && po.status === 'submitted' && (
                                                        <>
                                                            <button onClick={() => handleApprove(po.id)}
                                                                className="text-green-400 hover:text-green-300 p-1" title="Approve">
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleReject(po.id)}
                                                                className="text-red-400 hover:text-red-300 p-1" title="Reject">
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {canDelete('bridge_finance') && po.status === 'draft' && (
                                                        <button onClick={() => handleDelete(po.id)}
                                                            className="text-red-400 hover:text-red-300 p-1" title="Hapus">
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <POFormModal po={editPO} coaList={coaList}
                    onClose={() => { setShowForm(false); setEditPO(null); }}
                    onSave={() => { setShowForm(false); setEditPO(null); fetchAll(); }} />
            )}
        </div>
    );
};

export default BridgePurchaseOrder;
