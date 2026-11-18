'use strict';
// The conversation's approval level in the box's row (4.313.0; the owner, 11-18: "make these approvals just built into
// the chat … adjust the approval methods in the little composer area"), over a local Frame at 390 px:
//   - an open Actor conversation that can set its level shows the chip, in words (Asks first);
//   - its sheet has the four, says what asks at every level, and keeps the ones under the agent's own unoffered;
//   - a pick is PATCHed as { level } and the chip follows the answer; the row stays one line.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-level-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const patched = [];
const run = { ref: 'actor:run_1', kind: 'chat', title: 'Tidy the docs', status: 'waiting', waiting: { for: 'message' }, created_at: iso(600), updated_at: iso(500), agent: { id: 'actor', name: 'Actor' },
    level: { now: 'ask', agent: 'ask', always_asks: ['money', 'password', 'delete', 'new_recipient'], can_set: true } };
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
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs: [run], partial: [] });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m && decodeURIComponent(m[1]) === run.ref) {
        if (!m[2] && req.method === 'PATCH') { const b = await read(req); patched.push(b); run.level = { ...run.level, now: b.level }; return json(res, 200, run); }
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: run.title }, { seq: 2, kind: 'message', from: 'agent', status: 'done', text: 'Done.' }] });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-level-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        // A new session has no level chip.
        await until(p, "!!document.querySelector('.ovse-ctxrow')");
        assert.ok(await p.evaluate("document.querySelector('.ovse-level').hidden"), 'no chip on a new session');

        await p.evaluate("window.__s.open('actor:run_1')");
        const chip = await until(p, "(() => { const b = document.querySelector('.ovse-level'); return b && !b.hidden && b.getAttribute('aria-label'); })()");
        assert.match(chip, /^Asks first: It asks before every step that acts/);
        const row = await p.evaluate(`(() => { const r = document.querySelector('.ovse-ctxrow'); const kids = [...r.children].filter((x) => !x.hidden && x.getBoundingClientRect().width > 0);
            const tops = kids.map((x) => Math.round(x.getBoundingClientRect().top)); return Math.max(...tops) - Math.min(...tops); })()`);
        assert.ok(row <= 6, `the row stays one line (${row})`);

        await p.evaluate("document.querySelector('.ovse-level').click()");
        const sheet = await until(p, "(() => { const s = document.querySelector('.ovp.is-in'); return s && s.querySelectorAll('.ovp-row').length === 4 && { rows: [...s.querySelectorAll('.ovp-row b')].map((b) => b.textContent), intro: s.querySelector('.ovp-intro').textContent }; })()");
        assert.deepStrictEqual(sheet.rows, ['Asks first', 'Edits on its own', 'A reviewer approves', 'Full']);
        assert.match(sheet.intro, /still asks before spending money, a password, deleting or a new recipient/);
        await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row')].find((r) => /Edits on its own/.test(r.textContent)).click()");
        await until(p, "/^Edits on its own/.test(document.querySelector('.ovse-level').getAttribute('aria-label'))");
        assert.deepStrictEqual(patched, [{ level: 'auto-edits' }]);

        // The agent's own level is the floor: the ones under it are shown, not offered.
        run.level = { ...run.level, now: 'approve-for-me', agent: 'approve-for-me' };
        await p.evaluate("window.__s.open('actor:run_1')");
        await until(p, "/^A reviewer approves/.test((document.querySelector('.ovse-level') || {}).getAttribute && document.querySelector('.ovse-level').getAttribute('aria-label') || '')");
        await pause(400);
        await p.evaluate("document.querySelector('.ovse-level').click()");
        const off = await until(p, "(() => { const s = document.querySelector('.ovp.is-in'); return s && s.querySelectorAll('.ovp-row').length === 4 && [...s.querySelectorAll('.ovp-row')].map((r) => r.getAttribute('aria-disabled') === 'true'); })()");
        assert.deepStrictEqual(off, [true, true, false, false]);
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        assert.deepStrictEqual(errors, []);
        console.log('session-level-chrome: the chip in words, the four with what always asks, a pick PATCHed and followed, the agent\'s own as the floor ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
