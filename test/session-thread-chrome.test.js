'use strict';
// The thread as the owner read it on 11-18 (4.310.0), over a local Frame at 390 px:
//   - Actor's plan text ("Assumptions: …", "✓ 1. …", "Now 2. …") is the plan panel's checklist with its assumptions
//     folded, never a raw Thought block on every turn;
//   - the same answer said twice with only a thought between is shown once;
//   - a Markdown table is a table, in its own scrolling box; a tool's long JSON wraps; the page never pans sideways;
//   - a message queued while it works has "Send now", which stops the step under way and sends it.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-thread-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const PLAN1 = 'Assumptions: Python 3 with the standard library is fine; A toy function is fine\nNow 1. Choose a small function\n· 2. Write its unittest\n· 3. Run it';
const PLAN2 = 'Assumptions: Python 3 with the standard library is fine; A toy function is fine\n✓ 1. Choose a small function\nNow 2. Write its unittest\n· 3. Run it';
const SAID = 'I queued the change but it has not run: Codes is waiting for your approval.';
const TABLE = 'The brief:\n\n| Element | What is there | What it costs |\n|---|---|---|\n| Purpose | "improve" | Direction |\n| Inputs | none | No file |\n\n- [x] Read it\n- [ ] Score it\n\n> Point it at a real job.';
const said = { stops: 0, messages: [] };
const runs = [
    { ref: 'actor:run_1', kind: 'chat', title: 'Test code something', status: 'waiting', waiting: { for: 'message' }, created_at: iso(600), updated_at: iso(500), agent: { id: 'actor', name: 'Actor' } },
    { ref: 'actor:run_live', kind: 'chat', title: 'Analyze this', status: 'running', created_at: iso(60), updated_at: iso(5), agent: { id: 'actor', name: 'Actor' } },
];
const steps = {
    'actor:run_1': [
        { seq: 1, kind: 'message', from: 'person', status: 'done', text: 'Test code something' },
        { seq: 2, kind: 'think', status: 'done', text: PLAN1 },
        { seq: 3, kind: 'message', from: 'agent', status: 'done', text: SAID },
        { seq: 4, kind: 'tool', status: 'done', title: 'codes_task', tool_call: { name: 'codes_task', input: {} }, result: JSON.stringify({ error: 'not started: the person must approve it first'.repeat(4) }) },
        { seq: 5, kind: 'think', status: 'done', text: PLAN2 },
        { seq: 6, kind: 'message', from: 'agent', status: 'done', text: SAID },
        { seq: 7, kind: 'message', from: 'agent', status: 'done', text: TABLE },
    ],
    'actor:run_live': [
        { seq: 1, kind: 'message', from: 'person', status: 'done', text: 'Analyze this' },
        { seq: 2, kind: 'think', status: 'running', text: 'Working on it' },
    ],
};
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, codes: true, title: 'Vibe' });</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const read = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b ? JSON.parse(b) : {})); });
const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs, partial: [] });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        const ref = decodeURIComponent(m[1]);
        const run = runs.find((r) => r.ref === ref);
        if (!run) return json(res, 404, {});
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps: steps[ref] || [] });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
        if (m[2] === '/stop' && req.method === 'POST') { said.stops += 1; run.status = 'stopped'; return json(res, 200, { stopped: true }); }
        if (m[2] === '/messages' && req.method === 'POST') { const b = await read(req); said.messages.push(b); return json(res, 201, { seq: 9, kind: 'message', from: 'person', status: 'done', text: b.text }); }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const REFS = { 'Test code something': 'actor:run_1', 'Analyze this': 'actor:run_live' };
const openRun = async (p, title) => {
    await p.evaluate(`window.__s.open(${JSON.stringify(REFS[title])})`);
    await until(p, `(document.querySelector('.ovse-title') || {}).textContent === ${JSON.stringify(title)}`);
};

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-thread-')) });
    let failed = 0;
    const check = async (name, fn) => { try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failed += 1; console.log(`  ✗ ${name}\n      ${e && e.message}`); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await openRun(p, 'Test code something');
        await until(p, "(document.body.textContent || '').includes('What is there')");

        await check('Actor\'s plan text is the plan panel\'s checklist with its assumptions, not a Thought block per turn', async () => {
            const plan = await until(p, "(() => { const b = document.querySelector('.ovse-plan-h'); return b && !b.closest('[hidden]') && b.textContent; })()");
            assert.match(plan, /Plan · 1 of 3/);
            assert.match(plan, /Write its unittest/, 'the step it is on is named');
            assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovse-plan-asm li').length"), 2, 'two assumptions, folded under it');
            const raw = await p.evaluate("[...document.querySelectorAll('.ovse-thread *')].filter((n) => !n.closest('.ovse-plan') && !n.closest('details.ovse-plan-asm') && /Assumptions:/.test(n.textContent || '') && !n.children.length).length");
            assert.strictEqual(raw, 0, 'no raw "Assumptions:" text in the thread');
        });

        await check('the same answer said twice, with a thought between, is shown once', async () => {
            const n = await p.evaluate(`[...document.querySelectorAll('.ovse-words p')].filter((x) => x.textContent.includes(${JSON.stringify(SAID.slice(0, 30))})).length`);
            assert.strictEqual(n, 1);
        });

        await check('a Markdown table is a table in its own box; checkbox items and a quote are drawn', async () => {
            assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovse-table table th').length"), 3);
            assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovse-table table tbody tr').length"), 2);
            assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovse-checks li.is-done').length"), 1);
            assert.strictEqual(await p.evaluate("document.querySelectorAll('blockquote.ovse-quote').length"), 1);
            assert.ok(!(await p.evaluate("(document.body.textContent || '').includes('|---|')")), 'no raw separator row');
        });

        await check('nothing makes the page pan sideways at 390 px (a long tool output wraps)', async () => {
            await p.evaluate("document.querySelectorAll('details').forEach((d) => { d.open = true; })");
            await pause(200);
            assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390);
            const wide = await p.evaluate("[...document.querySelectorAll('.ovse-out')].filter((o) => o.scrollWidth > o.clientWidth + 2).length");
            assert.strictEqual(wide, 0, 'tool output wraps inside its box');
        });

        await check('a message queued while it works has Send now: the step under way stops and it goes', async () => {
            await openRun(p, 'Analyze this');
            await until(p, "!!document.querySelector('.ovse-compose textarea')");
            await p.evaluate(`(() => { const ta = document.querySelector('.ovse-compose textarea'); ta.focus(); ta.value = 'Analyze and improve this'; ta.dispatchEvent(new Event('input', { bubbles: true }));
                const f = document.querySelector('.ovse-compose form'); if (f) f.requestSubmit(); else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
            await until(p, "!!document.querySelector('.ovse-me.is-queued .ovse-sendnow')");
            await p.evaluate("document.querySelector('.ovse-sendnow').click()");
            const end = Date.now() + 6000;
            while (Date.now() < end && !said.messages.length) await pause(50);
            assert.strictEqual(said.stops, 1, 'the step under way was stopped');
            assert.deepStrictEqual(said.messages.map((x) => x.text), ['Analyze and improve this']);
        });
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close();
        server.close();
    }
    if (failed) { console.log(`${failed} failed`); process.exit(1); }
    console.log('session thread: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
