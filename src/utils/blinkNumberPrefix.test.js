import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBlinkNumberPrefix } from './blinkNumberPrefix.js';

test('normalizes Blink document prefixes in standard, sales, and invoice numbers', () => {
    assert.equal(normalizeBlinkNumberPrefix('BLK2611-0001'), 'BFW2611-0001');
    assert.equal(normalizeBlinkNumberPrefix('SQT-BLK2611-0001'), 'SQT-BFW2611-0001');
    assert.equal(normalizeBlinkNumberPrefix('INV-BLK2611-0001-v2'), 'INV-BFW2611-0001-v2');
});

test('leaves other document prefixes unchanged', () => {
    assert.equal(normalizeBlinkNumberPrefix('BRG-INV-2611-0001'), 'BRG-INV-2611-0001');
    assert.equal(normalizeBlinkNumberPrefix('AP-2611-123456'), 'AP-2611-123456');
});
