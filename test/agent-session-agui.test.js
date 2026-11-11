'use strict';
// Protocol 1.2 (ask 354, 2026-11-11): agent-session.js reads AG-UI 1.0 events (docs.ag-ui.com) with OpenVibe's words in
// metadata.ov, so any agent that speaks AG-UI renders in the one step view: phases, steps with their own titles and
// sources, thinking, streamed text, the plan, the activity line and the CUSTOM ov.* events.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const A = require('../agent-session.js');
const n = (e) => A.normalize(e);

assert.deepStrictEqual(n({ type: 'RUN_STARTED' }), [{ t: 'state', state: 'running' }]);
assert.deepStrictEqual(n({ type: 'STEP_STARTED', stepName: 'Read the repos' }), [{ t: 'phase', id: 'Read the repos', title: 'Read the repos', status: 'running' }]);
assert.deepStrictEqual(n({ type: 'STEP_FINISHED', step_name: 'Read the repos' }), [{ t: 'phase', id: 'Read the repos', status: 'done' }], 'snake_case fields too');
const tool = n({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'web_fetch', metadata: { ov: { title: 'Fetching README files', kind: 'web' } } })[0];
assert.strictEqual(tool.t, 'tool');
assert.strictEqual(tool.title, 'Fetching README files');
assert.strictEqual(tool.kind, 'web');
assert.deepStrictEqual(n({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"u' }), [{ t: 'tool_args', id: 't1', delta: '{"u' }]);
const res = n({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: 'ok', metadata: { ov: { sources: [{ url: 'https://a.example/x' }] } } });
assert.deepStrictEqual(res.map((x) => x.t), ['sources', 'tool_result'], 'a result\'s sources come first');
assert.deepStrictEqual(n({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Hi' }), [{ t: 'text_delta', id: 'm1', delta: 'Hi' }]);
assert.deepStrictEqual(n({ type: 'REASONING_END', messageId: 'r1' }), [{ t: 'thinking', id: 'r1', done: true }]);
assert.deepStrictEqual(n({ type: 'REASONING_ENCRYPTED_VALUE', messageId: 'r1' }), [{ t: 'thinking', id: 'r1', hidden: true }], 'an encrypted thought shows only that it happened');
assert.deepStrictEqual(n({ type: 'STATE_SNAPSHOT', snapshot: { plan: [{ title: 'A', status: 'completed' }] } }), [{ t: 'phases', items: [{ title: 'A', status: 'completed' }] }]);
assert.deepStrictEqual(n({ type: 'ACTIVITY_SNAPSHOT', content: { title: 'Comparing' } }), [{ t: 'activity', text: 'Comparing' }]);
assert.deepStrictEqual(n({ type: 'CUSTOM', name: 'ov.sources', value: [{ url: 'https://b.example' }] }), [{ t: 'sources', items: [{ url: 'https://b.example' }] }]);
assert.strictEqual(n({ type: 'RUN_ERROR', message: 'boom' })[0].ok, false);
assert.deepStrictEqual(n({ type: 'SOMETHING_NEW' }), [], 'an unknown family is ignored, never an error');
assert.deepStrictEqual(n({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } }).map((x) => x.t), ['text'], 'Claude stream-json still reads as before');

const js = fs.readFileSync(path.join(__dirname, '..', 'agent-session.js'), 'utf8');
assert.ok(js.includes("if (!/^https:\\/\\//.test(url) || S.sources.has(url)) continue;"), 'sources are https only, once each');
assert.ok(js.includes("a.rel = 'noopener noreferrer'") && js.includes("a.target = '_blank'"), 'a source opens in a new tab, without the opener');
const css = fs.readFileSync(path.join(__dirname, '..', 'agent-session.css'), 'utf8');
['.ovas-phase', '.ovas-think', '.ovas-sources', '.ovas--card', '.ovas-open'].forEach((sel) => assert.ok(css.includes(sel), sel));
console.log('agent-session-agui: AG-UI events read as phases, titled steps, sources, thinking and text');
