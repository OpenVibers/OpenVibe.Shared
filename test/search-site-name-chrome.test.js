'use strict';
// The menu names the site it is on by a short product name (4.155.0). On 11-08 the owner sent openvibe.website's menu:
// its first tab read "Websites that l…" and the box "Search Websites that look finished, or a…", the site's tagline
// taken from the page title. Now: the site's own short label, the network's name for the address (a site under a path,
// like openvibe.my/inventory, only on that path), the "OpenVibe.X" in the title, then the address; a tagline never.
// In a real headless Chrome; skipped without one.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('search-site-name-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const page = (title, search) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main></main><script src="/navbar.js"></script>
<script>
  window.__realFetch = window.fetch;
  window.fetch = async (u, init) => {
    const url = new URL(String(u), location.href);
    // The network's sites (https only, as the navbar keeps them): an account hub at localhost's root and Inventory under
    // /inventory there. The other pages are on 127.0.0.1, an address the list does not know.
    if (url.hostname === 'openvibe.network' && url.pathname === '/api/frame') return new Response(JSON.stringify({
      nav: [{ name: 'My', url: 'https://localhost/' }, { name: 'Inventory', url: 'https://localhost/inventory' }] }), { headers: { 'content-type': 'application/json' } });
    if (url.hostname === 'openvibe.network' || url.hostname === 'search.openvibe.network') return new Response('{}', { status: 404 });
    return window.__realFetch(u, init);
  };
  OpenVibeNavbar.init({ service: 'test', user: null, links: [{ label: 'Home', href: '/' }], search: ${JSON.stringify(search || {})} });
</script></body></html>`;
const PAGES = {
    '/website': page('OpenVibe.Website · Websites that look finished'),
    '/long-label': page('Templates · OpenVibe.Space', { label: 'Websites that look finished, from the first preview' }),
    '/inventory/items': page('Your items'),
    '/account': page('Account settings and everything else you own'),
};
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (PAGES[u.pathname]) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGES[u.pathname]); }
    const name = u.pathname.slice(1);
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-search-name-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const seen = {};
    try {
        for (const at of Object.keys(PAGES)) {
            const context = await browser.newContext();
            const p = await h.openPage(browser, context, { width: 390 });
            const origin = /^\/(inventory|account)/.test(at) ? base.replace('127.0.0.1', 'localhost') : base;
            await p.goto(`${origin}${at}`, { maxMs: 5000 });
            await wait(300);
            await p.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })); 1');
            for (let i = 0; i < 50 && !(await p.evaluate('!!document.querySelector(".ovs.is-open .ovs-input")')); i++) await wait(100);
            await wait(300);
            seen[at] = await p.evaluate(`({ placeholder: document.querySelector('.ovs-input').placeholder,
                tab: (document.querySelector('.ovs-tab[data-tab]') || {}).textContent || '',
                group: ((document.querySelector('.ovs-group') || {}).firstChild || {}).textContent || '' })`);
        }
        const name = (at) => seen[at].placeholder.replace(/^Search /, '').replace(/, or ask Vibe$/, '');
        assert.strictEqual(name('/website'), 'Website', `a tagline title gives the OpenVibe.X name: ${JSON.stringify(seen['/website'])}`);
        assert.ok(!/look finished/.test(seen['/website'].tab + seen['/website'].group), 'the tagline is nowhere in the tab or the heading');
        assert.strictEqual(name('/long-label'), 'Space', 'a long label is passed over for the name in the title');
        assert.strictEqual(name('/inventory/items'), 'Inventory', 'under /inventory the site is Inventory');
        assert.strictEqual(name('/account'), 'My', 'at the root of the same address it is not Inventory');
        for (const at of Object.keys(seen)) assert.ok(name(at).length <= 18, `${at}: a short name (${name(at)})`);
        console.log('search-site-name-chrome: short product names (tagline title, long label, path-aware sites) ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
