'use strict';
// Links in running text are OpenVibe's own on every site (4.283.0; the owner, 11-16: "a completely custom link style
// with animations and effects … rather than these default ass looking ones"). The navbar's page-wide styles, in real
// headless Chrome on a page that boots the bar:
//   a link in a paragraph takes the theme's light accent, no browser underline, a fine accent line resting and a
//   two-tone line that sweeps in on focus; a press washes it; the visited purple is gone;
//   a link with a class (a component), a link in a nav, and a site's own look for links (colour, a button-like link)
//   keep theirs: the colours sit at zero specificity;
//   Off stops the sweep's motion; forced colours get a plain underline back.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('links-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const page = (motion) => `<!doctype html><html lang="en"${motion ? ` data-ov-motion="${motion}"` : ''}><head><meta charset="utf-8"><title>Links</title><link rel="icon" href="data:,">
<style>:root{--accent:#16a34a;--accent-light:#4ade80;--text-primary:#e6edf7}body{background:#0b1220;color:#e6edf7;font:16px/1.5 sans-serif}
.site a{color:rgb(1, 2, 3)} .cta a{background:rgb(9, 9, 9);color:rgb(255, 255, 255);padding:8px 14px;border-radius:8px}</style>
<script src="/shared/navbar.js" defer></script></head>
<body><div id="navbar-mount"></div><main>
<p id="para">Read <a id="prose" href="/docs">the docs</a> first.</p>
<p><a id="comp" class="ov-chip" href="/x">A chip</a></p>
<nav><p><a id="navl" href="/n">In a nav</a></p></nav>
<p class="site"><a id="site" href="/s">The site's own colour</a></p>
<p class="cta"><a id="cta" href="/go">Start</a></p>
<ul><li><a id="li" href="/l">A list link outside prose</a></li></ul>
</main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [], networkLinks: false, countViews: false, notifications: false }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' || u.pathname === '/off') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(u.pathname === '/off' ? 'off' : '')); }
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

const LOOK = `(() => Object.fromEntries(['prose', 'comp', 'navl', 'site', 'cta', 'li'].map((id) => { const c = getComputedStyle(document.getElementById(id));
    return [id, { color: c.color, deco: c.textDecorationLine, layers: (c.backgroundImage.match(/linear-gradient/g) || []).length, size: c.backgroundSize, transition: c.transitionProperty, outline: c.outlineStyle }]; })))()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-links-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        for (let i = 0; i < 60 && !(await p.evaluate("!!document.getElementById('openvibe-navbar-styles')")); i++) await wait(50);
        let s = await p.evaluate(LOOK);
        // In running text: the theme's light accent, no browser underline, the three lines (sweep, resting line, wash).
        assert.strictEqual(s.prose.color, 'rgb(74, 222, 128)', `the theme's light accent (${JSON.stringify(s.prose)})`);
        assert.deepStrictEqual([s.prose.deco, s.prose.layers, s.prose.size], ['none', 3, '0% 2px, 100% 1px, 100% 0%'], `its own lines, resting (${JSON.stringify(s.prose)})`);
        assert.ok(/background-size/.test(s.prose.transition), 'the sweep moves');
        // Components, navs, list links outside prose: untouched.
        for (const id of ['comp', 'navl', 'li']) assert.strictEqual(s[id].layers, 0, `${id} keeps its own look (${JSON.stringify(s[id])})`);
        // A site's own colour and a button-like link keep theirs: zero specificity.
        assert.strictEqual(s.site.color, 'rgb(1, 2, 3)', 'a site\'s own link colour wins');
        assert.deepStrictEqual([s.site.deco, s.site.layers], ['none', 3], 'and the lines are still ours');
        assert.deepStrictEqual([s.cta.color, s.cta.layers], ['rgb(255, 255, 255)', 0], `a button-like link keeps its colour and fill (${JSON.stringify(s.cta)})`);
        // Focus sweeps the line in and rings it; a press washes it.
        await p.evaluate("document.getElementById('prose').focus(), true");
        await p.evaluate("(() => { const a = document.getElementById('prose'); a.blur(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })); a.focus({ focusVisible: true }); })(), true");
        await wait(600);
        s = await p.evaluate(LOOK);
        const visible = await p.evaluate("document.getElementById('prose').matches(':focus-visible')");
        if (visible) assert.deepStrictEqual([s.prose.size, s.prose.outline], ['100% 2px, 100% 1px, 100% 0%', 'solid'], `focus sweeps the line in and rings it (${JSON.stringify(s.prose)})`);
        // Motion Off: no sweep motion.
        await p.goto(`${base}/off`, { maxMs: 6000 });
        for (let i = 0; i < 60 && !(await p.evaluate("!!document.getElementById('openvibe-navbar-styles')")); i++) await wait(50);
        s = await p.evaluate(LOOK);
        assert.ok(/^(all|none)$/.test(s.prose.transition) || !/background-size/.test(s.prose.transition), `Off: still (${s.prose.transition})`);
        assert.strictEqual(s.prose.layers, 3, 'Off keeps the look, only the motion stops');
        console.log(`links-chrome: running-text links in the theme's accent with their own lines${visible ? ', focus sweeps and rings' : ''}; components, navs and a site's own look untouched; Off is still`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
