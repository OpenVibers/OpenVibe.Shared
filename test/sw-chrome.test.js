'use strict';
// The shared worker (openvibe-sw.js) in a real headless Chrome against a local server: the hashed file comes from the
// worker's cache, a page always comes from the network, a private page is never stored, a slow network falls back to the
// cached page, and the kill switch takes the worker away. Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const sw = require('../sw');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('sw-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const WORKER = fs.readFileSync(path.join(__dirname, '..', 'openvibe-sw.js'), 'utf8');
const hits = {};
const state = { slow: false, kill: { enabled: true }, body: 1 };
const count = (p) => { hits[p] = (hits[p] || 0) + 1; return hits[p]; };

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    count(u.pathname);
    if (u.pathname === '/openvibe-sw.js') {
        res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' });
        return res.end(WORKER);
    }
    if (u.pathname === '/sw-config') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify(state.kill));
    }
    if (u.pathname === '/shared/navbar.js') {
        res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=31536000, immutable' });
        return res.end('window.shellLoads = (window.shellLoads || 0) + 1;');
    }
    if (u.pathname === '/api/thing') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ n: count('/api/thing') }));
    }
    if (u.pathname === '/private') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' });
        return res.end('<!doctype html><title>private</title><p id="m">private page</p>');
    }
    if (u.pathname === '/slow') {
        const send = () => {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' });
            res.end('<!doctype html><title>slow</title><p id="m">cached page</p>');
        };
        if (state.slow) setTimeout(send, 6000); else send();
        return undefined;
    }
    // A page: public, and its body changes on every write, so a fresh copy is visible.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', etag: 'W/"' + state.body + '"' });
    res.end('<!doctype html><title>home</title><p id="m">body ' + state.body + '</p><script src="/shared/navbar.js?v=abcdef123456"></script>');
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 5000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
    return false;
}

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = 'http://127.0.0.1:' + server.address().port;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-sw-'));
    const browser = await h.launch({ tmpDir });
    try {
        // ── The worker takes over the page ────────────────────────────────────────────────────────────────────────
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280 });
        await p.goto(base + '/', { maxMs: 8000 });
        const registered = await p.evaluate(`navigator.serviceWorker.register('/openvibe-sw.js?cfg=' + ${JSON.stringify(base)} + '/sw-config', { scope: '/' }).then(() => navigator.serviceWorker.ready).then(() => true).catch((e) => String(e))`);
        assert.strictEqual(registered, true, 'the worker registered');
        const controlled = await waitFor(async () => p.evaluate('!!navigator.serviceWorker.controller'));
        assert.ok(controlled, 'the worker controls the page');

        // ── A hashed file comes from the worker's cache ────────────────────────────────────────────────────────
        await p.goto(base + '/', { maxMs: 8000 });
        const cached = await waitFor(async () => p.evaluate(`caches.open('ov-shell-' + ${JSON.stringify(sw.VERSION)}).then((c) => c.keys()).then((k) => k.map((r) => r.url)).catch(() => [])`).then((list) => list.some((u) => u.indexOf('/shared/navbar.js?v=abcdef123456') >= 0)));
        assert.ok(cached, 'the hashed file is in the worker cache');
        const shellHits = hits['/shared/navbar.js'] || 0;
        await p.goto(base + '/', { maxMs: 8000 });
        assert.strictEqual(hits['/shared/navbar.js'] || 0, shellHits, 'the hashed file was not asked for again');

        // ── A page always comes from the network ──────────────────────────────────────────────────────────────
        const pageHits = hits['/'] || 0;
        state.body = 2;
        await p.goto(base + '/', { maxMs: 8000 });
        assert.ok((hits['/'] || 0) > pageHits, 'the page was asked for again (never served from the cache while the network answers)');
        const body = await p.evaluate('document.getElementById("m").textContent');
        assert.strictEqual(body, 'body 2', 'the page shows what the server just wrote');

        // ── The API is never cached ───────────────────────────────────────────────────────────────────────────
        const api1 = await p.evaluate('fetch("/api/thing").then((r) => r.json()).then((j) => j.n)');
        const api2 = await p.evaluate('fetch("/api/thing").then((r) => r.json()).then((j) => j.n)');
        assert.notStrictEqual(api1, api2, 'the API is asked every time');

        // ── A slow network falls back to the cached page ──────────────────────────────────────────────────────
        await p.goto(base + '/slow', { maxMs: 12000 });
        assert.strictEqual(await p.evaluate('document.getElementById("m").textContent'), 'cached page', 'the slow page loaded');
        state.slow = true;
        const started = Date.now();
        await p.goto(base + '/slow', { maxMs: 12000 });
        const waited = Date.now() - started;
        assert.strictEqual(await p.evaluate('document.getElementById("m").textContent'), 'cached page', 'the cached page showed when the network was too slow');
        assert.ok(waited >= 2500 && waited < 6000, 'the page waited for the network first (' + waited + ' ms)');
        state.slow = false;

        // ── The kill switch takes the worker away ─────────────────────────────────────────────────────────────
        state.kill = { enabled: false };
        await p.evaluate('navigator.serviceWorker.controller.postMessage({ type: "checkKill" })');
        const gone = await waitFor(async () => p.evaluate('navigator.serviceWorker.getRegistration().then((r) => !r)'));
        assert.ok(gone, 'the worker unregistered itself when the switch said no');
        const caches = await p.evaluate('caches.keys().then((k) => k)');
        assert.deepStrictEqual(caches.filter((k) => k.indexOf('ov-shell-') === 0), [], 'the caches are gone');

        // ── A switch that does not answer leaves the worker alone ─────────────────────────────────────────────
        const context2 = await browser.newContext();
        const p2 = await h.openPage(browser, context2, { width: 1280 });
        await p2.goto(base + '/', { maxMs: 8000 });
        await p2.evaluate(`navigator.serviceWorker.register('/openvibe-sw.js?cfg=' + ${JSON.stringify(base)} + '/no-such-switch', { scope: '/' }).then(() => navigator.serviceWorker.ready).then(() => true).catch((e) => String(e))`);
        await sleep(1200);
        const still = await p2.evaluate('navigator.serviceWorker.getRegistration().then((r) => !!r)');
        assert.ok(still, 'a switch that cannot be reached leaves the worker working');
        await p2.close();
        await p.close();
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
    console.log('sw-chrome: ok');
})().catch((e) => { console.error('sw-chrome:', e && e.message ? e.message : e); process.exit(1); });
