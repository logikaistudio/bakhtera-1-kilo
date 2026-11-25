import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutationTracking } from './mutationTracking.js';

test('stores the latest mutation status on the original item and counts multiple mutations in one save', () => {
    const packages = [{
        packageNumber: 'PKG-A',
        items: [
            { itemCode: 'ITEM-1' },
            { itemCode: 'ITEM-2', totalMutated: 3 }
        ]
    }];
    const mutations = [
        { _pkgIndex: 0, _itemIndex: 1, itemCode: 'ITEM-2', mutatedQty: 2, date: '2026-11-25' },
        { _pkgIndex: 0, _itemIndex: 1, itemCode: 'ITEM-2', mutatedQty: 4, date: '2026-11-26' }
    ];
    const mutationLogs = [
        { pengajuanNumber: 'BRG-1', packageNumber: 'PKG-A', itemCode: 'ITEM-2' }
    ];

    const updated = applyMutationTracking(packages, mutations, mutationLogs, 'BRG-1');

    assert.equal(updated[0].items[0].mutationStatus, undefined);
    assert.equal(updated[0].items[1].mutationStatus, 're-mutasi');
    assert.equal(updated[0].items[1].lastMutationDate, '2026-11-26');
    assert.equal(updated[0].items[1].lastMutationQty, 4);
    assert.equal(updated[0].items[1].totalMutated, 9);
    assert.equal(packages[0].items[1].mutationStatus, undefined);
});
