'use strict';
// How a service's notice reads in the bell and the Dock's Activity tab (notification-ui present()):
//   - an agent's notices (Actor) show the task, not the words it was given: "Done: <prompt>" is the prompt, a step's
//     "approve: … (<task>)" is the step with an "Approval" chip; rich_content's task_title and step win when given;
//     two finished tasks are two rows (their task ids keep them apart);
//   - a value's JSON in a message (a watch on a feed sends the entry, cut short at 300 characters) reads as its
//     title and summary, and JSON with neither is left out, never shown as code;
//   - Actor, Watch and Connect each have a face of their own (not the Services grid) and a label.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

// The script in a page (it wires the document as it loads), never polling: no token, same origin.
const { window: w, document } = parseHTML('<!doctype html><html><head></head><body></body></html>');
const ctx = { document, navigator: { userAgent: 'test' }, location: new URL('https://openvibe.network/'), console,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    HTMLElement: w.HTMLElement, Event: w.Event, CustomEvent: w.CustomEvent };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'notification-ui.js'), 'utf8'), ctx, { filename: 'notification-ui.js' });
const N = ctx.OpenVibeNotifications;

const done = N.present({ type: 'AGENT_TASK_DONE', service: 'actor', category: 'service', title: 'Your task is done',
    message: 'Done: Research this and write a short report for a team, with the links of your sources: moss',
    rich_content: JSON.stringify({ task_id: 'tsk_1', state: 'succeeded' }) });
assert.equal(done.message, 'Research this and write a short report for a team, with the links of your sources: moss');
assert.equal(done.glyph, 'agent');
assert.equal(done.tone, 'ok');
assert.equal(done.label, 'Agents');
const done2 = N.present({ type: 'AGENT_TASK_DONE', service: 'actor', category: 'service', title: 'Your task is done', message: 'Done: x', rich_content: { task_id: 'tsk_2' } });
assert.notEqual(done.key, done2.key, 'two tasks never fold into one row');
assert.equal(N.present({ type: 'AGENT_TASK_DONE', service: 'actor', message: 'Done: old words', rich_content: { task_id: 'tsk_3', task_title: 'Plan the trip' } }).message, 'Plan the trip');

const failed = N.present({ type: 'AGENT_TASK_FAILED', service: 'actor', category: 'service', message: 'Not finished: Book it — the site refused' });
assert.equal(failed.message, 'Book it — the site refused');
assert.equal(failed.tone, 'warn');

const needs = N.present({ type: 'AGENT_NEEDS_YOU', service: 'actor', category: 'service', title: 'Your agent needs you',
    message: 'approve: Run "rm -rf /tmp/actor-gate-proof" on your computer (Call the computer_run tool right away)' });
assert.equal(needs.message, 'Run "rm -rf /tmp/actor-gate-proof" on your computer');
assert.deepEqual([...needs.chips], ['Approval']);
assert.equal(needs.glyph, 'agent');
assert.equal(N.present({ type: 'AGENT_NEEDS_YOU', service: 'actor', message: 'Look at the example page and tell me when you are done.' }).message,
    'Look at the example page and tell me when you are done.');
const given = N.present({ type: 'AGENT_NEEDS_YOU', service: 'actor', message: 'approve: x (y)', rich_content: { step: 'Sign in to the bank', kind: 'sign in' } });
assert.equal(given.message, 'Sign in to the bank');
assert.deepEqual([...given.chips], ['Sign-in']);

const cut = '{"identity":"https://openvibe.work/jobs/job_0wzn","kind":"entry","title":"(Senior) Product Engineer at sustaind GmbH","link":"https://openvibe.work/jobs/job_0wzn","summary":"Bielefeld · Remote · Unbefristeter arbeitsvertrag — Mit Sustaind \\"bauen\\" wir…';
const watch = N.present({ type: 'WATCH_TRIGGERED', service: 'watch', category: 'service', title: '“Jobs” fired', message: cut });
assert.equal(watch.message, '(Senior) Product Engineer at sustaind GmbH — Bielefeld · Remote · Unbefristeter arbeitsvertrag — Mit Sustaind "bauen" wir…');
assert.equal(watch.glyph, 'eye');
assert.equal(watch.label, 'Watch');
assert.equal(N.present({ type: 'WATCH_TRIGGERED', service: 'watch', message: '{"price":12,"stock":3}' }).message, '');
assert.equal(N.present({ type: 'WATCH_TRIGGERED', service: 'watch', message: '42 (was 40) · from https://x.example/' }).message, '42 (was 40) · from https://x.example/');

const connect = N.present({ type: 'GENERIC', service: 'connect', category: 'service', title: 'a is back', message: 'Your computer is connected again.' });
assert.equal(connect.glyph, 'screen');
assert.equal(connect.label, 'Connect');
assert.equal(N.present({ type: 'WELCOME', service: 'network', category: 'service', title: 'Welcome to OpenVibe', message: 'Hi' }).glyph, 'spark');
// Unchanged: a stream notice keeps its category's face; deals keep the tag.
assert.equal(N.present({ type: 'STREAM_LIVE', service: 'live', category: 'stream', title: 'x is live' }).glyph, 'live');
assert.equal(N.present({ type: 'DEAL_FOUND', service: 'deals', category: 'economy', title: 'Deal' }).glyph, 'tag');

console.log('notification-faces: all checks passed');
