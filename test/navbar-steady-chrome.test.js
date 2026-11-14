'use strict';
// The bar holds still (plan §AB.30; the owner: "loads multiple times and then jumps around … the logo will glitch"). In a
// real headless Chrome: telling the navbar the same person again keeps the very same bar element (nothing redrawn,
// nothing jumps); a real change (another person) draws a new bar but moves the mark ov-mark.js already drew into it, so
// its entrance never plays again; a link on this site under the pointer is prefetched once, a sign-out link never.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('navbar-steady-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Steady</title><link rel="icon" href="data:,">
<script>
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b });
  const realFetch = window.fetch;
  window.fetch = (u, o) => { const s = String(u); if (s.startsWith('https://')) return J({}, false, 404); return realFetch(u, o); };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<main style="padding:20px"><a id="near" href="/next">Next page</a> <a id="out" href="/logout">Sign out</a></main>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: { id: 'u1', username: 'ada', display_name: 'Ada' }, token: 'tok-1', links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page());
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-steady-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!document.querySelector('.openvibe-navbar-brand .ov-mark[data-ov] svg')", 'the bar with its drawn mark');
        await wait(400);
        await p.evaluate("window.__bar = document.querySelector('.openvibe-navbar'); window.__mark = document.querySelector('.openvibe-navbar-brand .ov-mark'); true");
        // The same person again: the same bar.
        await p.evaluate("OpenVibeNavbar.setUser({ id: 'u1', username: 'ada', display_name: 'Ada' }, 'tok-1'); true");
        // A redraw would happen at once (render is synchronous): the same element, still, after the call returns.
        assert.strictEqual(await p.evaluate("document.querySelector('.openvibe-navbar') === window.__bar"), true, 'the same person: the bar is not drawn again');
        // Another person: a new bar, the same mark.
        await p.evaluate("OpenVibeNavbar.setUser({ id: 'u2', username: 'grace', display_name: 'Grace' }, 'tok-2'); true");
        await until(p, "document.querySelector('.openvibe-navbar') !== window.__bar", 'a new bar for another person');
        assert.strictEqual(await p.evaluate("document.querySelector('.openvibe-navbar-brand .ov-mark') === window.__mark && !!window.__mark.querySelector('svg')"), true, 'the drawn mark moves into the new bar');
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.openvibe-navbar').length"), 1, 'one bar');
        // Prefetch: a same-site link under the pointer, once; a sign-out link never.
        const at = async (id) => p.evaluate(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: Math.round(r.left + 5), y: Math.round(r.top + 5) }; })()`);
        const near = await at('near'), out = await at('out');
        await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: near.x, y: near.y });
        await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: near.x + 2, y: near.y });
        await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: out.x, y: out.y });
        await until(p, "document.querySelectorAll('link[rel=prefetch]').length > 0", 'the prefetch hint');
        const hints = await p.evaluate("[...document.querySelectorAll('link[rel=prefetch]')].map((l) => new URL(l.href).pathname)");
        assert.deepStrictEqual(hints, ['/next'], 'the next page is fetched ahead once; sign-out never');
        console.log('navbar-steady-chrome: ok');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
