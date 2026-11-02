import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Printer, RefreshCw } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import { supabase } from '../../lib/supabase';
import { printReport, fmtDatePrint } from '../../utils/printPDF';
import { getJournalFxAuditRow, getJournalFxDateRange } from '../../utils/journalFxAudit';

const PERIOD_OPTIONS = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
];

const STATUS_LABELS = {
    snapshot: 'Verified snapshot',
    legacy: 'Stored legacy rate',
    source_document: 'Source document rate',
    reconstructed: 'Reconstructed',
    review: 'Review rate',
    missing: 'Rate unavailable'
};

const formatNumber = (value, maximumFractionDigits = 2) => Number(value || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const JournalFxAuditReport = ({ open, onClose, entries, dateRange, setDateRange, loading, companyInfo, module, t }) => {
    const [periodPreset, setPeriodPreset] = useState('custom');
    const [currencyFilter, setCurrencyFilter] = useState('all');
    const [sourceData, setSourceData] = useState({ entryKey: '', documents: {}, payments: {} });
    const entryKey = useMemo(() => (entries || []).map(entry => `${entry.reference_type}:${entry.reference_id}:${entry.reference_number}`).sort().join('|'), [entries]);

    useEffect(() => {
        if (!open || !entries?.length) return undefined;

        let cancelled = false;
        const loadSourceData = async () => {
            const invoiceTable = module === 'blink' ? 'blink_invoices' : 'bridge_invoices';
            const purchaseOrderTable = module === 'blink' ? 'blink_purchase_orders' : 'bridge_pos';
            const apTable = module === 'blink' ? 'blink_ap_transactions' : 'bridge_ap_transactions';
            const paymentTable = module === 'blink' ? 'blink_payments' : 'bridge_payments';
            const invoiceTypes = new Set(['ar', 'blink_invoice', 'invoice', 'ar_payment', 'ar_reversal']);
            const purchaseOrderTypes = new Set(['po', 'purchase_order', 'ap_reversal']);
            const apPaymentTypes = new Set(['ap_payment']);
            const invoiceIds = [...new Set(entries.filter(entry => invoiceTypes.has(entry.reference_type) && entry.reference_id).map(entry => entry.reference_id))];
            const purchaseOrderIds = [...new Set(entries.filter(entry => purchaseOrderTypes.has(entry.reference_type) && entry.reference_id).map(entry => entry.reference_id))];
            const apIds = [...new Set(entries.filter(entry => apPaymentTypes.has(entry.reference_type) && entry.reference_id).map(entry => entry.reference_id))];
            const paymentNumbers = [...new Set(entries.filter(entry => ['ar_payment', 'ap_payment'].includes(entry.reference_type) && entry.reference_number).map(entry => entry.reference_number))];

            const [invoiceResult, apResult, paymentResult] = await Promise.all([
                invoiceIds.length
                    ? supabase.from(invoiceTable).select('id, currency, exchange_rate').in('id', invoiceIds)
                    : Promise.resolve({ data: [], error: null }),
                apIds.length
                    ? supabase.from(apTable).select('id, po_id').in('id', apIds)
                    : Promise.resolve({ data: [], error: null }),
                paymentNumbers.length
                    ? supabase.from(paymentTable).select('payment_number, amount, currency').in('payment_number', paymentNumbers)
                    : Promise.resolve({ data: [], error: null })
            ]);

            const apPoIds = (apResult.data || []).map(row => row.po_id).filter(Boolean);
            const allPoIds = [...new Set([...purchaseOrderIds, ...apPoIds])];
            const poResult = allPoIds.length
                ? await supabase.from(purchaseOrderTable).select('id, currency, exchange_rate').in('id', allPoIds)
                : { data: [], error: null };

            [invoiceResult, apResult, paymentResult, poResult].forEach(result => {
                if (result?.error) console.warn('[FX Audit] Could not load one source table:', result.error.message);
            });

            const invoicesById = Object.fromEntries((invoiceResult.data || []).map(row => [row.id, row]));
            const purchaseOrdersById = Object.fromEntries((poResult.data || []).map(row => [row.id, row]));
            const apToPoId = Object.fromEntries((apResult.data || []).map(row => [row.id, row.po_id]));
            const paymentsByNumber = Object.fromEntries((paymentResult.data || []).map(row => [row.payment_number, row]));
            const documents = {};

            entries.forEach(entry => {
                let document = null;
                if (invoiceTypes.has(entry.reference_type)) document = invoicesById[entry.reference_id];
                else if (purchaseOrderTypes.has(entry.reference_type)) document = purchaseOrdersById[entry.reference_id];
                else if (apPaymentTypes.has(entry.reference_type)) document = purchaseOrdersById[apToPoId[entry.reference_id]];
                if (document) documents[`${entry.reference_type}:${entry.reference_id}`] = document;
            });

            if (!cancelled) setSourceData({ entryKey, documents, payments: paymentsByNumber });
        };

        loadSourceData().catch(error => console.warn('[FX Audit] Source lookup failed:', error));
        return () => { cancelled = true; };
    }, [entries, entryKey, module, open]);

    const currentSourceData = useMemo(() => sourceData.entryKey === entryKey
        ? sourceData
        : { documents: {}, payments: {} }, [sourceData, entryKey]);

    const auditRows = useMemo(() => (entries || [])
        .map(entry => getJournalFxAuditRow(
            entry,
            currentSourceData.documents[`${entry.reference_type}:${entry.reference_id}`],
            currentSourceData.payments[entry.reference_number]
        ))
        .filter(Boolean), [entries, currentSourceData]);
    const currencies = useMemo(() => [...new Set(auditRows.map(row => row.currency))].sort(), [auditRows]);
    const visibleRows = useMemo(() => currencyFilter === 'all'
        ? auditRows
        : auditRows.filter(row => row.currency === currencyFilter), [auditRows, currencyFilter]);
    const mismatchCount = visibleRows.filter(row => row.isMismatch).length;
    const documentRateDifferenceCount = visibleRows.filter(row => row.differsFromDocumentRate).length;
    const unverifiedCount = visibleRows.filter(row => !['snapshot', 'legacy'].includes(row.rateStatus)).length;

    const setPreset = (preset) => {
        setPeriodPreset(preset);
        setDateRange(getJournalFxDateRange(preset));
    };

    const exportCsv = () => {
        const headers = [
            'Date', 'Journal No.', 'Reference No.', 'Party', 'Account Code', 'Account Name',
            'Description', 'Currency', 'Foreign Amount', 'Journal Rate', 'Source Document Rate',
            'Debit IDR', 'Credit IDR', 'Booked IDR', 'Variance vs Journal Rate IDR',
            'Variance vs Source Rate IDR', 'Rate Audit Status'
        ];
        const values = visibleRows.map(row => [
            row.entryDate,
            row.entryNumber,
            row.referenceNumber || '',
            row.partyName || '',
            row.accountCode || '',
            row.accountName || '',
            row.description || '',
            row.currency,
            row.foreignAmount ?? '',
            row.transactionExchangeRate ?? '',
            row.sourceExchangeRate ?? '',
            row.debitIDR,
            row.creditIDR,
            row.bookedIDR,
            row.differenceIDR ?? '',
            row.documentRateVarianceIDR ?? '',
            STATUS_LABELS[row.rateStatus]
        ]);
        const escapeCsv = value => {
            const text = String(value ?? '');
            return text.includes(',') || text.includes('"') || text.includes('\n')
                ? `"${text.replace(/"/g, '""')}"`
                : text;
        };
        const csv = [headers, ...values].map(row => row.map(escapeCsv).join(',')).join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = `FX_Journal_Audit_${dateRange.start}_${dateRange.end}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportPdf = () => {
        const rowsHtml = visibleRows.map(row => `
            <tr>
                <td>${escapeHtml(fmtDatePrint(row.entryDate))}</td>
                <td>${escapeHtml(row.entryNumber)}</td>
                <td>${escapeHtml(row.referenceNumber)}</td>
                <td>${escapeHtml(row.partyName)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td class="text-right">${escapeHtml(formatNumber(row.foreignAmount))} ${escapeHtml(row.currency)}</td>
                <td class="text-right">${row.transactionExchangeRate ? escapeHtml(formatNumber(row.transactionExchangeRate, 8)) : '-'}</td>
                <td class="text-right">${row.sourceExchangeRate ? escapeHtml(formatNumber(row.sourceExchangeRate, 8)) : '-'}</td>
                <td class="text-right">Rp ${escapeHtml(formatNumber(row.bookedIDR))}</td>
                <td class="text-right">${row.differenceIDR === null ? '-' : `Rp ${escapeHtml(formatNumber(row.differenceIDR))}`}</td>
                <td class="text-right">${row.documentRateVarianceIDR === null ? '-' : `Rp ${escapeHtml(formatNumber(row.documentRateVarianceIDR))}`}</td>
                <td>${escapeHtml(t(STATUS_LABELS[row.rateStatus]))}${row.differsFromDocumentRate ? ` · ${escapeHtml(t('Differs from document rate'))}` : ''}${row.isMismatch ? ` · ${escapeHtml(t('Posting variance'))}` : ''}</td>
            </tr>`).join('');
        const bodyHTML = `
            <div class="summary-grid" style="grid-template-columns:repeat(4,1fr)">
                <div class="summary-card"><div class="label">FX Lines</div><div class="value">${visibleRows.length}</div></div>
                <div class="summary-card"><div class="label">Journal Variances</div><div class="value">${mismatchCount}</div></div>
                <div class="summary-card"><div class="label">Different from Document Rate</div><div class="value">${documentRateDifferenceCount}</div></div>
                <div class="summary-card"><div class="label">Unverified Rates</div><div class="value">${unverifiedCount}</div></div>
            </div>
            <table>
                <thead><tr>
                    <th>Date</th><th>Journal No.</th><th>Reference</th><th>Party</th><th>Description</th>
                    <th class="text-right">Foreign Amount</th><th class="text-right">Journal Rate</th>
                    <th class="text-right">Document Rate</th><th class="text-right">Booked IDR</th>
                    <th class="text-right">Variance vs Journal Rate</th><th class="text-right">Variance vs Document</th><th>Audit Status</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>`;

        printReport({
            reportName: 'FX Journal Audit',
            companyInfo,
            period: `${fmtDatePrint(dateRange.start)} - ${fmtDatePrint(dateRange.end)}`,
            bodyHTML,
            note: `${visibleRows.length} foreign-currency journal lines. Reconstructed or missing rates are not treated as verified variances.`
        });
    };

    if (!open) return null;

    return (
        <Modal isOpen={open} onClose={onClose} maxWidth="max-w-7xl">
            <div className="p-5 md:p-6 space-y-4">
                <div>
                    <div>
                        <h2 className="text-xl font-bold text-silver-light">{t('FX Transaction Audit')}</h2>
                        <p className="mt-1 text-sm text-silver-dark">{t('Foreign-currency journal lines and the IDR value recorded in the ledger.')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1" role="group" aria-label={t('Report period')}>
                        {PERIOD_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={periodPreset === option.value}
                                onClick={() => setPreset(option.value)}
                                className={`px-3 py-2 rounded border text-sm ${periodPreset === option.value ? 'border-blue-400 bg-blue-500/15 text-blue-200' : 'border-dark-border text-silver-light hover:bg-dark-surface'}`}
                            >{t(option.label)}</button>
                        ))}
                    </div>
                    <input type="date" aria-label={t('Start date')} value={dateRange.start} onChange={event => { setPeriodPreset('custom'); setDateRange(current => ({ ...current, start: event.target.value })); }} className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm" />
                    <span className="text-silver-dark">-</span>
                    <input type="date" aria-label={t('End date')} value={dateRange.end} onChange={event => { setPeriodPreset('custom'); setDateRange(current => ({ ...current, end: event.target.value })); }} className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm" />
                    <select value={currencyFilter} onChange={event => setCurrencyFilter(event.target.value)} aria-label={t('Currency filter')} className="px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm">
                        <option value="all">{t('All currencies')}</option>
                        {currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                    <div className="ml-auto flex gap-2">
                        <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!visibleRows.length}>{t('CSV')}</Button>
                        <Button variant="secondary" icon={Printer} onClick={exportPdf} disabled={!visibleRows.length}>{t('Print')}</Button>
                    </div>
                </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="rounded border border-dark-border bg-dark-surface p-3">
                        <p className="text-xs text-silver-dark">{t('FX journal lines')}</p>
                        <p className="mt-1 text-lg font-semibold text-silver-light">{visibleRows.length}</p>
                    </div>
                    <div className="rounded border border-dark-border bg-dark-surface p-3">
                        <p className="text-xs text-silver-dark">{t('Journal rate variances')}</p>
                        <p className={`mt-1 text-lg font-semibold ${mismatchCount ? 'text-amber-300' : 'text-green-300'}`}>{mismatchCount}</p>
                    </div>
                    <div className="rounded border border-dark-border bg-dark-surface p-3">
                        <p className="text-xs text-silver-dark">{t('Different from document rate')}</p>
                        <p className={`mt-1 text-lg font-semibold ${documentRateDifferenceCount ? 'text-amber-300' : 'text-green-300'}`}>{documentRateDifferenceCount}</p>
                    </div>
                    <div className="rounded border border-dark-border bg-dark-surface p-3">
                        <p className="text-xs text-silver-dark">{t('Rates needing review')}</p>
                        <p className={`mt-1 text-lg font-semibold ${unverifiedCount ? 'text-amber-300' : 'text-green-300'}`}>{unverifiedCount}</p>
                    </div>
                </div>

                <div className="max-h-[55vh] overflow-auto rounded border border-dark-border">
                    <table className="w-full min-w-[1180px] text-sm">
                        <thead className="sticky top-0 bg-dark-surface text-left text-xs uppercase text-silver-dark">
                            <tr>
                                <th className="p-2">{t('Date / Reference')}</th>
                                <th className="p-2">{t('Party / Description')}</th>
                                <th className="p-2">{t('Account')}</th>
                                <th className="p-2 text-right">{t('Original Amount')}</th>
                                <th className="p-2 text-right">{t('Journal Rate')}</th>
                                <th className="p-2 text-right">{t('Document Rate')}</th>
                                <th className="p-2 text-right">{t('Booked IDR')}</th>
                                <th className="p-2 text-right">{t('Variance vs Journal Rate')}</th>
                                <th className="p-2 text-right">{t('Variance vs Document Rate')}</th>
                                <th className="p-2">{t('Audit Status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr><td colSpan="8" className="p-8 text-center text-silver-dark"><RefreshCw className="inline h-4 w-4 animate-spin mr-2" />{t('Loading journal entries...')}</td></tr>
                            ) : visibleRows.length ? visibleRows.map((row, index) => (
                                <tr key={`${row.entryNumber}-${index}`} className={row.isMismatch ? 'bg-amber-500/5' : ''}>
                                    <td className="p-2 whitespace-nowrap">
                                        <div>{row.entryDate}</div>
                                        <div className="text-xs text-silver-dark">{row.entryNumber}</div>
                                        {row.referenceNumber && <div className="text-xs text-silver-dark">{row.referenceNumber}</div>}
                                    </td>
                                    <td className="p-2">
                                        <div>{row.partyName || '-'}</div>
                                        <div className="max-w-[260px] truncate text-xs text-silver-dark" title={row.description}>{row.description || '-'}</div>
                                    </td>
                                    <td className="p-2"><div>{row.accountCode || '-'}</div><div className="text-xs text-silver-dark">{row.accountName || '-'}</div></td>
                                    <td className="p-2 text-right font-mono">{row.foreignAmount === null ? '-' : `${formatNumber(row.foreignAmount, 6)} ${row.currency}`}</td>
                                    <td className="p-2 text-right font-mono">{row.transactionExchangeRate ? formatNumber(row.transactionExchangeRate, 8) : '-'}</td>
                                    <td className="p-2 text-right font-mono">{row.sourceExchangeRate ? formatNumber(row.sourceExchangeRate, 8) : '-'}</td>
                                    <td className="p-2 text-right font-mono">Rp {formatNumber(row.bookedIDR)}</td>
                                    <td className={`p-2 text-right font-mono ${row.isMismatch ? 'text-amber-300' : ''}`}>{row.differenceIDR === null ? '-' : `Rp ${formatNumber(row.differenceIDR)}`}</td>
                                    <td className={`p-2 text-right font-mono ${row.differsFromDocumentRate ? 'text-amber-300' : ''}`}>{row.documentRateVarianceIDR === null ? '-' : `Rp ${formatNumber(row.documentRateVarianceIDR)}`}</td>
                                    <td className="p-2 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${row.isMismatch || row.differsFromDocumentRate || ['missing', 'review'].includes(row.rateStatus) ? 'bg-amber-500/10 text-amber-300' : 'bg-green-500/10 text-green-300'}`}>
                                            {(row.isMismatch || row.differsFromDocumentRate) && <AlertTriangle className="h-3 w-3" />}
                                            {t(STATUS_LABELS[row.rateStatus])}{row.differsFromDocumentRate ? ` · ${t('Differs from document rate')}` : ''}{row.isMismatch ? ` · ${t('Posting variance')}` : ''}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="8" className="p-8 text-center text-silver-dark">{t('No foreign-currency journal lines in this period.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default JournalFxAuditReport;