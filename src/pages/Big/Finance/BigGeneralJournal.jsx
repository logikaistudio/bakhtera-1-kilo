import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/Common/Button';
import Modal from '../../../components/Common/Modal';
import { BookOpen, Plus, Trash, RefreshCw, CheckCircle, X } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';

const EntryFormModal = ({ coaList, onClose, onSave }) => {
    const [form, setForm] = useState({
        entry_date: today(),
        description: '',
        reference_number: '',
        lines: [
            { coa_id: '', description: '', debit: 0, credit: 0 },
            { coa_id: '', description: '', debit: 0, credit: 0 },
        ],
    });
    const [saving, setSaving] = useState(false);

    const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const updateLine = (idx, field, val) => {
        const lines = [...form.lines];
        lines[idx] = { ...lines[idx], [field]: val };
        setForm(p => ({ ...p, lines }));
    };

    const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { coa_id: '', description: '', debit: 0, credit: 0 }] }));
    const removeLine = (idx) => { if (form.lines.length > 2) setForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) })); };

    const handleSave = async () => {
        if (!form.description.trim()) return alert('Deskripsi wajib diisi');
        if (!isBalanced) return alert('Jumlah Debit dan Kredit harus seimbang!');
        if (form.lines.some(l => !l.coa_id)) return alert('Semua baris harus memiliki COA');
        setSaving(true);
        try {
            const { data: entry, error: entryErr } = await supabase
                .from('big_journal_entries')
                .insert([{
                    entry_date: form.entry_date,
                    description: form.description,
                    reference_type: 'manual',
                    reference_number: form.reference_number || null,
                    total_debit: totalDebit,
                    total_credit: totalCredit,
                    entry_type: 'manual',
                    status: 'posted',
                }])
                .select()
                .single();
            if (entryErr) throw entryErr;

            const lineItems = form.lines.map(l => ({
                journal_entry_id: entry.id,
                coa_id: l.coa_id,
                description: l.description || form.description,
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
            }));
            const { error: lineErr } = await supabase.from('big_journal_line_items').insert(lineItems);
            if (lineErr) throw lineErr;
            onSave();
        } catch (err) { alert('Error: ' + err.message); }
        finally { setSaving(false); }
    };

    return (
        <Modal isOpen onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6 space-y-5">
                <h2 className="text-2xl font-bold gradient-text">Tambah Jurnal Manual</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-silver-dark mb-1">Tanggal *</label>
                        <input type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-silver-dark mb-1">Deskripsi *</label>
                        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" placeholder="Keterangan jurnal" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-silver-dark mb-1">No. Referensi</label>
                    <input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                        className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-silver-light text-sm" placeholder="Opsional" />
                </div>

                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#0070BB]">
                        <span className="text-white font-semibold text-sm">Baris Jurnal</span>
                        <button onClick={addLine} className="text-white text-xs flex items-center gap-1 hover:text-yellow-300">
                            <Plus className="w-4 h-4" /> Tambah Baris
                        </button>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-dark-surface/60 text-silver-dark text-xs uppercase">
                            <tr>
                                <th className="px-3 py-2 text-left">COA Big *</th>
                                <th className="px-3 py-2 text-left">Keterangan</th>
                                <th className="px-3 py-2 text-right w-36">Debit</th>
                                <th className="px-3 py-2 text-right w-36">Kredit</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {form.lines.map((line, idx) => (
                                <tr key={idx} className="border-b border-dark-border/40">
                                    <td className="px-3 py-2">
                                        <select value={line.coa_id} onChange={e => updateLine(idx, 'coa_id', e.target.value)}
                                            className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1.5 text-silver-light text-xs">
                                            <option value="">— Pilih COA —</option>
                                            {coaList.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                                            className="w-full bg-transparent border-b border-dark-border text-silver-light text-sm focus:outline-none" />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" value={line.debit} min="0" step="any"
                                            onChange={e => updateLine(idx, 'debit', e.target.value)}
                                            className="w-full bg-transparent border-b border-dark-border text-silver-light text-sm text-right focus:outline-none" />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" value={line.credit} min="0" step="any"
                                            onChange={e => updateLine(idx, 'credit', e.target.value)}
                                            className="w-full bg-transparent border-b border-dark-border text-silver-light text-sm text-right focus:outline-none" />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {form.lines.length > 2 && (
                                            <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className={`text-sm font-bold ${isBalanced ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <tr>
                                <td colSpan={2} className="px-3 py-3 text-right text-silver-light">TOTAL</td>
                                <td className="px-3 py-3 text-right text-blue-400 font-mono">{fmtIDR(totalDebit)}</td>
                                <td className="px-3 py-3 text-right text-orange-400 font-mono">{fmtIDR(totalCredit)}</td>
                                <td className="px-3 py-3 text-center">
                                    {isBalanced ? <CheckCircle className="w-5 h-5 text-green-400 mx-auto" /> : <X className="w-5 h-5 text-red-400 mx-auto" />}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {!isBalanced && (
                    <p className="text-red-400 text-sm text-center">⚠️ Selisih: {fmtIDR(Math.abs(totalDebit - totalCredit))} — Jurnal harus seimbang</p>
                )}

                <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                    <Button variant="secondary" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSave} disabled={saving || !isBalanced} icon={CheckCircle}>
                        {saving ? 'Menyimpan...' : 'Posting Jurnal'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const BigGeneralJournal = () => {
    const { canCreate, canDelete } = useAuth();
    const [entries, setEntries] = useState([]);
    const [coaList, setCoaList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [{ data: ent }, { data: coa }] = await Promise.all([
                supabase.from('big_journal_entries').select(`*, big_journal_line_items(*, big_coa(code, name))`).order('entry_date', { ascending: false }),
                supabase.from('big_coa').select('id,code,name,type').eq('is_active', true).order('code'),
            ]);
            setEntries(ent || []);
            setCoaList(coa || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!canDelete('big_finance')) return alert('Tidak ada akses.');
        if (!confirm('Hapus jurnal ini? Tindakan tidak dapat dibatalkan.')) return;
        await supabase.from('big_journal_line_items').delete().eq('journal_entry_id', id);
        await supabase.from('big_journal_entries').delete().eq('id', id);
        fetchAll();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <BookOpen className="w-8 h-8" /> General Journal — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Jurnal manual Big module</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchAll}>Refresh</Button>
                    {canCreate('big_finance') && (
                        <Button icon={Plus} onClick={() => setShowForm(true)}>Tambah Jurnal</Button>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-silver-dark">Memuat jurnal...</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-[#0070BB] text-white">
                            <tr>
                                <th className="px-4 py-3 text-left">Tanggal</th>
                                <th className="px-4 py-3 text-left">Deskripsi</th>
                                <th className="px-4 py-3 text-left">Referensi</th>
                                <th className="px-4 py-3 text-right">Total Debit</th>
                                <th className="px-4 py-3 text-right">Total Kredit</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/40">
                            {entries.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-silver-dark italic">Belum ada jurnal</td></tr>
                            ) : entries.map(ent => (
                                <React.Fragment key={ent.id}>
                                    <tr className="hover:bg-white/5 smooth-transition cursor-pointer" onClick={() => setExpanded(expanded === ent.id ? null : ent.id)}>
                                        <td className="px-4 py-3 text-silver-dark">{ent.entry_date}</td>
                                        <td className="px-4 py-3 text-silver-light font-medium">{ent.description}</td>
                                        <td className="px-4 py-3 text-silver-dark font-mono text-xs">{ent.reference_number || '-'}</td>
                                        <td className="px-4 py-3 text-right text-blue-400 font-mono">{fmtIDR(ent.total_debit)}</td>
                                        <td className="px-4 py-3 text-right text-orange-400 font-mono">{fmtIDR(ent.total_credit)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {canDelete('big_finance') && ent.entry_type === 'manual' && (
                                                <button onClick={e => { e.stopPropagation(); handleDelete(ent.id); }}
                                                    className="text-red-400 hover:text-red-300 p-1">
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expanded === ent.id && ent.big_journal_line_items?.length > 0 && (
                                        <tr>
                                            <td colSpan={6} className="bg-dark-surface/50 px-8 py-3">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-dark-border text-silver-dark">
                                                            <th className="py-1 text-left">COA</th>
                                                            <th className="py-1 text-left">Keterangan</th>
                                                            <th className="py-1 text-right">Debit</th>
                                                            <th className="py-1 text-right">Kredit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ent.big_journal_line_items.map((line, i) => (
                                                            <tr key={i} className="border-b border-dark-border/30">
                                                                <td className="py-1.5 text-accent-orange font-mono">
                                                                    {line.big_coa?.code} - {line.big_coa?.name}
                                                                </td>
                                                                <td className="py-1.5 text-silver-dark">{line.description}</td>
                                                                <td className="py-1.5 text-right text-blue-400 font-mono">{line.debit > 0 ? fmtIDR(line.debit) : '-'}</td>
                                                                <td className="py-1.5 text-right text-orange-400 font-mono">{line.credit > 0 ? fmtIDR(line.credit) : '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showForm && (
                <EntryFormModal coaList={coaList}
                    onClose={() => setShowForm(false)}
                    onSave={() => { setShowForm(false); fetchAll(); }} />
            )}
        </div>
    );
};

export default BigGeneralJournal;
