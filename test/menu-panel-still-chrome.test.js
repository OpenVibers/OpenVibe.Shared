'use strict';
// The menu's panel never scrolls as a whole (4.223.1; the owner, 11-12, two phone screenshots: the menu "loses its
// tabs"). 4.223.0 drew a light 20% past the panel's edges and the panel was overflow: hidden, which is still a scroll
// container: a focus or a scroll into view inside it scrolled the panel up and the search field and the tabs left the
// screen. Here, at 390 and 1280 px, the You tab and the site list are opened, the last tile is focused and scrolled into
// view, and the panel must still be at 0 with its field and tabs where they were. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-panel-still-chrome: skipped (no Chrome)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const SITES = Array.from({ length: 24 }, (_, i) => ({ id: `s${i}`, name: `Site ${i}`, url: `https://openvibe.s${i}.example/`, icon: 'live', group: i < 12 ? 'play' : 'more' }));
const FRAME = { nav: SITES, groups: [{ id: 'play', name: 'Play' }, { id: 'more', name: 'More' }], soon: [], footer: {} };
const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Here</title><link rel="icon" href="data:,">
<script>
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b });
  const realFetch = window.fetch;
  window.fetch = (u, o) => { const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s.startsWith('https://')) return J({}, false, 404);
    return realFetch(u, o); };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: null, mount: '#navbar-mount' }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(new URL(req.url, 'http://x').pathname);
    if (m) { if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page());
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-still-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(60); } };
    try {
        const context = await browser.newContext();
        for (const [w, ht] of [[390, 844], [1280, 860]]) {
            const p = await h.openPage(browser, context, { width: w, height: ht });
            await p.goto(`${base}/`, { maxMs: 6000 });
            await until(p, `!!(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn'))`);
            await p.evaluate(`(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true`);
            assert.ok(await until(p, `document.querySelectorAll('.ovs.is-open .ovs-grid.is-mini .ovs-tile').length >= 20`), `${w}px: the site list is drawn`);
            await wait(500);
            const head = () => p.evaluate(`(() => { const panel = document.querySelector('.ovs.is-open .ovs-panel'); const field = panel.querySelector('.ovs-input'); const tabs = panel.querySelector('.ovs-starttabs');
                return { scroll: panel.scrollTop, field: Math.round(field.getBoundingClientRect().top), tabs: Math.round(tabs.getBoundingClientRect().top), overflow: getComputedStyle(panel).overflowY }; })()`);
            const before = await head();
            // What a focus deep in the list does: scroll the last tile into view, then focus it.
            await p.evaluate(`(() => { const t = [...document.querySelectorAll('.ovs.is-open .ovs-grid.is-mini .ovs-tile')].pop(); t.scrollIntoView({ block: 'end' }); t.focus(); })(), true`);
            await wait(300);
            const after = await head();
            assert.strictEqual(after.scroll, 0, `${w}px: the panel never scrolls as a whole (${JSON.stringify(after)})`);
            assert.strictEqual(after.overflow, 'clip', `${w}px: the panel clips, it is not a scroll container`);
            assert.deepStrictEqual([after.field, after.tabs], [before.field, before.tabs], `${w}px: the search field and the tabs stay where they were`);
            assert.ok(after.field >= 0 && after.tabs > after.field, `${w}px: the field and the tabs are on the screen`);
            await p.close();
        }
        console.log('menu-panel-still-chrome: a focus deep in the menu scrolls its list, never the panel; the field and the tabs stay on screen');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
