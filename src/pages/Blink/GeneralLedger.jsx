import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Common/Button';
import {
    BookOpen, Search, Calendar, Download, RefreshCw,
    ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
    FileText, ExternalLink, Info, ChevronDown, ChevronRight,
    BarChart2, Filter, X, DollarSign, Layers, Tag
} from 'lucide-react';

// ─── COA Type Config ─────────────────────────────────────────────────────────
const COA_TYPE_CONFIG = {
    ASSET: { label: 'Asset', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', normalBalance: 'DEBIT', accent: '#3b82f6' },
    LIABILITY: { label: 'Liability', color: 'bg-red-500/20 text-red-400 border-red-500/30', normalBalance: 'CREDIT', accent: '#ef4444' },
    EQUITY: { label: 'Equity', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', normalBalance: 'CREDIT', accent: '#a855f7' },
    REVENUE: { label: 'Revenue', color: 'bg-green-500/20 text-green-400 border-green-500/30', normalBalance: 'CREDIT', accent: '#22c55e' },
    EXPENSE: { label: 'Expense', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', normalBalance: 'DEBIT', accent: '#f97316' },
    COGS: { label: 'COGS', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', normalBalance: 'DEBIT', accent: '#eab308' },
};

// ─── Source Config ────────────────────────────────────────────────────────────
const SOURCE_CONFIG = {
    ar_payment: { label: 'AR Payment', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    ap_payment: { label: 'AP Payment', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    invoice: { label: 'Invoice', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ar_invoice: { label: 'AR Invoice', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    po: { label: 'Purchase Order', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    ap: { label: 'AP Entry', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    manual: { label: 'Manual', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    adjustment: { label: 'Adjustment', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    auto: { label: 'Auto', color: 'bg-dark-surface text-silver-dark border-dark-border' },
};

const getSourceConfig = (entry) => {
    const key = entry.reference_type || entry.entry_type || (entry.source === 'manual' ? 'manual' : 'auto');
    return SOURCE_CONFIG[key] || SOURCE_CONFIG.auto;
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtIDR = (value, showSign = false) => {
    if (value === undefined || value === null) return '-';
    const neg = value < 0;
    const abs = Math.abs(value);
    const str = `Rp ${abs.toLocaleString('id-ID')}`;
    if (neg) return `(${str})`;
    if (showSign && value > 0) return `+${str}`;
    return str;
};

const fmtUSD = (value) => {
    if (!value || value === 0) return null;
    return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

const hasRealRate = (currency, exchangeRate) => {
    if (!currency || currency === 'IDR') return false;
    return (exchangeRate || 1) > 1;
};

// Returns IDR equivalent (null if USD with no real rate)
const toIDR = (value, currency, exchangeRate) => {
    if (!value) return 0;
    if (hasRealRate(currency, exchangeRate)) return (value || 0) * exchangeRate;
    if (!currency || currency === 'IDR') return (value || 0);
    return null;
};

// Smart display: IDR if convertible, original currency otherwise
const fmtAmount = (value, currency, exchangeRate) => {
    if (!value || value === 0) return null;
    if (hasRealRate(currency, exchangeRate)) {
        return { primary: `Rp ${Math.abs((value || 0) * exchangeRate).toLocaleString('id-ID')}`, secondary: fmtUSD(value) };
    }
    if (currency === 'USD') return { primary: `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, secondary: null };
    return { primary: `Rp ${Math.abs(value).toLocaleString('id-ID')}`, secondary: null };
};

// Mini sparkline SVG
const Sparkline = ({ data, color = '#f97316', width = 80, height = 24 }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={width} height={height} className="opacity-60">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
const GeneralLedger = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [showSidebar, setShowSidebar] = useState(true);
    const [accountBalances, setAccountBalances] = useState({}); // coaId → balance
    const [balancesLoading, setBalancesLoading] = useState(false);

    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    });

    // ── Deep-link from Trial Balance ─────────────────────────────────────────
    useEffect(() => { fetchAccounts(); }, []);

    useEffect(() => {
        if (location.state?.preSelectedAccount) {
            setSelectedAccount(location.state.preSelectedAccount);
        }
    }, [location.state]);

    useEffect(() => {
        if (selectedAccount && dateRange.start && dateRange.end) {
            fetchLedgerData();
        } else {
            setEntries([]);
            setOpeningBalance(0);
        }
    }, [selectedAccount, dateRange]);

    // ── Fetch Accounts ────────────────────────────────────────────────────────
    const fetchAccounts = async () => {
        try {
            setLoadingAccounts(true);
            const { data } = await supabase.from('finance_coa').select('*').order('code');
            setAccounts(data || []);
            // After loading accounts, compute balances
            if (data && data.length > 0) fetchAccountBalances(data);
        } catch (e) { console.error(e); }
        finally { setLoadingAccounts(false); }
    };

    // compute closing balance for each account (YTD, current year)
    const fetchAccountBalances = async (accs) => {
        try {
            setBalancesLoading(true);
            const yearStart = `${today.getFullYear()}-01-01`;
            const yearEnd = today.toISOString().split('T')[0];
            const { data } = await supabase
                .from('blink_journal_entries')
                .select('coa_id, debit, credit, currency, exchange_rate')
                .gte('entry_date', yearStart)
                .lte('entry_date', yearEnd);

            if (!data) return;
            const bal = {};
            data.forEach(e => {
                if (!e.coa_id) return;
                if (!bal[e.coa_id]) bal[e.coa_id] = { d: 0, c: 0 };
                bal[e.coa_id].d += toIDR(e.debit, e.currency, e.exchange_rate) ?? 0;
                bal[e.coa_id].c += toIDR(e.credit, e.currency, e.exchange_rate) ?? 0;
            });
            // normalize to closing balance
            const result = {};
            accs.forEach(acc => {
                const b = bal[acc.id] || { d: 0, c: 0 };
                const isCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                result[acc.id] = isCredit ? (b.c - b.d) : (b.d - b.c);
            });
            setAccountBalances(result);
        } catch (e) { console.error('Balance fetch error:', e); }
        finally { setBalancesLoading(false); }
    };

    // ── Fetch Ledger ──────────────────────────────────────────────────────────
    const fetchLedgerData = async () => {
        try {
            setLoading(true);
            const acc = accounts.find(a => a.id === selectedAccount);
            const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc?.type);

            // Opening balance: dual-match by coa_id OR account_code
            // (old entries might have code but no coa_id)
            const fetchPrev = async () => {
                const results = await Promise.all([
                    supabase.from('blink_journal_entries')
                        .select('debit, credit, currency, exchange_rate, id')
                        .eq('coa_id', selectedAccount)
                        .lt('entry_date', dateRange.start),
                    acc?.code ? supabase.from('blink_journal_entries')
                        .select('debit, credit, currency, exchange_rate, id')
                        .eq('account_code', acc.code)
                        .is('coa_id', null)
                        .lt('entry_date', dateRange.start) : Promise.resolve({ data: [] })
                ]);
                const rows = [...(results[0].data || []), ...(results[1].data || [])];
                // deduplicate by id
                return [...new Map(rows.map(r => [r.id, r])).values()];
            };

            const prev = await fetchPrev();
            const prevD = prev.reduce((s, e) => s + (toIDR(e.debit, e.currency, e.exchange_rate) ?? 0), 0);
            const prevC = prev.reduce((s, e) => s + (toIDR(e.credit, e.currency, e.exchange_rate) ?? 0), 0);
            const opening = isNormalCredit ? prevC - prevD : prevD - prevC;
            setOpeningBalance(opening);

            // Current period: dual-fetch same pattern
            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('*')
                    .eq('coa_id', selectedAccount)
                    .gte('entry_date', dateRange.start)
                    .lte('entry_date', dateRange.end)
                    .order('entry_date', { ascending: true })
                    .order('created_at', { ascending: true }),
                acc?.code ? supabase.from('blink_journal_entries')
                    .select('*')
                    .eq('account_code', acc.code)
                    .is('coa_id', null)
                    .gte('entry_date', dateRange.start)
                    .lte('entry_date', dateRange.end)
                    .order('entry_date', { ascending: true })
                    .order('created_at', { ascending: true }) : Promise.resolve({ data: [] })
            ]);

            if (r1.error) throw r1.error;
            const combined = [...(r1.data || []), ...(r2.data || [])];
            // deduplicate
            const unique = [...new Map(combined.map(r => [r.id, r])).values()];
            // sort chronologically
            unique.sort((a, b) => {
                const d = a.entry_date.localeCompare(b.entry_date);
                return d !== 0 ? d : (a.created_at || '').localeCompare(b.created_at || '');
            });
            setEntries(unique);
        } catch (e) {
            console.error('Error fetching ledger:', e);
        } finally {
            setLoading(false);
        }
    };

    // ── Computed ──────────────────────────────────────────────────────────────
    const accountInfo = accounts.find(a => a.id === selectedAccount);
    const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(accountInfo?.type);
    const typeConfig = COA_TYPE_CONFIG[accountInfo?.type] || COA_TYPE_CONFIG.ASSET;

    const filteredEntries = useMemo(() => {
        let list = entries;
        if (sourceFilter !== 'all') {
            list = list.filter(e => {
                const key = e.reference_type || e.entry_type || (e.source === 'manual' ? 'manual' : 'auto');
                return key === sourceFilter;
            });
        }
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            list = list.filter(e =>
                e.description?.toLowerCase().includes(t) ||
                e.reference_number?.toLowerCase().includes(t) ||
                e.entry_number?.toLowerCase().includes(t) ||
                e.party_name?.toLowerCase().includes(t)
            );
        }
        return list;
    }, [entries, searchTerm, sourceFilter]);

    const totalDebit = filteredEntries.reduce((s, e) => s + (toIDR(e.debit, e.currency, e.exchange_rate) ?? 0), 0);
    const totalCredit = filteredEntries.reduce((s, e) => s + (toIDR(e.credit, e.currency, e.exchange_rate) ?? 0), 0);
    const closingBalance = isNormalCredit
        ? openingBalance + totalCredit - totalDebit
        : openingBalance + totalDebit - totalCredit;

    // Running balance with DR/CR tag
    const rows = useMemo(() => {
        let running = openingBalance;
        return filteredEntries.map(e => {
            const d = toIDR(e.debit, e.currency, e.exchange_rate) ?? 0;
            const c = toIDR(e.credit, e.currency, e.exchange_rate) ?? 0;
            if (isNormalCredit) running += (c - d);
            else running += (d - c);
            return { ...e, runningBalance: running };
        });
    }, [filteredEntries, openingBalance, isNormalCredit]);

    // Sparkline data for closing balance trend (last 7 rows)
    const sparkData = rows.slice(-Math.min(rows.length, 12)).map(r => r.runningBalance);

    // Source options (only those that appear in entries)
    const availableSources = useMemo(() => {
        const keys = new Set(entries.map(e => e.reference_type || e.entry_type || (e.source === 'manual' ? 'manual' : 'auto')));
        return [...keys].filter(Boolean);
    }, [entries]);

    // ── Navigate to source ────────────────────────────────────────────────────
    const goToSource = (entry) => {
        const rt = entry.reference_type;
        if (rt === 'invoice' || rt === 'ar_invoice') navigate('/blink/finance/invoices');
        else if (rt === 'po' || rt === 'ap') navigate('/blink/finance/purchase-orders');
        else if (rt === 'ar_payment') navigate('/blink/finance/ar');
        else if (rt === 'ap_payment') navigate('/blink/finance/ap');
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const exportCSV = () => {
        if (!selectedAccount) return;
        const headers = ['Date', 'Entry No.', 'Description', 'Ref. No.', 'Party', 'Debit (IDR)', 'Credit (IDR)', 'Balance (IDR)', 'Currency', 'Source'];
        const csvRows = [
            ['Opening Balance', '', '', '', '', '', '', openingBalance, '', ''],
            ...rows.map(r => [
                r.entry_date, r.entry_number, r.description || '',
                r.reference_number || '', r.party_name || '',
                toIDR(r.debit, r.currency, r.exchange_rate) ?? 0,
                toIDR(r.credit, r.currency, r.exchange_rate) ?? 0,
                r.runningBalance, r.currency || 'IDR',
                r.reference_type || r.source || ''
            ]),
            ['Closing Balance', '', '', '', '', totalDebit, totalCredit, closingBalance, '', '']
        ];
        const esc = f => { const s = String(f ?? ''); return s.includes(',') ? `"${s}"` : s; };
        const csv = [headers.join(','), ...csvRows.map(r => r.map(esc).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `Ledger_${accountInfo?.code || 'Account'}_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
    };

    // ── Balance DR/CR tag ──────────────────────────────────────────────────────
    const BalanceTag = ({ bal }) => {
        if (Math.abs(bal) < 0.01) return <span className="text-xs text-silver-dark px-1">–</span>;
        // For normal-debit accounts (ASSET, EXPENSE): positive = DR (normal)
        // For normal-credit accounts (LIABILITY, EQUITY, REVENUE): positive = CR (normal)
        const isNormal = isNormalCredit ? bal > 0 : bal > 0;
        const isDR = isNormalCredit ? bal < 0 : bal > 0;
        return (
            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isDR ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {isDR ? 'DR' : 'CR'}
            </span>
        );
    };

    // ── Group accounts for sidebar ────────────────────────────────────────────
    const groupedAccounts = useMemo(() => {
        const groups = {};
        accounts.forEach(acc => {
            if (!groups[acc.type]) groups[acc.type] = [];
            groups[acc.type].push(acc);
        });
        return groups;
    }, [accounts]);

    const [expandedTypes, setExpandedTypes] = useState(new Set(['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE']));
    const toggleType = (type) => setExpandedTypes(prev => {
        const next = new Set(prev);
        next.has(type) ? next.delete(type) : next.add(type);
        return next;
    });

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">General Ledger</h1>
                    <p className="text-silver-dark mt-1">Per-account transaction detail with running balance</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSidebar(v => !v)}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-xs hover:bg-dark-card smooth-transition"
                    >
                        <Layers className="w-4 h-4" />
                        {showSidebar ? 'Hide' : 'Show'} Accounts
                    </button>
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchLedgerData} disabled={!selectedAccount}>Refresh</Button>
                    <button
                        onClick={exportCSV}
                        disabled={!selectedAccount || loading}
                        className={`flex items-center gap-2 px-3 py-2 bg-dark-surface text-silver-light hover:bg-dark-card rounded-lg border border-dark-border smooth-transition text-xs ${(!selectedAccount || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        <FileText className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* ── Date Range Bar ── */}
            <div className="glass-card p-3 rounded-lg flex flex-col md:flex-row gap-3 items-start md:items-end">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-silver-dark" />
                    <span className="text-xs text-silver-dark uppercase tracking-wider">Period</span>
                </div>
                <div className="flex items-center gap-2">
                    <input type="date" value={dateRange.start}
                        onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-silver-light text-sm" />
                    <span className="text-silver-dark">—</span>
                    <input type="date" value={dateRange.end}
                        onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-silver-light text-sm" />
                </div>
                {/* Quick period buttons */}
                <div className="flex gap-1.5 ml-auto">
                    {[
                        {
                            label: 'This Month', fn: () => {
                                const d = new Date();
                                setDateRange({ start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: d.toISOString().split('T')[0] });
                            }
                        },
                        {
                            label: 'This Quarter', fn: () => {
                                const d = new Date(); const q = Math.floor(d.getMonth() / 3);
                                setDateRange({ start: `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`, end: d.toISOString().split('T')[0] });
                            }
                        },
                        {
                            label: 'This Year', fn: () => {
                                const d = new Date();
                                setDateRange({ start: `${d.getFullYear()}-01-01`, end: d.toISOString().split('T')[0] });
                            }
                        },
                    ].map(({ label, fn }) => (
                        <button key={label} onClick={fn}
                            className="px-2.5 py-1 text-xs bg-dark-surface border border-dark-border text-silver-dark hover:text-silver-light hover:bg-dark-card rounded smooth-transition">
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Layout: Sidebar + Content ── */}
            <div className="flex gap-4">

                {/* ── Account Sidebar ── */}
                {showSidebar && (
                    <div className="w-64 shrink-0 glass-card rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: '75vh' }}>
                        <div className="p-3 border-b border-dark-border bg-dark-surface/60">
                            <p className="text-xs font-semibold text-silver-light uppercase tracking-wider">Chart of Accounts</p>
                            <p className="text-xs text-silver-dark mt-0.5">YTD Balance</p>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {loadingAccounts ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin w-5 h-5 border-2 border-accent-orange border-t-transparent rounded-full" />
                                </div>
                            ) : (
                                Object.entries(groupedAccounts).map(([type, accs]) => {
                                    const cfg = COA_TYPE_CONFIG[type] || COA_TYPE_CONFIG.ASSET;
                                    const isEx = expandedTypes.has(type);
                                    const typeTotal = accs.reduce((s, a) => s + (accountBalances[a.id] || 0), 0);
                                    return (
                                        <div key={type}>
                                            <button
                                                onClick={() => toggleType(type)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-dark-surface/40 hover:bg-dark-surface smooth-transition border-b border-dark-border/50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isEx ? <ChevronDown className="w-3 h-3 text-silver-dark" /> : <ChevronRight className="w-3 h-3 text-silver-dark" />}
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.color}`}>{cfg.label}</span>
                                                </div>
                                                <span className={`text-xs font-mono ${typeTotal >= 0 ? 'text-silver-dark' : 'text-red-400'}`}>
                                                    {balancesLoading ? '...' : fmtIDR(typeTotal).replace('Rp ', '').substring(0, 12)}
                                                </span>
                                            </button>
                                            {isEx && accs.map(acc => {
                                                const bal = accountBalances[acc.id] || 0;
                                                const isSelected = selectedAccount === acc.id;
                                                return (
                                                    <button
                                                        key={acc.id}
                                                        onClick={() => setSelectedAccount(acc.id)}
                                                        className={`w-full px-3 py-2 text-left flex items-center justify-between border-b border-dark-border/30 smooth-transition ${isSelected ? 'bg-accent-orange/10 border-l-2 border-l-accent-orange' : 'hover:bg-dark-surface/50'}`}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className={`text-xs font-mono truncate ${isSelected ? 'text-accent-orange' : 'text-silver-dark'}`}>{acc.code}</p>
                                                            <p className={`text-xs truncate leading-snug ${isSelected ? 'text-silver-light font-medium' : 'text-silver-dark'}`}>{acc.name}</p>
                                                        </div>
                                                        <span className={`text-xs ml-2 shrink-0 font-mono ${bal < 0 ? 'text-red-400' : bal > 0 ? 'text-silver-light' : 'text-silver-dark/40'}`}>
                                                            {balancesLoading ? '…' : (bal === 0 ? '-' : (Math.abs(bal) > 1e9 ? `${(Math.abs(bal) / 1e9).toFixed(1)}B` : Math.abs(bal) > 1e6 ? `${(Math.abs(bal) / 1e6).toFixed(1)}M` : `${(Math.abs(bal) / 1e3).toFixed(0)}K`))}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ── Main Content ── */}
                <div className="flex-1 min-w-0 space-y-4">
                    {!selectedAccount ? (
                        <div className="flex flex-col items-center justify-center py-24 opacity-50">
                            <BookOpen className="w-16 h-16 text-silver-dark mb-4" />
                            <p className="text-xl font-medium text-silver-light">Select an Account to View Ledger</p>
                            <p className="text-sm text-silver-dark mt-2">Choose a COA account from the left sidebar</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Account Info Header ── */}
                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${typeConfig.color}`}>{typeConfig.label}</span>
                                            <span className="font-mono text-accent-blue text-sm font-bold">{accountInfo?.code}</span>
                                            <span className="text-silver-light font-semibold">{accountInfo?.name}</span>
                                        </div>
                                        <div className="flex gap-4 mt-2 text-xs text-silver-dark">
                                            <span>Normal Balance: <span className="text-silver-light font-medium">{typeConfig.normalBalance}</span></span>
                                            {accountInfo?.group_name && <span>Group: <span className="text-silver-light">{accountInfo.group_name}</span></span>}
                                            <span>{filteredEntries.length} transaction{filteredEntries.length !== 1 ? 's' : ''} in period</span>
                                        </div>
                                    </div>
                                    {sparkData.length > 1 && (
                                        <Sparkline data={sparkData} color={typeConfig.accent} width={100} height={28} />
                                    )}
                                </div>
                            </div>

                            {/* ── Summary Cards ── */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="glass-card p-4 rounded-lg border-l-4 border-yellow-500">
                                    <p className="text-xs text-silver-dark uppercase tracking-wider">Opening Balance</p>
                                    <p className="text-base font-bold text-silver-light mt-1 font-mono">{fmtIDR(openingBalance)}</p>
                                    <p className="text-xs text-silver-dark mt-0.5">
                                        Before {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </p>
                                </div>
                                <div className="glass-card p-4 rounded-lg border-l-4 border-green-500">
                                    <p className="text-xs text-silver-dark uppercase tracking-wider">Period Debit</p>
                                    <p className="text-base font-bold text-green-400 mt-1 font-mono">{fmtIDR(totalDebit)}</p>
                                    <p className="text-xs text-silver-dark mt-0.5">{filteredEntries.filter(e => e.debit > 0).length} debit lines</p>
                                </div>
                                <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                                    <p className="text-xs text-silver-dark uppercase tracking-wider">Period Credit</p>
                                    <p className="text-base font-bold text-blue-400 mt-1 font-mono">{fmtIDR(totalCredit)}</p>
                                    <p className="text-xs text-silver-dark mt-0.5">{filteredEntries.filter(e => e.credit > 0).length} credit lines</p>
                                </div>
                                <div className={`glass-card p-4 rounded-lg border-l-4 ${closingBalance >= 0 ? 'border-purple-500' : 'border-red-500'}`}>
                                    <p className="text-xs text-silver-dark uppercase tracking-wider">Closing Balance</p>
                                    <p className={`text-base font-bold mt-1 font-mono ${closingBalance >= 0 ? 'text-purple-400' : 'text-red-400'}`}>{fmtIDR(closingBalance)}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <BalanceTag bal={closingBalance} />
                                        <span className="text-xs text-silver-dark">net balance</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Filters Row ── */}
                            <div className="flex gap-2 flex-wrap items-center">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                                    <input type="text" placeholder="Search description, reference, party..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm" />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-3.5 h-3.5 text-silver-dark hover:text-silver-light" />
                                        </button>
                                    )}
                                </div>
                                {/* Source filter */}
                                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                                    className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm">
                                    <option value="all">All Sources</option>
                                    {availableSources.map(s => (
                                        <option key={s} value={s}>{SOURCE_CONFIG[s]?.label || s}</option>
                                    ))}
                                </select>
                                {(searchTerm || sourceFilter !== 'all') && (
                                    <button onClick={() => { setSearchTerm(''); setSourceFilter('all'); }}
                                        className="flex items-center gap-1 px-2.5 py-2 text-xs text-silver-dark border border-dark-border rounded-lg hover:text-silver-light smooth-transition">
                                        <X className="w-3 h-3" /> Clear
                                    </button>
                                )}
                                <span className="text-xs text-silver-dark ml-auto">
                                    {rows.length} of {entries.length} entries
                                </span>
                            </div>

                            {/* ── Ledger Table ── */}
                            <div className="glass-card rounded-lg overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="animate-spin w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full mr-3" />
                                        <span className="text-silver-dark">Loading ledger data...</span>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead>
                                                <tr className="bg-accent-orange">
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '90px' }}>Date</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '160px' }}>Entry No.</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '220px' }}>Description</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Ref. No.</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '120px' }}>Party</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '110px' }}>Source</th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Debit</th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>Credit</th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-white uppercase whitespace-nowrap" style={{ minWidth: '150px' }}>Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-dark-border">
                                                {/* Opening Balance Row */}
                                                <tr className="bg-yellow-500/5 border-l-2 border-yellow-500">
                                                    <td className="px-3 py-3 text-xs text-silver-dark" colSpan={6}>
                                                        <span className="font-semibold text-yellow-400">↑ Opening Balance</span>
                                                        <span className="ml-2 text-silver-dark text-xs">
                                                            (before {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })})
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3" />
                                                    <td className="px-3 py-3" />
                                                    <td className="px-3 py-3 text-right font-bold text-yellow-400 font-mono text-sm">
                                                        {fmtIDR(openingBalance)}
                                                        <div className="flex justify-end mt-0.5"><BalanceTag bal={openingBalance} /></div>
                                                    </td>
                                                </tr>

                                                {/* Transaction Rows */}
                                                {rows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="px-4 py-12 text-center text-silver-dark">
                                                            No transactions found in this period for the selected account.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    rows.map((entry, idx) => {
                                                        const srcCfg = getSourceConfig(entry);
                                                        const isLinked = entry.reference_type && entry.reference_type !== 'adjustment' && entry.reference_number;
                                                        const debitAmt = fmtAmount(entry.debit, entry.currency, entry.exchange_rate);
                                                        const creditAmt = fmtAmount(entry.credit, entry.currency, entry.exchange_rate);
                                                        return (
                                                            <tr key={entry.id || idx} className="hover:bg-dark-surface/60 smooth-transition group">
                                                                <td className="px-3 py-2.5 text-silver-dark whitespace-nowrap text-xs">
                                                                    {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-accent-orange text-xs font-mono whitespace-nowrap">
                                                                    {entry.entry_number}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-silver-light max-w-[220px]" title={entry.description}>
                                                                    <span className="block truncate text-xs">{entry.description || '-'}</span>
                                                                </td>
                                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                                    {isLinked ? (
                                                                        <button onClick={() => goToSource(entry)}
                                                                            className="flex items-center gap-1 text-xs text-accent-blue hover:text-blue-300 smooth-transition">
                                                                            {entry.reference_number}
                                                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-silver-dark text-xs">{entry.reference_number || '-'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-silver-dark text-xs whitespace-nowrap max-w-[120px]">
                                                                    <span className="block truncate">{entry.party_name || '-'}</span>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${srcCfg.color}`}>
                                                                        {srcCfg.label}
                                                                    </span>
                                                                </td>
                                                                {/* Debit */}
                                                                <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                                                    {debitAmt ? (
                                                                        <div>
                                                                            <span className="text-green-400 font-medium">{debitAmt.primary}</span>
                                                                            {debitAmt.secondary && <div className="text-[10px] text-silver-dark">{debitAmt.secondary}</div>}
                                                                        </div>
                                                                    ) : <span className="text-silver-dark/40">—</span>}
                                                                </td>
                                                                {/* Credit */}
                                                                <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                                                    {creditAmt ? (
                                                                        <div>
                                                                            <span className="text-blue-400 font-medium">{creditAmt.primary}</span>
                                                                            {creditAmt.secondary && <div className="text-[10px] text-silver-dark">{creditAmt.secondary}</div>}
                                                                        </div>
                                                                    ) : <span className="text-silver-dark/40">—</span>}
                                                                </td>
                                                                {/* Running Balance */}
                                                                <td className="px-3 py-2.5 text-right font-mono font-medium whitespace-nowrap">
                                                                    <span className={entry.runningBalance >= 0 ? 'text-silver-light' : 'text-red-400'}>
                                                                        {fmtIDR(entry.runningBalance)}
                                                                    </span>
                                                                    <div className="flex justify-end mt-0.5">
                                                                        <BalanceTag bal={entry.runningBalance} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}

                                                {/* Closing Balance Row */}
                                                {rows.length > 0 && (
                                                    <tr className="bg-purple-500/5 border-l-2 border-purple-500">
                                                        <td className="px-3 py-3" colSpan={6}>
                                                            <span className="font-semibold text-purple-400">↓ Closing Balance</span>
                                                            <span className="ml-2 text-silver-dark text-xs">
                                                                ({new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })})
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-bold text-green-400 font-mono text-sm">{fmtIDR(totalDebit)}</td>
                                                        <td className="px-3 py-3 text-right font-bold text-blue-400 font-mono text-sm">{fmtIDR(totalCredit)}</td>
                                                        <td className="px-3 py-3 text-right font-mono">
                                                            <span className={`font-bold text-sm ${closingBalance >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                                                                {fmtIDR(closingBalance)}
                                                            </span>
                                                            <div className="flex justify-end mt-0.5"><BalanceTag bal={closingBalance} /></div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* ── Period Summary Footer ── */}
                            {rows.length > 0 && (
                                <div className="glass-card p-4 rounded-lg">
                                    <h3 className="text-xs font-semibold text-silver-light uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 text-accent-blue" /> Period Summary
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-silver-dark mb-0.5">Total Transactions</p>
                                            <p className="font-semibold text-silver-light">{rows.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-silver-dark mb-0.5">Net Movement</p>
                                            <p className={`font-semibold font-mono ${(totalDebit - totalCredit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {fmtIDR(totalDebit - totalCredit, true)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-silver-dark mb-0.5">Avg per Transaction</p>
                                            <p className="font-semibold text-silver-light font-mono">
                                                {fmtIDR(Math.max(totalDebit, totalCredit) / Math.max(rows.length, 1))}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-silver-dark mb-0.5">Balance Change</p>
                                            <p className={`font-semibold font-mono ${(closingBalance - openingBalance) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {fmtIDR(closingBalance - openingBalance, true)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneralLedger;
