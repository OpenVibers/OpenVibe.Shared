'use strict';
// Research says where it looked (4.313.0; the owner, 11-18, a screenshot of an agent's "Searched 13 websites" with the
// sites as chips: "improve our system so that it can do shit like this"), over a local Frame at 390 px: a group of web
// steps says "Searched N websites" and shows the first sites as chips, the rest counted; a group of other tools does not.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-sites-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const run = { ref: 'actor:run_1', kind: 'chat', title: 'Plan my week', status: 'waiting', waiting: { for: 'message' }, created_at: iso(10), updated_at: iso(5), agent: { id: 'actor', name: 'Actor' } };
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
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: 'Which VPS is in stock?' },
            { seq: 2, kind: 'tool', status: 'done', tool_call: { name: 'search_web', input: { query: 'cheap vps 32gb' } }, result: { results: [{ url: 'https://www.netcup.com/en/server/root-server' }, { url: 'https://contabo.com/en/vps/' }, { url: 'https://lowendtalk.com/discussion/1' }] } },
            { seq: 3, kind: 'tool', status: 'done', tool_call: { name: 'read_pages', input: { urls: ['https://www.ionos.com/servers/cheap-vps', 'https://contabo.com/en/vps/'] } }, result: { read: 2 } },
            { seq: 4, kind: 'tool', status: 'done', tool_call: { name: 'fetch_data', input: { url: 'https://api.us.ovhcloud.com/1.0/order/catalog/public/eco' } }, result: 'ok' },
            { seq: 5, kind: 'message', from: 'agent', status: 'done', text: 'netcup RS 4000 G12.5 is in stock.' }] });
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
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-sites-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("window.__s.open('actor:run_1')");
        const head = await until(p, "(() => { const h = document.querySelector('.ovse-acts-h'); return h && h.querySelector('.ovse-sites') && { words: h.querySelector('.ovse-acts-w').textContent, chips: [...h.querySelectorAll('.ovse-site')].map((c) => c.textContent) }; })()");
        assert.strictEqual(head.words, 'Searched 5 websites');
        assert.deepStrictEqual(head.chips, ['Nnetcup.com', 'Ccontabo.com', 'Llowendtalk.com', '2 more']);
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        assert.deepStrictEqual(errors, []);
        console.log('session-sites-chrome: a group of web steps says Searched N websites, the first sites as chips, the rest counted ok');
    } finally {
        await browser.close();
        server.close();
    }
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
