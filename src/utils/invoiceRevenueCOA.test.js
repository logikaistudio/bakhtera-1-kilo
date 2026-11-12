import test from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveDefaultInvoiceRevenueCOA,
    resolveInvoiceRevenueCOA
} from './invoiceRevenueCOA.js';

const accounts = [
    { id: 'income', code: '4-00-000-0-1-00', name: 'INCOME', level: 1 },
    { id: 'sales', code: '4100', name: 'Pendapatan Freight & Pengiriman', level: 2 },
    { id: 'ocean', code: '4-01-301-0-1-00', name: 'OE : OCEAN FREIGHT', level: 3, parent_code: '4100' },
    { id: 'handling', code: '4-01-202-0-1-00', name: 'AI : HANDLING FEE', level: 3, parent_code: '4100' }
];

test('default invoice revenue account prefers sales income over the generic income account', () => {
    assert.equal(resolveDefaultInvoiceRevenueCOA(accounts)?.id, 'sales');
});

test('invoice item description maps to a matching detailed sales account', () => {
    assert.equal(
        resolveInvoiceRevenueCOA(
            { item_name: 'Ocean Freight', coa_id: 'income' },
            accounts,
            accounts[1]
        )?.id,
        'ocean'
    );
});

test('an ambiguous generic description falls back to sales income, not generic income', () => {
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'Freight' }, accounts, accounts[1])?.id,
        'sales'
    );
});
