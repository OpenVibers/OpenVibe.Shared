'use strict';
// Icons are centred in their boxes, everywhere the shared chrome draws one (4.284.0; the owner, 11-16: "still offset icons
// in some places. You really need to fix this forever and across all sites"). scripts/icon-center.js finds a framed box
// whose only content is one icon and measures the icon's centre (and where its glyph is drawn) against the box's. Here:
//   it catches a planted offset (padding on one side) and passes a centred one;
//   the navbar, the open menu and the kit's icon buttons have none, at a phone's width.
// Real headless Chrome; skipped without it.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const { offsetIcons } = require('../scripts/icon-center');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('icon-center-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const kit = require('../kit');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Icons</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/kit.css">
<style>.box{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#223;border:0;color:#fff;margin:8px}.box svg{width:20px;height:20px}#bad{padding-left:10px}</style></head>
<body><div id="navbar-mount"></div><main class="ov-base">
<button class="box" id="good" aria-label="Good"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg></button>
<button class="box" id="bad" aria-label="Bad"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg></button>
<p>${kit.iconButton ? kit.iconButton({ icon: 'copy', label: 'Copy' }) : ''} ${kit.button({ href: '#', label: 'Get a key', icon: 'key' })}</p>
</main>
<script src="/navbar.js"></script>
<script>
  window.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  OpenVibeNavbar.init({ service: 'chat', user: null, links: [{ label: 'Rooms', href: '/' }], networkLinks: false, countViews: false, notifications: false });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const name = u.pathname.slice(1);
    if (/^[a-z0-9-]+\.(js|css)$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-iconc-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await h.eventually(async () => assert.ok(await p.evaluate('!!document.querySelector(".openvibe-navbar")')));
        const check = () => p.evaluate(`(${offsetIcons.toString()})({ limit: 1.5 })`);
        let found = await check();
        const planted = found.filter((f) => /#bad/.test(f.box));
        assert.strictEqual(planted.length, 1, `the planted offset is caught (${JSON.stringify(found)})`);
        assert.ok(planted[0].dx > 1.5, `by its offset, past the limit (${planted[0].dx})`);
        assert.ok(!found.some((f) => /#good/.test(f.box)), 'a centred icon passes');
        const others = found.filter((f) => !/#bad/.test(f.box));
        assert.deepStrictEqual(others, [], `the navbar and the kit's buttons are centred (${JSON.stringify(others)})`);
        // The menu, open.
        await p.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })), 1');
        await h.eventually(async () => assert.ok(await p.evaluate("!!document.querySelector('.ovs-tab')")));
        found = (await check()).filter((f) => !/#bad/.test(f.box));
        assert.deepStrictEqual(found, [], `the open menu's icons are centred (${JSON.stringify(found)})`);
        console.log('icon-center-chrome: a planted offset is caught, a centred icon passes; the navbar, the open menu and the kit\'s buttons are centred');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
