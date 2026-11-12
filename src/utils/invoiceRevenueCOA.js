const isRevenueAccount = (account) => String(account?.code || '').trim().startsWith('4');

export const resolveInvoiceRevenueCOA = (item, coaList, fallbackAccount) => {
    const accounts = Array.isArray(coaList) ? coaList : [];
    const accountById = item?.coa_id
        ? accounts.find(account => account.id === item.coa_id)
        : null;
    if (isRevenueAccount(accountById)) return accountById;

    const itemCode = String(item?.coa_code || item?.itemCode || '').trim();
    if (itemCode) {
        const accountByCode = accounts.find(account =>
            String(account.code || '').trim() === itemCode
        );
        if (isRevenueAccount(accountByCode)) return accountByCode;
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
