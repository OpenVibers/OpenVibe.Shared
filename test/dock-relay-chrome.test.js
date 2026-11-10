'use strict';
// The Dock's three agent modules on a site: with no explicit product base they ask Network's same-origin frame relay,
// never openvibe.codes or openvibe.actor (2026-11-09: every site's connect-src allows openvibe.network and refuses
// them). This runs the modules in a real headless Chrome against a stand-in for Network's relay paths:
//   • dock-agent.js: GET /api/frame/agent-view, POST /api/frame/agent-view/pause, the still at /api/frame/agent-view/frame;
//   • dock-timeline.js: GET /api/frame/agent/timeline with its mode filter, POST /api/frame/agent/approvals/…/decide;
//   • dock-actor.js: GET /api/frame/actor, POST /api/frame/actor/tell;
//   • with no token, nothing is asked at all (a signed-out page can never read them).
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-relay-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const AGENT = { id: 'ags_01JAB2C3D4E5F6G7H8J9K0MNPQ', state: 'ended', title: 'Ship it', task: null, last_frame_url: 'https://openvibe.codes/api/v1/me/agent-view/frame' };
const ACTOR = { id: 'act_1', enabled: true, name: 'Juniper', status: 'resting', brain: 'Auto', caps: {}, now: { cost_today: 0 }, asks: [] };
const TIMELINE = { now: null, needs_you: [], entries: [], next_cursor: null, counts: {} };
const calls = [];

const page = (signedIn) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dock relay</title>
<link rel="icon" href="data:,"></head><body style="margin:0;background:#111;color:#eee;font:14px system-ui">
<div id="a"></div><div id="t"></div><div id="c"></div>
<script src="/dock-agent.js"></script><script src="/dock-timeline.js"></script><script src="/dock-actor.js"></script>
<script>
const token = ${signedIn ? "async () => 'tok-1'" : 'null'};
OpenVibeDockAgent.mount(document.getElementById('a'), { token, frameBase: '/api/frame', active: () => true });
OpenVibeDockTimeline.mount(document.getElementById('t'), { token, frameBase: '/api/frame', active: () => true });
OpenVibeDockActor.mount(document.getElementById('c'), { token, frameBase: '/api/frame', active: () => true });
</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page(u.searchParams.get('in') !== '0')); }
    for (const f of ['dock-agent.js', 'dock-timeline.js', 'dock-actor.js']) {
        if (u.pathname === '/' + f) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, f))); }
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', body: body ? JSON.parse(body) : null });
        if (u.pathname === '/api/frame/agent-view') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ agent: AGENT }));
        }
        if (u.pathname === '/api/frame/agent-view/frame') {
            res.writeHead(200, { 'content-type': 'image/jpeg' });
            return res.end(JPEG);
        }
        if (/^\/api\/frame\/agent-view\/(pause|curtain|mute|end)$/.test(u.pathname)) {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ agent: AGENT }));
        }
        if (u.pathname === '/api/frame/agent/timeline') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(TIMELINE));
        }
        if (u.pathname === '/api/frame/agent/approvals/actor/apr_1/decide') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ product: 'actor', id: 'apr_1', state: 'approved' }));
        }
        if (u.pathname === '/api/frame/actor') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(ACTOR));
        }
        if (u.pathname === '/api/frame/actor/tell') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end('{"ok":true}');
        }
        // Anything else, including a direct /api/v1/me/... call, is a miss this test remembers.
        res.writeHead(404, { 'content-type': 'application/json' });
        return res.end('{"error":"no route"}');
    });
});

const wait = async (pg, expr, ms = 4000) => {
    const end = Date.now() + ms;
    for (;;) {
        if (await pg.evaluate(expr)) return true;
        if (Date.now() > end) return false;
        await new Promise((ok) => setTimeout(ok, 50));
    }
};

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dockrelay-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const pg = await h.openPage(browser, context, { width: 390, height: 800 });
        await pg.goto(`${base}/`, { maxMs: 8000 });
        await wait(pg, `document.querySelector('.ovda-still') && document.querySelector('.ovdac-tell input')`);
        await pg.evaluate(`document.querySelector('.ovdac-tell input').value = 'hello'`);
        await pg.evaluate(`document.querySelector('.ovdac-tell button').click()`);
        await wait(pg, `document.querySelector('.ovdac-tell input').value === ''`, 2000);
        await new Promise((ok) => setTimeout(ok, 400));

        const paths = calls.map((c) => `${c.method} ${c.url.split('?')[0]}`);
        assert.ok(paths.includes('GET /api/frame/agent-view'), 'the agent view is read through the relay');
        assert.ok(paths.includes('GET /api/frame/agent-view/frame'), 'the still comes through the relay too');
        assert.ok(paths.includes('GET /api/frame/agent/timeline'), 'the timeline is read through the relay');
        assert.ok(paths.includes('GET /api/frame/actor'), 'the Actor block is read through the relay');
        assert.ok(paths.includes('POST /api/frame/actor/tell'), 'telling the Actor goes through the relay');
        assert.ok(calls.every((c) => c.auth === 'Bearer tok-1'), 'every call carries the person\'s token');
        assert.ok(calls.every((c) => c.url.startsWith('/api/frame/')), 'no call leaves for another product: ' + paths.join(', '));
        const timeline = calls.find((c) => c.url.startsWith('/api/frame/agent/timeline'));
        assert.ok(timeline, 'the timeline was asked');
        assert.ok(await pg.evaluate(`document.querySelector('.ovda-still') && document.querySelector('.ovda-still').src.startsWith('blob:')`), 'the still shows as the person\'s own picture');

        // Signed out: the same three modules ask the relay nothing.
        const before = calls.length;
        const out = await h.openPage(browser, context, { width: 390, height: 800 });
        await out.goto(`${base}/?in=0`, { maxMs: 8000 });
        await new Promise((ok) => setTimeout(ok, 1200));
        assert.strictEqual(calls.length, before, 'a signed-out page asks nothing at all');
        assert.ok(!(await out.evaluate(`!!document.querySelector('.ovdac.on')`)), 'and shows no Actor');
    } finally {
        await browser.close();
        server.close();
    }
    console.log('dock relay chrome: the Dock\'s agent modules ask Network\'s /api/frame relay, and nothing without a token');
    console.log('all passed');
    process.exit(0);
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
