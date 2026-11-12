'use strict';
// Menu addresses (4.229.0; the owner, 11-12: "other tools and buttons can open specific areas of the menu"), in a real
// headless Chrome: any element with data-ov-menu="you/notifications" opens the menu there on a click; a page address
// ending #ov-menu=… opens it as the page loads and the hash goes; OpenVibeNavbar.menuAddress reads an address the same
// way. A link with an address still opens elsewhere with a modifier key. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-address-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const FRAME = { nav: [{ id: 'chat', name: 'Chat', url: 'https://openvibe.chat/', icon: 'chat', group: 'talk' }], groups: [{ id: 'talk', name: 'Talk' }], soon: [], footer: {} };
const LINKS = [{ label: 'Home', href: '/' }, { label: 'Other page', href: '/other' }];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Addr</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame?') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : String(u).startsWith('https://') ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : realFetch(u, o));
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<main><button id="bell" type="button" data-ov-menu="you/notifications">Notifications</button> <a id="feed" href="/feed-page" data-ov-menu="feed">Feed</a> <a id="hashlink" href="#ov-menu=you">You</a></main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: ${JSON.stringify(LINKS)}, countViews: false, notifications: false }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    if (u.pathname === '/feed-page') { res.writeHead(204); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-addr-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { let v = null; try { v = await p.evaluate(expr); } catch { v = null; } if (v || Date.now() > end) return v; await wait(50); } };
    const openTab = `(document.querySelector('.ovs.is-open .ovs-tab[data-tab][aria-selected="true"]') || {}).getAttribute ? document.querySelector('.ovs.is-open .ovs-tab[data-tab][aria-selected="true"]').getAttribute('data-tab') : ''`;
    const closeMenu = `(window.OpenVibeSearch && OpenVibeSearch.close && OpenVibeSearch.close(), true)`;
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });

        // An address in the page's own address opens the menu as it loads, and the hash goes.
        await p.goto(`${base}/#ov-menu=you/notifications`, { maxMs: 5000 });
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open')`, 8000), '#ov-menu opens the menu as the page loads');
        assert.strictEqual(await until(p, openTab), 'you', 'on You');
        assert.strictEqual(await p.evaluate('location.hash'), '', 'and the address no longer carries it');
        await p.evaluate(closeMenu);
        assert.ok(await until(p, `!document.querySelector('.ovs.is-open')`, 3000), 'it closes');

        // The API reads addresses the same way.
        const read = await p.evaluate(`JSON.stringify(['you/notifications', 'notifications', 'vibe', 'you/apps', 'feed', 'nonsense', 'here/live'].map((a) => OpenVibeNavbar.menuAddress(a)))`);
        assert.deepStrictEqual(JSON.parse(read), [
            { tab: 'you', part: 'notifications' }, { tab: 'you', part: 'notifications' }, { door: 'vibe' }, { tab: 'you', part: 'apps' },
            { tab: 'feed', part: null }, { tab: 'here', part: null }, { tab: 'here', part: 'live' },
        ]);

        // A button with an address opens the menu there.
        await p.evaluate(`document.getElementById('bell').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open')`, 5000), 'data-ov-menu opens the menu');
        assert.strictEqual(await until(p, openTab), 'you', 'you/notifications opens You');
        await p.evaluate(closeMenu);
        assert.ok(await until(p, `!document.querySelector('.ovs.is-open')`, 3000), 'it closes');

        // A link with an address opens the menu instead of following its href…
        await p.evaluate(`document.getElementById('feed').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open')`, 5000), 'a link with data-ov-menu opens the menu');
        assert.strictEqual(await until(p, openTab), 'feed', 'on the Feed');
        assert.strictEqual(await p.evaluate('location.pathname'), '/', 'and stays on the page');
        await p.evaluate(closeMenu);
        assert.ok(await until(p, `!document.querySelector('.ovs.is-open')`, 3000), 'it closes');
        // …but a modified click is the browser's (a new tab), and the menu stays shut.
        const prevented = await p.evaluate(`(() => { const e = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }); let seen = null; document.addEventListener('click', (x) => { seen = x.defaultPrevented; x.preventDefault(); }, { once: true }); document.getElementById('feed').dispatchEvent(e); return seen; })()`);
        assert.strictEqual(prevented, false, 'a ctrl-click on a link with an address is left to the browser');
        await wait(300);
        assert.strictEqual(await p.evaluate(`!!document.querySelector('.ovs.is-open')`), false, 'and opens no menu');

        // A plain link to #ov-menu=… on the same page opens it too (hashchange).
        await p.evaluate(`document.getElementById('hashlink').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open')`, 5000), 'a #ov-menu link on the page opens the menu');
        assert.strictEqual(await until(p, openTab), 'you', 'on You');
        await p.close();
        console.log('menu-address-chrome: #ov-menu on load and on the page, data-ov-menu on a button and a link, modifier clicks left alone, menuAddress');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
