import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/Common/Button';
import Modal from '../../../components/Common/Modal';
import {
    DollarSign, TrendingUp, AlertTriangle, Clock, Search,
    Download, CheckCircle, AlertCircle, CreditCard, History, X
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
    return new Date() > new Date(due) ? 'overdue' : 'current';
};

const STATUS_STYLE = {
    paid:    'bg-green-500/20 text-green-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
    overdue: 'bg-red-500/20 text-red-400',
    current: 'bg-blue-500/20 text-blue-400',
};

// ─── Payment Modal ────────────────────────────────────────────────────────────
const PaymentModal = ({ ar, onClose, onSuccess }) => {
    const [form, setForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: ar.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        ar_coa_id: '',
        notes: '',
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [arAccounts, setArAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        const load = async () => {
            const [{ data: banks }, { data: coa }] = await Promise.all([
                supabase.from('company_bank_accounts').select('*').order('display_order'),
                supabase.from('big_coa').select('*').eq('type', 'ASSET').eq('is_active', true).order('code'),
            ]);
            setBankAccounts(banks || []);
            const arCoa = (coa || []).filter(c => c.name?.toLowerCase().includes('piutang') || c.code?.startsWith('1-0'));
            setArAccounts(arCoa.length ? arCoa : (coa || []).slice(0, 10));
            if (banks?.length) setForm(p => ({ ...p, paid_from_account: banks[0].id }));
            if (arCoa.length) setForm(p => ({ ...p, ar_coa_id: arCoa[0].id }));
        };
        load();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.amount <= 0) return alert('Jumlah pembayaran harus lebih dari 0');
        if (form.amount > ar.outstanding_amount) return alert('Melebihi saldo outstanding');
        setLoading(true);
        try {
            const payNum = `BRG-AR-PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            const newPaid = (ar.paid_amount || 0) + parseFloat(form.amount);
            const newOut = ar.original_amount - newPaid;
            const newStatus = newOut <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'current';

            await supabase.from('big_ar_transactions').update({
                paid_amount: newPaid,
                outstanding_amount: Math.max(0, newOut),
                status: newStatus,
                last_payment_date: form.payment_date,
            }).eq('id', ar.id);

            await supabase.from('big_payments').insert([{
                payment_number: payNum,
                payment_type: 'incoming',
                payment_date: form.payment_date,
                reference_type: 'ar',
                reference_id: ar.id,
                reference_number: ar.ar_number,
                amount: parseFloat(form.amount),
                currency: ar.currency || 'IDR',
                payment_method: form.payment_method,
                transaction_ref: form.reference_number || null,
                notes: form.notes || null,
                status: 'completed',
            }]);

            if (ar.invoice_id) {
                await supabase.from('big_invoices').update({
                    paid_amount: newPaid,
                    outstanding_amount: Math.max(0, newOut),
                    status: newStatus === 'paid' ? 'paid' : newStatus === 'partial' ? 'partially_paid' : 'sent',
                }).eq('id', ar.invoice_id);
            }

            setSuccess({ payNum, amount: parseFloat(form.amount), newOut, newStatus, currency: ar.currency });
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
                        <span className="text-silver-dark">Sisa Tagihan:</span>
                        <span className={`font-bold ${success.newOut <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
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
                <h2 className="text-2xl font-bold gradient-text mb-6">Catat Pembayaran AR</h2>
                <div className="glass-card p-4 rounded-lg mb-6 bg-green-500/5 border border-green-500/20">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-silver-dark">AR Number:</span><span className="text-silver-light ml-2 font-medium">{ar.ar_number}</span></div>
                        <div><span className="text-silver-dark">Customer:</span><span className="text-silver-light ml-2 font-medium">{ar.customer_name}</span></div>
                        <div><span className="text-silver-dark">Total:</span><span className="text-silver-light ml-2">{fmtIDR(ar.original_amount, ar.currency)}</span></div>
                        <div><span className="text-silver-dark">Outstanding:</span><span className="text-green-400 ml-2 font-bold">{fmtIDR(ar.outstanding_amount, ar.currency)}</span></div>
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
                            <input type="number" required min="0" max={ar.outstanding_amount} step="0.01"
                                value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full" />
                            <p className="text-xs text-silver-dark mt-1">Max: {fmtIDR(ar.outstanding_amount, ar.currency)}</p>
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
                            <CreditCard className="w-4 h-4 inline mr-1" />Akun Diterima (COA Big)
                        </label>
                        <select value={form.ar_coa_id} onChange={e => setForm(p => ({ ...p, ar_coa_id: e.target.value }))} className="w-full">
                            <option value="">— Pilih COA Piutang —</option>
                            {arAccounts.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                        </select>
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
const BigAccountsReceivable = () => {
    const { canEdit } = useAuth();
    const [arList, setArList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAR, setSelectedAR] = useState(null);
    const [showPayment, setShowPayment] = useState(false);

    useEffect(() => { fetchAR(); }, []);

    const fetchAR = async () => {
        setLoading(true);
        try {
            const { data: arRows, error } = await supabase
                .from('big_ar_transactions')
                .select('*')
                .order('transaction_date', { ascending: false });

            let rows = [];
            if (!error && arRows?.length > 0) {
                rows = arRows;
            } else {
                const { data: invRows } = await supabase
                    .from('big_invoices')
                    .select('*')
                    .neq('status', 'draft')
                    .neq('status', 'cancelled')
                    .order('invoice_date', { ascending: false });

                rows = (invRows || []).map(inv => ({
                    id: inv.id,
                    invoice_id: inv.id,
                    ar_number: `BRG-AR-${(inv.invoice_number || inv.id.slice(0,8)).toUpperCase()}`,
                    invoice_number: inv.invoice_number,
                    customer_name: inv.customer_name || 'Unknown',
                    transaction_date: inv.invoice_date,
                    due_date: inv.due_date || inv.invoice_date,
                    original_amount: inv.grand_total || inv.total_amount || 0,
                    paid_amount: inv.paid_amount || 0,
                    outstanding_amount: Math.max(0, (inv.grand_total || 0) - (inv.paid_amount || 0)),
                    currency: inv.currency || 'IDR',
                    status: inv.status,
                }));
            }

            setArList(rows.map(ar => ({
                ...ar,
                aging_bucket: calcAging(ar.due_date),
                status: ar.status || deriveStatus(ar.paid_amount || 0, ar.original_amount || 0, ar.due_date),
            })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalAR = arList.reduce((s, a) => s + (a.original_amount || 0), 0);
    const totalPaid = arList.reduce((s, a) => s + (a.paid_amount || 0), 0);
    const totalOut = arList.reduce((s, a) => s + (a.outstanding_amount || 0), 0);
    const overdueTotal = arList.filter(a => a.status === 'overdue').reduce((s, a) => s + a.outstanding_amount, 0);

    const aging = {
        '0-30': arList.filter(a => a.aging_bucket === '0-30').reduce((s, a) => s + a.outstanding_amount, 0),
        '31-60': arList.filter(a => a.aging_bucket === '31-60').reduce((s, a) => s + a.outstanding_amount, 0),
        '61-90': arList.filter(a => a.aging_bucket === '61-90').reduce((s, a) => s + a.outstanding_amount, 0),
        '90+': arList.filter(a => a.aging_bucket === '90+').reduce((s, a) => s + a.outstanding_amount, 0),
    };

    const filtered = arList.filter(a =>
        !searchTerm ||
        a.ar_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExport = () => {
        import('../../../utils/exportXLS').then(({ exportToXLS }) => {
            exportToXLS({
                filename: `big_ar_${new Date().toISOString().split('T')[0]}`,
                sheetName: 'Big AR',
                columns: [
                    { header: 'AR Number', key: 'ar_number', width: 22 },
                    { header: 'Invoice #', key: 'invoice_number', width: 22 },
                    { header: 'Customer', key: 'customer_name', width: 28 },
                    { header: 'Date', key: 'transaction_date', width: 14 },
                    { header: 'Due Date', key: 'due_date', width: 14 },
                    { header: 'Total', key: 'original_amount', width: 20, render: r => fmtIDR(r.original_amount, r.currency) },
                    { header: 'Paid', key: 'paid_amount', width: 20, render: r => fmtIDR(r.paid_amount, r.currency) },
                    { header: 'Outstanding', key: 'outstanding_amount', width: 20, render: r => fmtIDR(r.outstanding_amount, r.currency) },
                    { header: 'Aging', key: 'aging_bucket', width: 10 },
                    { header: 'Status', key: 'status', width: 14 },
                ],
                data: filtered.map((r, i) => ({ ...r, no: i + 1 })),
            });
        }).catch(() => {
            const csv = ['AR Number,Invoice,Customer,Date,Due Date,Total,Paid,Outstanding,Aging,Status',
                ...filtered.map(r => `${r.ar_number},${r.invoice_number || ''},${r.customer_name},${r.transaction_date},${r.due_date || ''},${r.original_amount},${r.paid_amount || 0},${r.outstanding_amount || 0},${r.aging_bucket},${r.status}`)
            ].join('\n');
            const a = document.createElement('a');
            a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
            a.download = `big_ar_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <TrendingUp className="w-8 h-8" /> Accounts Receivable — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Monitoring piutang Big module</p>
                </div>
                <Button variant="secondary" icon={Download} onClick={handleExport}>Export XLS</Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total AR', value: fmtIDR(totalAR), color: 'text-blue-400' },
                    { label: 'Terbayar', value: fmtIDR(totalPaid), color: 'text-green-400' },
                    { label: 'Outstanding', value: fmtIDR(totalOut), color: 'text-yellow-400' },
                    { label: 'Overdue', value: fmtIDR(overdueTotal), color: 'text-red-400' },
                ].map(c => (
                    <div key={c.label} className="glass-card p-5 rounded-xl">
                        <p className="text-silver-dark text-xs uppercase tracking-wider">{c.label}</p>
                        <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Aging Analysis */}
            <div className="glass-card p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-silver-light uppercase tracking-wider mb-4">Aging Analysis (Outstanding)</h3>
                <div className="grid grid-cols-4 gap-4">
                    {Object.entries(aging).map(([bucket, val]) => (
                        <div key={bucket} className="text-center">
                            <p className="text-xs text-silver-dark mb-1">{bucket} days</p>
                            <p className="text-lg font-bold text-silver-light">{fmtIDR(val)}</p>
                            <div className="w-full bg-dark-border rounded-full h-1.5 mt-2">
                                <div className="bg-accent-orange h-1.5 rounded-full"
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
                        placeholder="Cari AR Number, Invoice, Customer..."
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-silver-dark">Memuat data AR...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0070BB] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">AR Number</th>
                                    <th className="px-4 py-3 text-left">Invoice #</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
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
                                    <tr><td colSpan={11} className="text-center py-10 text-silver-dark italic">Tidak ada data AR</td></tr>
                                ) : filtered.map(ar => (
                                    <tr key={ar.id} className="hover:bg-white/5 smooth-transition">
                                        <td className="px-4 py-3 font-mono text-accent-orange text-xs">{ar.ar_number}</td>
                                        <td className="px-4 py-3 text-silver-dark text-xs">{ar.invoice_number || '-'}</td>
                                        <td className="px-4 py-3 text-silver-light font-medium">{ar.customer_name}</td>
                                        <td className="px-4 py-3 text-silver-dark">{ar.transaction_date}</td>
                                        <td className={`px-4 py-3 ${ar.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                            {ar.due_date || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-silver-light">{fmtIDR(ar.original_amount, ar.currency)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">{fmtIDR(ar.paid_amount || 0, ar.currency)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-yellow-400">{fmtIDR(ar.outstanding_amount || 0, ar.currency)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                ar.aging_bucket === '90+' ? 'bg-red-500/20 text-red-400' :
                                                ar.aging_bucket === '61-90' ? 'bg-orange-500/20 text-orange-400' :
                                                ar.aging_bucket === '31-60' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>{ar.aging_bucket}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[ar.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                                {ar.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {ar.outstanding_amount > 0 && canEdit('big_finance') && (
                                                <Button size="sm" variant="ghost" icon={DollarSign}
                                                    onClick={() => { setSelectedAR(ar); setShowPayment(true); }}>
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

            {showPayment && selectedAR && (
                <PaymentModal ar={selectedAR} onClose={() => { setShowPayment(false); setSelectedAR(null); }}
                    onSuccess={() => { setShowPayment(false); setSelectedAR(null); fetchAR(); }} />
            )}
        </div>
    );
};

export default BigAccountsReceivable;