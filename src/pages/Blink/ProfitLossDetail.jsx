import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, Calendar, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getActiveDivision } from '../../utils/divisionContext';

const ProfitLossDetail = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const activeDivision = getActiveDivision();
    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [loading, setLoading] = useState(true);
    const [taxRate, setTaxRate] = useState(22);
    const [reportData, setReportData] = useState({
        revenue: { groups: [] },
        cogs: { groups: [] },
        expenses: { groups: [] },
        other_income: { groups: [] },
        other_expense: { groups: [] },
    });
    const [totals, setTotals] = useState({ raw: null, prof: null });
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedSections, setExpandedSections] = useState({
        revenue: true, cogs: true, expenses: true, other_income: true, other_expense: true
    });

    useEffect(() => { fetchReportData(); }, [selectedMonth]);

    useEffect(() => {
        if (totals.prof && totals.prof.current) {
            const calcProfits = (t) => {
                const nibt = t.nibt;
                const tax = nibt > 0 ? nibt * (taxRate / 100) : 0;
                return { ...t, tax, niat: nibt - tax };
            };
            setTotals(prev => ({ ...prev, prof: { current: calcProfits(prev.prof.current), prev: calcProfits(prev.prof.prev), ytd: calcProfits(prev.prof.ytd) } }));
        }
    }, [taxRate]);

    const toggleGroup = (key) =>
        setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const { data: coaData, error: coaError } = await supabase
                .from('finance_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            const [y, m] = selectedMonth.split('-');
            const targetYear = parseInt(y, 10);
            const targetMonth = parseInt(m, 10);

            let prevMonth = targetMonth - 1;
            let prevYear = targetYear;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }
            
            const currentMonthCol = selectedMonth;
            const prevMonthCol = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            const queryEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
            const fetchStart = prevYear < targetYear ? `${prevYear}-12-01` : `${targetYear}-01-01`;

            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate, reference_type, reference_id')
                    .eq('division', activeDivision)
                    .not('coa_id', 'is', null)
                    .gte('entry_date', fetchStart).lte('entry_date', queryEnd),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate, reference_type, reference_id')
                    .eq('division', activeDivision)
                    .is('coa_id', null)
                    .gte('entry_date', fetchStart).lte('entry_date', queryEnd)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            const dedupedEntries = [...new Map(combined.map(r => [r.id, r])).values()];

            const [invRes, poRes, arRes, apRes] = await Promise.all([
                supabase
                    .from('blink_invoices')
                    .select('id')
                    .eq('division', activeDivision)
                    .neq('status', 'cancelled'),
                supabase
                    .from('blink_purchase_orders')
                    .select('id')
                    .eq('division', activeDivision)
                    .neq('status', 'cancelled'),
                supabase
                    .from('blink_ar_transactions')
                    .select('id'),
                supabase
                    .from('blink_ap_transactions')
                    .select('id')
            ]);
            if (invRes.error) throw invRes.error;
            if (poRes.error) throw poRes.error;
            if (arRes.error) throw arRes.error;
            if (apRes.error) throw apRes.error;

            const activeInvoiceIds = new Set((invRes.data || []).map(row => String(row.id)));
            const activePOIds = new Set((poRes.data || []).map(row => String(row.id)));
            const activeARIds = new Set((arRes.data || []).map(row => String(row.id)));
            const activeAPIds = new Set((apRes.data || []).map(row => String(row.id)));

            const invoiceRefTypes = new Set(['ar', 'invoice', 'ar_payment', 'ar_reversal']);
            const poRefTypes = new Set(['po', 'ap_reversal']);
            const apRefTypes = new Set(['ap_payment']);

            const entries = dedupedEntries.filter((entry) => {
                const refType = entry.reference_type;
                const refId = entry.reference_id != null ? String(entry.reference_id) : null;
                if (!refType || !refId) return true;
                if (invoiceRefTypes.has(refType)) return activeInvoiceIds.has(refId);
                if (poRefTypes.has(refType)) return activePOIds.has(refId);
                if (apRefTypes.has(refType)) return activeAPIds.has(refId) || activeARIds.has(refId);
                return true;
            });

            const idToCode = {};
            const coaMapByCode = {};
            const codeToMeta = {};
            (coaData || []).forEach(coa => {
                if (coa.code) {
                    const codeStr = String(coa.code).trim();
                    idToCode[coa.id] = codeStr;
                    codeToMeta[codeStr] = coa;
                    if (!coaMapByCode[codeStr]) {
                        coaMapByCode[codeStr] = { ...coa, code: codeStr, amount: 0, currentMonthAmount: 0, prevMonthAmount: 0, ytdAmount: 0 };
                    }
                }
            });

            const toIDR = (v, cur, rate) => {
                if (!v) return 0;
                const numRate = Number(rate);
                return cur && cur !== 'IDR' && numRate > 0 ? v * numRate : v;
            };

            entries.forEach(e => {
                let code = null;
                if (e.coa_id && idToCode[e.coa_id]) {
                    code = idToCode[e.coa_id];
                } else if (e.account_code) {
                    const accCodeStr = String(e.account_code).trim();
                    if (coaMapByCode[accCodeStr]) {
                        code = accCodeStr;
                    }
                }
                
                if (!code) return;
                const acc = coaMapByCode[code];
                if (!acc) return;

                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);
                let val = 0;
                if (['REVENUE', 'OTHER_INCOME'].includes(acc.type)) val = (credit - debit);
                else if (['EXPENSE', 'COGS', 'COST', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(acc.type)) val = (debit - credit);
                const mKey = e.entry_date?.substring(0, 7);
                if (mKey === currentMonthCol) acc.currentMonthAmount += val;
                if (mKey === prevMonthCol) acc.prevMonthAmount += val;
                if (mKey.startsWith(String(targetYear)) && mKey <= currentMonthCol) acc.ytdAmount += val;
            });

            const all = Object.values(coaMapByCode);
            const valid = a => a.currentMonthAmount !== 0 || a.prevMonthAmount !== 0 || a.ytdAmount !== 0;
            const revenue = all.filter(a => a.type === 'REVENUE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const cogs = all.filter(a => ['COGS', 'COST', 'DIRECT_COST'].includes(a.type) && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const expenses = all.filter(a => a.type === 'EXPENSE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const other_income = all.filter(a => a.type === 'OTHER_INCOME' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const other_expense = all.filter(a => a.type === 'OTHER_EXPENSE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));

            const sumField = (arr, field) => arr.reduce((s, a) => s + a[field], 0);
            const rawTotals = {
                current: { rev: sumField(revenue, 'currentMonthAmount'), cogs: sumField(cogs, 'currentMonthAmount'), exp: sumField(expenses, 'currentMonthAmount'), oi: sumField(other_income, 'currentMonthAmount'), oe: sumField(other_expense, 'currentMonthAmount') },
                prev: { rev: sumField(revenue, 'prevMonthAmount'), cogs: sumField(cogs, 'prevMonthAmount'), exp: sumField(expenses, 'prevMonthAmount'), oi: sumField(other_income, 'prevMonthAmount'), oe: sumField(other_expense, 'prevMonthAmount') },
                ytd: { rev: sumField(revenue, 'ytdAmount'), cogs: sumField(cogs, 'ytdAmount'), exp: sumField(expenses, 'ytdAmount'), oi: sumField(other_income, 'ytdAmount'), oe: sumField(other_expense, 'ytdAmount') }
            };
            const calcProfits = (t) => {
                const gp = t.rev - t.cogs;
                const op = gp - t.exp;
                const onet = t.oi - t.oe;
                const nibt = op + onet;
                const tax = nibt > 0 ? nibt * (taxRate / 100) : 0;
                return { gp, op, onet, nibt, tax, niat: nibt - tax };
            };
            const prof = { current: calcProfits(rawTotals.current), prev: calcProfits(rawTotals.prev), ytd: calcProfits(rawTotals.ytd) };

            setReportData({
                revenue,
                cogs,
                expenses,
                other_income,
                other_expense,
            });
            setTotals({ raw: rawTotals, prof });
        } catch (error) {
            console.error('Error fetching P&L data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => {
        if (!amount || amount === 0) return '';
        const s = Math.abs(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        return s;
    };

    const getAmountColor = (amount) => {
        if (!amount || amount === 0) return '';
        return amount < 0 ? 'text-red-600 dark:text-red-400' : '';
    };

    const [selY, selM] = selectedMonth.split('-');
    const firstDate = new Date(parseInt(selY, 10), parseInt(selM, 10) - 1, 1);
    const lastDate = new Date(parseInt(selY, 10), parseInt(selM, 10), 0);
    const formatDate = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const period = `Periode: ${formatDate(firstDate)} - ${formatDate(lastDate)}`;

    const getMonthName = (offset) => {
        const [y, m] = selectedMonth.split('-');
        const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + offset, 1);
        return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    const SectionLabel = ({ label }) => (
        <div className="px-4 py-2 bg-slate-100 dark:bg-dark-surface/70 border-b border-t border-slate-200 dark:border-dark-border mt-2">
            <span className="text-xs font-extrabold text-slate-800 dark:text-silver-light uppercase tracking-widest">{label}</span>
        </div>
    );

    const totalW = 'w-[120px] min-w-[120px]';

    const ItemRow = ({ item }) => (
        <div
            onClick={() => navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: item.id } })}
            className="flex items-center border-b border-gray-100 dark:border-dark-border/20 hover:bg-gray-50 dark:hover:bg-dark-surface/40 cursor-pointer group"
        >
            <div className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center`}>
                <span className="text-[11px] text-slate-600 dark:text-silver-dark font-mono whitespace-nowrap">{item.code}</span>
            </div>
            <div className="text-[12px] text-slate-700 dark:text-silver-light group-hover:underline flex-1 min-w-[300px] px-2 py-2 whitespace-nowrap" title={item.name}>
                {item.name}
            </div>
            <div className="flex items-center flex-shrink-0 pr-2">
                <div className={`flex items-center justify-end text-[11px] font-mono text-slate-500 dark:text-silver-light ${getAmountColor(item.currentMonthAmount)} ${totalW} px-1`} title={fmt(item.currentMonthAmount)}>{fmt(item.currentMonthAmount)}</div>
                <div className={`flex items-center justify-end text-[11px] font-mono text-slate-500 dark:text-silver-light ${getAmountColor(item.prevMonthAmount)} ${totalW} px-1`} title={fmt(item.prevMonthAmount)}>{fmt(item.prevMonthAmount)}</div>
                <div className={`flex items-center justify-end text-[12px] font-bold font-mono text-slate-800 dark:text-silver-light ${getAmountColor(item.ytdAmount)} ${totalW} px-1`} title={fmt(item.ytdAmount)}>{fmt(item.ytdAmount)}</div>
            </div>
        </div>
    );

    const renderSection = (accounts, sectionKey) => {
        if (!accounts || accounts.length === 0) return <div className="px-6 py-2 text-[11px] text-silver-dark italic">No data</div>;
        return accounts.map(item => <ItemRow key={item.id} item={item} />);
    };

    const TotalRow = ({ label, vals, highlight, thick, indent }) => {
        const colors = {
            green: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-500',
            blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-500',
            red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400',
        };
        const cls = highlight ? colors[highlight] : 'bg-slate-50 dark:bg-transparent border-slate-200 dark:border-dark-border/30 text-slate-800 dark:text-silver-light';
        return (
            <div className={`flex items-center border-y ${cls} ${thick ? 'border-t-2' : ''}`}>
                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                <div className={`text-[12px] font-bold uppercase flex-1 min-w-[300px] px-2 py-2 whitespace-nowrap ${indent ? 'pl-6' : ''}`} title={label}>{label}</div>
                <div className="flex items-center flex-shrink-0 pr-2">
                    <div className={`flex items-center justify-end text-[12px] font-bold font-mono ${totalW} px-1 py-2 ${highlight ? '' : (vals.current < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.current)}>{fmt(vals.current)}</div>
                    <div className={`flex items-center justify-end text-[12px] font-bold font-mono ${totalW} px-1 py-2 ${highlight ? '' : (vals.prev < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.prev)}>{fmt(vals.prev)}</div>
                    <div className={`flex items-center justify-end text-[12px] font-bold font-mono ${totalW} px-1 py-2 ${highlight ? '' : (vals.ytd < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.ytd)}>{fmt(vals.ytd)}</div>
                </div>
            </div>
        );
    };

    if (loading || !totals.raw) {
        return <div className="p-12 text-center text-slate-500 dark:text-silver-dark">Loading data...</div>;
    }

    return (
        <div className="w-full px-4 xl:px-8 mx-auto pb-20">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-silver-light flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-accent-orange" />
                        Detail P&L
                    </h1>
                    <p className="text-slate-500 dark:text-silver-dark text-xs">Period: {period}</p>
                    <p className="text-[11px] text-blue-500 dark:text-blue-300">Data ditampilkan sesuai divisi aktif: {activeDivision?.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-dark-border shadow-sm">
                    <div className="flex items-center px-2 border-r border-gray-200 dark:border-dark-border/50">
                        <Calendar className="w-3 h-3 text-gray-500 dark:text-silver-dark mr-2" />
                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Periode:</span>
                        <input type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-900 dark:text-blue-400 focus:ring-0 p-0" />
                    </div>
                    <button onClick={fetchReportData} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors" title="Refresh">
                        <RefreshCw className="w-4 h-4 text-slate-600 dark:text-silver-light" />
                    </button>
                    {/* Tax Rate */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <span className="text-xs text-slate-500 dark:text-silver-dark">Tax:</span>
                        <input
                            type="number" value={taxRate}
                            onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                            className="w-10 text-xs bg-transparent border border-gray-300 dark:border-dark-border rounded px-1 py-0.5 text-slate-800 dark:text-silver-light text-center focus:outline-none focus:border-accent-blue"
                            min="0" max="100" step="0.5"
                        />
                        <span className="text-xs text-slate-500 dark:text-silver-dark">%</span>
                    </div>
                </div>
            </div>

            {/* Report Card */}
            <div className="bg-white dark:bg-dark-surface/20 border border-gray-200 dark:border-dark-border rounded-lg shadow-lg overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <div className="w-max min-w-full">
                        {/* Title */}
                        <div className="text-center py-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface/40">
                            <h2 className="text-base font-extrabold text-red-600 dark:text-red-500 tracking-widest uppercase">Detail Profit & Loss</h2>
                            <p className="text-xs text-slate-500 dark:text-silver-dark mt-1">{period}</p>
                        </div>

                {/* Column header */}
                <div className="flex items-center" style={{ background: '#0070BB' }}>
                    <div className="text-[11px] font-bold uppercase tracking-wider w-[140px] flex-shrink-0 pl-4 pr-2 py-2.5" style={{ color: '#FFFFFF' }}>Code</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider flex-1 min-w-[300px] px-2 py-2.5" style={{ color: '#FFFFFF' }}>Description</div>
                    <div className="flex items-center flex-shrink-0 pr-2">
                        <div className={`flex items-center justify-end text-[11px] font-bold uppercase ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>{getMonthName(0)}</div>
                        <div className={`flex items-center justify-end text-[11px] font-bold uppercase ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>{getMonthName(-1)}</div>
                        <div className={`flex items-center justify-end text-[11px] font-bold uppercase ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>Total YTD</div>
                    </div>
                </div>

                    <>
                        {/* ── INCOME ── */}
                        <SectionLabel label="INCOME" />
                        {renderSection(reportData.revenue, 'revenue')}
                        <TotalRow label="Total Sales Income" highlight="green"
                            vals={{ current: totals.raw.current.rev, prev: totals.raw.prev.rev, ytd: totals.raw.ytd.rev }} />

                        {/* ── COST OF GOOD SOLD ── */}
                        <SectionLabel label="Cost of Good Sold" />
                        {renderSection(reportData.cogs, 'cogs')}
                        <TotalRow label="Total Cost of Good Sold"
                            vals={{ current: totals.raw.current.cogs, prev: totals.raw.prev.cogs, ytd: totals.raw.ytd.cogs }} />

                        {/* ── GROSS PROFIT ── */}
                        <TotalRow label="Total Operation Income ( Gross Profit )"
                            vals={{ current: totals.prof.current.gp, prev: totals.prof.prev.gp, ytd: totals.prof.ytd.gp }}
                            highlight="blue" thick />

                        {/* ── ADMINISTRASI & GENERAL EXPENSES ── */}
                        <SectionLabel label="Administrasi & General Expenses" />
                        {renderSection(reportData.expenses, 'expenses')}
                        <TotalRow label="Total Administrasi & General Expenses"
                            vals={{ current: totals.raw.current.exp, prev: totals.raw.prev.exp, ytd: totals.raw.ytd.exp }} />

                        {/* ── OTHER INCOME / EXPENSES ── */}
                        <SectionLabel label="Other Income / Expenses" />
                        {reportData.other_income && reportData.other_income.length > 0 && (
                            <>
                                {renderSection(reportData.other_income, 'other_income')}
                                <TotalRow label="Total Other Income" indent
                                    vals={{ current: totals.raw.current.oi, prev: totals.raw.prev.oi, ytd: totals.raw.ytd.oi }} />
                            </>
                        )}
                        {reportData.other_expense && reportData.other_expense.length > 0 && (
                            <>
                                {renderSection(reportData.other_expense, 'other_expense')}
                                <TotalRow label="Total Other Expenses" indent
                                    vals={{ current: -totals.raw.current.oe, prev: -totals.raw.prev.oe, ytd: -totals.raw.ytd.oe }} />
                            </>
                        )}

                        {/* ── Summary ── */}
                        <div className="border-t-2 border-slate-300 dark:border-dark-border mt-1">
                            <TotalRow label="Total Other Income / Expenses"
                                vals={{ current: totals.prof.current.onet, prev: totals.prof.prev.onet, ytd: totals.prof.ytd.onet }} />
                            <TotalRow label="Total Income"
                                vals={{ current: totals.prof.current.op + totals.prof.current.onet, prev: totals.prof.prev.op + totals.prof.prev.onet, ytd: totals.prof.ytd.op + totals.prof.ytd.onet }}
                                highlight="blue" />
                            <TotalRow label="Total Net Income Before Tax"
                                vals={{ current: totals.prof.current.nibt, prev: totals.prof.prev.nibt, ytd: totals.prof.ytd.nibt }} />

                            {/* Corporate Income Tax */}
                            <div className="flex items-center bg-red-50 dark:bg-red-500/10 border-y border-red-200 dark:border-red-500/30">
                                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                                <span className="text-[12px] font-bold text-red-600 dark:text-red-400 uppercase flex-1 min-w-0 px-2 py-2" title={`Corporate Income Tax (${taxRate}%)`}>
                                    Corporate Income Tax ({taxRate}%)
                                </span>
                                <div className="flex items-center flex-shrink-0 pr-2">
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2`} title={fmt(-totals.prof.current.tax)}>{fmt(-totals.prof.current.tax)}</span>
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2`} title={fmt(-totals.prof.prev.tax)}>{fmt(-totals.prof.prev.tax)}</span>
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2`} title={fmt(-totals.prof.ytd.tax)}>{fmt(-totals.prof.ytd.tax)}</span>
                                </div>
                            </div>

                            <TotalRow label="Total Net Income After Tax"
                                vals={{ current: totals.prof.current.niat, prev: totals.prof.prev.niat, ytd: totals.prof.ytd.niat }}
                                highlight="blue" thick />
                        </div>
                    </>
                    </div>
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-silver-dark mt-6 italic">
                * Klik pada akun untuk melihat detail di General Ledger.
            </div>
        </div>
    );
};

export default ProfitLossDetail;
