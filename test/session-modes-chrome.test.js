'use strict';
// One session, its mode on a switch (4.296.0; the owner, 11-17: "the fully modular agentic system … even with the chat
// mode"; plan §AD.17). Over a local Frame at 390 px: the box carries Auto · Chat · Agent · Code. In a new session, Code
// is Codes' (its hello), Chat starts your Actor with one model (engine model), Agent with its agent (engine agent). In
// an open Actor session the switch changes the way of the next words, sent once with them (engine harness for Code), and
// a Codes session hides the switch.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-modes-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const said = { starts: [], messages: [] };
const runs = [
    { ref: 'actor:run_1', kind: 'task', title: 'Plan my week', status: 'done', created_at: iso(600), updated_at: iso(500), agent: { id: 'actor', name: 'Actor' } },
    { ref: 'codes:tsk_1', kind: 'code', title: 'Fix the footer', status: 'done', created_at: iso(900), updated_at: iso(800), agent: { id: 'codes', name: 'Codes' } },
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
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs, partial: [] });
    if (p === '/api/frame/runs' && req.method === 'POST') { const b = await read(req); said.starts.push(b); const run = { ref: 'actor:run_new', kind: 'task', title: b.text, status: 'running', created_at: iso(0), agent: { id: 'actor', name: 'Actor' } }; runs.unshift(run); return json(res, 201, run); }
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
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }
const MODE = "(document.querySelector('.ovse-mode[aria-checked=true]') || {}).dataset && document.querySelector('.ovse-mode[aria-checked=true]').dataset.mode";
const typeAndSend = async (p, words) => {
    await until(p, "!!document.querySelector('.ovse-compose textarea')");
    await p.evaluate(`(() => { const ta = document.querySelector('.ovse-compose textarea'); ta.focus(); ta.value = ${JSON.stringify(words)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
        const f = document.querySelector('.ovse-compose form'); if (f) f.requestSubmit(); else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
};

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-modes-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        assert.deepStrictEqual(await until(p, "document.querySelectorAll('.ovse-modes .ovse-mode').length === 4 && [...document.querySelectorAll('.ovse-mode')].map((m) => m.dataset.mode)"), ['auto', 'chat', 'agent', 'code']);
        assert.strictEqual(await p.evaluate(MODE), 'auto', 'Auto by default');

        // New session: Code is Codes'; Chat starts Actor with one model.
        await p.evaluate("document.querySelector('.ovse-mode[data-mode=code]').click()");
        await until(p, "!!document.querySelector('.ovse-hello-face.is-code') && document.querySelector('.ovse-title').textContent === 'Codes'");
        assert.strictEqual(await p.evaluate(MODE), 'code');
        await p.evaluate("document.querySelector('.ovse-mode[data-mode=chat]').click()");
        await until(p, "!!document.querySelector('.ovse-hello-face.is-actor')");
        assert.strictEqual(await p.evaluate(MODE), 'chat');
        await typeAndSend(p, 'Tell me a joke');
        await until(p, `${JSON.stringify(true)} && document.querySelector('.ovse-title') && document.querySelector('.ovse-title').textContent === 'Tell me a joke'`, 6000).catch(() => null);
        await pause(400);
        assert.ok(said.starts.length >= 1, 'it started');
        assert.deepStrictEqual([said.starts[0].agent, said.starts[0].engine], ['actor', { kind: 'model' }], 'Chat: your Actor, one model');

        // An open Actor session: the switch changes the next words' way, once.
        await p.evaluate("window.__s.open('actor:run_1')");
        await until(p, "document.querySelector('.ovse-title').textContent === 'Plan my week'");
        await until(p, "!document.querySelector('.ovse-modes').hidden");
        // 4.311.0 (11-18: Code sent the words to no harness and spun): with no coding agent chosen, Code opens the sheet on
        // its harness half instead of guessing (test/session-engine-chrome.test.js picks one and sends).
        await p.evaluate("document.querySelector('.ovse-mode[data-mode=code]').click()");
        assert.match(await until(p, "(document.querySelector('.ovp-sec') || {}).textContent"), /coding harness, on a machine/);
        await p.evaluate("(document.querySelector('.ovp-x') || { click() {} }).click()");

        // A Codes session hides the switch.
        await p.evaluate("window.__s.open('codes:tsk_1')");
        await until(p, "document.querySelector('.ovse-title').textContent === 'Fix the footer'");
        assert.ok(await p.evaluate("document.querySelector('.ovse-modes').hidden"), 'no modes on a Codes session');
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('session-modes-chrome: Auto · Chat · Agent · Code; new sessions go where the mode says; an open Actor session switches its next words ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
