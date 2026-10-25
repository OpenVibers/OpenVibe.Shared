'use strict';
// The phone menu (the burger's drawer) opens in view even on a page that is wider than the phone. It is anchored to the
// bar, not to the viewport: on openvibe.chat/messages a long pasted link made the page 939 px wide on a 412 px phone,
// and the drawer, then position: fixed against that wider layout viewport, opened at x 631-931, off-screen (the owner,
// 2026-10-25: "Missing menu"). Runs in a real headless Chrome with phone emulation (skipped without Chrome or with
// OV_SKIP_BROWSER=1).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('navbar-drawer-overflow: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wide</title><link rel="icon" href="data:,">
<script src="/shared/navbar.js" defer></script></head>
<body style="margin:0"><div id="navbar-mount"></div><main><p id="wide" style="white-space:nowrap">https://www.example.com/a-very-long-link-that-nobody-wrapped-so-it-runs-far-past-the-right-edge-of-any-phone-screen?and=more&amp;still=more</p></main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: { id: 7, username: 'probe', display_name: 'Probe' }, links: [{ label: 'Rooms', href: '/rooms' }, { label: 'Messages', href: '/messages' }, { label: 'Settings', href: '/settings' }], networkLinks: false, countViews: false, notifications: false, recent: false }); });</script>
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-drawer-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 412, height: 860, block: ['*openvibe.network*', '*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (document.getElementById('openvibe-burger')) { clearInterval(t); r(true); } }, 20); })`);
        const wide = await p.evaluate('document.documentElement.scrollWidth');
        assert.ok(wide > 600, `the page is wider than the phone (${wide} px)`);
        await p.evaluate(`document.getElementById('openvibe-burger').click()`);
        const box = JSON.parse(await p.evaluate(`new Promise((r) => setTimeout(() => { const d = document.getElementById('openvibe-drawer'); const b = d.getBoundingClientRect(); r(JSON.stringify({ open: d.classList.contains('open'), x: b.x, right: b.right, top: b.top, links: d.querySelectorAll('a').length })); }, 350))`));
        assert.strictEqual(box.open, true, 'the drawer opened');
        assert.ok(box.x >= 0 && box.right <= 412, `the drawer is on the phone's screen (x ${Math.round(box.x)} to ${Math.round(box.right)} of 412)`);
        assert.ok(box.top > 40 && box.top < 80, `right under the bar (top ${Math.round(box.top)})`);
        assert.ok(box.links >= 3, 'with the site\'s links');
        console.log('navbar-drawer-overflow: ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
