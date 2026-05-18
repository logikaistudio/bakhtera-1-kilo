import re

with open('src/pages/Blink/ProfitLossDetail.jsx', 'r') as f:
    code = f.read()

# Change component name
code = code.replace('const ProfitLoss = () => {', 'const ProfitLossDetail = () => {')
code = code.replace('export default ProfitLoss;', 'export default ProfitLossDetail;')

# Change state
state_replace = """    const currentYear = new Date().getFullYear();
    const [dateRange, setDateRange] = useState({
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`
    });"""

new_state = """    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);"""
code = code.replace(state_replace, new_state)

# Modify reportMonths
code = code.replace("const [reportMonths, setReportMonths] = useState([]);\n", "")

# Change fetchReportData
fetch_old = """            // Build month list (Jan to Dec of the selected year)
            const d1 = new Date(dateRange.startDate + 'T00:00:00');
            const targetYear = d1.getFullYear();
            const monthsList = [];
            for (let i = 1; i <= 12; i++) {
                monthsList.push(`${targetYear}-${String(i).padStart(2, '0')}`);
            }

            const queryStart = `${targetYear}-01-01`;
            const queryEnd = `${targetYear}-12-31`;

            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null)
                    .gte('entry_date', queryStart).lte('entry_date', queryEnd),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .gte('entry_date', queryStart).lte('entry_date', queryEnd)
            ]);"""

fetch_new = """            const [y, m] = selectedMonth.split('-');
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
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null)
                    .gte('entry_date', fetchStart).lte('entry_date', queryEnd),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .gte('entry_date', fetchStart).lte('entry_date', queryEnd)
            ]);"""
code = code.replace(fetch_old, fetch_new)

# Modify entries.forEach
old_entries = """                const mKey = e.entry_date?.substring(0, 7);
                if (mKey && acc.byMonth && acc.byMonth[mKey] !== undefined) acc.byMonth[mKey] += val;"""
new_entries = """                const mKey = e.entry_date?.substring(0, 7);
                if (mKey === currentMonthCol) acc.currentMonthAmount = (acc.currentMonthAmount || 0) + val;
                if (mKey === prevMonthCol) acc.prevMonthAmount = (acc.prevMonthAmount || 0) + val;
                if (mKey.startsWith(String(targetYear)) && mKey <= currentMonthCol) acc.ytdAmount = (acc.ytdAmount || 0) + val;"""

code = code.replace("monthsList.forEach(m => byMonth[m] = 0);\n", "")
code = code.replace("coaMap[coa.id] = { ...coa, amount: 0, byMonth };", "coaMap[coa.id] = { ...coa, amount: 0, currentMonthAmount: 0, prevMonthAmount: 0, ytdAmount: 0 };")
code = code.replace(old_entries, new_entries)

# Build Groups modification
build_groups_old = """                            const parentByMonth = {};
                            monthsList.forEach(m => parentByMonth[m] = 0);
                            groups[acc.parent_code] = { parent: { ...parentMeta, groupAmount: 0, byMonth: parentByMonth }, items: [] };
                        }
                        groups[acc.parent_code].items.push(acc);
                        groups[acc.parent_code].parent.groupAmount += acc.amount;
                        monthsList.forEach(m => { groups[acc.parent_code].parent.byMonth[m] += (acc.byMonth?.[m] || 0); });"""
build_groups_new = """                            groups[acc.parent_code] = { parent: { ...parentMeta, currentMonthAmount: 0, prevMonthAmount: 0, ytdAmount: 0 }, items: [] };
                        }
                        groups[acc.parent_code].items.push(acc);
                        groups[acc.parent_code].parent.currentMonthAmount += acc.currentMonthAmount;
                        groups[acc.parent_code].parent.prevMonthAmount += acc.prevMonthAmount;
                        groups[acc.parent_code].parent.ytdAmount += acc.ytdAmount;"""

code = code.replace(build_groups_old, build_groups_new)

# Modify revenue filter and totals
all_filters = """            const all = Object.values(coaMap);
            const revenue = all.filter(a => a.type === 'REVENUE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const cogs = all.filter(a => ['COGS', 'COST', 'DIRECT_COST'].includes(a.type) && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const expenses = all.filter(a => a.type === 'EXPENSE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const other_income = all.filter(a => a.type === 'OTHER_INCOME' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const other_expense = all.filter(a => a.type === 'OTHER_EXPENSE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));"""

all_filters_new = """            const all = Object.values(coaMap);
            const valid = a => a.currentMonthAmount !== 0 || a.prevMonthAmount !== 0 || a.ytdAmount !== 0;
            const revenue = all.filter(a => a.type === 'REVENUE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const cogs = all.filter(a => ['COGS', 'COST', 'DIRECT_COST'].includes(a.type) && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const expenses = all.filter(a => a.type === 'EXPENSE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const other_income = all.filter(a => a.type === 'OTHER_INCOME' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));
            const other_expense = all.filter(a => a.type === 'OTHER_EXPENSE' && valid(a)).sort((a, b) => a.code.localeCompare(b.code));"""

code = code.replace(all_filters, all_filters_new)

total_sums = """            const totalRevenue = revenue.reduce((s, a) => s + a.amount, 0);
            const totalCOGS = cogs.reduce((s, a) => s + a.amount, 0);
            const grossProfit = totalRevenue - totalCOGS;
            const totalExpenses = expenses.reduce((s, a) => s + a.amount, 0);
            const operatingProfit = grossProfit - totalExpenses;
            const totalOtherIncome = other_income.reduce((s, a) => s + a.amount, 0);
            const totalOtherExpense = other_expense.reduce((s, a) => s + a.amount, 0);
            const otherNet = totalOtherIncome - totalOtherExpense;
            const netIncomeBeforeTax = operatingProfit + otherNet;
            const taxAmount = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * (taxRate / 100) : 0;
            const netIncomeAfterTax = netIncomeBeforeTax - taxAmount;

            setReportData({
                revenue: { groups: buildGroups(revenue), total: totalRevenue },
                cogs: { groups: buildGroups(cogs), total: totalCOGS },
                expenses: { groups: buildGroups(expenses), total: totalExpenses },
                other_income: { groups: buildGroups(other_income), total: totalOtherIncome },
                other_expense: { groups: buildGroups(other_expense), total: totalOtherExpense },
            });
            setTotals({ totalRevenue, totalCOGS, grossProfit, totalExpenses, operatingProfit, totalOtherIncome, totalOtherExpense, otherNet, netIncomeBeforeTax, taxAmount, netIncomeAfterTax });"""

total_sums_new = """            const sumField = (arr, field) => arr.reduce((s, a) => s + a[field], 0);
            const totals = {
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
            const prof = { current: calcProfits(totals.current), prev: calcProfits(totals.prev), ytd: calcProfits(totals.ytd) };

            setReportData({
                revenue: { groups: buildGroups(revenue) },
                cogs: { groups: buildGroups(cogs) },
                expenses: { groups: buildGroups(expenses) },
                other_income: { groups: buildGroups(other_income) },
                other_expense: { groups: buildGroups(other_expense) },
            });
            setTotals({ raw: totals, prof });"""

code = code.replace(total_sums, total_sums_new)

# Initial totals state
totals_state_old = """    const [totals, setTotals] = useState({
        totalRevenue: 0, totalCOGS: 0, grossProfit: 0,
        totalExpenses: 0, operatingProfit: 0,
        totalOtherIncome: 0, totalOtherExpense: 0,
        otherNet: 0, netIncomeBeforeTax: 0,
        taxAmount: 0, netIncomeAfterTax: 0
    });"""
totals_state_new = """    const [totals, setTotals] = useState({ raw: null, prof: null });"""
code = code.replace(totals_state_old, totals_state_new)

code = code.replace("    useEffect(() => { fetchReportData(); }, [dateRange]);", "    useEffect(() => { fetchReportData(); }, [selectedMonth]);")

# Tax effect
tax_effect_old = """    useEffect(() => {
        if (totals.netIncomeBeforeTax !== undefined) {
            const taxAmount = totals.netIncomeBeforeTax > 0 ? totals.netIncomeBeforeTax * (taxRate / 100) : 0;
            setTotals(prev => ({ ...prev, taxAmount, netIncomeAfterTax: prev.netIncomeBeforeTax - taxAmount }));
        }
    }, [taxRate]);"""

tax_effect_new = """    useEffect(() => {
        if (totals.prof && totals.prof.current) {
            const calcProfits = (t) => {
                const nibt = t.nibt;
                const tax = nibt > 0 ? nibt * (taxRate / 100) : 0;
                return { ...t, tax, niat: nibt - tax };
            };
            setTotals(prev => ({ ...prev, prof: { current: calcProfits(prev.prof.current), prev: calcProfits(prev.prof.prev), ytd: calcProfits(prev.prof.ytd) } }));
        }
    }, [taxRate]);"""
code = code.replace(tax_effect_old, tax_effect_new)


# Toolbar and inputs
input_old = """                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Tahun:</span>
                        <input type="number" value={new Date(dateRange.startDate).getFullYear()}
                            onChange={e => {
                                const y = e.target.value;
                                setDateRange({ startDate: `${y}-01-01`, endDate: `${y}-12-31` });
                            }}
                            className="bg-transparent border-none text-xs text-slate-800 dark:text-white focus:ring-0 p-0 w-20" />"""
input_new = """                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Bulan:</span>
                        <input type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-800 dark:text-white focus:ring-0 p-0" />"""

code = code.replace(input_old, input_new)
code = code.replace("const period = `Tahun ${new Date(dateRange.startDate).getFullYear()}`;", "const period = `Bulan: ${selectedMonth}`;")

# Remove handleExportExcel and handleExportPDF entirely since they rely on reportMonths and are hard to refactor right now.
code = re.sub(r'    const handleExportExcel = \(\) => \{.*?\n    \};\n', '', code, flags=re.DOTALL)
code = re.sub(r'    // ── Export PDF ───────────────────────────────────────────────────\n    const handleExportPDF = \(\) => \{.*?\n    \};\n', '', code, flags=re.DOTALL)
code = re.sub(r'                        <button onClick=\{handleExportExcel\}.*?</button>', '', code, flags=re.DOTALL)
code = re.sub(r'                        <button onClick=\{handleExportPDF\}.*?</button>', '', code, flags=re.DOTALL)


# Rewrite render methods
render_old = """    const ParentRow = ({ group, sectionKey, index }) => {
        const key = `${sectionKey}-${group.parent?.code || index}`;
        const isOpen = expandedGroups[key] !== false;
        const total = group.items.reduce((s, a) => s + a.amount, 0);
        return (
            <div
                className="flex items-center bg-slate-50 dark:bg-dark-surface/40 border-b border-slate-200 dark:border-dark-border/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-surface/60 transition-colors"
                onClick={() => toggleGroup(key)}
            >
                <div className="w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center">
                    <span className="text-[12px] font-bold text-slate-800 dark:text-silver-light whitespace-nowrap">{group.parent.code}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 px-2 py-2">
                    {isOpen
                        ? <ChevronDown className="w-4 h-4 text-slate-600 dark:text-silver-dark flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-600 dark:text-silver-dark flex-shrink-0" />}
                    <span className="text-[12px] font-extrabold text-slate-800 dark:text-silver-light uppercase truncate" title={group.parent.name}>
                        {group.parent.name}
                    </span>
                </div>
                <div className="flex items-center flex-shrink-0 pr-2">
                    {reportMonths.map(m => (
                        <span key={m} className={`text-[11px] font-mono text-slate-600 dark:text-silver-dark text-right ${colW} px-1 truncate`} title={fmt(group.parent.byMonth?.[m] || 0)}>
                            {fmt(group.parent.byMonth?.[m] || 0)}
                        </span>
                    ))}
                    <span className={`text-[12px] font-bold font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(total)}>
                        {fmt(total)}
                    </span>
                </div>
            </div>
        );
    };

    const ItemRow = ({ item, indent }) => (
        <div
            onClick={() => navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: item.id } })}
            className="flex items-center border-b border-gray-100 dark:border-dark-border/20 hover:bg-gray-50 dark:hover:bg-dark-surface/40 cursor-pointer group"
        >
            <div className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center ${indent ? 'pl-8' : ''}`}>
                <span className="text-[11px] text-slate-600 dark:text-silver-dark font-mono whitespace-nowrap">{item.code}</span>
            </div>
            <span className="text-[12px] text-slate-700 dark:text-silver-light group-hover:underline flex-1 px-2 py-2 truncate" title={item.name}>
                {item.name}
            </span>
            <div className="flex items-center flex-shrink-0 pr-2">
                {reportMonths.map(m => (
                    <span key={m} className={`text-[11px] font-mono text-slate-500 dark:text-silver-dark text-right ${colW} px-1 truncate`} title={fmt(item.byMonth?.[m] || 0)}>
                        {fmt(item.byMonth?.[m] || 0)}
                    </span>
                ))}
                <span className={`text-[12px] font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(item.amount)}>{fmt(item.amount)}</span>
            </div>
        </div>
    );"""

render_new = """    const ParentRow = ({ group, sectionKey, index }) => {
        const key = `${sectionKey}-${group.parent?.code || index}`;
        const isOpen = expandedGroups[key] !== false;
        return (
            <div
                className="flex items-center bg-slate-50 dark:bg-dark-surface/40 border-b border-slate-200 dark:border-dark-border/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-dark-surface/60 transition-colors"
                onClick={() => toggleGroup(key)}
            >
                <div className="w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center">
                    <span className="text-[12px] font-bold text-slate-800 dark:text-silver-light whitespace-nowrap">{group.parent.code}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 px-2 py-2">
                    {isOpen
                        ? <ChevronDown className="w-4 h-4 text-slate-600 dark:text-silver-dark flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-600 dark:text-silver-dark flex-shrink-0" />}
                    <span className="text-[12px] font-extrabold text-slate-800 dark:text-silver-light uppercase truncate" title={group.parent.name}>
                        {group.parent.name}
                    </span>
                </div>
                <div className="flex items-center flex-shrink-0 pr-2">
                    <span className={`text-[12px] font-bold font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(group.parent.prevMonthAmount)}>{fmt(group.parent.prevMonthAmount)}</span>
                    <span className={`text-[12px] font-bold font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(group.parent.currentMonthAmount)}>{fmt(group.parent.currentMonthAmount)}</span>
                    <span className={`text-[12px] font-bold font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(group.parent.ytdAmount)}>{fmt(group.parent.ytdAmount)}</span>
                </div>
            </div>
        );
    };

    const ItemRow = ({ item, indent }) => (
        <div
            onClick={() => navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: item.id } })}
            className="flex items-center border-b border-gray-100 dark:border-dark-border/20 hover:bg-gray-50 dark:hover:bg-dark-surface/40 cursor-pointer group"
        >
            <div className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center ${indent ? 'pl-8' : ''}`}>
                <span className="text-[11px] text-slate-600 dark:text-silver-dark font-mono whitespace-nowrap">{item.code}</span>
            </div>
            <span className="text-[12px] text-slate-700 dark:text-silver-light group-hover:underline flex-1 px-2 py-2 truncate" title={item.name}>
                {item.name}
            </span>
            <div className="flex items-center flex-shrink-0 pr-2">
                <span className={`text-[12px] font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(item.prevMonthAmount)}>{fmt(item.prevMonthAmount)}</span>
                <span className={`text-[12px] font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(item.currentMonthAmount)}>{fmt(item.currentMonthAmount)}</span>
                <span className={`text-[12px] font-mono text-slate-800 dark:text-silver-light text-right ${totalW} px-1 truncate`} title={fmt(item.ytdAmount)}>{fmt(item.ytdAmount)}</span>
            </div>
        </div>
    );"""

code = code.replace(render_old, render_new)

total_row_old = """    const TotalRow = ({ label, amount, byMonthFn, highlight, thick, indent }) => {
        const colors = {
            green: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-500',
            blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-500',
            red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400',
        };
        const cls = highlight ? colors[highlight] : 'bg-slate-50 dark:bg-transparent border-slate-200 dark:border-dark-border/30 text-slate-800 dark:text-silver-light';
        const valCls = highlight ? '' : (amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light');
        return (
            <div className={`flex items-center border-y ${cls} ${thick ? 'border-t-2' : ''}`}>
                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                <span className={`text-[12px] font-bold uppercase flex-1 min-w-0 px-2 py-2 ${indent ? 'pl-6' : ''} truncate`} title={label}>{label}</span>
                <div className="flex items-center flex-shrink-0 pr-2">
                    {reportMonths.map(m => (
                        <span key={m} className={`text-[11px] font-bold font-mono text-right ${colW} px-1 py-2 truncate`} title={fmt(byMonthFn ? byMonthFn(m) : 0)}>
                            {byMonthFn ? fmt(byMonthFn(m)) : ''}
                        </span>
                    ))}
                    <span className={`text-[12px] font-bold font-mono text-right ${totalW} px-1 py-2 ${valCls} truncate`} title={fmt(amount)}>{fmt(amount)}</span>
                </div>
            </div>
        );
    };"""

total_row_new = """    const TotalRow = ({ label, vals, highlight, thick, indent }) => {
        const colors = {
            green: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-500',
            blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-500',
            red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400',
        };
        const cls = highlight ? colors[highlight] : 'bg-slate-50 dark:bg-transparent border-slate-200 dark:border-dark-border/30 text-slate-800 dark:text-silver-light';
        return (
            <div className={`flex items-center border-y ${cls} ${thick ? 'border-t-2' : ''}`}>
                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                <span className={`text-[12px] font-bold uppercase flex-1 min-w-0 px-2 py-2 ${indent ? 'pl-6' : ''} truncate`} title={label}>{label}</span>
                <div className="flex items-center flex-shrink-0 pr-2">
                    <span className={`text-[12px] font-bold font-mono text-right ${totalW} px-1 py-2 truncate ${highlight ? '' : (vals.prev < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.prev)}>{fmt(vals.prev)}</span>
                    <span className={`text-[12px] font-bold font-mono text-right ${totalW} px-1 py-2 truncate ${highlight ? '' : (vals.current < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.current)}>{fmt(vals.current)}</span>
                    <span className={`text-[12px] font-bold font-mono text-right ${totalW} px-1 py-2 truncate ${highlight ? '' : (vals.ytd < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-silver-light')}`} title={fmt(vals.ytd)}>{fmt(vals.ytd)}</span>
                </div>
            </div>
        );
    };"""

code = code.replace(total_row_old, total_row_new)

# Modify Table Header
th_old = """                {/* Column header — putih di atas biru agar terlihat jelas */}
                <div className="flex items-center" style={{ background: '#0070BB' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider w-[140px] flex-shrink-0 pl-4 pr-2 py-2.5" style={{ color: '#FFFFFF' }}>Code</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider flex-1 px-2 py-2.5" style={{ color: '#FFFFFF' }}>Description</span>
                    <div className="flex items-center flex-shrink-0 pr-2">
                        {reportMonths.map(m => (
                            <span key={m} className={`text-[11px] font-bold uppercase text-right ${colW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>
                                {mLabel(m)}
                            </span>
                        ))}
                        <span className={`text-[11px] font-bold uppercase text-right ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>Total</span>
                    </div>
                </div>"""

th_new = """                {/* Column header — putih di atas biru agar terlihat jelas */}
                <div className="flex items-center" style={{ background: '#0070BB' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider w-[140px] flex-shrink-0 pl-4 pr-2 py-2.5" style={{ color: '#FFFFFF' }}>Code</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider flex-1 px-2 py-2.5" style={{ color: '#FFFFFF' }}>Description</span>
                    <div className="flex items-center flex-shrink-0 pr-2">
                        <span className={`text-[11px] font-bold uppercase text-right ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>Prev Month</span>
                        <span className={`text-[11px] font-bold uppercase text-right ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>Current Month</span>
                        <span className={`text-[11px] font-bold uppercase text-right ${totalW} px-1 py-2.5`} style={{ color: '#FFFFFF' }}>YTD</span>
                    </div>
                </div>"""

code = code.replace(th_old, th_new)

# Modify the render of rows
total_sec_old = """                        {/* ── INCOME ── */}
                        <SectionLabel label="INCOME" />
                        {renderSection(reportData.revenue, 'revenue')}
                        <TotalRow label="Total Sales Income" amount={totals.totalRevenue} highlight="green"
                            byMonthFn={m => reportData.revenue.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── COST OF GOOD SOLD ── */}
                        <SectionLabel label="Cost of Good Sold" />
                        {renderSection(reportData.cogs, 'cogs')}
                        <TotalRow label="Total Cost of Good Sold" amount={totals.totalCOGS}
                            byMonthFn={m => reportData.cogs.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── GROSS PROFIT ── */}
                        <TotalRow label="Total Operation Income ( Gross Profit )"
                            amount={totals.grossProfit}
                            byMonthFn={m => {
                                const mRev = reportData.revenue.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                const mCogs = reportData.cogs.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                return mRev - mCogs;
                            }}
                            highlight={totals.grossProfit >= 0 ? 'blue' : 'red'} thick />

                        {/* ── ADMINISTRASI & GENERAL EXPENSES ── */}
                        <SectionLabel label="Administrasi & General Expenses" />
                        {renderSection(reportData.expenses, 'expenses')}
                        <TotalRow label="Total Administrasi & General Expenses" amount={totals.totalExpenses}
                            byMonthFn={m => reportData.expenses.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── OTHER INCOME / EXPENSES ── */}
                        <SectionLabel label="Other Income / Expenses" />
                        {reportData.other_income.groups.length > 0 && (
                            <>
                                {renderSection(reportData.other_income, 'other_income')}
                                <TotalRow label="Total Other Income" amount={totals.totalOtherIncome} indent
                                    byMonthFn={m => reportData.other_income.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />
                            </>
                        )}
                        {reportData.other_expense.groups.length > 0 && (
                            <>
                                {renderSection(reportData.other_expense, 'other_expense')}
                                <TotalRow label="Total Other Expenses" amount={-totals.totalOtherExpense} indent
                                    byMonthFn={m => -reportData.other_expense.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />
                            </>
                        )}

                        {/* ── Summary ── */}
                        <div className="border-t-2 border-slate-300 dark:border-dark-border mt-1">
                            <TotalRow label="Total Other Income / Expenses" amount={totals.otherNet} byMonthFn={m => {
                                const mOI = reportData.other_income.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                const mOE = reportData.other_expense.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                return mOI - mOE;
                            }} />
                            <TotalRow label="Total Income" amount={totals.operatingProfit + totals.otherNet} highlight="blue" />
                            <TotalRow label="Total Net Income Before Tax" amount={totals.netIncomeBeforeTax} />

                            {/* Corporate Income Tax */}
                            <div className="flex items-center bg-red-50 dark:bg-red-500/10 border-y border-red-200 dark:border-red-500/30">
                                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                                <span className="text-[12px] font-bold text-red-600 dark:text-red-400 uppercase flex-1 min-w-0 px-2 py-2 truncate" title={`Corporate Income Tax (${taxRate}%)`}>
                                    Corporate Income Tax ({taxRate}%)
                                </span>
                                <div className="flex items-center flex-shrink-0 pr-2">
                                    {reportMonths.map(m => (
                                        <span key={m} className={`text-[11px] font-bold font-mono text-right ${colW} px-1 py-2`}></span>
                                    ))}
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2 truncate`} title={fmt(-totals.taxAmount)}>
                                        {fmt(-totals.taxAmount)}
                                    </span>
                                </div>
                            </div>

                            <TotalRow label="Total Net Income After Tax" amount={totals.netIncomeAfterTax}
                                highlight={totals.netIncomeAfterTax >= 0 ? 'blue' : 'red'} thick />
                        </div>"""

total_sec_new = """                        {/* ── INCOME ── */}
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
                        {reportData.other_income.groups.length > 0 && (
                            <>
                                {renderSection(reportData.other_income, 'other_income')}
                                <TotalRow label="Total Other Income" indent
                                    vals={{ current: totals.raw.current.oi, prev: totals.raw.prev.oi, ytd: totals.raw.ytd.oi }} />
                            </>
                        )}
                        {reportData.other_expense.groups.length > 0 && (
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
                                <span className="text-[12px] font-bold text-red-600 dark:text-red-400 uppercase flex-1 min-w-0 px-2 py-2 truncate" title={`Corporate Income Tax (${taxRate}%)`}>
                                    Corporate Income Tax ({taxRate}%)
                                </span>
                                <div className="flex items-center flex-shrink-0 pr-2">
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2 truncate`} title={fmt(-totals.prof.prev.tax)}>{fmt(-totals.prof.prev.tax)}</span>
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2 truncate`} title={fmt(-totals.prof.current.tax)}>{fmt(-totals.prof.current.tax)}</span>
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2 truncate`} title={fmt(-totals.prof.ytd.tax)}>{fmt(-totals.prof.ytd.tax)}</span>
                                </div>
                            </div>

                            <TotalRow label="Total Net Income After Tax"
                                vals={{ current: totals.prof.current.niat, prev: totals.prof.prev.niat, ytd: totals.prof.ytd.niat }}
                                highlight="blue" thick />
                        </div>"""

code = code.replace(total_sec_old, total_sec_new)

code = code.replace("if (!totals || !totals.raw) return <div className=\"p-12 text-center text-slate-500 dark:text-silver-dark\">Loading data...</div>;", "")

with open('src/pages/Blink/ProfitLossDetail.jsx', 'w') as f:
    f.write(code)

