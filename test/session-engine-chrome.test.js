'use strict';
// What Actor runs on, and whose turn it is (4.311.0; the owner, 11-18: "choose Actor so that it uses an API key … or
// Claude Code as a harness … make it clear how it's working", and a group "stuck waiting for you even though it's not
// waiting"), over a local Frame at 390 px:
//   - a finished turn waiting for the next message says "Your turn", and it is not listed as needing the person;
//   - an Actor conversation has a chip saying what it runs on; its sheet has two halves (an AI model through its API, a
//     coding harness on a machine); choosing Claude Code sends the next words to that harness;
//   - Code mode with no harness chosen opens that sheet instead of sending the words nowhere.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-engine-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const said = { messages: [] };
const runs = [
    { ref: 'actor:run_1', kind: 'chat', title: 'Test', status: 'waiting', waiting: { for: 'message' }, created_at: iso(600), updated_at: iso(500), agent: { id: 'actor', name: 'Actor' } },
    { ref: 'group:grp_1', kind: 'group', title: 'Design review', status: 'waiting', waiting: { for: 'message' }, created_at: iso(900), updated_at: iso(800), agent: { id: 'group', name: 'Group' } },
];
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
    if (p === '/api/frame/run-options') {
        return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' },
            { id: 'claude-code', name: 'Claude Code', kind: 'harness', available: true, line: 'On your computer' }, { id: 'codex', name: 'Codex', kind: 'harness', available: false }],
        places: [{ kind: 'auto', name: 'Auto' }, { kind: 'machine', id: 'dev_1', name: 'Your computer' }] });
    }
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs, partial: [] });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        const run = runs.find((r) => r.ref === decodeURIComponent(m[1]));
        if (!run) return json(res, 404, {});
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: run.title }, { seq: 2, kind: 'message', from: 'agent', status: 'done', text: 'Here it is.' }] });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
        if (m[2] === '/messages' && req.method === 'POST') { const b = await read(req); said.messages.push(b); return json(res, 201, { seq: 3, kind: 'message', from: 'person', status: 'done', text: b.text }); }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-engine-')) });
    let failed = 0;
    const check = async (name, fn) => { try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failed += 1; console.log(`  ✗ ${name}\n      ${e && e.message}`); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });

        await check('a turn that is over says "Your turn", and is not listed as needing you', async () => {
            await p.evaluate("window.__s.open('actor:run_1')");
            await until(p, "(document.querySelector('.ovse-title') || {}).textContent === 'Test'");
            const stat = await until(p, "(document.querySelector('.ovse-stat') || {}).textContent");
            assert.match(stat, /Your turn/);
            assert.ok(!/Waiting for you/.test(stat), stat);
            const needs = await p.evaluate("[...document.querySelectorAll('.ovse-row.is-needs')].map((r) => r.textContent).join(' | ')");
            assert.ok(!/Design review/.test(needs), `the group is not "needs you": ${needs}`);
        });

        await check('the chip says what Actor runs on; its sheet has an API half and a harness half; Claude Code takes the next words', async () => {
            const chip = await until(p, "(() => { const b = document.querySelector('.ovse-engine'); return b && !b.hidden && b.textContent; })()");
            assert.match(chip, /Runs on Auto/);
            await p.evaluate("document.querySelector('.ovse-engine').click()");
            const secs = await until(p, "document.querySelectorAll('.ovp-sec').length >= 2 && [...document.querySelectorAll('.ovp-sec')].map((x) => x.textContent)");
            assert.ok(secs.some((x) => /AI model, through its API/.test(x)) && secs.some((x) => /coding harness, on a machine/.test(x)), JSON.stringify(secs));
            await p.evaluate("[...document.querySelectorAll('.ovp-row')].find((r) => /Claude Code/.test(r.textContent)).click()");
            await until(p, "/Runs on Claude Code/.test((document.querySelector('.ovse-engine') || {}).textContent || '')");
            await until(p, "!!document.querySelector('.ovse-compose textarea')");
            await p.evaluate(`(() => { const ta = document.querySelector('.ovse-compose textarea'); ta.focus(); ta.value = 'Write the tests'; ta.dispatchEvent(new Event('input', { bubbles: true }));
                const f = document.querySelector('.ovse-compose form'); if (f) f.requestSubmit(); else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
            const end = Date.now() + 6000;
            while (Date.now() < end && !said.messages.length) await pause(50);
            assert.deepStrictEqual(said.messages[0] && said.messages[0].engine, { kind: 'harness', harness: 'claude-code' });
        });

        await check('Code mode with no harness chosen opens the sheet on the harness half', async () => {
            await p.evaluate("localStorage.removeItem('ov:composer:run')");
            await p.goto(base, { maxMs: 8000 });
            await p.evaluate("window.__s.open('actor:run_1')");
            await until(p, "(document.querySelector('.ovse-title') || {}).textContent === 'Test'");
            await until(p, "!!document.querySelector('.ovse-mode[data-mode=code]')");
            await p.evaluate("document.querySelector('.ovse-mode[data-mode=code]').click()");
            const first = await until(p, "(document.querySelector('.ovp-sec') || {}).textContent");
            assert.match(first, /coding harness, on a machine/);
        });
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close();
        server.close();
    }
    if (failed) { console.log(`${failed} failed`); process.exit(1); }
    console.log('session engine: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
