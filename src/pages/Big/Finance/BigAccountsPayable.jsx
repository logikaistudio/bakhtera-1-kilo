import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    TrendingDown, DollarSign, AlertCircle, Search,
    Download, CheckCircle, CreditCard, Clock
} from 'lucide-react';

const fmtIDR = (v, cur = 'IDR') => {
    if (v == null) return '-';
    return cur === 'USD' ? `$${Number(v).toLocaleString('id-ID')}` : `Rp ${Number(v).toLocaleString('id-ID')}`;
};

const calcAging = (dueDate) => {
    const days = Math.floor((new Date() - new Date(dueDate)) / 86400000);
    if (days < 0) return '0-30';
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
};

const deriveStatus = (paid, total, due) => {
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return new Date() > new Date(due) ? 'overdue' : 'outstanding';
};

const STATUS_STYLE = {
    paid:        'bg-green-500/20 text-green-400',
    partial:     'bg-yellow-500/20 text-yellow-400',
    overdue:     'bg-red-500/20 text-red-400',
    outstanding: 'bg-blue-500/20 text-blue-400',
};

// ─── AP Payment Modal ─────────────────────────────────────────────────────────
const APPaymentModal = ({ ap, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: ap.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        ap_coa_id: '',
        notes: '',
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [apAccounts, setApAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        const load = async () => {
            const [{ data: banks }, { data: coa }] = await Promise.all([
                supabase.from('company_bank_accounts').select('*').order('display_order'),
                supabase.from('big_coa').select('*').eq('type', 'LIABILITY').eq('is_active', true).order('code'),
            ]);
            setBankAccounts(banks || []);
            const apCoa = (coa || []).filter(c => c.name?.toLowerCase().includes('hutang') || c.code?.startsWith('2-0'));
            setApAccounts(apCoa.length ? apCoa : (coa || []).slice(0, 10));
            if (banks?.length) setForm(p => ({ ...p, paid_from_account: banks[0].id }));
            if (apCoa.length) setForm(p => ({ ...p, ap_coa_id: apCoa[0].id }));
        };
        load();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.amount <= 0) return alert('Jumlah pembayaran harus lebih dari 0');
        if (form.amount > ap.outstanding_amount) return alert('Melebihi saldo outstanding');
        setLoading(true);
        try {
            const payNum = `BRG-AP-PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            const newPaid = (ap.paid_amount || 0) + parseFloat(form.amount);
            const newOut = ap.original_amount - newPaid;
            const newStatus = newOut <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'outstanding';

            await supabase.from('big_ap_transactions').update({
                paid_amount: newPaid,
                outstanding_amount: Math.max(0, newOut),
                status: newStatus,
                last_payment_date: form.payment_date,
            }).eq('id', ap.id);

            await supabase.from('big_payments').insert([{
                payment_number: payNum,
                payment_type: 'outgoing',
                payment_date: form.payment_date,
                reference_type: 'ap',
                reference_id: ap.id,
                reference_number: ap.ap_number,
                amount: parseFloat(form.amount),
                currency: ap.currency || 'IDR',
                payment_method: form.payment_method,
                transaction_ref: form.reference_number || null,
                notes: form.notes || null,
                status: 'completed',
            }]);

            if (ap.po_id) {
                await supabase.from('big_pos').update({
                    paid_amount: newPaid,
                    outstanding_amount: Math.max(0, newOut),
                    status: newOut <= 0 ? 'paid' : 'approved',
                }).eq('id', ap.po_id);
            }

            setSuccess({ payNum, amount: parseFloat(form.amount), newOut, newStatus, currency: ap.currency });
        } catch (err) {
            alert('Error: ' + err.message);
        } finally { setLoading(false); }
    };

    if (success) return (
        <Modal isOpen onClose={() => onSuccess()} maxWidth="max-w-lg">
            <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-green-500 mb-2">Pembayaran Berhasil!</h2>
                <div className="glass-card p-4 rounded-lg mb-6 text-left space-y-3 bg-green-500/5 border border-green-500/20">
                    <div className="flex justify-between text-sm">
                        <span className="text-silver-dark">No. Pembayaran:</span>
                        <span className="text-silver-light font-mono">{success.payNum}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-silver-dark">Jumlah:</span>
                        <span className="text-green-400 font-bold">{fmtIDR(success.amount, success.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-silver-dark">Sisa Hutang:</span>
                        <span className={`font-bold ${success.newOut <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmtIDR(Math.max(0, success.newOut), success.currency)}
                        </span>
                    </div>
                </div>
                <Button onClick={() => onSuccess()} className="w-full">Tutup</Button>
            </div>
        </Modal>
    );

    return (
        <Modal isOpen onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">Catat Pembayaran AP</h2>
                <div className="glass-card p-4 rounded-lg mb-6 bg-red-500/5 border border-red-500/20">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-silver-dark">AP Number:</span><span className="text-silver-light ml-2 font-medium">{ap.ap_number}</span></div>
                        <div><span className="text-silver-dark">Vendor:</span><span className="text-silver-light ml-2 font-medium">{ap.vendor_name}</span></div>
                        <div><span className="text-silver-dark">Total:</span><span className="text-silver-light ml-2">{fmtIDR(ap.original_amount, ap.currency)}</span></div>
                        <div><span className="text-silver-dark">Outstanding:</span><span className="text-red-400 ml-2 font-bold">{fmtIDR(ap.outstanding_amount, ap.currency)}</span></div>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">Tanggal Bayar *</label>
                            <input type="date" required value={form.payment_date}
                                onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} className="w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">Jumlah *</label>
                            <input type="number" required min="0" max={ap.outstanding_amount} step="0.01"
                                value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full" />
                            <p className="text-xs text-silver-dark mt-1">Max: {fmtIDR(ap.outstanding_amount, ap.currency)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">Metode Bayar *</label>
                            <select required value={form.payment_method}
                                onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full">
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cash">Cash</option>
                                <option value="check">Cek / Giro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">No. Referensi</label>
                            <input type="text" value={form.reference_number}
                                onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                                placeholder="Ref transfer / no. cek" className="w-full" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            <CreditCard className="w-4 h-4 inline mr-1" />Akun Hutang (COA Big)
                        </label>
                        <select value={form.ap_coa_id} onChange={e => setForm(p => ({ ...p, ap_coa_id: e.target.value }))} className="w-full">
                            <option value="">— Pilih COA Hutang —</option>
                            {apAccounts.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                        </select>
                        <p className="text-xs text-silver-dark mt-1">Dicatat di General Ledger sebagai pengurang hutang.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">Catatan</label>
                        <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            className="w-full" placeholder="Catatan opsional..." />
                    </div>
                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
                        <Button type="submit" disabled={loading} icon={DollarSign}>
                            {loading ? 'Memproses...' : 'Catat Pembayaran'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const BigAccountsPayable = () => {
    const { canEdit } = useAuth();
    const [apList, setApList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAP, setSelectedAP] = useState(null);
    const [showPayment, setShowPayment] = useState(false);

    useEffect(() => { fetchAP(); }, []);

    const fetchAP = async () => {
        setLoading(true);
        try {
            const { data: apRows, error } = await supabase
                .from('big_ap_transactions')
                .select('*')
                .order('transaction_date', { ascending: false });

            let rows = [];
            if (!error && apRows?.length > 0) {
                rows = apRows;
            } else {
                const { data: poRows } = await supabase
                    .from('big_pos')
                    .select('*')
                    .in('status', ['approved', 'paid'])
                    .order('po_date', { ascending: false });

                rows = (poRows || []).map(po => ({
                    id: po.id,
                    po_id: po.id,
                    ap_number: `BRG-AP-${(po.po_number || po.id.slice(0,8)).toUpperCase()}`,
                    po_number: po.po_number,
                    vendor_name: po.vendor_name || 'Unknown',
                    transaction_date: po.po_date,
                    due_date: po.due_date || po.po_date,
                    original_amount: po.grand_total || 0,
                    paid_amount: po.paid_amount || 0,
                    outstanding_amount: Math.max(0, (po.grand_total || 0) - (po.paid_amount || 0)),
                    currency: po.currency || 'IDR',
                    status: po.status,
                    source: 'po_fallback',
                }));
            }

            setApList(rows.map(ap => ({
                ...ap,
                aging_bucket: calcAging(ap.due_date),
                status: ap.status || deriveStatus(ap.paid_amount || 0, ap.original_amount || 0, ap.due_date),
            })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalAP = apList.reduce((s, a) => s + (a.original_amount || 0), 0);
    const totalPaid = apList.reduce((s, a) => s + (a.paid_amount || 0), 0);
    const totalOut = apList.reduce((s, a) => s + (a.outstanding_amount || 0), 0);
    const overdueTotal = apList.filter(a => a.status === 'overdue').reduce((s, a) => s + a.outstanding_amount, 0);

    const aging = {
        '0-30': apList.filter(a => a.aging_bucket === '0-30').reduce((s, a) => s + a.outstanding_amount, 0),
        '31-60': apList.filter(a => a.aging_bucket === '31-60').reduce((s, a) => s + a.outstanding_amount, 0),
        '61-90': apList.filter(a => a.aging_bucket === '61-90').reduce((s, a) => s + a.outstanding_amount, 0),
        '90+': apList.filter(a => a.aging_bucket === '90+').reduce((s, a) => s + a.outstanding_amount, 0),
    };

    const filtered = apList.filter(a =>
        !searchTerm ||
        a.ap_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <TrendingDown className="w-8 h-8" /> Accounts Payable — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Monitoring hutang usaha Big module</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total AP', value: fmtIDR(totalAP), color: 'text-blue-400' },
                    { label: 'Terbayar', value: fmtIDR(totalPaid), color: 'text-green-400' },
                    { label: 'Outstanding', value: fmtIDR(totalOut), color: 'text-red-400' },
                    { label: 'Overdue', value: fmtIDR(overdueTotal), color: 'text-orange-400' },
                ].map(c => (
                    <div key={c.label} className="glass-card p-5 rounded-xl">
                        <p className="text-silver-dark text-xs uppercase tracking-wider">{c.label}</p>
                        <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Aging */}
            <div className="glass-card p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-silver-light uppercase tracking-wider mb-4">Aging Analysis (Outstanding)</h3>
                <div className="grid grid-cols-4 gap-4">
                    {Object.entries(aging).map(([bucket, val]) => (
                        <div key={bucket} className="text-center">
                            <p className="text-xs text-silver-dark mb-1">{bucket} days</p>
                            <p className="text-lg font-bold text-silver-light">{fmtIDR(val)}</p>
                            <div className="w-full bg-dark-border rounded-full h-1.5 mt-2">
                                <div className="bg-red-500 h-1.5 rounded-full"
                                    style={{ width: totalOut > 0 ? `${Math.min(100, (val / totalOut) * 100)}%` : '0%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="glass-card p-4 rounded-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Cari AP Number, PO, Vendor..."
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-silver-dark">Memuat data AP...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0070BB] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">AP Number</th>
                                    <th className="px-4 py-3 text-left">PO #</th>
                                    <th className="px-4 py-3 text-left">Vendor</th>
                                    <th className="px-4 py-3 text-left">Tgl Transaksi</th>
                                    <th className="px-4 py-3 text-left">Jatuh Tempo</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Terbayar</th>
                                    <th className="px-4 py-3 text-right">Outstanding</th>
                                    <th className="px-4 py-3 text-center">Aging</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/40">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={11} className="text-center py-10 text-silver-dark italic">Tidak ada data AP</td></tr>
                                ) : filtered.map(ap => (
                                    <tr key={ap.id} className="hover:bg-white/5 smooth-transition">
                                        <td className="px-4 py-3 font-mono text-accent-orange text-xs">{ap.ap_number}</td>
                                        <td className="px-4 py-3 text-silver-dark text-xs">{ap.po_number || '-'}</td>
                                        <td className="px-4 py-3 text-silver-light font-medium">{ap.vendor_name}</td>
                                        <td className="px-4 py-3 text-silver-dark">{ap.transaction_date}</td>
                                        <td className={`px-4 py-3 ${ap.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                            {ap.due_date || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-silver-light">{fmtIDR(ap.original_amount, ap.currency)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">{fmtIDR(ap.paid_amount || 0, ap.currency)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-400">{fmtIDR(ap.outstanding_amount || 0, ap.currency)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                ap.aging_bucket === '90+' ? 'bg-red-500/20 text-red-400' :
                                                ap.aging_bucket === '61-90' ? 'bg-orange-500/20 text-orange-400' :
                                                ap.aging_bucket === '31-60' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>{ap.aging_bucket}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[ap.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                                {ap.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {ap.outstanding_amount > 0 && canEdit('big_finance') && ap.source !== 'po_fallback' && (
                                                <Button size="sm" variant="ghost" icon={DollarSign}
                                                    onClick={() => { setSelectedAP(ap); setShowPayment(true); }}>
                                                    Bayar
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showPayment && selectedAP && (
                <APPaymentModal ap={selectedAP} onClose={() => { setShowPayment(false); setSelectedAP(null); }}
                    onSuccess={() => { setShowPayment(false); setSelectedAP(null); fetchAP(); }} />
            )}
        </div>
    );
};

export default BigAccountsPayable;