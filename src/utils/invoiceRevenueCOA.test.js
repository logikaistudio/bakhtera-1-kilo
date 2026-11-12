import test from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveDefaultInvoiceRevenueCOA,
    resolveInvoiceRevenueCOA
} from './invoiceRevenueCOA.js';

const accounts = [
    { id: 'income', code: '4-00-000-0-1-00', name: 'INCOME', level: 1 },
    { id: 'sales', code: '4-01-000-0-1-00', name: 'SALES INCOME', level: 2 },
    { id: 'ocean', code: '4-01-301-0-1-00', name: 'OE : OCEAN FREIGHT', level: 3, parent_code: '4-01-000-0-1-00' },
    { id: 'handling', code: '4-01-202-0-1-00', name: 'AI : HANDLING FEE', level: 3, parent_code: '4-01-000-0-1-00' }
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

test('item description overrides the selected aggregate sales account', () => {
    assert.equal(
        resolveInvoiceRevenueCOA(
            { item_name: 'Handling Fee', coa_id: 'sales' },
            accounts,
            accounts[1]
        )?.id,
        'handling'
    );
});

test('freight invoice abbreviations resolve to the matching detailed accounts', () => {
    const accountsWithMoreDetails = [
        ...accounts,
        { id: 'document', code: '4-01-304-0-1-00', name: 'OE : DOCUMENT FEE', level: 3, parent_code: '4-01-000-0-1-00' },
        { id: 'admin', code: '4-01-310-0-1-00', name: 'OE : ADMINISTRATION FEE', level: 3, parent_code: '4-01-000-0-1-00' }
    ];

    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'THC - Invoice INV-001', coa_id: 'ocean' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'handling'
    );
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'AGENCY FEE - Invoice INV-001' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'handling'
    );
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'SEAL FEE - Invoice INV-001' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'handling'
    );
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'DOC FEE - Invoice INV-001' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'document'
    );
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'ADM FEE - Invoice INV-001' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'admin'
    );
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'INWARD MANIFEST FEE - Invoice INV-001', coa_id: 'sales' }, accountsWithMoreDetails, accountsWithMoreDetails[1])?.id,
        'document'
    );
});

test('an ambiguous generic description falls back to sales income, not generic income', () => {
    assert.equal(
        resolveInvoiceRevenueCOA({ description: 'Freight' }, accounts, accounts[1])?.id,
        'sales'
    );
});
