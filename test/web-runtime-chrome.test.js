'use strict';
// web-runtime.js in a real headless Chrome against a local site (roadmap WS-P task 6): scripts injected together run in
// order even when one is slow; the server's own tags are not fetched again; a real 404 rolls the group back (its new
// stylesheet leaves the document, the script that ran is not fetched or run again) and a retry completes it; a route
// scope's interval stops and its fetch is aborted on nextRoute(). Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('web-runtime-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const hits = {};
let flakyFails = 1;
const JS = {
    '/js/server.js': 'window.order.push("server");',
    '/js/a1.js': 'window.order.push("a1");',
    '/js/a2.js': 'window.order.push("a2");',       // served slowly
    '/js/a3.js': 'window.order.push("a3");',
    '/js/ok.js': 'window.order.push("ok");',
    '/js/flaky.js': 'window.order.push("flaky"); window.flakyReady = function () { return "ready"; };',
};
const CSS = { '/css/a.css': 'body { --a: 1; }', '/css/g.css': 'body { --g: 1; }' };
const FEATURES = {
    seq: { css: ['/css/a.css'], js: ['/js/server.js', '/js/a1.js', '/js/a2.js', '/js/a3.js'] },
    group: { css: ['/css/g.css'], js: ['/js/ok.js', '/js/flaky.js'], stubs: ['flakyReady'] },
};
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>runtime</title><link rel="icon" href="data:,">
<script>window.order = [];</script><script src="/js/server.js?v=1"></script><script src="/web-runtime.js"></script></head><body><p>runtime</p>
<script>window.rt = OVWebRuntime.create({ features: ${JSON.stringify(FEATURES)}, versions: { '/js/a1.js': 'h1' } }); rt.boot({ idle: false });</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    hits[u.pathname] = (hits[u.pathname] || 0) + 1;
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (u.pathname === '/web-runtime.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'web-runtime.js'))); }
    if (u.pathname === '/js/flaky.js' && flakyFails > 0) { flakyFails--; res.writeHead(404); return res.end(); }
    if (u.pathname === '/slow') { setTimeout(() => { try { res.end('late'); } catch { /* */ } }, 3000); return undefined; }
    if (JS[u.pathname]) {
        const send = () => { res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }); res.end(JS[u.pathname]); };
        return u.pathname === '/js/a2.js' ? void setTimeout(send, 400) : send();
    }
    if (CSS[u.pathname]) { res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' }); return res.end(CSS[u.pathname]); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-web-runtime-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const page = await h.openPage(browser, context, { width: 390 });
        await page.goto(`${base}/`, { maxMs: 5000 });

        // In order, the slow one included; the server's tag adopted, not fetched again.
        let v = await page.evaluate('rt.load("seq").then(() => ({ order: window.order, sheets: [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => new URL(l.href).pathname) }))');
        assert.deepStrictEqual(v.order, ['server', 'a1', 'a2', 'a3']);
        assert.deepStrictEqual(v.sheets, ['/css/a.css']);
        assert.strictEqual(hits['/js/server.js'], 1, 'the server\'s tag counts as loaded');

        // A real 404: the group rolls back; the retry (here through a stub) fetches only what is missing.
        v = await page.evaluate(`rt.load('group').then(() => 'loaded', (e) => ({ error: e.message, sheets: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => new URL(l.href).pathname),
            scripts: [...document.querySelectorAll('script[src]')].map((s) => new URL(s.src).pathname), failed: rt.diagnostics().features.failed.map((f) => f.name), rolledBack: rt.diagnostics().assets.rolledBack }))`);
        assert.strictEqual(v.error, 'Could not load /js/flaky.js');
        assert.deepStrictEqual(v.sheets, ['/css/a.css'], 'g.css withdrawn');
        assert.ok(!v.scripts.includes('/js/flaky.js') && v.scripts.includes('/js/ok.js'));
        assert.deepStrictEqual([v.failed, v.rolledBack], [['group'], 1]);
        v = await page.evaluate(`(rt.installStubs(), window.flakyReady()).then((r) => ({ r, order: window.order, leaks: rt.leaks(), dg: rt.diagnostics() }))`);
        assert.strictEqual(v.r, 'ready');
        assert.deepStrictEqual(v.order, ['server', 'a1', 'a2', 'a3', 'ok', 'flaky'], 'ok.js ran once');
        assert.deepStrictEqual([hits['/js/ok.js'], hits['/js/flaky.js'], hits['/css/g.css']], [1, 2, 2]);
        assert.deepStrictEqual([v.leaks, v.dg.features.failed, v.dg.assets.duplicates], [[], [], []]);

        // Route scopes: the interval stops, the fetch is aborted.
        v = await page.evaluate(`new Promise((done) => {
            rt.nextRoute(); const s = rt.scope(); window.ticks = 0;
            s.interval(() => { window.ticks++; }, 20);
            const f = s.fetch('/slow').then(() => 'finished', (e) => e.name);
            setTimeout(() => { rt.nextRoute(); const at = window.ticks; setTimeout(() => f.then((r) => done({ at, after: window.ticks, fetch: r, late: s.interval(() => {}, 5) })), 200); }, 150);
        })`);
        assert.ok(v.at > 0 && v.after === v.at, `ticks stop at nextRoute (${v.at} → ${v.after})`);
        assert.deepStrictEqual([v.fetch, v.late], ['AbortError', 0]);
        const errors = page.state.errors.filter((e) => !/Failed to load resource|flaky\.js/.test(e.text));
        assert.deepStrictEqual(errors, [], 'no page errors besides the planned 404');
    } finally {
        await browser.close().catch(() => {});
        server.close(); server.closeAllConnections?.();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('web-runtime-chrome: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
