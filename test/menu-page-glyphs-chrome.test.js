'use strict';
// Every page row in the menu wears its own glyph (4.253.0, plan §AA.38): the site's own (links[].icon) when it names one,
// else one read from the page's name ("Jobs" a briefcase, "Live tours" a broadcast, "Watchlists" an eye, not a video),
// else a page icon (4.262.0: never the arrow). In a real headless Chrome with the menu's search opened on a site's links.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-page-glyphs-chrome: skipped'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const LINKS = [
    { label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: 'Live tours', href: '/live' }, { label: 'Watchlists', href: '/watch' },
    { label: 'Settings', href: '/settings', icon: 'fa-star' }, { label: 'Companies', href: '/companies' }, { label: 'Your pictures', href: '/me' },
];
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(req.url);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': m[1].endsWith('.js') ? 'application/javascript' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><body><script>
    window.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    </script><script src="/shared/search.js"></script><script>
    OpenVibeSearch.open({ service: 'site', links: ${JSON.stringify(LINKS)}, sibling: (n) => '/shared/' + n,
      navIcon: (fa) => '<svg data-fa="' + fa + '"></svg>' });
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-page-glyphs-')) });
    const page = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
    const wait = async (expr) => { for (let n = 0; n < 100; n++) { if (await page.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait(`document.querySelectorAll('.ovs-link').length >= 7`), 'the page rows show');
        const got = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.ovs-link')].map((a) => [a.textContent.trim(), (a.querySelector('svg[data-fa]') || {}).getAttribute ? a.querySelector('svg[data-fa]').getAttribute('data-fa') : 'arrow']))`);
        assert.deepStrictEqual(got, { Home: 'fa-house', Jobs: 'fa-briefcase', 'Live tours': 'fa-tower-broadcast', Watchlists: 'fa-eye', Settings: 'fa-star', Companies: 'fa-file-lines', 'Your pictures': 'fa-image' },
            JSON.stringify(got));
        console.log('menu-page-glyphs-chrome: own icon first, else read from the name, else a page icon');
    } finally { await page.close(); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
