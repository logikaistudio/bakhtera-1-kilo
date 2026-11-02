export const getJournalFxAuditRow = (entry, sourceDocument = null, payment = null) => {
    const referenceType = String(entry.reference_type || '').toLowerCase();
    if (/selisih kurs|exchange (gain|loss)/i.test(entry.description || '')) return null;

    const documentCurrency = String(sourceDocument?.currency || '').toUpperCase();
    const paymentCurrency = String(payment?.currency || '').toUpperCase();
    const rawSourceRate = Number(sourceDocument?.exchange_rate) || 0;
    const sourceRate = documentCurrency && documentCurrency !== 'IDR' && rawSourceRate > 1
        ? rawSourceRate
        : null;
    const currency = String(
        (entry.foreign_currency && entry.foreign_currency !== 'IDR' ? entry.foreign_currency : '') ||
        (entry.currency && entry.currency !== 'IDR' ? entry.currency : '') ||
        (paymentCurrency !== 'IDR' ? paymentCurrency : '') ||
        (documentCurrency !== 'IDR' ? documentCurrency : '')
    ).toUpperCase();
    if (!currency || currency === 'IDR') return null;

    const debitIDR = Math.abs(Number(entry.debit_idr ?? entry.debit) || 0);
    const creditIDR = Math.abs(Number(entry.credit_idr ?? entry.credit) || 0);
    const bookedIDR = Math.max(debitIDR, creditIDR);
    const paymentAmount = Number(payment?.amount) > 0 && paymentCurrency === currency ? Number(payment.amount) : null;
    const foreignAmountValue = Number(entry.foreign_amount);
    const foreignAmount = foreignAmountValue > 0
        ? foreignAmountValue
        : paymentAmount
            ? paymentAmount
            : entry.currency && entry.currency !== 'IDR'
                ? Math.abs(Number(entry.debit) || 0) + Math.abs(Number(entry.credit) || 0)
                : sourceRate && bookedIDR > 0 && !['ar_payment', 'ap_payment'].includes(referenceType)
                    ? bookedIDR / sourceRate
                    : null;
    const snapshotRate = Number(entry.transaction_exchange_rate) || 0;
    const legacyRate = entry.currency !== 'IDR' ? Number(entry.exchange_rate) || 0 : 0;
    const inferredRateValue = foreignAmount > 0 && bookedIDR > 0 ? bookedIDR / foreignAmount : null;
    const inferredRate = inferredRateValue > 1 ? inferredRateValue : null;
    const rate = snapshotRate || (legacyRate > 1 ? legacyRate : null) ||
        (paymentAmount && inferredRate ? inferredRate : null) ||
        (sourceRate && !['ar_payment', 'ap_payment'].includes(referenceType) ? sourceRate : null) || inferredRate;
    const rateStatus = snapshotRate > 1
        ? 'snapshot'
        : snapshotRate > 0
            ? 'review'
            : rate && legacyRate > 1
                ? 'legacy'
                : paymentAmount && inferredRate
                    ? 'reconstructed'
                    : sourceRate && !['ar_payment', 'ap_payment'].includes(referenceType)
                        ? 'source_document'
                        : inferredRateValue && inferredRateValue <= 1
                            ? 'review'
                            : rate
                    ? 'reconstructed'
                    : 'missing';
    const expectedIDR = foreignAmount > 0 && rate ? Math.round(foreignAmount * rate * 100) / 100 : null;
    const differenceIDR = expectedIDR === null ? null : Math.round((bookedIDR - expectedIDR) * 100) / 100;
    const documentExpectedIDR = foreignAmount > 0 && sourceRate
        ? Math.round(foreignAmount * sourceRate * 100) / 100
        : null;
    const documentRateVarianceIDR = documentExpectedIDR === null
        ? null
        : Math.round((bookedIDR - documentExpectedIDR) * 100) / 100;
    const hasVerifiedRate = rateStatus === 'snapshot' || rateStatus === 'legacy' ||
        (rateStatus === 'source_document' && foreignAmountValue > 0);

    return {
        entryDate: entry.entry_date,
        entryNumber: entry.entry_number,
        referenceNumber: entry.reference_number,
        partyName: entry.party_name,
        accountCode: entry.account_code,
        accountName: entry.account_name,
        description: entry.description,
        currency,
        foreignAmount,
        transactionExchangeRate: rate,
        sourceExchangeRate: sourceRate,
        debitIDR,
        creditIDR,
        bookedIDR,
        differenceIDR,
        documentRateVarianceIDR,
        rateStatus,
        isMismatch: hasVerifiedRate && differenceIDR !== null && Math.abs(differenceIDR) > 0.02,
        differsFromDocumentRate: documentRateVarianceIDR !== null && Math.abs(documentRateVarianceIDR) > 0.02
    };
};

const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getJournalFxDateRange = (period, referenceDate = new Date()) => {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const end = new Date(start);

    if (period === 'weekly') {
        const daysFromMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysFromMonday);
        end.setDate(start.getDate() + 6);
    } else if (period === 'monthly') {
        start.setDate(1);
        end.setMonth(start.getMonth() + 1, 0);
    } else if (period === 'yearly') {
        start.setMonth(0, 1);
        end.setMonth(11, 31);
    }

    return { start: toDateInputValue(start), end: toDateInputValue(end) };
};