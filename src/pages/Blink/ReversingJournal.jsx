import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    BookOpen, Plus, Search, Download, Filter,
    ArrowUpRight, ArrowDownLeft, CheckCircle, AlertCircle,
    FileText, DollarSign, Eye, Trash2, X,
    RefreshCw, FileSpreadsheet, ExternalLink, ChevronDown, ChevronRight,
    Tag, Calendar, TrendingUp, TrendingDown, Layers, Printer
} from 'lucide-react';
import { printReport, fmtDatePrint } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

// ─── Source badge config ─────────────────────────────────────────────────────
const SOURCE_CONFIG = {
    manual: { label: 'Manual', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    adjustment: { label: 'Adjustment', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
};

const getSourceBadge = (entry) => {
    const key = entry.entry_type || (entry.source === 'manual' ? 'manual' : 'adjustment');
    return SOURCE_CONFIG[key] || SOURCE_CONFIG.manual;
};

// ─── Currency Formatter ──────────────────────────────────────────────────────
const fmt = (value, currency = 'IDR') => {
    if (!value || value === 0) return '-';
    const abs = Math.abs(value);
    const neg = value < 0;
    const str = currency === 'USD'
        ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : `Rp ${abs.toLocaleString('id-ID')}`;
    return neg ? `(${str})` : str;
};

const hasRealRate = (currency, exchangeRate) => {
    if (!currency || currency === 'IDR') return false;
    return (exchangeRate || 1) > 1;
};

const fmtAmount = (value, currency, exchangeRate) => {
    if (!value || value === 0) return '-';
    if (hasRealRate(currency, exchangeRate)) {
        return `Rp ${Math.abs((value || 0) * exchangeRate).toLocaleString('id-ID')}`;
    }
    return fmt(value, currency);
};

const toIDR = (value, currency, exchangeRate) => {
    if (hasRealRate(currency, exchangeRate)) return (value || 0) * exchangeRate;
    if (!currency || currency === 'IDR') return (value || 0);
    return null;
};

const fmtIDR = (value) => {
    if (!value || value === 0) return '-';
    return `Rp ${Math.abs(value).toLocaleString('id-ID')}`;
};

// ─── Main Component ──────────────────────────────────────────────────────────
const ReversingJournal = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const { canCreate, canDelete } = useAuth();

    const [entries, setEntries] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Modal states
    const [showNewEntryModal, setShowNewEntryModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // New entry form
    const [newEntry, setNewEntry] = useState({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [
            { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 },
            { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }
        ]
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [dateRange]);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchAccounts = async () => {
        try {
            const { data } = await supabase.from('finance_coa').select('*').order('code');
            setAccounts(data || []);
        } catch (e) { console.error(e); }
    };

    const fetchEntries = async () => {
        try {
            setLoading(true);
            let q = supabase
                .from('blink_journal_entries')
                .select('*')
                .eq('journal_type', 'reversal')
                .order('entry_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (dateRange.start) q = q.gte('entry_date', dateRange.start);
            if (dateRange.end) q = q.lte('entry_date', dateRange.end);

            const { data, error } = await q;
            if (error) throw error;
            setEntries(data || []);
        } catch (e) {
            console.error('Error fetching reversing journal entries:', e);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Filter & Group ─────────────────────────────────────────────────────────
    const filteredEntries = useMemo(() => {
        let list = entries;
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            list = list.filter(e =>
                e.entry_number?.toLowerCase().includes(t) ||
                e.description?.toLowerCase().includes(t) ||
                e.account_name?.toLowerCase().includes(t) ||
                e.account_code?.toLowerCase().includes(t) ||
                e.reference_number?.toLowerCase().includes(t) ||
                e.party_name?.toLowerCase().includes(t)
            );
        }
        return list;
    }, [entries, searchTerm]);

    const groupedEntries = useMemo(() => {
        const groups = {};
        filteredEntries.forEach(entry => {
            const key = entry.batch_id || entry.entry_number || entry.id;
            if (!groups[key]) {
                const displayNumber = entry.reference_number
                    ? entry.reference_number
                    : entry.entry_number?.replace(/-L\d+$/i, '') || entry.entry_number;

                groups[key] = {
                    key,
                    date: entry.entry_date,
                    entry_number: displayNumber,
                    description: entry.description,
                    batch_id: entry.batch_id,
                    lines: []
                };
            }
            groups[key].lines.push(entry);
        });
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredEntries]);

    const totals = useMemo(() => {
        const totalDebit = filteredEntries.reduce((s, e) => {
            const v = toIDR(e.debit, e.currency, e.exchange_rate);
            return s + (v ?? 0);
        }, 0);
        const totalCredit = filteredEntries.reduce((s, e) => {
            const v = toIDR(e.credit, e.currency, e.exchange_rate);
            return s + (v ?? 0);
        }, 0);
        return { totalDebit, totalCredit, balance: totalDebit - totalCredit };
    }, [filteredEntries]);

    // ── Toggle Group ────────────────────────────────────────────────────────────
    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // ── New Entry Handlers ──────────────────────────────────────────────────────
    const handleLineChange = (index, field, value) => {
        const updated = [...newEntry.lines];
        if (field === 'coa_id') {
            const acc = accounts.find(a => a.id === value);
            updated[index] = { ...updated[index], coa_id: value, account_code: acc?.code || '', account_name: acc?.name || '' };
        } else {
            updated[index] = { ...updated[index], [field]: (field === 'debit' || field === 'credit') ? parseFloat(value) || 0 : value };
        }
        setNewEntry({ ...newEntry, lines: updated });
    };

    const addLine = () => setNewEntry({ ...newEntry, lines: [...newEntry.lines, { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }] });
    const removeLine = (i) => {
        if (newEntry.lines.length <= 2) return;
        setNewEntry({ ...newEntry, lines: newEntry.lines.filter((_, idx) => idx !== i) });
    };

    const isBalanced = () => {
        const d = newEntry.lines.reduce((s, l) => s + (l.debit || 0), 0);
        const c = newEntry.lines.reduce((s, l) => s + (l.credit || 0), 0);
        return Math.abs(d - c) < 0.01 && d > 0;
    };

    const generateEntryNumber = async () => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `RV-${yy}${mm}-`;

        try {
            const { data } = await supabase
                .from('blink_journal_entries')
                .select('entry_number')
                .like('entry_number', `${prefix}%`)
                .order('entry_number', { ascending: false })
                .limit(20);

            let seq = 1;
            if (data && data.length > 0) {
                const seqNums = data.map(row => {
                    const base = row.entry_number.replace(/-L\d+$/i, '');
                    const parts = base.split('-');
                    return parseInt(parts[parts.length - 1], 10);
                }).filter(n => !isNaN(n));

                if (seqNums.length > 0) {
                    seq = Math.max(...seqNums) + 1;
                }
            }
            return `${prefix}${String(seq).padStart(4, '0')}`;
        } catch {
            return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
        }
    };

    const saveEntry = async () => {
        if (!canCreate('blink_journal')) {
            alert('Anda tidak memiliki hak akses untuk membuat entri jurnal reversal.');
            return;
        }
        if (!isBalanced()) { alert('Journal entry must balance!'); return; }
        if (!newEntry.description) { alert('Description is required.'); return; }
        try {
            setSaving(true);
            const baseEntryNumber = await generateEntryNumber();
            const batchId = crypto.randomUUID();

            const validLines = newEntry.lines.filter(l => l.coa_id && (l.debit > 0 || l.credit > 0));

            const rows = validLines.map((line, idx) => ({
                entry_number: `${baseEntryNumber}-L${String(idx + 1).padStart(2, '0')}`,
                entry_date: newEntry.entry_date,
                entry_type: 'adjustment',
                account_code: line.account_code,
                account_name: line.account_name,
                coa_id: line.coa_id,
                debit: line.debit || 0,
                credit: line.credit || 0,
                description: newEntry.description,
                batch_id: batchId,
                source: 'manual',
                currency: 'IDR',
                journal_type: 'reversal',
                reference_number: baseEntryNumber,
            }));

            if (rows.length === 0) {
                alert('Please fill in at least one valid journal line.');
                return;
            }

            const { error } = await supabase.from('blink_journal_entries').insert(rows);
            if (error) throw error;
            alert(`✅ Reversing entry ${baseEntryNumber} saved successfully!`);
            setShowNewEntryModal(false);
            setNewEntry({
                entry_date: new Date().toISOString().split('T')[0], description: '', lines: [
                    { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 },
                    { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }
                ]
            });
            fetchEntries();
        } catch (e) {
            console.error(e);
            alert('Failed to save entry: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ──────────────────────────────────────────────────────────────────
    const deleteEntry = async (batchId) => {
        if (!canDelete('blink_journal')) {
            alert('Anda tidak memiliki hak akses untuk menghapus entri jurnal.');
            return;
        }
        if (!confirm('Delete this reversing entry? This cannot be undone.')) return;
        try {
            const { error } = await supabase.from('blink_journal_entries').delete().eq('batch_id', batchId);
            if (error) throw error;
            setShowDetailModal(false);
            fetchEntries();
        } catch (e) {
            alert('Failed to delete: ' + e.message);
        }
    };

    // ── Export ──────────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Date', 'Entry No.', 'Account Code', 'Account Name', 'Description', 'Debit', 'Credit'];
        const rows = filteredEntries.map(e => [
            e.entry_date, e.entry_number,
            e.account_code, e.account_name, e.description || '',
            e.debit || 0, e.credit || 0
        ]);
        const esc = f => {
            const s = String(f ?? '');
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Reversing_Journal_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
    };

    const exportToPDF = () => {
        const period = `${fmtDatePrint(dateRange.start)} – ${fmtDatePrint(dateRange.end)}`;
        const fmt2 = (v, cur) => {
            if (!v || v === 0) return '-';
            const abs = Math.abs(v);
            return cur && cur !== 'IDR'
                ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : `Rp ${abs.toLocaleString('id-ID')}`;
        };

        const groupsHTML = groupedEntries.map(group => {
            const linesHTML = group.lines.map(line => `
                <tr>
                    <td></td>
                    <td class="code">${line.account_code || ''}</td>
                    <td style="padding-left:16px">${line.account_name || '-'}</td>
                    <td class="text-right mono green">${line.debit > 0 ? fmt2(line.debit, line.currency) : ''}</td>
                    <td class="text-right mono" style="color:#1d4ed8">${line.credit > 0 ? fmt2(line.credit, line.currency) : ''}</td>
                </tr>`).join('');

            const totalDebit = group.lines.reduce((s, l) => s + (l.debit || 0), 0);
            const totalCredit = group.lines.reduce((s, l) => s + (l.credit || 0), 0);

            return `
                <tr class="row-header">
                    <td class="muted" style="white-space:nowrap">${fmtDatePrint(group.date)}</td>
                    <td class="code">${group.entry_number || ''}</td>
                    <td><b style="color:#ea580c">🔄 REVERSAL</b> — ${group.description || '-'}</td>
                    <td class="text-right mono green bold">${fmt2(totalDebit, 'IDR')}</td>
                    <td class="text-right mono bold" style="color:#1d4ed8">${fmt2(totalCredit, 'IDR')}</td>
                </tr>
                ${linesHTML}`;
        }).join('');

        const bodyHTML = `
            <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
                <div class="summary-card green-card">
                    <div class="label">Total Debit</div>
                    <div class="value">Rp ${Math.round(totals.totalDebit).toLocaleString('id-ID')}</div>
                </div>
                <div class="summary-card blue-card">
                    <div class="label">Total Credit</div>
                    <div class="value">Rp ${Math.round(totals.totalCredit).toLocaleString('id-ID')}</div>
                </div>
                <div class="summary-card ${Math.abs(totals.balance) < 1 ? '' : 'red-card'}">
                    <div class="label">Balance (D−C)</div>
                    <div class="value">Rp ${Math.round(Math.abs(totals.balance)).toLocaleString('id-ID')}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="min-width:90px">Date</th>
                        <th style="min-width:110px">Entry No.</th>
                        <th style="min-width:300px">Description / Account</th>
                        <th class="text-right" style="min-width:130px">Debit</th>
                        <th class="text-right" style="min-width:130px">Credit</th>
                    </tr>
                </thead>
                <tbody>${groupsHTML}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;text-transform:uppercase">Grand Total</td>
                        <td class="text-right">Rp ${Math.round(totals.totalDebit).toLocaleString('id-ID')}</td>
                        <td class="text-right">Rp ${Math.round(totals.totalCredit).toLocaleString('id-ID')}</td>
                    </tr>
                </tfoot>
            </table>`;

        printReport({
            reportName: 'Reversing Journal',
            companyInfo: companySettings,
            period,
            bodyHTML,
            note: `Showing ${groupedEntries.length} reversing (correction) entries.`
        });
    };

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">🔄 Reversing Jurnal</h1>
                    <p className="text-silver-dark mt-1">Perbaikan & koreksi entry journal untuk membatalkan kesalahan</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" onClick={fetchEntries}>Refresh</Button>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-silver-light hover:bg-dark-card border border-dark-border rounded-lg smooth-transition text-xs">
                        <FileText className="w-4 h-4" /> CSV
                    </button>
                    <button onClick={exportToPDF} disabled={loading || groupedEntries.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-red-400 hover:bg-dark-card border border-dark-border rounded-lg smooth-transition text-xs disabled:opacity-40">
                        <Printer className="w-4 h-4" /> Print PDF
                    </button>
                    {canCreate('blink_journal') && (
                        <Button icon={Plus} onClick={() => setShowNewEntryModal(true)}>Reversal Baru</Button>
                    )}
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Debit</p>
                        <ArrowUpRight className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-green-400">{fmtIDR(totals.totalDebit)}</p>
                    <p className="text-xs text-silver-dark mt-1">{filteredEntries.filter(e => e.debit > 0).length} debit lines</p>
                </div>
                <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Credit</p>
                        <ArrowDownLeft className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-blue-400">{fmtIDR(totals.totalCredit)}</p>
                    <p className="text-xs text-silver-dark mt-1">{filteredEntries.filter(e => e.credit > 0).length} credit lines</p>
                </div>
                <div className="glass-card p-4 rounded-lg border-l-4 border-orange-500">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Balance Check</p>
                        {Math.abs(totals.balance) < 1 ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className={`text-xl font-bold ${Math.abs(totals.balance) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                        {Math.abs(totals.balance) < 1 ? 'Balanced ✓' : fmt(totals.balance)}
                    </p>
                    <p className="text-xs text-silver-dark mt-1">Debit = Credit</p>
                </div>
                <div className="glass-card p-4 rounded-lg border-l-4 border-accent-orange">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Entries</p>
                        <Layers className="w-4 h-4 text-accent-orange" />
                    </div>
                    <p className="text-xl font-bold text-accent-orange">{groupedEntries.length}</p>
                    <p className="text-xs text-silver-dark mt-1">{filteredEntries.length} total lines</p>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari entry number, deskripsi, akun..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                    />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Calendar className="w-4 h-4 text-silver-dark" />
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                    <span className="text-silver-dark">—</span>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
            </div>

            {/* ── Journal Table ── */}
            <div className="glass-card rounded-lg overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full mr-3" />
                        <span className="text-silver-dark">Loading reversing journal entries...</span>
                    </div>
                ) : groupedEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-60">
                        <BookOpen className="w-14 h-14 text-silver-dark mb-4" />
                        <p className="text-silver-light font-medium">No reversing entries found</p>
                        <p className="text-silver-dark text-sm mt-1">Create reversing entries to correct or cancel journal entries</p>
                    </div>
                ) : (
                    <table className="w-full min-w-max text-sm">
                        <thead>
                            <tr className="bg-accent-orange">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase" style={{ width: '32px' }}></th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '220px' }}>Entry No. (RV)</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '110px' }}>Account Code</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '160px' }}>Account Name</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '200px' }}>Description</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Debit</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Credit</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '80px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {groupedEntries.map((group) => {
                                const isExpanded = expandedGroups.has(group.key);
                                const groupDebitIDR = group.lines.reduce((s, e) => {
                                    const v = toIDR(e.debit, e.currency, e.exchange_rate);
                                    return s + (v ?? 0);
                                }, 0);
                                const groupCreditIDR = group.lines.reduce((s, e) => {
                                    const v = toIDR(e.credit, e.currency, e.exchange_rate);
                                    return s + (v ?? 0);
                                }, 0);

                                return (
                                    <React.Fragment key={group.key}>
                                        <tr
                                            className="bg-dark-surface/60 hover:bg-dark-surface cursor-pointer smooth-transition"
                                            onClick={() => toggleGroup(group.key)}
                                        >
                                            <td className="px-3 py-2.5 text-silver-dark">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-dark whitespace-nowrap text-xs">
                                                {new Date(group.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <div className="font-bold text-accent-orange">🔄 {group.entry_number}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-dark text-xs whitespace-nowrap" colSpan={2}>
                                                <span className="italic">{group.lines.length} line{group.lines.length > 1 ? 's' : ''}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-light text-xs" style={{ maxWidth: '200px' }}>
                                                <div className="truncate" title={group.description}>{group.description}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-green-400 whitespace-nowrap text-xs">
                                                {groupDebitIDR > 0 ? fmtIDR(groupDebitIDR) : <span className="text-silver-dark">-</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-blue-400 whitespace-nowrap text-xs">
                                                {groupCreditIDR > 0 ? fmtIDR(groupCreditIDR) : <span className="text-silver-dark">-</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button
                                                    onClick={ev => { ev.stopPropagation(); setSelectedGroup(group); setShowDetailModal(true); }}
                                                    className="p-1.5 text-silver-dark hover:text-accent-orange hover:bg-orange-500/10 rounded smooth-transition"
                                                    title="View Detail"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>

                                        {isExpanded && group.lines.map((entry, idx) => (
                                            <tr key={entry.id || idx} className="bg-dark-bg/40 border-b border-dark-border/30 hover:bg-dark-surface/20">
                                                <td className="px-3 py-2 pl-8 text-silver-dark text-xs" />
                                                <td className="px-3 py-2 text-silver-dark text-xs" />
                                                <td className="px-3 py-2 text-silver-dark font-mono text-xs whitespace-nowrap">{entry.entry_number}</td>
                                                <td className="px-3 py-2">
                                                    <span className="font-mono text-xs text-accent-blue">{entry.account_code || '-'}</span>
                                                </td>
                                                <td className="px-3 py-2 text-silver-light text-xs">{entry.account_name || '-'}</td>
                                                <td className="px-3 py-2 text-silver-dark text-xs max-w-[200px] truncate">{entry.description || '-'}</td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {entry.debit > 0 ? <span className="text-green-400 font-medium">{fmt(entry.debit)}</span> : <span className="text-silver-dark">-</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {entry.credit > 0 ? <span className="text-blue-400 font-medium">{fmt(entry.credit)}</span> : <span className="text-silver-dark">-</span>}
                                                </td>
                                                <td />
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        {groupedEntries.length > 0 && (
                            <tfoot className="bg-dark-surface border-t-2 border-accent-orange">
                                <tr>
                                    <td colSpan={6} className="px-3 py-2 text-right font-bold text-silver-light uppercase text-xs">TOTAL</td>
                                    <td className="px-3 py-2 text-right font-bold text-green-400 text-sm whitespace-nowrap">{fmtIDR(totals.totalDebit)}</td>
                                    <td className="px-3 py-2 text-right font-bold text-blue-400 text-sm whitespace-nowrap">{fmtIDR(totals.totalCredit)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                )}
            </div>

            {/* DETAIL MODAL */}
            {showDetailModal && selectedGroup && (
                <Modal isOpen={true} onClose={() => setShowDetailModal(false)} maxWidth="max-w-3xl">
                    <div className="p-6">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold gradient-text">Reversing Entry Detail</h2>
                                <p className="text-silver-dark mt-1">🔄 #{selectedGroup.entry_number}</p>
                            </div>
                            {canDelete('blink_journal') && (
                                <button
                                    onClick={() => deleteEntry(selectedGroup.batch_id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/30 smooth-transition"
                                >
                                    <Trash2 className="w-3 h-3" /> Delete
                                </button>
                            )}
                        </div>

                        <div className="mb-5 p-3 bg-dark-surface rounded-lg border border-dark-border">
                            <p className="text-xs text-silver-dark uppercase mb-1">Description</p>
                            <p className="text-sm text-silver-light">{selectedGroup.description || '-'}</p>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-dark-border mb-5">
                            <table className="w-full text-sm">
                                <thead className="bg-dark-surface">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs text-silver-dark uppercase font-semibold">Account</th>
                                        <th className="px-4 py-2.5 text-right text-xs text-silver-dark uppercase font-semibold w-36">Debit</th>
                                        <th className="px-4 py-2.5 text-right text-xs text-silver-dark uppercase font-semibold w-36">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {selectedGroup.lines.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-dark-surface/40">
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs text-accent-blue block">{entry.account_code}</span>
                                                <span className="text-silver-light">{entry.account_name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {entry.debit > 0 ? <span className="text-green-400 font-medium">{fmt(entry.debit)}</span> : <span className="text-silver-dark">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {entry.credit > 0 ? <span className="text-blue-400 font-medium">{fmt(entry.credit)}</span> : <span className="text-silver-dark">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-dark-surface border-t-2 border-dark-border">
                                    <tr>
                                        <td className="px-4 py-2 text-right font-bold text-silver-light text-xs uppercase">Total</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-400">{fmt(selectedGroup.lines.reduce((s, e) => s + (e.debit || 0), 0))}</td>
                                        <td className="px-4 py-2 text-right font-bold text-blue-400">{fmt(selectedGroup.lines.reduce((s, e) => s + (e.credit || 0), 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-end">
                            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* NEW ENTRY MODAL */}
            {showNewEntryModal && (
                <Modal isOpen={true} onClose={() => setShowNewEntryModal(false)} maxWidth="max-w-4xl">
                    <div className="p-6">
                        <h2 className="text-2xl font-bold gradient-text mb-6">Reversing Entry Baru</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-silver-light mb-2">Date *</label>
                                <input type="date" value={newEntry.entry_date}
                                    onChange={e => setNewEntry({ ...newEntry, entry_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-silver-light mb-2">Description (Alasan Koreksi) *</label>
                                <input type="text" placeholder="Contoh: Koreksi invoice #12345..."
                                    value={newEntry.description}
                                    onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                            </div>
                        </div>

                        <div className="glass-card p-4 rounded-lg mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-silver-light">Journal Lines</h3>
                                <button onClick={addLine} className="flex items-center gap-1 text-sm text-accent-orange hover:text-accent-orange/80">
                                    <Plus className="w-4 h-4" /> Add Line
                                </button>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-silver-dark uppercase">
                                        <th className="pb-2 w-1/2">Account</th>
                                        <th className="pb-2 w-1/4 text-right">Debit (IDR)</th>
                                        <th className="pb-2 w-1/4 text-right">Credit (IDR)</th>
                                        <th className="pb-2 w-10" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {newEntry.lines.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 pr-2">
                                                <select value={line.coa_id}
                                                    onChange={e => handleLineChange(idx, 'coa_id', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm">
                                                    <option value="">-- Select Account --</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 px-2">
                                                <input type="number" min="0" step="1000" placeholder="0"
                                                    value={line.debit || ''}
                                                    onChange={e => handleLineChange(idx, 'debit', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-right text-sm" />
                                            </td>
                                            <td className="py-2 px-2">
                                                <input type="number" min="0" step="1000" placeholder="0"
                                                    value={line.credit || ''}
                                                    onChange={e => handleLineChange(idx, 'credit', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-right text-sm" />
                                            </td>
                                            <td className="py-2 pl-2">
                                                {newEntry.lines.length > 2 && (
                                                    <button onClick={() => removeLine(idx)}
                                                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-dark-border">
                                    <tr>
                                        <td className="pt-3 font-semibold text-silver-light text-right text-sm">TOTAL</td>
                                        <td className="pt-3 text-right font-bold text-green-400">
                                            {fmt(newEntry.lines.reduce((s, l) => s + (l.debit || 0), 0))}
                                        </td>
                                        <td className="pt-3 text-right font-bold text-blue-400">
                                            {fmt(newEntry.lines.reduce((s, l) => s + (l.credit || 0), 0))}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className={`p-3 rounded-lg mb-5 flex items-center gap-3 ${isBalanced() ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                            {isBalanced()
                                ? <><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-green-400 font-medium">Balanced ✓</span></>
                                : <><AlertCircle className="w-5 h-5 text-red-400" /><span className="text-red-400 font-medium">Unbalanced — Difference: {fmt(newEntry.lines.reduce((s, l) => s + (l.debit || 0), 0) - newEntry.lines.reduce((s, l) => s + (l.credit || 0), 0))}</span></>
                            }
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setShowNewEntryModal(false)}>Cancel</Button>
                            <Button onClick={saveEntry} disabled={!isBalanced() || saving}>
                                {saving ? 'Saving...' : 'Save Reversal'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ReversingJournal;
