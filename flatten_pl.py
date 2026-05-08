import re
import os

files = [
    'src/pages/Blink/ProfitLossDetail.jsx',
    'src/pages/Blink/ProfitLoss.jsx',
    'src/pages/Bridge/BridgeProfitLoss.jsx'
]

for filepath in files:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Remove buildGroups function
    content = re.sub(r'const buildGroups = \(accounts\) => \{.*?\n            \};\n\n', '', content, flags=re.DOTALL)

    # 2. Update setReportData calls
    if 'ProfitLossDetail' in filepath:
        content = content.replace('revenue: { groups: buildGroups(revenue) }', 'revenue')
        content = content.replace('cogs: { groups: buildGroups(cogs) }', 'cogs')
        content = content.replace('expenses: { groups: buildGroups(expenses) }', 'expenses')
        content = content.replace('other_income: { groups: buildGroups(other_income) }', 'other_income')
        content = content.replace('other_expense: { groups: buildGroups(other_expense) }', 'other_expense')
    else:
        content = content.replace('revenue: { groups: buildGroups(revenue), total: totalRevenue }', 'revenue')
        content = content.replace('cogs: { groups: buildGroups(cogs), total: totalCOGS }', 'cogs')
        content = content.replace('expenses: { groups: buildGroups(expenses), total: totalExpenses }', 'expenses')
        content = content.replace('other_income: { groups: buildGroups(other_income), total: totalOtherIncome }', 'other_income')
        content = content.replace('other_expense: { groups: buildGroups(other_expense), total: totalOtherExpense }', 'other_expense')

    # 3. Remove ParentRow
    content = re.sub(r'    const ParentRow = \(\{ group, sectionKey, index \}\) => \{.*?\n    \};\n\n', '', content, flags=re.DOTALL)

    # 4. Modify ItemRow to remove indent prop and group hover logic
    if 'ProfitLossDetail' in filepath:
        content = content.replace('const ItemRow = ({ item, indent }) => (', 'const ItemRow = ({ item }) => (')
        content = content.replace(' className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center ${indent ? \'pl-8\' : \'\'}`}', ' className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center`}')
    else:
        content = content.replace('const ItemRow = ({ item, indent }) => (', 'const ItemRow = ({ item }) => (')
        content = content.replace(' className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center ${indent ? \'pl-8\' : \'\'}`}', ' className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center`}')

    # 5. Modify renderSection
    render_section_old = r'    const renderSection = \(sectionData, sectionKey\) => \{.*?\n    \};\n'
    render_section_new = """    const renderSection = (accounts, sectionKey) => {
        if (!accounts || accounts.length === 0) return <div className="px-6 py-2 text-[11px] text-silver-dark italic">No data</div>;
        return accounts.map(item => <ItemRow key={item.id} item={item} />);
    };
"""
    content = re.sub(render_section_old, render_section_new, content, flags=re.DOTALL)

    # 6. Fix byMonthFn calls for 12-month tables (ProfitLoss, BridgeProfitLoss)
    if 'ProfitLossDetail' not in filepath:
        # reportData.revenue.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0) -> reportData.revenue.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0)
        content = re.sub(r'reportData\.([a-z_]+)\.groups\.reduce\(\(s, g\) => s \+ g\.items\.reduce\(\(ss, a\) => ss \+ \(a\.byMonth\?\.\[m\] \|\| 0\), 0\), 0\)', 
                         r'reportData.\1.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0)', content)

    # 7. Fix other_income length checks
    content = content.replace('reportData.other_income.groups.length > 0', 'reportData.other_income && reportData.other_income.length > 0')
    content = content.replace('reportData.other_expense.groups.length > 0', 'reportData.other_expense && reportData.other_expense.length > 0')

    with open(filepath, 'w') as f:
        f.write(content)

