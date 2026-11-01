export const getJournalBalanceDifference = (lines) => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return Math.round((debit - credit) * 100) / 100;
};

export const buildBalancingLine = (difference, account, description) => {
    const amount = Math.round(Math.abs(Number(difference) || 0) * 100) / 100;
    if (amount < 0.01 || !account || !description?.trim()) return null;

    return {
        coa_id: account.id,
        account_code: account.code,
        account_name: account.name,
        debit: difference < 0 ? amount : 0,
        credit: difference > 0 ? amount : 0,
        description: description.trim()
    };
};