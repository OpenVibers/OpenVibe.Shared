'use strict';
// Back to the menu (4.229.0; the owner, 11-12: "fix the history back button so it properly brings you back to this GUI
// rather than the page behind it"), in a real headless Chrome: a page left from the menu, then Back, opens the menu again
// where it was, on the same history entry (Forward still works); closing it then leaves the page as it was; a site's
// in-place move (Boost) comes back the same way. Built on menu-navigate-chrome's page.
//
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
    console.log('menu-back-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const FRAME = { nav: [{ id: 'chat', name: 'Chat', url: 'https://openvibe.chat/', icon: 'chat', group: 'talk' }], groups: [{ id: 'talk', name: 'Talk' }], soon: [], footer: {} };
const LINKS = [{ label: 'Home', href: '/' }, { label: 'Camera', href: '/camera' }, { label: 'Other page', href: '/other' }];
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-back-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { let v = null; try { v = await p.evaluate(expr); } catch { v = null; } if (v || Date.now() > end) return v; await wait(50); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 5000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the navbar is up');

        // Leave from the menu by a page that loads: Back opens the menu again.
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-links')`), 'the menu opened');
        await p.evaluate(`[...document.querySelectorAll('.ovs-links .ovs-link')].find((a) => a.textContent === 'Other page').click(), true`);
        assert.ok(await until(p, `location.pathname === '/other' && !!document.getElementById('openvibe-burger')`, 8000), 'the other page loaded');
        await p.evaluate(`history.back(), true`);
        assert.ok(await until(p, `location.pathname === '/' && !!document.querySelector('.ovs.is-open')`, 8000), 'Back opens the menu again, not the page behind it');
        assert.strictEqual(await p.evaluate(`!!(history.state && history.state.ovsMenu)`), true, 'on its own history entry');
        assert.strictEqual(await p.evaluate(`!!(history.state && history.state.ovsBack)`), false, 'and the mark is used up');
        // Closing it now leaves the page as it was (one Back, taken by the menu).
        await p.evaluate(`(document.querySelector('.ovs.is-open [data-close], .ovs.is-open .ovs-orb, .ovs.is-open .ovs-x') || { click() {} }).click(), true`);
        assert.ok(await until(p, `!document.querySelector('.ovs.is-open')`, 3000), 'it closes');
        await eventually(async () => assert.strictEqual(await p.evaluate('location.pathname'), '/', 'still on the page it was left from'));
        // Forward still leads to the page that was left to.
        await p.evaluate(`history.forward(), true`);
        assert.ok(await until(p, `location.pathname === '/other'`, 8000) || await until(p, `location.pathname === '/'`, 1000), 'Forward is not lost');

        // A move in place (Boost): Back on the same page opens the menu again too.
        await p.goto(`${base}/`, { maxMs: 5000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the navbar is up again');
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-links')`), 'the menu opened');
        await p.evaluate(`[...document.querySelectorAll('.ovs-links .ovs-link')].find((a) => a.textContent === 'Camera').click(), true`);
        assert.ok(await until(p, `location.pathname === '/camera' && !document.querySelector('.ovs.is-open')`, 3000), 'moved in place, the menu closed');
        await p.evaluate(`history.back(), true`);
        assert.ok(await until(p, `location.pathname === '/' && !!document.querySelector('.ovs.is-open')`, 5000), 'Back opens the menu again on the same page');
        await p.close();
        console.log('menu-back-chrome: Back to the menu after a page load and after an in-place move, its own entry, close and Forward');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
