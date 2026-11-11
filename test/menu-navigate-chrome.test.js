'use strict';
// Changing pages from the menu (owner, 11-09: "when you switch pages… it doesn't update the navigation that's highlighted…
// the menu should animate closed when you change pages… a progress indicator at the very top… a glow"), in a real
// headless Chrome:
//   • a page chosen in the menu closes it, and Back is not spent on the menu during the move (a site's in-place move,
//     like Boost's, keeps its own history entry);
//   • a menu still open when a page is swapped in place marks the new page;
//   • a link that leaves the page shows the top bar at once, while the next page loads; a click a page handled itself
//     (defaultPrevented) draws nothing.
// Skipped without Chrome.
const assert = require('assert');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-navigate-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const FRAME = { nav: [{ id: 'chat', name: 'Chat', url: 'https://openvibe.chat/', icon: 'chat', group: 'talk' }], groups: [{ id: 'talk', name: 'Talk' }], soon: [], footer: {} };
const LINKS = [{ label: 'Home', href: '/' }, { label: 'Camera', href: '/camera' }, { label: 'Elsewhere', href: '/stay' }];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nav</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame?') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : String(u).startsWith('https://') ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : realFetch(u, o));
  // A stand-in for Boost: same-site links to /camera are swapped in place.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || new URL(a.href).pathname !== '/camera') return;
    e.preventDefault();
    history.pushState({}, '', '/camera');
    document.dispatchEvent(new CustomEvent('ov:boost:load'));
  });
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div><main><a id="plain" href="/stay">A plain link</a> <a id="handled" href="/elsewhere">Handled</a></main>
<script>document.getElementById('handled').addEventListener('click', (e) => e.preventDefault());
document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: ${JSON.stringify(LINKS)}, countViews: false, notifications: false });
  setTimeout(function () { window.addEventListener('click', function (e) { if (e.target && e.target.id === 'plain') { window.__left = true; e.preventDefault(); } }); }, 0); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    if (u.pathname === '/stay') { res.writeHead(204); return res.end(); }   // no content: the browser stays on the page
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-nav-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    try {
        const context = await browser.newContext();
        const blocked = ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'];
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: blocked });
        await p.goto(`${base}/`, { maxMs: 5000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the navbar is up');

        // Choose Camera in the menu: the menu closes, the page moves in place, Back still leads to the first page.
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-links')`), 'the menu opened');
        const before = await p.evaluate('history.length');
        await p.evaluate(`[...document.querySelectorAll('.ovs-links .ovs-link')].find((a) => a.textContent === 'Camera').click(), true`);
        assert.ok(await until(p, `!document.querySelector('.ovs.is-open')`, 1500), 'the menu closed when a page was chosen');
        await wait(300);
        await eventually(async () => assert.strictEqual(await p.evaluate('location.pathname'), '/camera', 'the page moved, and the menu did not step Back over it'));
        await eventually(async () => assert.ok(await p.evaluate('history.length') >= before, 'no history entry was taken back'));

        // Open again on the new page: Camera is marked; swap back to / in place while it is open: Home is marked.
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-links')`), 'the menu opened again');
        assert.ok(await until(p, `[...document.querySelectorAll('.ovs-links .is-here')].map((a) => a.textContent).join() === 'Camera'`), 'Camera is marked on /camera');
        await p.evaluate(`history.pushState({}, '', '/'); document.dispatchEvent(new CustomEvent('ov:boost:load')); true`);
        assert.ok(await until(p, `[...document.querySelectorAll('.ovs-links .is-here')].map((a) => a.textContent).join() === 'Home'`, 2000), 'a page swapped under the open menu is marked');
        await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`);
        await wait(400);

        // A click the page handled draws no bar; a link that leaves draws it at once, while the next page loads.
        await p.evaluate(`document.getElementById('handled').click(), true`);
        await wait(100);
        await eventually(async () => assert.strictEqual(await p.evaluate(`!!document.querySelector('#ovnav-leave.is-run')`), false, 'a handled click draws nothing'));
        await p.evaluate(`document.getElementById('plain').click(), true`);
        assert.ok(await until(p, `window.__left === true`, 1500), 'the plain link was clicked');
        assert.ok(await until(p, `(() => { const b = document.getElementById('ovnav-leave'); return !!b && b.classList.contains('is-run') && getComputedStyle(b).position === 'fixed' && parseFloat(getComputedStyle(b).height) === 3; })()`, 1500), 'the top bar runs as the page is left');
        console.log('menu-navigate-chrome: a chosen page closes the menu without spending Back, a swapped page is marked, the top bar runs on leaving ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
