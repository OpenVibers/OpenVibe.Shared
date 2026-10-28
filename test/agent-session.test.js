'use strict';
// agent-session.js under node: the stream-json → line mapping every reader shares (the harness's job.js lines pass
// through as they are), what a step is, and the line diff behind an edit's +/− counts. The page itself is checked in
// Chrome by agent-session-chrome.test.js.
const assert = require('assert');
const as = require('../agent-session');

assert.deepStrictEqual(as.normalize({ type: 'system', subtype: 'init', agent: 'codex', model: 'm' }), [{ t: 'agent', agent: 'codex', model: 'm' }]);
const said = as.normalize({ type: 'assistant', parent_tool_use_id: 'T', message: { content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', id: 'x1', name: 'Bash', input: { command: 'ls' } }], usage: { input_tokens: 3, output_tokens: 4 } } });
assert.deepStrictEqual(said, [{ t: 'text', text: 'hi', parent: 'T' }, { t: 'tool', id: 'x1', name: 'Bash', input: { command: 'ls' }, parent: 'T' }, { t: 'usage', input_tokens: 3, output_tokens: 4 }], 'text, a step and usage, with the helper they belong to');
assert.deepStrictEqual(as.normalize({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x1', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], is_error: true }] } }),
    [{ t: 'tool_result', id: 'x1', ok: false, output: 'a\nb' }], 'a result\'s parts become one output');
assert.deepStrictEqual(as.normalize({ type: 'system', subtype: 'tool_progress', tool_use_id: 'x1', text: 'line\n' }), [{ t: 'tool_progress', id: 'x1', chunk: 'line\n' }], 'output as a step runs');
assert.deepStrictEqual(as.normalize({ type: 'system', subtype: 'handoff', from: 'claude', to: 'codex', reason: 'limit' }), [{ t: 'handoff', from: 'claude', to: 'codex', reason: 'limit' }]);
assert.strictEqual(as.normalize({ type: 'result', is_error: false, result: 'ok', duration_ms: 5, total_cost_usd: 0.1, num_turns: 2 })[0].t, 'done');
assert.deepStrictEqual(as.normalize({ t: 'tool', id: 'y', name: 'Read' }), [{ t: 'tool', id: 'y', name: 'Read' }], 'a job line passes as it is');
assert.deepStrictEqual(as.normalize(null), []);
assert.strictEqual(as.normalize({ type: 'assistant', message: { content: [{ type: 'text', text: 'x'.repeat(9000) }] } })[0].text.length, 6000, 'long text is cut');

assert.deepStrictEqual(['Bash', 'run_command', 'Read', 'Grep', 'Edit', 'write_file', 'WebFetch', 'Task', 'TodoWrite', 'mystery_shell_exec', 'Frobnicate'].map(as.kindOf),
    ['command', 'command', 'read', 'search', 'edit', 'write', 'web', 'agent', 'plan', 'command', 'tool'], 'every agent\'s tools map to the same kinds');
assert.deepStrictEqual(as.diffLines('a\nb\nc', 'a\nB\nc'), [['=', 'a'], ['-', 'b'], ['+', 'B'], ['=', 'c']], 'a changed line is a removal and an addition');
assert.deepStrictEqual(as.diffLines('', 'x'), [['-', ''], ['+', 'x']]);
console.log('agent-session: lines, kinds and diffs ok');
