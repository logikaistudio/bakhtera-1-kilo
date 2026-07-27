import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/Common/Button';
import Modal from '../../../components/Common/Modal';
import {
    FileText, Plus, Send, CheckCircle, XCircle, DollarSign,
    AlertCircle, Clock, Search, Trash, Edit, Eye, X, Package, Download, RefreshCw
} from 'lucide-react';

const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : '-';
const today = () => new Date().toISOString().split('T')[0];
const genNumber = () => `BRG-INV-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${String(Date.now()).slice(-5)}`;

const STATUS_CONFIG = {
    draft:          { label: 'Draft',         color: 'bg-gray-500/20 text-gray-400' },
    sent:           { label: 'Sent',          color: 'bg-blue-500/20 text-blue-400' },
    partially_paid: { label: 'Partial',       color: 'bg-yellow-500/20 text-yellow-400' },
    paid:           { label: 'Paid',          color: 'bg-green-500/20 text-green-400' },
    overdue:        { label: 'Overdue',       color: 'bg-red-500/20 text-red-400' },
    cancelled:      { label: 'Cancelled',     color: 'bg-gray-500/20 text-gray-400' },
};

const EMPTY_ITEM = { description: '', qty: 1, unit: 'Job', unit_price: 0, amount: 0, tax_rate: 0, tax_amount: 0, coa_id: null };

const PAYMENT_TERMS = ['NET 7', 'NET 14', 'NET 30', 'NET 45', 'NET 60', 'COD'];

const RecreateRateModal = ({ invoice, onClose, onSave }) => {
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [newRate, setNewRate] = useState('1');
    const [internalNote, setInternalNote] = useState('Penyesuaian kurs untuk invoice dengan pengajuan yang sama.');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(invoice, invoiceDate, newRate, internalNote);
        setSaving(false);
    };

    return (
        <Modal isOpen onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <div className="mb-5">
                    <h2 className="text-xl font-bold gradient-text">Recreate Invoice Dengan Kurs Baru</h2>
                    <p className="text-silver-dark text-sm mt-1">Source: {invoice.invoice_number} - {invoice.customer_name}</p>
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-silver-dark mb-1">Invoice Date (baru)</label>
                    <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-silver-dark mb-1">Kurs Baru</label>
                    <input
                        type="number"
                        min="0.000001"
                        step="any"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light"
                    />
                </div>

                <div className="mb-5">
                    <label className="block text-sm text-silver-dark mb-1">Internal Note</label>
                    <textarea
                        rows={3}
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light"
                        placeholder="Contoh: Kurs revisi sesuai tanggal invoice customer"
                    />
                </div>

                <div className="flex justify-end gap-3 border-t border-dark-border pt-4">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg smooth-transition font-semibold disabled:opacity-50"
                    >
                        {saving ? 'Creating...' : 'Create Recreate Kurs Draft'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ─── Item Row ────────────────────────────────────────────────────────────────
const ItemRow = ({ item, idx, coaList, canEdit, onChange, onRemove }) => {
    const handleChange = (field, val) => {
        const updated = { ...item, [field]: val };
        if (field === 'qty' || field === 'unit_price') {
            updated.amount = (parseFloat(updated.qty) || 0) * (parseFloat(updated.unit_price) || 0);
            updated.tax_amount = updated.amount * ((parseFloat(updated.tax_rate) || 0) / 100);
        }
        if (field === 'tax_rate') {
            updated.tax_amount = (parseFloat(updated.amount) || 0) * (parseFloat(val) / 100);
        }
        onChange(idx, updated);
    };

    return (
        <tr className="border-b border-dark-border/40 hover:bg-white/5">
            <td className="px-3 py-2">
                <input value={item.description} onChange={e => handleChange('description', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm border-b border-dark-border focus:outline-none" placeholder="Deskripsi item" />
            </td>
            <td className="px-3 py-2 w-20">
                <input type="number" value={item.qty} min="0" step="any"
                    onChange={e => handleChange('qty', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-20">
                <input value={item.unit} onChange={e => handleChange('unit', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-32">
                <input type="number" value={item.unit_price} min="0" step="any"
                    onChange={e => handleChange('unit_price', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-16">
                <input type="number" value={item.tax_rate} min="0" max="100" step="0.01"
                    onChange={e => handleChange('tax_rate', e.target.value)}
                    className="w-full bg-transparent text-silver-light text-sm text-right border-b border-dark-border focus:outline-none" />
            </td>
            <td className="px-3 py-2 w-36 text-right text-silver-light text-sm font-mono">
                {fmtIDR((parseFloat(item.amount) || 0) + (parseFloat(item.tax_amount) || 0))}
            </td>
            <td className="px-3 py-2 w-48">
                <select value={item.coa_id || ''} disabled={!canEdit}
                    onChange={e => handleChange('coa_id', e.target.value || null)}
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

// ─── Create / Edit Modal ─────────────────────────────────────────────────────
const InvoiceFormModal = ({ invoice, coaList, onClose, onSave }) => {
    const { canEdit } = useAuth();
    const isEdit = !!invoice;

    const [form, setForm] = useState({
        invoice_number: invoice?.invoice_number || genNumber(),
        invoice_date: invoice?.invoice_date || today(),
        due_date: invoice?.due_date || '',
        payment_terms: invoice?.payment_terms || 'NET 30',
        customer_name: invoice?.customer_name || '',
        customer_address: invoice?.customer_address || '',
        currency: invoice?.currency || 'IDR',
        notes: invoice?.notes || '',
        discount_amount: invoice?.discount_amount || 0,
        invoice_items: invoice?.invoice_items || [{ ...EMPTY_ITEM }],
    });
    const [saving, setSaving] = useState(false);

    const handleTermsChange = (terms) => {
        const days = parseInt(terms.replace('NET ', '')) || 0;
        const due = new Date(form.invoice_date);
        due.setDate(due.getDate() + days);
        setForm(p => ({ ...p, payment_terms: terms, due_date: due.toISOString().split('T')[0] }));
    };

    const updateItem = (idx, updated) => setForm(p => {
        const items = [...p.invoice_items];
        items[idx] = updated;
        return { ...p, invoice_items: items };
    });

    const removeItem = (idx) => setForm(p => ({
        ...p, invoice_items: p.invoice_items.filter((_, i) => i !== idx)
    }));

    const addItem = () => setForm(p => ({ ...p, invoice_items: [...p.invoice_items, { ...EMPTY_ITEM }] }));

    const subtotal = form.invoice_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const taxTotal = form.invoice_items.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0);
    const grandTotal = subtotal + taxTotal - (parseFloat(form.discount_amount) || 0);

    const handleSave = async (status = 'draft') => {
        if (!form.customer_name.trim()) return alert('Nama customer wajib diisi');
        if (form.invoice_items.length === 0) return alert('Tambah minimal 1 item');
        setSaving(true);
        try {
            const payload = {
                ...form,
                status,
                subtotal,
                tax_amount: taxTotal,
                grand_total: grandTotal,
                total_amount: grandTotal,
                paid_amount: invoice?.paid_amount || 0,
                outstanding_amount: grandTotal - (invoice?.paid_amount || 0),
            };
            if (isEdit) {
                const { error } = await supabase.from('big_invoices').update(payload).eq('id', invoice.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('big_invoices').insert([payload]);
                if (error) throw error;
            }
            onSave();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} maxWidth="max-w-6xl">
            <div className="p-6 space-y-6">
                <h2 className="text-2xl font-bold gradient-text">{isEdit ? 'Edit Invoice' : 'Buat Invoice Baru'}</h2>

                {/* Header fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Nomor Invoice</label>
                        <input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Tanggal Invoice *</label>
                        <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))}
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
                        <label className="block text-xs text-silver-dark mb-1">Nama Customer *</label>
                        <input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" placeholder="Nama customer / perusahaan" />
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
                        <label className="block text-xs text-silver-dark mb-1">Alamat Customer</label>
                        <input value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                </div>

                {/* Items */}
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0070BB]">
                        <span className="text-white font-semibold text-sm">Item Invoice</span>
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
                                    <th className="px-3 py-2 w-48">COA Big</th>
                                    <th className="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.invoice_items.map((item, idx) => (
                                    <ItemRow key={idx} item={item} idx={idx} coaList={coaList}
                                        canEdit={canEdit('big_finance')}
                                        onChange={updateItem} onRemove={removeItem} />
                                ))}
                                {form.invoice_items.length === 0 && (
                                    <tr><td colSpan={8} className="text-center py-6 text-silver-dark text-sm italic">Belum ada item — klik "+ Tambah Item"</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
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
                                    <span>Grand Total</span><span className="font-mono text-accent-orange">{fmtIDR(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
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
                    <Button onClick={() => handleSave('sent')} disabled={saving} icon={Send}>
                        {saving ? 'Mengirim...' : 'Simpan & Kirim'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const BigInvoiceManagement = () => {
    const { canCreate, canEdit, canDelete } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [coaList, setCoaList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editInvoice, setEditInvoice] = useState(null);
    const [showRecreateRateModal, setShowRecreateRateModal] = useState(false);
    const [recreateRateSourceInvoice, setRecreateRateSourceInvoice] = useState(null);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [{ data: inv }, { data: coa }] = await Promise.all([
                supabase.from('big_invoices').select('*').order('created_at', { ascending: false }),
                supabase.from('big_coa').select('id,code,name,type').eq('is_active', true).order('code')
            ]);
            setInvoices(inv || []);
            setCoaList(coa || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!canDelete('big_finance')) return alert('Tidak ada akses untuk menghapus.');
        if (!confirm('Hapus invoice ini?')) return;
        await supabase.from('big_invoices').delete().eq('id', id);
        fetchAll();
    };

    const handleCancel = async (id) => {
        if (!canEdit('big_finance')) return alert('Tidak ada akses.');
        await supabase.from('big_invoices').update({ status: 'cancelled' }).eq('id', id);
        fetchAll();
    };

    const handleCreateRecreateRate = async (invoice, newInvoiceDate, newExchangeRate, recreateNote) => {
        if (!canEdit('big_finance')) return alert('Tidak ada akses.');
        const rateParsed = Number(newExchangeRate);
        if (!newInvoiceDate) return alert('Tanggal invoice baru wajib diisi.');
        if (!Number.isFinite(rateParsed) || rateParsed <= 0) return alert('Kurs baru wajib angka lebih besar dari 0.');

        try {
            const timestamp = new Date().toISOString();
            const sourceInvoiceNumber = String(invoice.invoice_number || '').trim();
            const recreateBase = sourceInvoiceNumber.replace(/[-_]?FX\d+$/i, '');
            const escapedBase = recreateBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const { data: existingRows, error: existingErr } = await supabase
                .from('big_invoices')
                .select('invoice_number')
                .like('invoice_number', `${recreateBase}-FX%`);
            if (existingErr) throw existingErr;

            let maxFxVersion = 0;
            (existingRows || []).forEach(row => {
                const invoiceNo = String(row.invoice_number || '');
                const match = invoiceNo.match(new RegExp(`^${escapedBase}-FX(\\d+)$`, 'i'));
                if (!match) return;
                const parsed = parseInt(match[1], 10);
                if (!Number.isNaN(parsed) && parsed > maxFxVersion) maxFxVersion = parsed;
            });

            const recreatedInvoiceNumber = `${recreateBase}-FX${maxFxVersion + 1}`;

            const payload = {
                invoice_number: recreatedInvoiceNumber,
                invoice_date: newInvoiceDate,
                due_date: invoice.due_date || null,
                payment_terms: invoice.payment_terms || 'NET 30',
                customer_name: invoice.customer_name || null,
                customer_address: invoice.customer_address || null,
                customer_id: invoice.customer_id || null,
                currency: invoice.currency || 'IDR',
                invoice_items: invoice.invoice_items || [],
                subtotal: Number(invoice.subtotal) || 0,
                tax_amount: Number(invoice.tax_amount) || 0,
                discount_amount: Number(invoice.discount_amount) || 0,
                grand_total: Number(invoice.grand_total ?? invoice.total_amount) || 0,
                total_amount: Number(invoice.total_amount ?? invoice.grand_total) || 0,
                paid_amount: 0,
                outstanding_amount: Number(invoice.total_amount ?? invoice.grand_total) || 0,
                status: 'draft',
                notes: `[RECREATE KURS ${timestamp.slice(0, 10)}] Source: ${invoice.invoice_number}. Kurs baru: ${rateParsed}. ${recreateNote || ''}`,
                created_at: timestamp,
                updated_at: timestamp,
            };

            const { data: insertedData, error: insertError } = await supabase
                .from('big_invoices')
                .insert([payload])
                .select();
            if (insertError) throw insertError;

            await supabase
                .from('big_invoices')
                .update({
                    notes: `${invoice.notes || ''}\n[RECREATE KURS CREATED ${timestamp.slice(0, 10)}] Draft ${recreatedInvoiceNumber} dibuat dari ${invoice.invoice_number}. Kurs baru: ${rateParsed}.`.trim(),
                    updated_at: timestamp,
                })
                .eq('id', invoice.id);

            setShowRecreateRateModal(false);
            setRecreateRateSourceInvoice(null);
            await fetchAll();

            const created = insertedData?.[0];
            alert(
                `✅ Recreate kurs draft berhasil dibuat.\n\n` +
                `Source Invoice: ${invoice.invoice_number}\n` +
                `New Draft ID: ${created?.id || '-'}\n` +
                `Invoice Number: ${created?.invoice_number || '-'}\n` +
                `Kurs Baru: ${rateParsed}\n` +
                `Invoice Date: ${newInvoiceDate}`
            );
        } catch (error) {
            console.error('Error creating recreate-rate invoice (Big):', error);
            alert('Failed to recreate invoice with new exchange rate: ' + error.message);
        }
    };

    const filtered = invoices.filter(inv => {
        const matchSearch = !searchTerm ||
            inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const totalInvoiced = filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.grand_total || i.total_amount || 0), 0);
    const totalPaid = filtered.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const totalOutstanding = filtered.filter(i => i.status !== 'cancelled' && i.status !== 'paid').reduce((s, i) => s + (i.outstanding_amount || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <FileText className="w-8 h-8" /> Invoice Big
                    </h1>
                    <p className="text-silver-dark mt-1">Kelola invoice tagihan Big module</p>
                </div>
                {canCreate('big_finance') && (
                    <Button icon={Plus} onClick={() => { setEditInvoice(null); setShowForm(true); }}>
                        Buat Invoice
                    </Button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Ditagihkan', value: fmtIDR(totalInvoiced), color: 'text-blue-400', icon: FileText },
                    { label: 'Total Terbayar', value: fmtIDR(totalPaid), color: 'text-green-400', icon: CheckCircle },
                    { label: 'Sisa Tagihan', value: fmtIDR(totalOutstanding), color: 'text-yellow-400', icon: AlertCircle },
                ].map(c => (
                    <div key={c.label} className="glass-card p-5 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-silver-dark text-sm">{c.label}</p>
                                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                            </div>
                            <c.icon className={`w-8 h-8 ${c.color} opacity-60`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Cari nomor invoice atau customer..."
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
                                    <th className="px-4 py-3 text-left">No Invoice</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Tgl Invoice</th>
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
                                    <tr><td colSpan={9} className="text-center py-10 text-silver-dark italic">Tidak ada data invoice</td></tr>
                                ) : filtered.map(inv => {
                                    const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status === 'sent';
                                    return (
                                        <tr key={inv.id} className="hover:bg-white/5 smooth-transition">
                                            <td className="px-4 py-3 font-mono text-accent-orange text-xs">{inv.invoice_number}</td>
                                            <td className="px-4 py-3 text-silver-light font-medium">{inv.customer_name}</td>
                                            <td className="px-4 py-3 text-silver-dark">{inv.invoice_date}</td>
                                            <td className={`px-4 py-3 ${isOverdue ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>{inv.due_date || '-'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-silver-light">{fmtIDR(inv.grand_total || inv.total_amount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-green-400">{fmtIDR(inv.paid_amount || 0)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-yellow-400">{fmtIDR(inv.outstanding_amount || 0)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {canEdit('big_finance') && inv.status === 'draft' && (
                                                        <button onClick={() => { setEditInvoice(inv); setShowForm(true); }}
                                                            className="text-blue-400 hover:text-blue-300 p-1" title="Edit">
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canEdit('big_finance') && inv.status !== 'cancelled' && (
                                                        <button onClick={() => { setRecreateRateSourceInvoice(inv); setShowRecreateRateModal(true); }}
                                                            className="text-cyan-400 hover:text-cyan-300 p-1" title="Recreate Kurs">
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDelete('big_finance') && inv.status === 'draft' && (
                                                        <button onClick={() => handleDelete(inv.id)}
                                                            className="text-red-400 hover:text-red-300 p-1" title="Hapus">
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canEdit('big_finance') && (inv.status === 'sent' || inv.status === 'partially_paid') && (
                                                        <button onClick={() => handleCancel(inv.id)}
                                                            className="text-gray-400 hover:text-gray-300 p-1" title="Cancel">
                                                            <XCircle className="w-4 h-4" />
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

            {/* Form Modal */}
            {showForm && (
                <InvoiceFormModal
                    invoice={editInvoice}
                    coaList={coaList}
                    onClose={() => { setShowForm(false); setEditInvoice(null); }}
                    onSave={() => { setShowForm(false); setEditInvoice(null); fetchAll(); }}
                />
            )}

            {showRecreateRateModal && recreateRateSourceInvoice && (
                <RecreateRateModal
                    invoice={recreateRateSourceInvoice}
                    onClose={() => {
                        setShowRecreateRateModal(false);
                        setRecreateRateSourceInvoice(null);
                    }}
                    onSave={handleCreateRecreateRate}
                />
            )}
        </div>
    );
};

export default BigInvoiceManagement;
