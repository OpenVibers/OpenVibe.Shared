'use strict';
// The menu's ↗ to the place's own site, on every tab (4.284.0; the owner, 11-16: "when you're on chat it doesn't have a
// link to chat … the feed should bring you to the feed … one for the You … the link changes when you're going between
// tabs" and "make sure all sizes of things are consistent"): Feed → the feed's own page, You → OpenVibe.my, the site's own
// tab none; a new place's link first wears its tab's glyph and turns into the arrow; every button in the field is 40 px
// with a 20 px glyph. Real headless Chrome at 390 px.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-place-link-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Place</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><p>Page</p></main>
<script src="/navbar.js"></script>
<script>
  const real = window.fetch;
  window.fetch = async (u, init) => { const url = new URL(String(u), location.href); if (url.origin !== location.origin) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); return real(u, init); };
  OpenVibeNavbar.init({ service: 'chat', user: null, links: [{ label: 'Rooms', href: '/' }], networkLinks: false, countViews: false, notifications: false });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const name = u.pathname.slice(1);
    if (/^[a-z0-9-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});
const PLACE = `(() => { const a = document.querySelector('.ovs-acts .ovs-place'); return a ? { href: a.getAttribute('href'), turning: a.classList.contains('is-turn'), from: !!a.querySelector('.ovs-place-from') } : null; })()`;
const SIZES = `[...document.querySelectorAll('.ovs-bar .ovs-tool:not([hidden]) svg, .ovs-bar .ovs-act svg, .ovs-bar .ovs-place > span > svg')].filter((s) => s.getBoundingClientRect().width > 0 && getComputedStyle(s.parentElement).opacity !== '0').map((s) => Math.round(s.getBoundingClientRect().width))`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-place-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        for (let i = 0; i < 60 && !(await p.evaluate('typeof OpenVibeNavbar !== "undefined" && !!document.querySelector(".openvibe-navbar")')); i++) await wait(50);
        await p.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })), 1');
        for (let i = 0; i < 80 && !(await p.evaluate("!!document.querySelector('.ovs-tab[data-tab=feed]')")); i++) await wait(50);
        await h.eventually(async () => assert.strictEqual(await p.evaluate(PLACE), null, 'the site\'s own tab: no link (you are there)'));
        await p.evaluate("document.querySelector('.ovs-tab[data-tab=feed]').click(), 1");
        let s = await h.eventually(async () => { const x = await p.evaluate(PLACE); assert.deepStrictEqual(x, { href: 'https://openvibe.community/pulse', turning: true, from: true }, `Feed: the feed's own page, wearing its glyph first (${JSON.stringify(x)})`); return x; });
        s = await h.eventually(async () => { const x = await p.evaluate(PLACE); assert.deepStrictEqual(x, { href: 'https://openvibe.community/pulse', turning: false, from: false }, 'then the arrow alone'); return x; }, { timeout: 4000 });
        await p.evaluate("document.querySelector('.ovs-tab[data-tab=you]').click(), 1");
        s = await h.eventually(async () => { const x = await p.evaluate(PLACE); assert.deepStrictEqual([x.href, x.turning], ['https://openvibe.my/', true], 'You: OpenVibe.my, turning again (a new place)'); return x; });
        const sizes = await h.eventually(async () => { const x = await p.evaluate(SIZES); const t = await p.evaluate(PLACE); assert.ok(!t.turning && x.length >= 2 && x.every((w) => w === 20), `every glyph in the field is 20 px (${x})`); return x; }, { timeout: 4000 });
        console.log(`menu-place-link-chrome: Feed → the feed's page, You → OpenVibe.my, none on the site's own tab; the tab's glyph turns into the arrow; ${sizes.length} glyphs, all 20 px`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
