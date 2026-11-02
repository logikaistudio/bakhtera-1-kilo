export const getJournalBalanceDifference = (lines) => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return Math.round((debit - credit) * 100) / 100;
};

export const getUnbalancedJournalBatchKeys = (entries) => {
    const batches = new Map();
    entries.forEach(entry => {
        const key = entry.batch_id || entry.entry_number || entry.id;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(entry);
    });

    return new Set([...batches.entries()]
        .filter(([, lines]) => Math.abs(getJournalBalanceDifference(lines)) >= 0.01)
        .map(([key]) => key));
};

export const getJournalLinesStatus = (lines) => {
    const enteredLines = lines.filter(line => (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0);
    const invalidLines = enteredLines.filter(line =>
        !line.coa_id || ((Number(line.debit) || 0) > 0 && (Number(line.credit) || 0) > 0)
    );
    const difference = getJournalBalanceDifference(enteredLines);
    const totalDebit = enteredLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);

    return {
        enteredLines,
        invalidLines,
        difference,
        canBalance: enteredLines.length > 0 && invalidLines.length === 0 && Math.abs(difference) >= 0.01,
        isBalanced: enteredLines.length > 0 && invalidLines.length === 0 && Math.abs(difference) < 0.01 && totalDebit > 0
    };
};

export const buildBalancingLine = (difference, account, description) => {
    const amount = Math.round(Math.abs(Number(difference) || 0) * 100) / 100;
    if (amount < 0.01 || !account || !description?.trim()) return null;

    return {
        coa_id: account.id,
        journal_coa_id: Object.prototype.hasOwnProperty.call(account, 'journal_coa_id')
            ? account.journal_coa_id
            : account.id,
        account_code: account.code,
        account_name: account.name,
        debit: difference < 0 ? amount : 0,
        credit: difference > 0 ? amount : 0,
        description: description.trim()
    };
};