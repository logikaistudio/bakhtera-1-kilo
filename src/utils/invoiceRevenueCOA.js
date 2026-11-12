const isRevenueAccount = (account) =>
    String(account?.code || '').trim().startsWith('4') && account.is_active !== false;

const isGenericIncomeAccount = (account) => {
    const code = String(account?.code || '').trim();
    return code === '4000' || /^4-00(?:-|$)/.test(code);
};

const normalizeName = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:thc|terminal handling charge|agency fee|seal fee)\b/g, 'handling fee')
    .replace(/\b(?:doc|docs|documentation)\b/g, 'document')
    .replace(/\b(?:adm|admin)\b/g, 'administration')
    .replace(/\bmanifest\b/g, 'document')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const hasChildAccount = (account, accounts) => {
    const code = String(account?.code || '').trim();
    return accounts.some(candidate => String(candidate.parent_code || '').trim() === code);
};

export const resolveDefaultInvoiceRevenueCOA = (coaList) => {
    const accounts = Array.isArray(coaList) ? coaList : [];
    const candidates = accounts.filter(account =>
        isRevenueAccount(account) && !isGenericIncomeAccount(account)
    );

    for (const code of ['4100', '4-01-001', '4-01-100', '4-01-301']) {
        const account = candidates.find(candidate => String(candidate.code || '').trim() === code);
        if (account) return account;
    }

    return candidates.find(account => String(account.code || '').trim().startsWith('4-01')) ||
        candidates.find(account => /^41\d{2,}$/.test(String(account.code || '').trim())) ||
        candidates[0] ||
        null;
};

export const resolveInvoiceRevenueCOA = (item, coaList, fallbackAccount) => {
    const accounts = Array.isArray(coaList) ? coaList : [];
    const accountById = item?.coa_id
        ? accounts.find(account => account.id === item.coa_id)
        : null;

    const itemCode = String(item?.coa_code || item?.itemCode || '').trim();
    const accountByCode = itemCode
        ? accounts.find(account => String(account.code || '').trim() === itemCode)
        : null;

    const isExplicitRevenueAccount = account =>
        isRevenueAccount(account) && !isGenericIncomeAccount(account);

    if (isExplicitRevenueAccount(accountById)) return accountById;
    if (isExplicitRevenueAccount(accountByCode)) return accountByCode;

    const itemHints = [item?.item_name, item?.description, item?.name, item?.service_name]
        .map(normalizeName)
        .filter(hint => hint.length >= 4);
    const detailAccounts = accounts.filter(account =>
        isRevenueAccount(account) &&
        !isGenericIncomeAccount(account) &&
        !hasChildAccount(account, accounts)
    );

    for (const hint of itemHints) {
        const hintTokens = hint.split(' ');
        const matches = detailAccounts.filter(account => {
            const nameTokens = normalizeName(account.name).split(' ').filter(token => token.length >= 3);
            return nameTokens.length > 0 && nameTokens.every(token => hintTokens.includes(token));
        });
        if (matches.length === 1) return matches[0];
    }

    return fallbackAccount;
};

export const getInvoiceRevenueAllocations = (invoice, coaList, fallbackAccount, toIDR) => {
    const items = Array.isArray(invoice?.invoice_items) ? invoice.invoice_items : [];
    const exchangeRate = invoice?.currency !== 'IDR'
        ? (Number(invoice?.exchange_rate) || 1)
        : 1;

    return items.flatMap(item => {
        const rawAmount = Number(item.amount) || 0;
        if (rawAmount <= 0) return [];

        const account = resolveInvoiceRevenueCOA(item, coaList, fallbackAccount);
        const amount = toIDR(
            rawAmount,
            item.currency || invoice.currency || 'IDR',
            exchangeRate
        );
        return account && amount > 0 ? [{ account, amount }] : [];
    });
};
