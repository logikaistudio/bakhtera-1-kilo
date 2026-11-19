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

export const buildManualBatchBalancingEntry = (lines, account, description, division) => {
    if (!Array.isArray(lines) || lines.length === 0 || !lines.every(line => line.source === 'manual')) return null;

    const batchId = lines[0].batch_id;
    if (!batchId || !lines.every(line => line.batch_id === batchId)) return null;

    const status = getJournalLinesStatus(lines);
    if (!status.canBalance) return null;

    const baseEntryNumber = lines[0].reference_number ||
        lines[0].entry_number?.replace(/-L\d+$/i, '') ||
        lines[0].entry_number;
    const nextLineNumber = Math.max(0, ...lines.map(line => {
        const match = line.entry_number?.match(/-L(\d+)$/i);
        return match ? Number(match[1]) : 0;
    })) + 1;
    const balancingLine = buildBalancingLine(status.difference, account, description);
    if (!baseEntryNumber || !balancingLine) return null;

    return {
        entry_number: `${baseEntryNumber}-L${String(nextLineNumber).padStart(2, '0')}`,
        entry_date: lines[0].entry_date,
        entry_type: 'adjustment',
        account_code: balancingLine.account_code,
        account_name: balancingLine.account_name,
        coa_id: balancingLine.coa_id,
        debit: balancingLine.debit,
        credit: balancingLine.credit,
        description: balancingLine.description,
        batch_id: batchId,
        source: 'manual',
        division: division || lines[0].division,
        currency: 'IDR',
        journal_type: lines[0].journal_type || 'general',
        reference_number: baseEntryNumber
    };
};