import assert from 'node:assert/strict';
import test from 'node:test';
import { sortMutationLogsBySubmission } from './goodsMovementUtils.js';

test('sorts Goods Movement by the newest submission number, not log timestamp', () => {
    const logs = [
        { id: 'later-log', pengajuanNumber: 'BRG2609-000017', createdAt: '2026-11-26T05:00:00Z' },
        { id: 'newest-submission', pengajuanNumber: 'BRG2610-000002', createdAt: '2026-11-20T05:00:00Z' },
        { id: 'older-submission', pengajuanNumber: 'BRG2609-000099', createdAt: '2026-11-26T06:00:00Z' },
        { id: 'earlier-log', pengajuanNumber: 'BRG2609-000017', createdAt: '2026-11-25T05:00:00Z' }
    ];

    assert.deepEqual(
        sortMutationLogsBySubmission(logs).map(log => log.id),
        ['newest-submission', 'older-submission', 'later-log', 'earlier-log']
    );
    assert.equal(logs[0].id, 'later-log');
});

test('places records without a submission number after numbered submissions', () => {
    const sorted = sortMutationLogsBySubmission([
        { id: 'missing-number' },
        { id: 'numbered', pengajuanNumber: 'BRG2609-000001' }
    ]);

    assert.deepEqual(sorted.map(log => log.id), ['numbered', 'missing-number']);
});
