import assert from 'node:assert/strict';
import test from 'node:test';
import { hasApprovedOutboundForSource } from './outboundApproval.js';

test('matches an approved outbound using a JSON document source reference', () => {
    const approved = hasApprovedOutboundForSource({
        submissionNumber: 'BRG2608-000009',
        quotations: [{
            type: 'outbound',
            document_status: 'approved',
            documents: { sourcePengajuanNumber: 'BRG2608-000009' }
        }]
    });

    assert.equal(approved, true);
});

test('matches legacy JSON-string metadata and snake-case source references', () => {
    const approved = hasApprovedOutboundForSource({
        submissionId: 'source-id',
        quotations: [{
            type: 'outbound',
            documentStatus: ' Approved ',
            documents: JSON.stringify({ source_pengajuan_id: 'SOURCE-ID' })
        }]
    });

    assert.equal(approved, true);
});

test('does not accept an unapproved or unrelated outbound submission', () => {
    const quotations = [
        {
            type: 'outbound',
            document_status: 'pending',
            source_pengajuan_number: 'BRG2608-000009'
        },
        {
            type: 'outbound',
            document_status: 'approved',
            source_pengajuan_number: 'BRG2608-000010'
        }
    ];

    assert.equal(hasApprovedOutboundForSource({
        submissionNumber: 'BRG2608-000009',
        quotations
    }), false);
});
