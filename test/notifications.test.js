'use strict';
// openvibe-shared/notifications: the CONFIRMATION_REQUESTED type an agent's owner receives when a
// sensitive-capability confirmation waits for them, and its re-export from the package root.
const assert = require('node:assert/strict');
const { TYPES } = require('../notifications');

assert.deepStrictEqual(TYPES.CONFIRMATION_REQUESTED,
    { category: 'system', priority: 'high', icon: '🔑', title: 'Approval needed' });
assert.ok(Object.isFrozen(TYPES), 'TYPES stays frozen');
assert.equal(require('..').NOTIFICATION_TYPES.CONFIRMATION_REQUESTED.title, 'Approval needed');

console.log('notifications: all checks passed');
