'use strict';
// Backend-independent analytics retention bounds.
const assert = require('assert');
const { retention } = require('openvibe-shared/analytics');

assert.strictEqual(retention.MAX_DAYS, 30);
assert.strictEqual(retention.DEFAULT_BATCH, 5000);
assert.strictEqual(retention.checkDays('30'), 30);
assert.strictEqual(retention.cutoffFor(30, Date.parse('2026-09-23T12:00:00Z')), '2026-08-24 12:00:00');
for (const days of [0, 31, 1.5, 'x']) assert.throws(() => retention.checkDays(days), /1 to 30/);
console.log('analytics-retention: all checks passed');
