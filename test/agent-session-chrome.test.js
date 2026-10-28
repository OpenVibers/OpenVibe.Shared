'use strict';
// agent-session.js in a real headless Chrome (4.24.0): a session replayed line by line. Steps in a row fold into one
// group with counts; a running step shows its output as it arrives and a failed one opens by itself; a helper's steps
// nest under it; the plan sits in the head; a hand-off reads agent → agent; the filters show what they say; the
// summary counts steps, commands, files and +/−; the agent's text is text (never markup) and only https links link.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('agent-session-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}
const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Session</title><link rel="icon" href="data:,"></head>
<body><div id="s"></div><script src="/agent-session.js"></script>
<script>window.v = OpenVibeAgentSession.mount(document.getElementById('s'), { title: 'Fix the stats', status: 'running' });</script></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (req.url === '/agent-session.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'agent-session.js'))); }
    if (req.url === '/agent-session.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, 'agent-session.css'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-agent-session-'));
    const browser = await h.launch({ tmpDir });
    const push = (p, e) => p.evaluate(`window.v.push(${JSON.stringify(e)}), 1`);
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await push(p, { t: 'step', text: 'Cloning https://github.com/o/r' });
        assert.strictEqual(await p.evaluate(`document.querySelector('.ovas-line').textContent`), 'Cloning https://github.com/o/r', 'the job\'s own progress is a quiet line');
        await push(p, { type: 'system', subtype: 'init', agent: 'claude', model: 'm' });
        await push(p, { type: 'assistant', message: { content: [{ type: 'text', text: 'I <b>will</b> fix it, see https://openvibe.codes/x and javascript:alert(1) and `code`.' }] } });
        await push(p, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'p', name: 'TodoWrite', input: { todos: [{ content: 'Read', status: 'completed' }, { content: 'Fix', status: 'in_progress', activeForm: 'Fixing' }] } }] } });
        await push(p, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'r', name: 'Read', input: { file_path: 'src/a.js' } }] } });
        await push(p, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'r', content: 'one' }] } });
        await push(p, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'e', name: 'Edit', input: { file_path: 'src/a.js', old_string: 'a\nb', new_string: 'a\nB\nc' } }] } });
        await push(p, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'e', content: 'ok' }] } });
        await push(p, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'b', name: 'Bash', input: { command: 'npm test', description: 'Run the tests' } }] } });
        await push(p, { type: 'system', subtype: 'tool_progress', tool_use_id: 'b', text: 'running 2 tests\n' });
        let v = await p.evaluate(`(() => { const b = document.querySelector('.ovas-step[data-id="b"]'); return {
            groups: document.querySelectorAll('.ovas-feed > .ovas-group-li').length, title: document.querySelector('.ovas-group .ovas-sum b').textContent,
            out: b.querySelector('.ovas-out').textContent, waiting: !b.querySelector('.ovas-wait').hidden, running: !!b.querySelector('summary .ovas-spin'),
            plan: document.querySelector('.ovas-plan-now').textContent, planN: document.querySelector('.ovas-plan-n').textContent,
            bold: !!document.querySelector('.ovas-msg b'), links: [...document.querySelectorAll('.ovas-msg a')].map((a) => a.getAttribute('href')), code: !!document.querySelector('.ovas-msg code'),
            delta: document.querySelector('.ovas-step[data-id="e"] .ovas-delta').textContent } })()`);
        assert.strictEqual(v.groups, 1, 'steps in a row are one group');
        assert.strictEqual(v.title, '1 command · 1 edit · 1 read', 'the group says what it holds');
        assert.ok(v.out === 'running 2 tests\n' && !v.waiting && v.running, 'a running step shows its output as it arrives');
        assert.deepStrictEqual([v.plan, v.planN], ['Fixing', '1 of 2'], 'the plan in the head: what is being done, and how far');
        assert.ok(!v.bold && v.code, 'the agent\'s text is text: no markup passes, backticks are code');
        assert.deepStrictEqual(v.links, ['https://openvibe.codes/x'], 'only https addresses become links');
        assert.strictEqual(v.delta, '+2−1', 'an edit counts its added and removed lines');
        await push(p, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b', is_error: true, content: 'running 2 tests\n1 failed' }] } });
        v = await p.evaluate(`(() => { const b = document.querySelector('.ovas-step[data-id="b"]'); return { open: b.open, fail: b.querySelector('.ovas-out').classList.contains('is-fail'), state: b.querySelector('summary .ovas-state').dataset.s, group: document.querySelector('.ovas-group summary .ovas-state').textContent } })()`);
        assert.ok(v.open && v.fail && v.state === 'fail', 'a failed step opens by itself, its output marked');
        assert.strictEqual(v.group, '1 failed', 'and its group says so');
        // A helper's steps nest under it; then a hand-off and the end.
        await push(p, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't', name: 'Task', input: { description: 'Find the helper', prompt: 'Look', subagent_type: 'Explore' } }] } });
        await push(p, { type: 'assistant', parent_tool_use_id: 't', message: { content: [{ type: 'tool_use', id: 'g', name: 'Grep', input: { pattern: 'count' } }] } });
        await push(p, { type: 'user', parent_tool_use_id: 't', message: { content: [{ type: 'tool_result', tool_use_id: 'g', content: 'none' }] } });
        await push(p, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'none found' }] } });
        await push(p, { type: 'system', subtype: 'handoff', from: 'claude', to: 'codex', reason: 'usage limit' });
        await push(p, { type: 'system', subtype: 'init', agent: 'codex' });
        await push(p, { type: 'result', is_error: false, result: 'Done.', duration_ms: 61000, total_cost_usd: 0.05, num_turns: 4 });
        await p.evaluate(`window.v.status('succeeded'), 1`);
        v = await p.evaluate(`(() => ({
            nested: !!document.querySelector('.ovas-step[data-id="t"] .ovas-sub .ovas-step[data-id="g"]'),
            hand: [...document.querySelectorAll('.ovas-handoff .ovas-agent')].map((a) => a.textContent), agents: [...document.querySelectorAll('.ovas-head .ovas-agent')].map((a) => a.firstChild.textContent),
            agentCost: [...document.querySelectorAll('.ovas-head .ovas-agent-cost')].map((a) => a.textContent),
            done: document.querySelector('.ovas-done b').textContent, pill: document.querySelector('.ovas-pill').textContent, sum: window.v.summary() }))()`);
        assert.ok(v.nested, 'a helper\'s steps nest under it');
        assert.deepStrictEqual(v.hand, ['Claude Code', 'Codex'], 'the hand-off reads agent → agent');
        assert.deepStrictEqual(v.agents, ['Claude Code', 'Codex'], 'and the head lists both');
        assert.deepStrictEqual(v.agentCost, ['$0.05'], 'each agent\'s cost, from its done line (4.32.0)');
        assert.deepStrictEqual(v.sum.costByAgent, { Codex: 0.05 });
        assert.strictEqual(v.done, 'Codex finished in 1 min 1 s');
        assert.strictEqual(v.pill, 'Finished');
        assert.deepStrictEqual([v.sum.steps, v.sum.commands, v.sum.files, v.sum.added, v.sum.removed, v.sum.costUsd], [5, 1, 1, 2, 1, 0.05], JSON.stringify(v.sum));
        // 4.32.0: the look comes from agent-session.css beside the script; each step keeps its raw input; the Files tab.
        v = await p.evaluate(`(() => ({ link: (document.getElementById('openvibe-agent-session-styles') || {}).href || '', grid: getComputedStyle(document.querySelector('.ovas')).display,
            raw: (document.querySelector('.ovas-step[data-id="e"] .ovas-raw pre') || {}).textContent || '', chip: document.querySelector('.ovas-chip[data-f="files"]').textContent }))()`);
        assert.ok(v.link.endsWith('/agent-session.css') && v.grid === 'grid', 'agent-session.css is linked from beside the script and applies');
        assert.ok(v.raw.includes('"file_path": "src/a.js"'), 'a step keeps its raw input, folded');
        assert.strictEqual(v.chip, 'Files 1', 'the Files tab counts the files changed');
        await p.evaluate(`document.querySelector('.ovas-chip[data-f="files"]').click(), 1`);
        v = await p.evaluate(`(() => ({ feed: document.querySelector('.ovas-feed').hidden, rows: [...document.querySelectorAll('.ovas-file')].map((b) => [b.querySelector('b').textContent, b.querySelector('small').textContent, b.querySelector('.ovas-delta').textContent]), files: window.v.files() }))()`);
        assert.deepStrictEqual([v.feed, v.rows], [true, [['a.js', 'src/a.js', '+2−1']]], 'one row per file, with its path and +/−');
        assert.deepStrictEqual(v.files, [{ path: 'src/a.js', added: 2, removed: 1, changes: 1 }]);
        await p.evaluate(`document.querySelector('.ovas-file').click(), 1`);
        v = await p.evaluate(`({ feed: document.querySelector('.ovas-feed').hidden, open: document.querySelector('.ovas-step[data-id="e"]').open, all: document.querySelector('.ovas-chip[data-f="all"]').getAttribute('aria-pressed') })`);
        assert.deepStrictEqual(v, { feed: false, open: true, all: 'true' }, 'a file opens its step in the whole session');
        // Filters.
        await p.evaluate(`document.querySelector('.ovas-chip[data-f="said"]').click(), 1`);
        v = await p.evaluate(`[...document.querySelectorAll('.ovas-feed > li')].filter((li) => !li.hidden).map((li) => li.dataset.k)`);
        assert.deepStrictEqual(v, ['msg', 'handoff', 'done'], 'What it said: the messages, the hand-off and the end');
        await p.evaluate(`document.querySelector('.ovas-chip[data-f="problems"]').click(), 1`);
        v = await p.evaluate(`[...document.querySelectorAll('.ovas-feed > li')].filter((li) => !li.hidden).map((li) => li.dataset.k)`);
        assert.deepStrictEqual(v, ['steps', 'handoff'], 'Problems: the group with the failed step and the hand-off');
        // OpenVibe.Actor's task events: a step and its result pair by tool (no ids), the head follows the agents, a check
        // that passed is good news (not a problem), and the task's states move the head.
        await p.evaluate(`(() => { const d = document.createElement('div'); d.id = 'actor'; document.body.appendChild(d); window.a = OpenVibeAgentSession.mount(d, { title: 'Find the ferry', status: 'queued' }); return 1; })()`);
        const pa = (e) => p.evaluate(`window.a.push(${JSON.stringify(e)}), 1`);
        await pa({ kind: 'state', state: 'running' });
        await pa({ kind: 'output', step: 'plan', agent: 'deepseek', text: 'DeepSeek takes it' });
        await pa({ kind: 'output', step: 'tool_call', agent: 'deepseek', tool: 'web_search', input: 'ferry times' });
        await pa({ kind: 'output', step: 'tool_result', agent: 'deepseek', tool: 'web_search', text: '3 results' });
        await pa({ kind: 'output', step: 'check', agent: 'deepseek', text: 'Checked by another model' });
        await pa({ kind: 'output', step: 'handoff', agent: 'claude', text: 'Claude takes it: a longer answer' });
        await pa({ kind: 'output', step: 'text', agent: 'claude', text: 'The ferry leaves at 8:40.' });
        await pa({ kind: 'end', state: 'succeeded' });
        v = await p.evaluate(`(() => { const r = document.getElementById('actor'); return { state: r.querySelector('.ovas-step summary .ovas-state').dataset.s, out: r.querySelector('.ovas-out').textContent,
            agents: [...r.querySelectorAll('.ovas-head .ovas-agent')].map((x) => x.textContent), hand: [...r.querySelectorAll('.ovas-handoff .ovas-agent')].map((x) => x.textContent),
            info: r.querySelector('.ovas-note').dataset.level, pill: r.querySelector('.ovas-pill').textContent, problems: window.a.summary().problems } })()`);
        assert.deepStrictEqual([v.state, v.out], ['ok', '3 results'], 'the result found its step');
        assert.deepStrictEqual(v.agents, ['DeepSeek', 'Claude Code'], 'the head follows who is working');
        assert.deepStrictEqual(v.hand, ['DeepSeek', 'Claude Code'], 'a hand-off without a from: the agent that was working');
        assert.strictEqual(v.info, 'info');
        assert.strictEqual(v.pill, 'Finished');
        assert.strictEqual(v.problems, 1, 'only the hand-off counts as a problem, not the passed check');
        // link(url): a site whose agents read untrusted pages links only its own addresses; the rest stay text.
        await p.evaluate(`(() => { const d = document.createElement('div'); d.id = 'own'; document.body.appendChild(d); const w = OpenVibeAgentSession.mount(d, { title: 'x', link: (u) => u.startsWith('https://openvibe.bot/') }); w.push({ t: 'text', text: 'Your desk: https://openvibe.bot/machines/m/screen and https://evil.example/login' }); return 1; })()`);
        v = await p.evaluate(`[...document.querySelectorAll('#own .ovas-msg a')].map((a) => a.href)`);
        assert.deepStrictEqual(v, ['https://openvibe.bot/machines/m/screen'], 'only the site\'s own address links');
        assert.ok(await p.evaluate(`document.querySelector('#own .ovas-msg').textContent.includes('https://evil.example/login')`), 'the other stays as text');
        // The action bar (4.32.0): the page's actions, sticky; a press reports its id and waits for the page's promise.
        v = await p.evaluate(`(async () => {
            const d = document.createElement('div'); d.id = 'acts'; document.body.appendChild(d);
            let release; window.acted = [];
            const w = OpenVibeAgentSession.mount(d, { title: 'x', status: 'running', actions: [{ id: 'approve', label: 'Approve', kind: 'primary' }, { id: 'stop', label: 'Stop', kind: 'danger' }], actionsNote: 'The agent asks to spend $0.40.',
                onAction: (id) => { window.acted.push(id); return new Promise((r) => { release = r; }); } });
            const bar = d.querySelector('.ovas-actions');
            const before = { hidden: bar.hidden, note: bar.querySelector('p').textContent, labels: [...bar.querySelectorAll('.ovas-act')].map((b) => b.textContent), primary: bar.querySelector('.ovas-act.is-primary').dataset.act };
            bar.querySelector('[data-act="approve"]').click();
            await new Promise((r) => setTimeout(r, 0));
            const during = [...bar.querySelectorAll('.ovas-act')].every((b) => b.disabled);
            release(); await new Promise((r) => setTimeout(r, 0));
            const after = [...bar.querySelectorAll('.ovas-act')].every((b) => !b.disabled);
            w.actions([]);
            return { before, during, after, acted: window.acted, gone: bar.hidden, sticky: getComputedStyle(bar).position };
        })()`);
        assert.deepStrictEqual(v.before, { hidden: false, note: 'The agent asks to spend $0.40.', labels: ['Approve', 'Stop'], primary: 'approve' });
        assert.deepStrictEqual([v.during, v.after, v.acted, v.gone, v.sticky], [true, true, ['approve'], true, 'sticky'], 'pressed: disabled until the page settles; [] hides the bar');
        // A finished run replayed without a start time shows no made-up time; its done line's duration shows.
        v = await p.evaluate(`(() => { const d = document.createElement('div'); d.id = 'replay'; document.body.appendChild(d); const w = OpenVibeAgentSession.mount(d, { title: 'x', status: 'succeeded' }); w.push({ t: 'text', text: 'Done.' }); const before = { hidden: d.querySelector('[data-m="time"]').hidden, ms: w.summary().durationMs }; w.push({ t: 'done', ok: true, text: 'Done.', duration_ms: 125000 }); return { before, after: d.querySelector('[data-m="time"]').textContent, hidden: d.querySelector('[data-m="time"]').hidden }; })()`);
        assert.deepStrictEqual(v.before, { hidden: true, ms: 0 }, 'no start time and no duration: no time');
        assert.deepStrictEqual([v.after, v.hidden], ['2 min 5 s', false], 'the done line\'s duration');
        const errors = p.state.errors.filter((e) => !/Failed to load resource/.test(e.text));
        assert.deepStrictEqual(errors, [], JSON.stringify(errors));
        console.log('agent-session-chrome: groups, live output, failures, helpers, hand-offs, filters and safe text ok');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
