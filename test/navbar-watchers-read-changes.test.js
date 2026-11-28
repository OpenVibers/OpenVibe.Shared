'use strict';
// 4.343.0: the navbar's watchers read what a batch of changes added, not the whole page (idle on the Live home at 4x CPU
// their scans were ~0.9-1.3 s of every 30 s). changedRoots() collects the added elements (and, for attribute watchers,
// the changed ones); a text-only batch is empty, and addedAny() looks only inside what was added.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const a = SRC.indexOf('    function changedRoots(records, withTargets) {');
const b = SRC.indexOf('    function ringPlan(el) {');
assert.ok(a > 0 && b > a, 'the helpers sit before the rings');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(SRC.slice(a, b).replace('const addedAny', 'var addedAny'), ctx);
const el = (sel, inside = []) => ({ nodeType: 1, isConnected: true, matches: (s) => s === sel, querySelector: (s) => (inside.includes(s) ? {} : null) });
const text = { nodeType: 3 };
const box = el('input[type=search]');
const card = el('div.card', ['select']);
const roots = vm.runInContext('changedRoots', ctx);
const changed = roots([{ type: 'childList', addedNodes: [text, box] }, { type: 'childList', addedNodes: [card, box] }, { type: 'attributes', target: card }]);
assert.deepStrictEqual([...changed], [box, card], 'the added elements, once each; no text nodes; no attribute targets unless asked');
assert.strictEqual(roots([{ type: 'childList', addedNodes: [text, text] }]).size, 0, 'a change of text alone: nothing to read');
assert.deepStrictEqual([...roots([{ type: 'attributes', target: card }], true)], [card], 'an attribute watcher gets the changed element');
const any = vm.runInContext('addedAny', ctx);
assert.strictEqual(any(new Set([card]), 'select'), true, 'a select inside what was added');
assert.strictEqual(any(new Set([box]), 'input[type=search]'), true, 'the added element itself');
assert.strictEqual(any(new Set([card]), '[data-ov-agent]'), false, 'nothing asked for');
assert.strictEqual(any(new Set([{ ...card, isConnected: false }]), 'select'), false, 'gone again: not read');
// Each watcher goes through them: the trending box, the agent button, the form kit, the rings and the peeks.
assert.ok(SRC.includes("if (soon || !addedAny(changedRoots(records), `${TREND_ASK}, ${TREND_FORM}`)) return;"), 'trending');
assert.ok(SRC.includes("if (soon || !addedAny(changedRoots(records), '[data-ov-agent]')) return;"), 'agents');
assert.ok(SRC.includes("if (soon || !addedAny(changedRoots(records), `${FORM_CONTROLS},input,textarea,button`)) return;"), 'forms');
assert.ok(SRC.includes('changed.add(n);') && SRC.includes('changedRoots(records, true)'), 'rings');
assert.ok(SRC.includes('const roots = scanned ? [...pending].filter((x) => x.isConnected) : [document];'), 'peeks: the whole page first, then what was added');
console.log('navbar-watchers-read-changes: the watchers read what changed, and a change of text alone reads nothing');
