'use strict';
// The phone menu's close orb goes back into the bar's menu button (11-13, the owner: "the close button … goes into the
// users avatar drop-down spot rather than where it should"). It is measured when the menu closes, after the sheet lets
// the page go: opened from the menu button or from You (no button passed), it lands on the button, never on the avatar
// or a corner. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const { eventually } = h;

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-orb-home-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rooms · OpenVibe.Chat</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main style="height:2400px"><p>Rooms</p></main>
<script src="/navbar.js"></script>
<script>
  window.__realFetch = window.fetch;
  window.fetch = async (u, init) => {
    const url = new URL(String(u), location.href);
    if (url.hostname !== location.hostname) return new Response('{}', { status: 404 });
    return window.__realFetch(u, init);
  };
  OpenVibeNavbar.init({ service: 'chat', auth: 'external', token: 'tok', user: { id: 3, username: 'maya', role: 'user' },
    links: [{ label: 'Rooms', href: '/rooms' }], search: { label: 'OpenVibe.Chat', page: '/search' } });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const name = u.pathname.slice(1);
    if (/^[a-z0-9-]+\.(js|css)$/.test(name) && fs.existsSync(path.join(ROOT, name))) {
        res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(fs.readFileSync(path.join(ROOT, name)));
    }
    res.writeHead(404); res.end();
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BURGER = "(() => { const r = document.getElementById('openvibe-burger').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()";
const LANDS = `(() => { const o = document.querySelector('.ovs .ovs-orb'); if (!o || !o.classList.contains('is-from')) return null;
  return { x: parseFloat(o.style.getPropertyValue('--orb-x')) + 24 + parseFloat(o.style.getPropertyValue('--orb-dx')),
           y: parseFloat(o.style.getPropertyValue('--orb-y')) + 24 + parseFloat(o.style.getPropertyValue('--orb-dy')) }; })()`;

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-menu-orb-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const seen = [];
        await ['burger', 'you'].reduce((prev, how) => prev.then(async () => {
            const p = await h.openPage(browser, context, { width: 390, height: 844 });
            await p.goto(`${base}/`, { maxMs: 5000 });
            await wait(300);
            const home = await p.evaluate(BURGER);
            await p.evaluate(how === 'burger' ? "document.getElementById('openvibe-burger').click(); 1" : "OpenVibeNavbar.openMenu('you'); 1");
            await eventually(async () => assert.ok(await p.evaluate("!!document.querySelector('.ovs.is-open .ovs-orb.is-x')"), 'the menu is open with its close'));
            await p.evaluate("document.querySelector('.ovs .ovs-orb').click(); 1");
            if (how === 'burger') {
                // The pressed button's own face flies back into it, so the close turns away where it is (never two things
                // landing on the bar at once).
                await eventually(async () => assert.ok(await p.evaluate("!!document.querySelector('.ovs .ovs-orb.is-gone')"), 'the close turns away in place'));
                seen.push('burger: the button flies home, the close turns away');
                return;
            }
            await eventually(async () => {
                const at = await p.evaluate(LANDS);
                assert.ok(at, 'the orb glides home');
                assert.ok(Math.abs(at.x - home.x) <= 2 && Math.abs(at.y - home.y) <= 2, `opened from ${how}: lands ${JSON.stringify(at)}, the menu button is at ${JSON.stringify(home)}`);
            });
            seen.push(`${how}: lands on the menu button`);
        }), Promise.resolve());
        console.log(`menu-orb-home-chrome: ${seen.join('; ')}`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
