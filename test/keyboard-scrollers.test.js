'use strict';
// Every box that scrolls with nothing focusable inside it can be scrolled from a keyboard (WCAG 2.1.1; axe
// scrollable-region-focusable, flagged on six sites' pages on 2026-11-02). The navbar gives each such box tabindex="0"
// once the page settles, in a real headless Chrome (layout decides what overflows). Skipped (exit 0) without Chrome or
// with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('keyboard-scrollers: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const long = 'const x = 1; '.repeat(80);
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Scrollers</title><link rel="icon" href="data:,">
<script src="/shared/navbar.js" defer></script>
<style>body{margin:0;font:16px system-ui} .box{width:300px;overflow:auto} .tall{height:60px;overflow-y:auto} .clip{width:300px;overflow:hidden}</style></head>
<body><div id="navbar-mount"></div><main>
<pre id="wide" class="box">${long}</pre>
<pre id="short" class="box">ok</pre>
<div id="with-link" class="box"><p style="width:900px">A wide row <a href="/x">with a link</a></p></div>
<dl id="tall" class="tall"><dt>a</dt><dd>1</dd><dt>b</dt><dd>2</dd><dt>c</dt><dd>3</dd><dt>d</dd><dd>4</dd></dl>
<pre id="own" class="box" tabindex="-1">${long}</pre>
<div id="clipped" class="clip"><p style="width:900px">Clipped, not scrollable</p></div>
</main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [{ label: 'Home', href: '/' }] }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-scrollers-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1024, block: ['*openvibe.network*', '*openvibe.tools*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 5000 });
        // The bar runs it when the page settles (idle, at most 3 s); wait for the first mark, or 6 s.
        await p.evaluate(`new Promise((r) => { const t0 = Date.now(); const t = setInterval(() => { if (document.querySelector('[data-ov-scroll-focus]') || Date.now() - t0 > 6000) { clearInterval(t); r(); } }, 100); })`);
        const state = await p.evaluate(`JSON.stringify(Object.fromEntries(['wide','short','with-link','tall','own','clipped'].map((id) => { const e = document.getElementById(id); return [id, e.getAttribute('tabindex')]; })))`);
        const s = JSON.parse(state);
        assert.strictEqual(s.wide, '0', 'a wide code block a keyboard could not reach gets tabindex 0');
        assert.strictEqual(s.tall, '0', 'so does a list held to a height');
        assert.strictEqual(s.short, null, 'a box that does not overflow is left alone');
        assert.strictEqual(s['with-link'], null, 'a box with a link inside is reachable already');
        assert.strictEqual(s.own, '-1', 'a page\'s own tabindex wins');
        assert.strictEqual(s.clipped, null, 'overflow hidden is not a scroller');
        assert.strictEqual(await p.evaluate('typeof OpenVibeNavbar.focusScrollers'), 'function');
        assert.strictEqual(await p.evaluate('OpenVibeNavbar.focusScrollers()'), 0, 'running it again changes nothing');
        console.log('keyboard-scrollers: all passed');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
