'use strict';
// An answer's words as they are written (4.313.0; the owner, 11-18: "stream response"; Network sends delta { live } while
// an Actor turn runs), over a local Frame at 390 px: the bubble grows where "Working" was, piece by piece, and the stored
// answer replaces it when it comes.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-live-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const run = { ref: 'actor:run_1', kind: 'chat', title: 'Plan my week', status: 'running', created_at: iso(10), updated_at: iso(5), agent: { id: 'actor', name: 'Actor' } };
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, title: 'Vibe' });</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
let send = null;
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'working', now: { cost_today: 0 }, caps: { usd: 1 } });
    if (p === '/api/frame/runs' && req.method === 'GET') return json(res, 200, { runs: [run], partial: [] });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m && decodeURIComponent(m[1]) === run.ref) {
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: 'Plan my week' }] });
        if (m[2] === '/events') {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            send = (event, data, id) => res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
            return;
        }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-live-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("window.__s.open('actor:run_1')");
        await until(p, "(document.querySelector('.ovse-title') || {}).textContent === 'Plan my week'");
        const end = Date.now() + 8000;
        while (!send && Date.now() < end) await pause(50);
        assert.ok(send, 'the session follows the run');
        send('delta', { live: true, text: 'Monday: ', n: 1 });
        assert.strictEqual(await until(p, "(document.querySelector('.ovse-live .ovse-live-t') || {}).textContent"), 'Monday: ');
        send('delta', { live: true, text: 'the gym, ', n: 1 });
        send('delta', { live: true, text: 'then the dentist.', n: 1 });
        await until(p, "(document.querySelector('.ovse-live .ovse-live-t') || {}).textContent === 'Monday: the gym, then the dentist.'");
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovse-live').length"), 1, 'one bubble, grown in place');
        // The stored answer replaces it.
        send('step', { step: { seq: 2, kind: 'message', from: 'agent', status: 'done', text: 'Monday: the gym, then the dentist.' } }, 2);
        send('run', { run: { ...run, status: 'waiting', waiting: { for: 'message' } } }, 2);
        await until(p, "!document.querySelector('.ovse-live') && [...document.querySelectorAll('.ovse-say')].some((x) => /the dentist/.test(x.textContent))");
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        assert.deepStrictEqual(errors, []);
        console.log('session-live-chrome: the answer grows as it is written, then the stored answer replaces it ok');
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
