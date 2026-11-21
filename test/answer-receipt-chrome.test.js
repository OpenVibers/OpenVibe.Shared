'use strict';
// Every answer says how it ran (4.298.0, agents.step@1 1.3.0; plan §AD.17, "one agent system that always finds a way").
// Over a local Frame at 390 px, an Actor session whose answer carries cost.by and model shows one quiet line under the
// words: what paid ("Free AI, then your Anthropic key"), the model ("Claude Sonnet 5.5"), the tokens and the time. A tap
// opens the spend by rung; at phone width the line keeps what paid and the model. An answer without a receipt shows none; one still
// being written shows none. Nothing off the screen; no page errors.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('answer-receipt-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const run = { ref: 'actor:tsk_1', kind: 'chat', title: 'Find me three cheap GPU rentals', status: 'succeeded', created_at: iso(300), updated_at: iso(60), agent: { id: 'actor', name: 'Actor' } };
const steps = [
    { seq: 1, kind: 'message', from: 'person', text: 'Find me three cheap GPU rentals' },
    { seq: 18, kind: 'message', from: 'agent', text: 'Three rentals under $0.40 an hour: Vast, RunPod and TensorDock.',
        cost: { usd: 0.0042, tokens: 6120, seconds: 21.4, by: { allowance: { tokens: 4100, usd: 0, seconds: 9.8 }, key: { tokens: 2020, usd: 0.0042, seconds: 11.6 } } },
        model: { id: 'claude-sonnet-5-5', provider: 'anthropic' } },
    { seq: 21, kind: 'message', from: 'person', text: 'And the cheapest 4090?' },
    { seq: 38, kind: 'message', from: 'agent', text: 'Vast, at $0.31 an hour today.', cost: null },
];
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, actor: true, title: 'Vibe' });
window.__s.open('actor:tsk_1');
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) {
        res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, p.slice(1))));
    }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    if (p === '/api/frame/runs') return json(res, 200, { runs: [run], partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Juniper', status: 'idle', now: { cost_today: 0 } });
    if (p === '/api/frame/resources') return json(res, 404, {});
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps, next: null });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-receipt-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        const got = await until(p, `(() => { const says = [...document.querySelectorAll('.ovse-say')]; if (says.length < 2) return null;
            return { lines: says.map((n) => { const r = n.querySelector('.ovse-receipt > summary'); return r ? r.textContent : null; }),
                more: getComputedStyle(document.querySelector('.ovse-receipt-more')).display, w: document.documentElement.scrollWidth }; })()`);
        assert.deepStrictEqual(got.lines, ['Claude Sonnet 5.5 via OpenVibe AI · Free AI, then your Anthropic key · 6.1k tokens · 21 s', null], 'the first answer has its receipt (4.335.0: the model and how it was reached lead, then what paid); the second has none');
        assert.strictEqual(got.more, 'none', 'a phone keeps what paid and the model on the line');
        assert.strictEqual(got.w, 390, 'nothing off the screen');

        await p.evaluate("document.querySelector('.ovse-receipt > summary').click()");
        const rows = await until(p, `(() => { const r = [...document.querySelectorAll('.ovse-receipt[open] .ovse-receipt-r')]; return r.length ? r.map((x) => [x.querySelector('b').textContent, x.querySelector('span').textContent]) : null; })()`);
        assert.deepStrictEqual(rows, [['Free AI', '4.1k tokens · 10 s · free'], ['Your Anthropic key', '2k tokens · 12 s · $0.0042']]);
        assert.match(await p.evaluate("document.querySelector('.ovse-receipt > summary').getAttribute('aria-label')"), /^How this answer ran: Claude Sonnet 5\.5 via OpenVibe AI, Free AI, then your Anthropic key/);
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('answer-receipt-chrome: every answer says how it ran (what paid, the model, tokens, time), and opens on the spend by rung ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
