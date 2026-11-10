'use strict';
const assert = require('node:assert/strict');
const machines = require('../machines');

const sample = [
  { id: 'dev_1', roles: ['codes.worker', 'ai.host'] },
  { id: 'dev_2', roles: ['desks.host'] },
];
assert.equal(machines.needsMachine(sample[0], 'models'), true);
assert.equal(machines.needsMachine(sample[1], 'models'), false);
assert.equal(machines.needsMachine(sample[1], 'desktop'), true);
assert.equal(machines.canRun(sample[0]), 'coding jobs, your AI models');
console.log('machines fixture: ok');
