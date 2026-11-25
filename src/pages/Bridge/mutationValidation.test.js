import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMutationRequests } from './mutationValidation.js';

test('allows mutation quantities up to the available stock', () => {
    assert.doesNotThrow(() => validateMutationRequests([
        { scope: 'item-1', quantity: 2, availableStock: 5, itemName: 'Item 1' },
        { scope: 'item-1', quantity: 3, availableStock: 5, itemName: 'Item 1' }
    ]));
});

test('rejects combined requests that exceed stock in the same scope', () => {
    assert.throws(
        () => validateMutationRequests([
            { scope: 'item-1', quantity: 3, availableStock: 5, itemName: 'Item 1' },
            { scope: 'item-1', quantity: 3, availableStock: 5, itemName: 'Item 1' }
        ]),
        /melebihi stok tersedia/
    );
});

test('rejects invalid quantities instead of silently ignoring them', () => {
    assert.throws(
        () => validateMutationRequests([
            { scope: 'item-1', quantity: Number.NaN, availableStock: 5, itemName: 'Item 1' }
        ]),
        /tidak valid/
    );
});
