import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/Common/Button';
import {
    BookOpen, Search, Calendar, Download, RefreshCw,
    ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
    FileText, ExternalLink, Info, ChevronDown, ChevronRight,
    BarChart2, Filter, X, DollarSign, Layers, Tag, Printer
} from 'lucide-react';
import { printReport, fmtDatePrint } from '../../utils/printPDF';
import { journalEntriesHasColumn } from '../../utils/journalHelper';
import { useData } from '../../context/DataContext';

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
// ── Export PDF ─────────────────────────────────────────────────────────────
const exportToPDF = (selectedAccount, accountInfo, dateRange, openingBalance, totalDebit, totalCredit, closingBalance, rows, typeConfig, companyInfo) => {
    if (!selectedAccount || !accountInfo) return;
    const period = `${fmtDatePrint(dateRange.start)} – ${fmtDatePrint(dateRange.end)}`;
    const fmtP = (v) => {
        if (v === undefined || v === null) return '-';
        const neg = v < 0;
        const s = `Rp ${Math.abs(v).toLocaleString('id-ID')}`;
        return neg ? `(${s})` : s;
    };
    const fmtAmt = (value, currency, exchangeRate) => {
        if (!value || value === 0) return '';
        if (currency && currency !== 'IDR' && (exchangeRate || 1) > 1)
            return `Rp ${Math.abs(value * exchangeRate).toLocaleString('id-ID')}`;
        if (currency === 'USD') return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        return `Rp ${Math.abs(value).toLocaleString('id-ID')}`;
    };

    const bodyHTML = `
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="label">Opening Balance</div>
                    <div class="value">${fmtP(openingBalance)}</div>
                    <div style="font-size:8px;color:#94a3b8">Before ${fmtDatePrint(dateRange.start)}</div>
                </div>
                <div class="summary-card green-card">
                    <div class="label">Total Debit</div>
                    <div class="value">${fmtP(totalDebit)}</div>
                    <div style="font-size:8px;color:#94a3b8">${rows.filter(r => r.debit > 0).length} lines</div>
                </div>
                <div class="summary-card blue-card">
                    <div class="label">Total Credit</div>
                    <div class="value">${fmtP(totalCredit)}</div>
                    <div style="font-size:8px;color:#94a3b8">${rows.filter(r => r.credit > 0).length} lines</div>
                </div>
                <div class="summary-card ${closingBalance >= 0 ? 'purple-card' : 'red-card'}">
                    <div class="label">Closing Balance</div>
                    <div class="value">${fmtP(closingBalance)}</div>
                    <div style="font-size:8px;color:#94a3b8">${fmtDatePrint(dateRange.end)}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="min-width:90px">Date</th>
                        <th style="min-width:130px">Entry No.</th>
                        <th style="min-width:180px">Description</th>
                        <th style="min-width:110px">Reference</th>
                        <th style="min-width:100px">Party</th>
                        <th style="min-width:80px">Source</th>
                        <th class="text-right" style="min-width:110px">Debit</th>
                        <th class="text-right" style="min-width:110px">Credit</th>
                        <th class="text-right" style="min-width:120px">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="row-opening">
                        <td colspan="6" class="yellow-label">↑ Opening Balance
                            <span style="font-weight:normal;color:#92400e;font-size:8px"> (before ${fmtDatePrint(dateRange.start)})</span>
                        </td>
                        <td></td><td></td>
                        <td class="text-right mono yellow-label">${fmtP(openingBalance)}</td>
                    </tr>
                    ${rows.map(entry => `
                    <tr>
                        <td class="muted">${fmtDatePrint(entry.entry_date)}</td>
                        <td class="code">${entry.entry_number || '-'}</td>
                        <td>${(entry.description || '-').substring(0, 50)}</td>
                        <td class="muted">${entry.reference_number || '-'}</td>
                        <td class="muted">${(entry.party_name || '-').substring(0, 20)}</td>
                        <td class="muted">${(entry.reference_type || entry.source || 'auto').toUpperCase()}</td>
                        <td class="text-right mono green">${entry.debit > 0 ? fmtAmt(entry.debit, entry.currency, entry.exchange_rate) : ''}</td>
                        <td class="text-right mono" style="color:#1d4ed8">${entry.credit > 0 ? fmtAmt(entry.credit, entry.currency, entry.exchange_rate) : ''}</td>
                        <td class="text-right mono ${entry.runningBalance < 0 ? 'red' : ''}">${fmtP(entry.runningBalance)}</td>
                    </tr>`).join('')}
                    <tr class="row-closing">
                        <td colspan="6" class="purple">↓ Closing Balance
                            <span style="font-weight:normal;color:#7c3aed;font-size:8px"> (${fmtDatePrint(dateRange.end)})</span>
                        </td>
                        <td class="text-right mono green bold">${fmtP(totalDebit)}</td>
                        <td class="text-right mono bold" style="color:#1d4ed8">${fmtP(totalCredit)}</td>
                        <td class="text-right mono ${closingBalance < 0 ? 'red' : 'purple'} bold">${fmtP(closingBalance)}</td>
                    </tr>
                </tbody>
            </table>`;

    printReport({
        reportName: 'General Ledger',
        companyInfo,
        period,
        bodyHTML,
        note: `Account: [${accountInfo.code}] ${accountInfo.name} | Type: ${typeConfig.label} | Normal Balance: ${typeConfig.normalBalance} | Showing ${rows.length} transactions.`
    });
};

// ─────────────────────────────────────────────────────────────────────────────
const GeneralLedger = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { companySettings } = useData();

    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [showSidebar, setShowSidebar] = useState(true);
    const [accountBalances, setAccountBalances] = useState({}); // coaId / account_code → balance
    const [balancesLoading, setBalancesLoading] = useState(false);
    const [journalHasCoaId, setJournalHasCoaId] = useState(null);
    const [coaSearchTerm, setCoaSearchTerm] = useState('');

    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    });

    // ── Deep-link from Trial Balance ─────────────────────────────────────────
    useEffect(() => { fetchAccounts(); }, []);

    useEffect(() => {
        const checkColumn = async () => {
            const hasCoaColumn = await journalEntriesHasColumn('coa_id');
            setJournalHasCoaId(hasCoaColumn);
        };
        checkColumn();
    }, []);

    useEffect(() => {
        if (location.state?.preSelectedAccount) {
            setSelectedAccount(location.state.preSelectedAccount);
        }
    }, [location.state]);

    useEffect(() => {
        if (journalHasCoaId === null) return;
        if (selectedAccount && dateRange.start && dateRange.end) {
            fetchLedgerData();
        } else {
            setEntries([]);
            setOpeningBalance(0);
        }
    }, [selectedAccount, dateRange, journalHasCoaId]);

    useEffect(() => {
        if (journalHasCoaId === null) return;
        if (accounts.length > 0) fetchAccountBalances(accounts);
    }, [accounts, journalHasCoaId]);

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

            const selectCols = journalHasCoaId
                ? 'coa_id, account_code, debit, credit, currency, exchange_rate'
                : 'account_code, debit, credit, currency, exchange_rate';

            const { data } = await supabase
                .from('blink_journal_entries')
                .select(selectCols)
                .gte('entry_date', yearStart)
                .lte('entry_date', yearEnd);

            if (!data) return;

            const codeMap = {};
            const nameMap = {};
            accs.forEach(acc => {
                if (acc.code) codeMap[acc.code] = acc.id;
                if (acc.name) nameMap[acc.name.toLowerCase().trim()] = acc.id;
            });

            const bal = {};
            data.forEach(e => {
                let targetId = journalHasCoaId ? e.coa_id : codeMap[e.account_code];
                if (!targetId && e.account_name) {
                    targetId = nameMap[e.account_name.toLowerCase().trim()];
                }
                if (!targetId) return;
                if (!bal[targetId]) bal[targetId] = { d: 0, c: 0 };
                bal[targetId].d += toIDR(e.debit, e.currency, e.exchange_rate) ?? 0;
                bal[targetId].c += toIDR(e.credit, e.currency, e.exchange_rate) ?? 0;
            });

            const result = {};
            accs.forEach(acc => {
                const b = bal[acc.id] || { d: 0, c: 0 };
                const isCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                result[acc.id] = isCredit ? (b.c - b.d) : (b.d - b.c);
            });
            setAccountBalances(result);
        } catch (e) {
            console.error('Balance fetch error:', e);
        } finally {
            setBalancesLoading(false);
        }
    };

    // ── Fetch Ledger ──────────────────────────────────────────────────────────
    const fetchLedgerData = async () => {
        try {
            setLoading(true);
            
            if (!selectedAccount) {
                setLoading(false);
                return;
            }

            const isUnclassified = selectedAccount.startsWith('unclassified_');
            const unclassifiedCode = isUnclassified ? selectedAccount.replace('unclassified_', '') : null;

            const acc = accounts.find(a => a.id === selectedAccount);
            if (!acc && !isUnclassified) {
                setLoading(false);
                return;
            }
            
            const isNormalCredit = isUnclassified ? false : ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc?.type);

            // Opening balance: dual-match by coa_id OR account_code
            // (old entries might have code but no coa_id)
            const fetchPrev = async () => {
                const results = await Promise.all([
                    supabase.from('blink_journal_entries')
                        .select('debit, credit, currency, exchange_rate, id')
                        .eq('coa_id', selectedAccount)
                        .lt('entry_date', dateRange.start),
                    (acc?.code || isUnclassified) ? supabase.from('blink_journal_entries')
                        .select('debit, credit, currency, exchange_rate, id')
                        .eq('account_code', acc?.code || unclassifiedCode)
                        .is('coa_id', null)
                        .lt('entry_date', dateRange.start) : Promise.resolve({ data: [] }),
                    acc?.name ? supabase.from('blink_journal_entries')
                        .select('debit, credit, currency, exchange_rate, id')
                        .ilike('account_name', acc.name)
                        .lt('entry_date', dateRange.start) : Promise.resolve({ data: [] })
                ]);
                const rows = [...(results[0].data || []), ...(results[1].data || []), ...(results[2].data || [])];
                // deduplicate by id
                return [...new Map(rows.map(r => [r.id, r])).values()];
            };

            const prev = await fetchPrev();
            const prevD = prev.reduce((s, e) => s + ((toIDR(e.debit, e.currency, e.exchange_rate) ?? 0)), 0);
            const prevC = prev.reduce((s, e) => s + ((toIDR(e.credit, e.currency, e.exchange_rate) ?? 0)), 0);
            const opening = isNormalCredit ? (prevC - prevD) : (prevD - prevC);
            setOpeningBalance(opening);

            // Current period: dual-fetch same pattern
            const [r1, r2, r3] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('*')
                    .eq('coa_id', selectedAccount)
                    .gte('entry_date', dateRange.start)
                    .lte('entry_date', dateRange.end)
                    .order('entry_date', { ascending: true })
                    .order('created_at', { ascending: true }),
                (acc?.code || isUnclassified) ? supabase.from('blink_journal_entries')
                    .select('*')
                    .eq('account_code', acc?.code || unclassifiedCode)
                    .is('coa_id', null)
                    .gte('entry_date', dateRange.start)
                    .lte('entry_date', dateRange.end)
                    .order('entry_date', { ascending: true })
                    .order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
                acc?.name ? supabase.from('blink_journal_entries')
                    .select('*')
                    .ilike('account_name', acc.name)
                    .gte('entry_date', dateRange.start)
                    .lte('entry_date', dateRange.end)
                    .order('entry_date', { ascending: true })
                    .order('created_at', { ascending: true }) : Promise.resolve({ data: [] })
            ]);

            if (r1.error) throw r1.error;
            const combined = [...(r1.data || []), ...(r2.data || []), ...(r3.data || [])];
            
            // Enhanced deduplication: use composite key (entry_number + entry_date + debit + credit)
            // to catch duplicates from different fetch sources
            const uniqueMap = new Map();
            combined.forEach(r => {
                const key = `${r.entry_number || r.id}-${r.entry_date}-${r.debit}-${r.credit}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, r);
                }
            });
            const unique = Array.from(uniqueMap.values());
            
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
    const isUnclassifiedSelected = selectedAccount && selectedAccount.startsWith('unclassified_');
    const accountInfo = isUnclassifiedSelected 
        ? { code: selectedAccount.replace('unclassified_', ''), name: 'Unmapped Account', type: 'ASSET' }
        : accounts.find(a => a.id === selectedAccount);
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

    const totalDebit = filteredEntries.reduce((s, e) => {
        const val = toIDR(e.debit, e.currency, e.exchange_rate);
        return s + (val ?? 0);
    }, 0);
    const totalCredit = filteredEntries.reduce((s, e) => {
        const val = toIDR(e.credit, e.currency, e.exchange_rate);
        return s + (val ?? 0);
    }, 0);
    
    // Enhanced balance calculation with edge case handling
    const closingBalance = useMemo(() => {
        if (!Number.isFinite(openingBalance)) return 0;
        const td = Number.isFinite(totalDebit) ? totalDebit : 0;
        const tc = Number.isFinite(totalCredit) ? totalCredit : 0;
        
        if (isNormalCredit) {
            return openingBalance + tc - td;
        } else {
            return openingBalance + td - tc;
        }
    }, [openingBalance, totalDebit, totalCredit, isNormalCredit]);

    // Running balance with DR/CR tag and edge case handling
    const rows = useMemo(() => {
        let running = Number.isFinite(openingBalance) ? openingBalance : 0;
        return filteredEntries.map(e => {
            const d = toIDR(e.debit, e.currency, e.exchange_rate) ?? 0;
            const c = toIDR(e.credit, e.currency, e.exchange_rate) ?? 0;
            
            if (isNormalCredit) {
                running = running + c - d;
            } else {
                running = running + d - c;
            }
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
        const term = coaSearchTerm.toLowerCase();
        accounts.forEach(acc => {
            if (term && !(acc.code.toLowerCase().includes(term) || acc.name.toLowerCase().includes(term))) return;
            if (!groups[acc.type]) groups[acc.type] = [];
            groups[acc.type].push(acc);
        });
        return groups;
    }, [accounts, coaSearchTerm]);

    const [expandedTypes, setExpandedTypes] = useState(new Set(['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE']));
    const toggleType = (type) => setExpandedTypes(prev => {
        const next = new Set(prev);
        next.has(type) ? next.delete(type) : next.add(type);
        return next;
    });


    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3" style={{ minHeight: 'calc(100vh - 80px)' }}>

            {/* ── TOP BAR ── */}
            <div className="glass-card rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 border border-dark-border">
                <div className="flex items-center gap-2.5 shrink-0">
                    <BookOpen className="w-5 h-5 text-accent-orange" />
                    <div>
                        <h1 className="text-base font-bold gradient-text leading-tight">General Ledger</h1>
                        <p className="text-[10px] text-silver-dark">Per-account transaction detail with running balance</p>
                    </div>
                </div>
                <div className="w-px h-7 bg-dark-border hidden md:block mx-1 shrink-0" />
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    <Calendar className="w-3.5 h-3.5 text-silver-dark shrink-0" />
                    <input type="date" value={dateRange.start}
                        onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-2.5 py-1.5 bg-dark-bg border border-dark-border rounded text-silver-light text-xs" />
                    <span className="text-silver-dark text-xs">—</span>
                    <input type="date" value={dateRange.end}
                        onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-2.5 py-1.5 bg-dark-bg border border-dark-border rounded text-silver-light text-xs" />
                    <div className="flex gap-1">
                        {[
                            { label: 'This Month', fn: () => { const d = new Date(); setDateRange({ start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: d.toISOString().split('T')[0] }); } },
                            { label: 'Quarter', fn: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); setDateRange({ start: `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`, end: d.toISOString().split('T')[0] }); } },
                            { label: 'This Year', fn: () => { const d = new Date(); setDateRange({ start: `${d.getFullYear()}-01-01`, end: d.toISOString().split('T')[0] }); } },
                        ].map(({ label, fn }) => (
                            <button key={label} onClick={fn} className="px-2 py-1 text-[10px] bg-dark-surface border border-dark-border text-silver-dark hover:text-white hover:border-accent-blue/50 rounded smooth-transition">
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setShowSidebar(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs smooth-transition ${showSidebar ? 'bg-accent-orange/10 border-accent-orange/40 text-accent-orange' : 'bg-dark-surface border-dark-border text-silver-dark hover:text-white'}`}>
                        <Layers className="w-3.5 h-3.5" />{showSidebar ? 'Hide' : 'Show'} Accounts
                    </button>
                    <button onClick={fetchLedgerData} disabled={!selectedAccount}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-dark-border text-xs text-silver-dark hover:text-white hover:bg-dark-card smooth-transition disabled:opacity-40">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button onClick={exportCSV} disabled={!selectedAccount || loading}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-dark-border text-xs text-silver-dark hover:text-white hover:bg-dark-card smooth-transition disabled:opacity-40">
                        <FileText className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => exportToPDF(selectedAccount, accountInfo, dateRange, openingBalance, totalDebit, totalCredit, closingBalance, rows, typeConfig, companySettings)} disabled={!selectedAccount || loading || rows.length === 0}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-dark-border text-xs text-red-400 hover:text-red-300 hover:bg-dark-card smooth-transition disabled:opacity-40">
                        <Printer className="w-3.5 h-3.5" /> Print PDF
                    </button>
                </div>
            </div>

            {/* ── BODY: Sidebar + Content (each scrolls independently) ── */}
            <div className="flex gap-3 flex-1 overflow-hidden" style={{ height: 'calc(100vh - 145px)' }}>

                {/* ── COA SIDEBAR ── */}
                {showSidebar && (
                    <div className="w-60 shrink-0 glass-card rounded-xl border border-dark-border flex flex-col overflow-hidden">
                        <div className="px-3 pt-3 pb-2 border-b border-dark-border bg-dark-bg/80 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-silver-light uppercase tracking-widest">Chart of Accounts</span>
                                <span className="text-[9px] text-silver-dark bg-dark-surface px-1.5 py-0.5 rounded border border-dark-border">YTD</span>
                            </div>
                            <div className="relative">
                                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-silver-dark" />
                                <input type="text" placeholder="Search account code or name..."
                                    value={coaSearchTerm} onChange={e => setCoaSearchTerm(e.target.value)}
                                    className="w-full pl-6 pr-5 py-1.5 bg-dark-surface border border-dark-border rounded text-[11px] text-silver-light placeholder:text-silver-dark/40 focus:border-accent-blue/50 smooth-transition" />
                                {coaSearchTerm && (
                                    <button onClick={() => setCoaSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                                        <X className="w-2.5 h-2.5 text-silver-dark hover:text-white" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {loadingAccounts ? (
                                <div className="flex justify-center py-8"><div className="animate-spin w-4 h-4 border-2 border-accent-orange border-t-transparent rounded-full" /></div>
                            ) : Object.keys(groupedAccounts).length === 0 ? (
                                <div className="py-8 px-3 text-center">
                                    <Search className="w-5 h-5 text-silver-dark/30 mx-auto mb-1.5" />
                                    <p className="text-[10px] text-silver-dark">No results for "{coaSearchTerm}"</p>
                                </div>
                            ) : (
                                Object.entries(groupedAccounts).map(([type, accs]) => {
                                    const cfg = COA_TYPE_CONFIG[type] || COA_TYPE_CONFIG.ASSET;
                                    const isEx = expandedTypes.has(type);
                                    const typeTotal = accs.reduce((s, a) => s + (accountBalances[a.id] || 0), 0);
                                    return (
                                        <div key={type}>
                                            <button onClick={() => toggleType(type)}
                                                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-dark-surface/60 hover:bg-dark-surface smooth-transition border-b border-dark-border/40">
                                                <div className="flex items-center gap-1.5">
                                                    {isEx ? <ChevronDown className="w-2.5 h-2.5 text-silver-dark" /> : <ChevronRight className="w-2.5 h-2.5 text-silver-dark" />}
                                                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${cfg.color}`}>{cfg.label}</span>
                                                    <span className="text-[9px] text-silver-dark/50">({accs.length})</span>
                                                </div>
                                                <span className={`text-[9px] font-mono ${typeTotal >= 0 ? 'text-silver-dark' : 'text-red-400'}`}>
                                                    {balancesLoading ? '...' : Math.abs(typeTotal) > 1e9 ? `${(typeTotal / 1e9).toFixed(1)}B` : Math.abs(typeTotal) > 1e6 ? `${(typeTotal / 1e6).toFixed(1)}M` : Math.abs(typeTotal) > 1e3 ? `${(typeTotal / 1e3).toFixed(0)}K` : '-'}
                                                </span>
                                            </button>
                                            {isEx && accs.map(acc => {
                                                const bal = accountBalances[acc.id] || 0;
                                                const isSelected = selectedAccount === acc.id;
                                                return (
                                                    <button key={acc.id} onClick={() => setSelectedAccount(acc.id)}
                                                        className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between border-b border-dark-border/20 smooth-transition group ${isSelected ? 'bg-accent-orange/10 border-l-2 border-l-accent-orange' : 'hover:bg-dark-surface/40'}`}>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-[9px] font-mono truncate ${isSelected ? 'text-accent-orange' : 'text-silver-dark/60'}`}>{acc.code}</p>
                                                            <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-white font-medium' : 'text-silver-dark group-hover:text-silver-light'}`}>{acc.name}</p>
                                                        </div>
                                                        <span className={`text-[9px] ml-1 shrink-0 font-mono ${bal < 0 ? 'text-red-400' : bal > 0 ? 'text-silver-light' : 'text-silver-dark/20'}`}>
                                                            {bal === 0 ? '' : Math.abs(bal) > 1e9 ? `${(Math.abs(bal) / 1e9).toFixed(1)}B` : Math.abs(bal) > 1e6 ? `${(Math.abs(bal) / 1e6).toFixed(1)}M` : `${(Math.abs(bal) / 1e3).toFixed(0)}K`}
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

                {/* ── MAIN CONTENT ── */}
                <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
                    {!selectedAccount ? (
                        <div className="glass-card rounded-xl border border-dark-border p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-accent-orange/10 flex items-center justify-center mb-4">
                                <BookOpen className="w-7 h-7 text-accent-orange/50" />
                            </div>
                            <p className="text-sm font-semibold text-silver-light">Select a COA Account</p>
                            <p className="text-xs text-silver-dark mt-1">Click an account in the left sidebar to view the ledger</p>
                            {!showSidebar && (
                                <button onClick={() => setShowSidebar(true)}
                                    className="mt-4 px-4 py-2 bg-accent-orange/10 border border-accent-orange/30 text-accent-orange text-xs rounded-lg hover:bg-accent-orange/20 smooth-transition">
                                    Show Account Sidebar
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Account info banner */}
                            <div className="glass-card rounded-xl border border-dark-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${typeConfig.color}`}>{typeConfig.label}</span>
                                <span className="font-mono text-accent-blue text-xs font-bold">{accountInfo?.code}</span>
                                <span className="text-silver-light font-semibold text-sm">{accountInfo?.name}</span>
                                <span className="text-[10px] text-silver-dark border border-dark-border rounded px-1.5 py-0.5">Normal Balance: {typeConfig.normalBalance}</span>
                                <span className="text-[10px] text-silver-dark">{filteredEntries.length} transactions</span>
                                {sparkData.length > 1 && <span className="ml-auto"><Sparkline data={sparkData} color={typeConfig.accent} width={80} height={22} /></span>}
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    { label: 'Opening Balance', value: fmtIDR(openingBalance), sub: `Before ${new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`, border: 'border-yellow-500', text: 'text-silver-light' },
                                    { label: 'Total Debit', value: fmtIDR(totalDebit), sub: `${filteredEntries.filter(e => e.debit > 0).length} lines`, border: 'border-green-500', text: 'text-green-400' },
                                    { label: 'Total Credit', value: fmtIDR(totalCredit), sub: `${filteredEntries.filter(e => e.credit > 0).length} lines`, border: 'border-blue-500', text: 'text-blue-400' },
                                    { label: 'Closing Balance', value: fmtIDR(closingBalance), sub: new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), border: closingBalance >= 0 ? 'border-purple-500' : 'border-red-500', text: closingBalance >= 0 ? 'text-purple-400' : 'text-red-400' },
                                ].map(c => (
                                    <div key={c.label} className={`glass-card p-3 rounded-xl border-l-4 ${c.border} border border-dark-border`}>
                                        <p className="text-[9px] text-silver-dark uppercase tracking-wider">{c.label}</p>
                                        <p className={`text-xs font-bold mt-1 font-mono ${c.text}`}>{c.value}</p>
                                        <p className="text-[9px] text-silver-dark mt-0.5">{c.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Search + Filter */}
                            <div className="flex gap-2 items-center flex-wrap">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-silver-dark" />
                                    <input type="text" placeholder="Search description, reference, party..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-7 pr-4 py-1.5 bg-dark-surface border border-dark-border rounded text-silver-light text-xs" />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                            <X className="w-2.5 h-2.5 text-silver-dark hover:text-white" />
                                        </button>
                                    )}
                                </div>
                                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                                    className="px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded text-silver-light text-xs">
                                    <option value="all">All Sources</option>
                                    {availableSources.map(s => <option key={s} value={s}>{SOURCE_CONFIG[s]?.label || s}</option>)}
                                </select>
                                {(searchTerm || sourceFilter !== 'all') && (
                                    <button onClick={() => { setSearchTerm(''); setSourceFilter('all'); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-silver-dark border border-dark-border rounded hover:text-white smooth-transition">
                                        <X className="w-2.5 h-2.5" /> Reset
                                    </button>
                                )}
                                <span className="text-[10px] text-silver-dark ml-auto">{rows.length}/{entries.length} entries</span>
                            </div>

                            {/* Ledger Table */}
                            <div className="glass-card rounded-xl border border-dark-border overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full mr-3" />
                                        <span className="text-silver-dark text-xs">Loading ledger data...</span>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-max">
                                            <thead>
                                                <tr className="bg-accent-orange">
                                                    {['Date', 'Entry No.', 'Description', 'Reference', 'Party', 'Source', 'Debit', 'Credit', 'Balance'].map((h, i) => (
                                                        <th key={h} className={`px-3 py-2 font-semibold text-white uppercase whitespace-nowrap ${i >= 6 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}
                                                            style={{ minWidth: [90, 150, 200, 120, 110, 90, 120, 120, 130][i] }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-dark-border/40">
                                                <tr className="bg-yellow-500/5 border-l-2 border-yellow-500">
                                                    <td className="px-3 py-1.5" colSpan={6}>
                                                        <span className="font-semibold text-yellow-400">↑ Opening Balance</span>
                                                        <span className="ml-2 text-silver-dark text-[10px]">(before {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })})</span>
                                                    </td>
                                                    <td className="px-3 py-1.5" />
                                                    <td className="px-3 py-1.5" />
                                                    <td className="px-3 py-1.5 text-right font-bold text-yellow-400 font-mono">{fmtIDR(openingBalance)}</td>
                                                </tr>
                                                {rows.length === 0 ? (
                                                    <tr><td colSpan={9} className="px-4 py-10 text-center text-silver-dark">Tidak ada transactions pada periode dan akun ini.</td></tr>
                                                ) : rows.map((entry, idx) => {
                                                    const srcCfg = getSourceConfig(entry);
                                                    const isLinked = entry.reference_type && entry.reference_type !== 'adjustment' && entry.reference_number;
                                                    const debitAmt = fmtAmount(entry.debit, entry.currency, entry.exchange_rate);
                                                    const creditAmt = fmtAmount(entry.credit, entry.currency, entry.exchange_rate);
                                                    return (
                                                        <tr key={entry.id || idx} className="hover:bg-accent-orange/5 smooth-transition group">
                                                            <td className="px-3 py-2 text-silver-dark whitespace-nowrap">{new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-2 text-accent-orange font-mono whitespace-nowrap">{entry.entry_number}</td>
                                                            <td className="px-3 py-2 max-w-[200px]" title={entry.description}><span className="block truncate text-silver-light">{entry.description || '-'}</span></td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                {isLinked ? (
                                                                    <button onClick={() => goToSource(entry)} className="flex items-center gap-1 text-accent-blue hover:text-blue-300 smooth-transition">
                                                                        {entry.reference_number}<ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                                                                    </button>
                                                                ) : <span className="text-silver-dark">{entry.reference_number || '-'}</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-silver-dark whitespace-nowrap max-w-[110px]"><span className="block truncate">{entry.party_name || '-'}</span></td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${srcCfg.color}`}>{srcCfg.label}</span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                                                                {debitAmt ? <><span className="text-green-400 font-medium">{debitAmt.primary}</span>{debitAmt.secondary && <div className="text-[9px] text-silver-dark">{debitAmt.secondary}</div>}</> : <span className="text-silver-dark/30">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                                                                {creditAmt ? <><span className="text-blue-400 font-medium">{creditAmt.primary}</span>{creditAmt.secondary && <div className="text-[9px] text-silver-dark">{creditAmt.secondary}</div>}</> : <span className="text-silver-dark/30">—</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-medium whitespace-nowrap">
                                                                <span className={entry.runningBalance >= 0 ? 'text-silver-light' : 'text-red-400'}>{fmtIDR(entry.runningBalance)}</span>
                                                                <div className="flex justify-end mt-0.5"><BalanceTag bal={entry.runningBalance} /></div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {rows.length > 0 && (
                                                    <tr className="bg-purple-500/5 border-l-2 border-purple-500">
                                                        <td className="px-3 py-1.5" colSpan={6}>
                                                            <span className="font-semibold text-purple-400">↓ Closing Balance</span>
                                                            <span className="ml-2 text-silver-dark text-[10px]">({new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-GB', { dateStyle: 'medium' })})</span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-green-400 font-mono">{fmtIDR(totalDebit)}</td>
                                                        <td className="px-3 py-1.5 text-right font-bold text-blue-400 font-mono">{fmtIDR(totalCredit)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono">
                                                            <span className={`font-bold ${closingBalance >= 0 ? 'text-purple-400' : 'text-red-400'}`}>{fmtIDR(closingBalance)}</span>
                                                            <div className="flex justify-end mt-0.5"><BalanceTag bal={closingBalance} /></div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneralLedger;
