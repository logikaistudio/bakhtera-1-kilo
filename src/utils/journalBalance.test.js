import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildManualBatchBalancingEntry,
    getJournalBalanceDifference
} from './journalBalance.js';

const lines = [
    {
        entry_number: 'JE-2611-00003-L01',
        entry_date: '2026-11-18',
        reference_number: 'JE-2611-00003',
        batch_id: 'batch-1',
        source: 'manual',
        division: 'BLINK',
        debit: 70410391.74,
        credit: 0,
        coa_id: 'cash'
    },
    {
        entry_number: 'JE-2611-00003-L02',
        entry_date: '2026-11-18',
        reference_number: 'JE-2611-00003',
        batch_id: 'batch-1',
        source: 'manual',
        division: 'BLINK',
        debit: 0,
        credit: 70474741.74,
        coa_id: 'expense'
    }
];

test('balancing an existing manual journal appends the difference to its batch', () => {
    const correction = buildManualBatchBalancingEntry(
        lines,
        { id: 'expense', code: '6100', name: 'Expense' },
        'Correct unbalanced entry',
        'BLINK'
    );

    assert.equal(correction.entry_number, 'JE-2611-00003-L03');
    assert.equal(correction.batch_id, 'batch-1');
    assert.equal(correction.debit, 64350);
    assert.equal(correction.credit, 0);
    assert.equal(getJournalBalanceDifference([...lines, correction]), 0);
});

test('manual batch correction rejects generated journals and batches without an id', () => {
    const account = { id: 'expense', code: '6100', name: 'Expense' };

    assert.equal(
        buildManualBatchBalancingEntry(lines.map(line => ({ ...line, source: 'auto' })), account, 'Correction', 'BLINK'),
        null
    );
    assert.equal(
        buildManualBatchBalancingEntry(lines.map(line => ({ ...line, batch_id: null })), account, 'Correction', 'BLINK'),
        null
    );
});
