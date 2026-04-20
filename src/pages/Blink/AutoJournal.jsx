import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    BookOpen, Search, Download, Filter,
    ArrowUpRight, ArrowDownLeft, CheckCircle, AlertCircle,
    FileText, Calendar, TrendingUp, TrendingDown, Layers, Printer,
    Eye, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { printReport, fmtDatePrint } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';

// ─── Source badge config ─────────────────────────────────────────────────────
const SOURCE_CONFIG = {
    ar_payment: { label: 'AR Payment', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    ap_payment: { label: 'AP Payment', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    invoice: { label: 'Invoice', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ar_invoice: { label: 'AR Invoice', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    po: { label: 'Purchase Order', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    payment: { label: 'Payment', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    auto: { label: 'Auto', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const getSourceBadge = (entry) => {
    const key = entry.reference_type || entry.entry_type || (entry.source === 'manual' ? 'manual' : 'auto');
    return SOURCE_CONFIG[key] || SOURCE_CONFIG.auto;
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
const AutoJournal = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    
    // Default date range: last 12 months
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchEntries();
    }, [dateRange]);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchEntries = async () => {
        try {
            setLoading(true);
            let q = supabase
                .from('blink_journal_entries')
                .select('*')
                .eq('journal_type', 'auto')
                .order('entry_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (dateRange.start) q = q.gte('entry_date', dateRange.start);
            if (dateRange.end) q = q.lte('entry_date', dateRange.end);

            const { data, error } = await q;
            if (error) throw error;
            setEntries(data || []);
        } catch (e) {
            console.error('Error fetching auto journal entries:', e);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Filter & Group ─────────────────────────────────────────────────────────
    const filteredEntries = useMemo(() => {
        let list = entries;
        if (sourceFilter !== 'all') {
            list = list.filter(e => {
                const src = e.reference_type || e.entry_type || (e.source === 'manual' ? 'manual' : 'auto');
                return src === sourceFilter;
            });
        }
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
    }, [entries, searchTerm, sourceFilter]);

    const groupedEntries = useMemo(() => {
        const groups = {};
        filteredEntries.forEach(entry => {
            const key = entry.batch_id || entry.entry_number || entry.id;
            if (!groups[key]) {
                const displayNumber = entry.source === 'manual' && entry.reference_number
                    ? entry.reference_number
                    : entry.entry_number?.replace(/-L\d+$/i, '') || entry.entry_number;

                groups[key] = {
                    key,
                    date: entry.entry_date,
                    entry_number: displayNumber,
                    description: entry.description,
                    reference_type: entry.reference_type,
                    reference_number: entry.reference_number,
                    party_name: entry.party_name,
                    source: entry.source,
                    entry_type: entry.entry_type,
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
        const hasMixedCcy = filteredEntries.some(e => e.currency && e.currency !== 'IDR' && !hasRealRate(e.currency, e.exchange_rate));
        return { totalDebit, totalCredit, balance: totalDebit - totalCredit, hasMixedCcy };
    }, [filteredEntries]);

    // ── Toggle Group ────────────────────────────────────────────────────────────
    const toggleGroup = (key) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // ── Export ──────────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Date', 'Entry No.', 'Ref No.', 'Party', 'Account Code', 'Account Name', 'Description', 'Debit', 'Credit', 'Source'];
        const rows = filteredEntries.map(e => [
            e.entry_date, e.entry_number, e.reference_number || '', e.party_name || '',
            e.account_code, e.account_name, e.description || '',
            e.debit || 0, e.credit || 0,
            e.reference_type || e.source || 'auto'
        ]);
        const esc = f => {
            const s = String(f ?? '');
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Auto_Journal_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
    };

    const sourceOptions = [
        { value: 'all', label: 'All Sources' },
        { value: 'ar_payment', label: 'AR Payment' },
        { value: 'ap_payment', label: 'AP Payment' },
        { value: 'invoice', label: 'Invoice' },
        { value: 'ar_invoice', label: 'AR Invoice' },
        { value: 'po', label: 'Purchase Order' },
        { value: 'payment', label: 'Payment' },
    ];

    const navigateToSource = (group) => {
        const rt = group.reference_type;
        if (rt === 'invoice' || rt === 'ar_invoice') navigate('/blink/finance/invoices');
        else if (rt === 'po') navigate('/blink/finance/purchase-orders');
        else if (rt === 'ar_payment') navigate('/blink/finance/ar');
        else if (rt === 'ap_payment') navigate('/blink/finance/ap');
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
            const badge = getSourceBadge(group);
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
            const cur = group.lines[0]?.currency || 'IDR';

            return `
                <tr class="row-header">
                    <td class="muted" style="white-space:nowrap">${fmtDatePrint(group.date)}</td>
                    <td class="code">${group.entry_number || ''}</td>
                    <td><b>${group.description || '-'}</b>${group.party_name ? ` &mdash; <span style="color:#64748b">${group.party_name}</span>` : ''}</td>
                    <td class="text-right mono green bold">${fmt2(totalDebit, cur)}</td>
                    <td class="text-right mono bold" style="color:#1d4ed8">${fmt2(totalCredit, cur)}</td>
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
                        <th style="min-width:250px">Description / Account</th>
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
            reportName: 'Auto Journal',
            companyInfo: companySettings,
            period,
            bodyHTML,
            note: `Showing ${groupedEntries.length} auto-generated journal entries (${filteredEntries.length} lines). System entries are read-only for audit compliance.`
        });
    };

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">📊 Auto Jurnal</h1>
                    <p className="text-silver-dark mt-1">System-generated entries from AR, AP, Invoices & PO (Last 12 Months) • Read-Only</p>
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
                <div className="glass-card p-4 rounded-lg border-l-4 border-purple-500">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Balance Check</p>
                        {Math.abs(totals.balance) < 1 ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className={`text-xl font-bold ${Math.abs(totals.balance) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                        {Math.abs(totals.balance) < 1 ? 'Balanced ✓' : fmt(totals.balance)}
                    </p>
                    <p className="text-xs text-silver-dark mt-1">Debit = Credit</p>
                </div>
                <div className="glass-card p-4 rounded-lg border-l-4 border-gray-500">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Batches</p>
                        <Layers className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xl font-bold text-gray-400">{groupedEntries.length}</p>
                    <p className="text-xs text-silver-dark mt-1">{filteredEntries.length} total lines</p>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search entry number, description, account, party..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                    />
                </div>
                <select
                    value={sourceFilter}
                    onChange={e => setSourceFilter(e.target.value)}
                    className="px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                >
                    {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex items-center gap-2 shrink-0">
                    <Calendar className="w-4 h-4 text-silver-dark" />
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                    <span className="text-silver-dark">—</span>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
            </div>

            {/* ── Journal Table (Grouped) ── */}
            <div className="glass-card rounded-lg overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full mr-3" />
                        <span className="text-silver-dark">Loading auto journal entries...</span>
                    </div>
                ) : groupedEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-60">
                        <BookOpen className="w-14 h-14 text-silver-dark mb-4" />
                        <p className="text-silver-light font-medium">No auto journal entries found</p>
                        <p className="text-silver-dark text-sm mt-1">Auto entries are generated when AR, AP payments, and invoices are processed</p>
                    </div>
                ) : (
                    <table className="w-full min-w-max text-sm">
                        <thead>
                            <tr className="bg-gray-700">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase" style={{ width: '32px' }}></th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '100px' }}>Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '220px' }}>Entry No.</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '110px' }}>Account Code</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '160px' }}>Account Name</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '200px' }}>Description</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>Party</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Debit</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Credit</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '110px' }}>Source</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '60px' }}>Action</th>
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
                                const currencies = [...new Set(group.lines.map(e => e.currency || 'IDR'))];
                                const isMultiCcy = currencies.some(c => c !== 'IDR');
                                const hasMixed = group.lines.some(e => e.currency && e.currency !== 'IDR' && !hasRealRate(e.currency, e.exchange_rate));
                                const badge = getSourceBadge(group);

                                return (
                                    <React.Fragment key={group.key}>
                                        <tr
                                            className="bg-dark-surface/60 hover:bg-dark-surface cursor-pointer smooth-transition"
                                            onClick={() => toggleGroup(group.key)}
                                        >
                                            <td className="px-3 py-2.5 text-silver-dark">
                                                {isExpanded
                                                    ? <ChevronDown className="w-4 h-4" />
                                                    : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-dark whitespace-nowrap text-xs">
                                                {new Date(group.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <div className="font-bold text-gray-400">{group.entry_number}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-dark text-xs whitespace-nowrap" colSpan={2}>
                                                <span className="italic">{group.lines.length} line{group.lines.length > 1 ? 's' : ''}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-light text-xs" style={{ maxWidth: '200px' }}>
                                                <div className="truncate" title={group.description}>{group.description}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-silver-dark text-xs whitespace-nowrap">
                                                {group.party_name || '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-green-400 whitespace-nowrap text-xs">
                                                {groupDebitIDR > 0 ? fmtIDR(groupDebitIDR) : <span className="text-silver-dark">-</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-blue-400 whitespace-nowrap text-xs">
                                                {groupCreditIDR > 0 ? fmtIDR(groupCreditIDR) : <span className="text-silver-dark">-</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button
                                                    onClick={ev => { ev.stopPropagation(); navigateToSource(group); }}
                                                    className="p-1.5 text-silver-dark hover:text-gray-400 hover:bg-gray-500/10 rounded smooth-transition disabled:opacity-40"
                                                    disabled={!group.reference_type || group.reference_type === 'adjustment'}
                                                    title="View Source Document"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
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
                                                <td className="px-3 py-2 text-silver-dark text-xs">{entry.party_name || '-'}</td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {entry.debit > 0 ? (
                                                        <span className="text-green-400 font-medium">{fmtAmount(entry.debit, entry.currency, entry.exchange_rate)}</span>
                                                    ) : <span className="text-silver-dark">-</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {entry.credit > 0 ? (
                                                        <span className="text-blue-400 font-medium">{fmtAmount(entry.credit, entry.currency, entry.exchange_rate)}</span>
                                                    ) : <span className="text-silver-dark">-</span>}
                                                </td>
                                                <td />
                                                <td />
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        {groupedEntries.length > 0 && (
                            <tfoot className="bg-dark-surface border-t-2 border-gray-700">
                                <tr>
                                    <td colSpan={8} className="px-3 py-2 text-right font-bold text-silver-light uppercase text-xs">TOTAL</td>
                                    <td className="px-3 py-2 text-right font-bold text-green-400 text-sm whitespace-nowrap">{fmtIDR(totals.totalDebit)}</td>
                                    <td className="px-3 py-2 text-right font-bold text-blue-400 text-sm whitespace-nowrap">{fmtIDR(totals.totalCredit)}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                )}
            </div>
        </div>
    );
};

export default AutoJournal;
