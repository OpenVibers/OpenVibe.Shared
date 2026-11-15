'use strict';
// OpenVibeSession (ov-session.js, 4.265.0; plan §AD.8, the owner: "a complete rethink and redesign … way smarter,
// intelligent type system sessions, kind of like Claude Code … but way better") in a real headless Chrome, over a local
// Frame: a coding session drawn as a harness draws it (thinking folded, the tools it used grouped, the files it changed
// as a card that opens the diff, the answered approval, a helper that opens in place and Back, the plan above the box,
// the words streaming in); a session that asks first, answered in place; the drawer of sessions; a new session from one
// box with an @-mention, a slash command and the one context chip; words said while it works wait as queued; a computer
// gets the sessions as a column. No sideways scroll at 390 px.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-session-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const now = Date.now();
const iso = (s) => new Date(now - s * 1000).toISOString();
const runs = [
    { ref: 'codes:tsk_1', kind: 'code', title: 'Add a dark mode switch', status: 'running', created_at: iso(134), started_at: iso(134), updated_at: iso(3), cost: { usd: 0.034 }, doing: { text: 'Running the tests' }, agent: { id: 'claude-code', name: 'Claude Code', hue: 25 }, model: { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5' }, where: { kind: 'machine', name: 'Studio PC' }, target: { repo: 'ada/site' }, url: 'https://openvibe.codes/t/tsk_1' },
    { ref: 'actor:run_2', kind: 'task', title: 'Book a table for Friday', status: 'waiting', waiting: { for: 'approval' }, created_at: iso(900), updated_at: iso(600), agent: { id: 'actor', name: 'Actor', hue: 265 } },
    { ref: 'chat:c_3', kind: 'chat', title: 'A good first synth', status: 'waiting', waiting: { for: 'message' }, created_at: iso(3 * 86400 + 600), updated_at: iso(3 * 86400), agent: { id: 'vibe', name: 'Vibe' } },   // days old: Earlier in any time zone
];
const T = (seq, x) => ({ seq, status: 'done', from: 'agent', started_at: iso(130 - seq * 6), ended_at: iso(127 - seq * 6), ...x });
const steps = {
    'codes:tsk_1': [
        T(1, { kind: 'message', from: 'person', text: 'Add a dark mode switch to the settings page.' }),
        T(2, { kind: 'think', text: 'It needs a class on <html> and a saved choice.' }),
        T(3, { kind: 'tool', tool_call: { name: 'TodoWrite', input: { todos: [{ content: 'Find the page', status: 'completed' }, { content: 'Add the switch', status: 'completed' }, { content: 'Keep the choice', status: 'in_progress' }, { content: 'Run the tests', status: 'pending' }] } } }),
        T(4, { kind: 'tool', tool_call: { name: 'Read', input: { file_path: 'src/pages/settings.html' } }, text: '<h1>Settings</h1>' }),
        T(5, { kind: 'tool', tool_call: { name: 'Grep', input: { pattern: 'data-theme' } } }),
        T(6, { kind: 'message', text: 'Its dark colours are in **base.css** already:\n\n1. a labelled switch\n2. the choice in `localStorage`' }),
        T(7, { kind: 'tool', tool_call: { name: 'Edit', input: { file_path: 'src/pages/settings.html', old_string: '<h2>Look</h2>', new_string: '<h2>Look</h2>\n<label><input type="checkbox" role="switch"> Dark</label>' } } }),
        T(8, { kind: 'tool', tool_call: { name: 'apply_patch', input: { patch: '*** Begin Patch\n*** Update File: src/js/theme.js\n@@\n-const t = null;\n+const t = localStorage.getItem("theme");\n+apply(t);\n*** End Patch' } } }),
        T(9, { kind: 'approval', title: 'Run the tests on Studio PC?', result: { approval: 'ap_1', answer: 'approve', answer_label: 'Run them' } }),
        T(10, { kind: 'child', title: 'A helper checks the page', text: 'Both widths look right', child_run: 'codes:tsk_1c' }),
        T(11, { kind: 'tool', status: 'running', ended_at: null, tool_call: { name: 'Bash', input: { command: 'npm test' } } }),
    ],
    'codes:tsk_1c': [{ seq: 1, kind: 'message', from: 'person', text: 'Check the page at two widths.' }, { seq: 2, kind: 'message', from: 'agent', text: 'Both widths look right.' }],
    'actor:run_2': [
        { seq: 1, kind: 'message', from: 'person', text: 'Book a table for two on Friday.' },
        { seq: 2, kind: 'approval', title: 'Book Riverside Table, Friday 20:00?', result: { approval: 'ap_2', options: [{ id: 'approve', label: 'Book it' }, { id: 'decline', label: 'Not now' }] } },
    ],
    'chat:c_3': [{ seq: 1, kind: 'message', from: 'person', text: 'A good first synth?' }, { seq: 2, kind: 'message', from: 'agent', text: 'One with a good filter.' }],
};
const said = { starts: [], messages: [], approvals: [] };
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const read = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e6edf7;font:15px system-ui} #host{height:100vh}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.__events = [];
const q = new URLSearchParams(location.search);
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f,
  ...(q.get('open') ? { open: q.get('open') } : {}),
  works: [{ value: 'ada/site', name: 'ada/site', line: 'On OpenVibe.Git' }], starters: [['code', 'Build me a landing page']],
  onEvent: (t, d) => window.__events.push(t) });
</script></body></html>`;
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }, { id: 'claude-code', name: 'Claude Code', kind: 'harness' }, { id: 'codex', name: 'Codex', kind: 'harness' }], places: [{ kind: 'auto', name: 'Auto' }, { kind: 'openvibe', name: 'OpenVibe' }, { kind: 'machine', id: 'dev_1', name: 'Studio PC' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [{ id: 'openvibe', title: 'OpenVibe', rows: [{ model: 'anthropic/claude-opus-5-5', name: 'Opus 5.5', maker: 'Anthropic', price: { in: 15, out: 75 } }, { model: 'glm/glm-4.7-flash', name: 'GLM-4.7-Flash', free: true }] }] });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs, partial: [] });
    if (p === '/api/frame/runs' && req.method === 'POST') {
        const body = await read(req); said.starts.push(body);
        const run = { ref: 'codes:tsk_new', kind: 'code', title: body.text, status: 'running', created_at: new Date().toISOString(), agent: { id: body.agent || 'codes', name: 'Claude Code' }, model: body.model || null };
        runs.unshift(run); steps['codes:tsk_new'] = [{ seq: 1, kind: 'message', from: 'person', text: body.text }];
        return json(res, 201, run);
    }
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        const ref = decodeURIComponent(m[1]); const rest = m[2] || '';
        const run = runs.find((r) => r.ref === ref) || (ref === 'codes:tsk_1c' ? { ref, kind: 'code', title: 'A helper checks the page', status: 'done' } : null);
        if (!run) return json(res, 404, { error: 'Not found' });
        if (!rest) return json(res, 200, run);
        if (rest === '/steps') return json(res, 200, { steps: steps[ref] || [] });
        if (rest === '/events') {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            const send = (event, id, data) => res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            if (ref === 'codes:tsk_1') {
                setTimeout(() => send('step', 12, { step: { seq: 12, kind: 'message', from: 'agent', status: 'running', text: 'All 48 tests pass.' } }), 300);
                setTimeout(() => send('delta', null, { seq: 12, text: ' Opening the pull request.' }), 600);
            }
            if (ref === 'codes:tsk_new') setTimeout(() => send('step', 2, { step: { seq: 2, kind: 'message', from: 'agent', status: 'done', text: 'On it: a sketch first.' } }), 300);
            return;
        }
        if (rest === '/messages' && req.method === 'POST') { const body = await read(req); said.messages.push(body); return json(res, 201, { seq: 99, kind: 'message', from: 'person', text: body.text }); }
        if (/^\/approvals\//.test(rest) && req.method === 'POST') { const body = await read(req); said.approvals.push([ref, rest, body.answer]); return json(res, 200, { ok: true }); }
        if (rest === '/stop') return json(res, 200, { ok: true });
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-session-')) });
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); };
    const typeIn = (p, text) => p.evaluate(`(() => { const t = document.querySelector('.ovse-compose textarea'); t.focus(); t.value = ${JSON.stringify(text)}; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const key = (p, k) => p.evaluate(`document.querySelector('.ovse-compose textarea').dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true }))`);
    try {
        // ── a phone: a coding session ──
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`${base}?open=codes:tsk_1`, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovse-files')");
        const shape = await p.evaluate(`(() => ({
            me: document.querySelector('.ovse-me .ovse-bubble').textContent,
            think: !!document.querySelector('details.ovse-think:not([open])'),
            acts: [...document.querySelectorAll('.ovse-acts .ovse-acts-w')].map((x) => x.textContent),
            files: [...document.querySelectorAll('.ovse-thread .ovse-files .ovse-file b')].map((x) => x.textContent),
            fileSum: document.querySelector('.ovse-thread .ovse-files .ovse-files-h').textContent,
            answered: document.querySelector('.ovse-ask.is-done .ovse-note').textContent,
            child: document.querySelector('.ovse-child b').textContent,
            plan: document.querySelector('.ovse-plan-h b').textContent,
            stat: document.querySelector('.ovse-stat').textContent,
            changes: document.querySelector('.ovse-chg b').textContent,
            ctx: document.querySelector('.ovse-ctxinfo').textContent,
            ctxChipHidden: document.querySelector('.ovse-ctx').hidden,
        }))()`);
        assert.strictEqual(shape.me, 'Add a dark mode switch to the settings page.');
        assert.ok(shape.think, 'thinking is folded');
        assert.deepStrictEqual(shape.acts, ['Read 1 file, searched once', 'Ran 1 command'], 'the tools it used, grouped and counted; edits alone are the files card');
        assert.deepStrictEqual(shape.files, ['settings.html', 'theme.js'], 'the files it changed (an edit and a patch)');
        assert.ok(/Changed 2 files\s*\+4\s*−2/.test(shape.fileSum), shape.fileSum);
        assert.strictEqual(shape.answered, 'You answered: Run them');
        assert.strictEqual(shape.child, 'A helper checks the page');
        assert.strictEqual(shape.plan, 'Plan · 2 of 4', 'the plan above the box');
        assert.ok(/^Working · \d+:\d\d · \$0\.03$/.test(shape.stat), shape.stat);
        assert.strictEqual(shape.changes, '2');
        assert.deepStrictEqual([shape.ctx, shape.ctxChipHidden], ['Claude Code · Sonnet 5.5 · Studio PC · ada/site', true], 'an open session says how it runs');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-acts.is-running .ovse-acts-now').textContent"), 'npm test', 'what it is running now');
        // The words stream in, in place.
        await until(p, "(document.querySelector('.ovse-say[data-seq=\"12\"]') || {}).textContent === 'All 48 tests pass. Opening the pull request.'");
        // The diff: a sheet with the lines it took out and put in.
        await p.evaluate("document.querySelector('.ovse-thread .ovse-files .ovse-file').click()");
        await until(p, "!!document.querySelector('.ovse-sheet.is-in .ovse-dl.is-add')");
        assert.deepStrictEqual(await p.evaluate("[document.querySelector('.ovse-sheet-h b').textContent, [...document.querySelectorAll('.ovse-sheet .ovse-dl')].map((l) => l.classList.contains('is-add') ? '+' : l.classList.contains('is-del') ? '-' : ' ').join('')]"), ['settings.html', '-++']);
        await p.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
        await until(p, "!document.querySelector('.ovse-sheet')");
        // A helper opens in place; Back returns.
        await p.evaluate("document.querySelector('.ovse-child').click()");
        await until(p, "document.querySelector('.ovse-title').textContent === 'A helper checks the page' && !document.querySelector('.ovse-up').hidden");
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-menu').hidden"), true, 'Back stands where the sessions button was');
        await p.evaluate("document.querySelector('.ovse-up').click()");
        await until(p, "document.querySelector('.ovse-title').textContent === 'Add a dark mode switch'");
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'no sideways scroll');

        // ── the drawer, and a session that asks first ──
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        await until(p, "document.querySelector('.ovse').classList.contains('is-drawer') && document.querySelectorAll('.ovse-row:not(.is-ghost)').length === 3");
        assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovse-group')].map((g) => g.textContent)"), ['Needs you', 'Working', 'Earlier'], 'needs-you first');
        await p.evaluate("document.querySelector('.ovse-row.is-needs').click()");
        await until(p, "!document.querySelector('.ovse').classList.contains('is-drawer') && !!document.querySelector('.ovse-ask-acts .ovse-b.is-primary')");
        await p.evaluate("document.querySelector('.ovse-ask-acts .ovse-b.is-primary').click()");
        await until(p, "!!document.querySelector('.ovse-ask.is-done')");
        assert.deepStrictEqual(said.approvals, [['actor:run_2', '/approvals/ap_2', 'approve']], 'answered in place');

        // ── a new session: an @-mention, the context chip, then the thread ──
        await p.evaluate("window.__s.blank()");
        await until(p, "!!document.querySelector('.ovse-hello') && !!document.querySelector('.ovse-compose textarea')");
        await typeIn(p, '/');
        await until(p, "!document.querySelector('.ovse-slash').hidden");
        assert.ok((await p.evaluate("[...document.querySelectorAll('.ovse-sl b')].map((b) => b.textContent)")).includes('/model'), 'slash commands are offered');
        await typeIn(p, '@cl');
        await until(p, "[...document.querySelectorAll('.ovse-sl b')].map((b) => b.textContent).join() === '@claude-code'");
        await key(p, 'Tab');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-compose textarea').value"), '@claude-code ', 'Tab takes the mention');
        // The one chip: How it runs → Model → Opus 5.5.
        await p.evaluate("document.querySelector('.ovse-ctx').click()");
        await until(p, "!!document.querySelector('.ovp.is-in .ovp-row')");
        assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row b')].map((b) => b.textContent)"), ['Agent', 'Model', 'Runs on', 'Works on']);
        await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row')].find((r) => r.textContent.startsWith('Model')).click()");
        await until(p, "!!document.querySelector('.ovp.is-in .ovp-row[data-id=\"openvibe|anthropic/claude-opus-5-5\"]')");
        await p.evaluate("document.querySelector('.ovp.is-in .ovp-row[data-id=\"openvibe|anthropic/claude-opus-5-5\"]').click()");
        await until(p, "document.querySelector('.ovse-ctx span').textContent === 'Any agent · Opus 5.5'");
        await until(p, "!document.querySelector('.ovp')");
        await typeIn(p, '@claude-code Build me a landing page for my band');
        await p.evaluate("document.querySelector('.ovse-compose form') ? document.querySelector('.ovse-compose form').requestSubmit() : document.querySelector('.ovse-compose textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))");
        await until(p, "[...document.querySelectorAll('.ovse-say')].some((s) => s.textContent === 'On it: a sketch first.')");
        assert.deepStrictEqual([said.starts.length, said.starts[0].text, said.starts[0].agent, said.starts[0].model && said.starts[0].model.id], [1, 'Build me a landing page for my band', 'claude-code', 'anthropic/claude-opus-5-5'], 'the mention picks the agent, the chip the model');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-me .ovse-bubble').textContent"), 'Build me a landing page for my band');
        // It is still working: the next words are queued.
        await typeIn(p, 'Make it purple');
        await p.evaluate("document.querySelector('.ovse-compose form') ? document.querySelector('.ovse-compose form').requestSubmit() : document.querySelector('.ovse-compose textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))");
        await until(p, "!!document.querySelector('.ovse-me.is-queued')");
        assert.strictEqual(said.messages.length, 0, 'queued while it works');
        assert.ok((await p.evaluate('window.__events')).includes('session.started'));

        // ── a computer: the sessions are a column ──
        const w = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 820 });
        await w.goto(`${base}?open=chat:c_3`, { maxMs: 8000 });
        await until(w, "document.querySelector('.ovse').classList.contains('is-wide') && document.querySelectorAll('.ovse-row:not(.is-ghost)').length >= 3");
        const col = await w.evaluate("(() => { const d = document.querySelector('.ovse-drawer').getBoundingClientRect(), m = document.querySelector('.ovse-main').getBoundingClientRect(); return { d: Math.round(d.width), side: m.left >= d.right - 1 }; })()");
        assert.deepStrictEqual(col, { d: 300, side: true }, 'a 300 px column beside the session');
        console.log('ov-session-chrome: a coding session (grouped tools, changed files and the diff, a helper and Back, the plan, streaming), an approval answered in place, the drawer, a new session with @ and the one chip, queued words, the column on a computer');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
