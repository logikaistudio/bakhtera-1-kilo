import assert from 'node:assert/strict';
import test from 'node:test';
import { getWarehouseStock } from './warehouseStock.js';

test('uses only stock for the matching submission, package, and item', () => {
    const stock = getWarehouseStock([
        { pengajuan_id: 'source-1', package_number: 'PKG-A', item_code: 'ITEM-1', quantity: 0 },
        { pengajuan_id: 'source-1', package_number: 'PKG-B', item_code: 'ITEM-1', quantity: 5 },
        { pengajuan_id: 'source-2', package_number: 'PKG-A', item_code: 'ITEM-1', quantity: 9 }
    ], {
        submissionId: 'SOURCE-1',
        packageNumber: 'pkg-a',
        itemCode: 'item-1'
    });

    assert.equal(stock, 0);
});

test('sums split stock rows for the same warehouse scope', () => {
    const stock = getWarehouseStock([
        { pengajuanNumber: 'BRG-1', packageNumber: 'PKG-A', itemCode: 'ITEM-1', quantity: 2 },
        { pengajuan_number: 'BRG-1', package_number: 'PKG-A', item_code: 'ITEM-1', quantity: 3 }
    ], {
        submissionNumber: 'BRG-1',
        packageNumber: 'PKG-A',
        itemCode: 'ITEM-1'
    });

    assert.equal(stock, 5);
});

test('uses the exact fallback warehouse row when an inventory ID is available', () => {
    const stock = getWarehouseStock([
        { id: 'warehouse-1', quantity: 0 },
        { id: 'warehouse-2', quantity: 4 }
    ], { warehouseInventoryId: 'warehouse-1', itemCode: 'ITEM-1' });

    assert.equal(stock, 0);
});
