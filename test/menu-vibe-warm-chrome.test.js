'use strict';
// The menu's Vibe is ready before it is pressed (4.316.0; the owner's phone, 11-18: "Opening Vibe…", "loads insanely
// slow"). In a real headless Chrome: someone signed in opens the menu and, without pressing Vibe, ov-session.js arrives
// (by its hashed URL, so a site serves it for good); pressing Vibe then draws at once. A visitor's menu loads none of it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-vibe-warm-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const asked = [];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live</title><link rel="icon" href="data:,"></head>
<body style="margin:0;min-height:100vh;background:#0b1120"><script>window.fetch = async () => new Response('{}', { status: 404 });</script><script src="/search.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const [u, q] = req.url.split('?');
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u === '/ov-session.js') asked.push(q || '');
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const OPEN = (signedIn) => `OpenVibeSearch.open({ service: 'live', scope: { label: 'Live', page: '/search' }, links: [], frame: {}, from: document.body,
    token: ${signedIn ? "'t'" : 'null'}, user: ${signedIn ? "{ id: 7, username: 'maya', display_name: 'Maya' }" : 'null'},
    dock: ${signedIn ? '(id) => { window.went = id; }' : 'null'}, sibling: (f) => '/' + f + '?v=test', section: 'notifications' })`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-vibe-warm-')) });
    try {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 780 });
        const until = async (expr, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(expr)) return true; await wait(60); } return false; };
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await page.evaluate("window.OpenVibeDock = { mountInto(host) { host.innerHTML = '<div class=\"stub\"></div>'; return { show() {}, destroy() { host.innerHTML = ''; } }; } };");

        // A visitor: the menu opens and loads no Vibe.
        await page.evaluate(OPEN(false));
        await until("!!document.querySelector('.ovs.is-open')");
        // Watched for longer than the signed-in warm-up takes (350 ms, then the script): it never comes.
        assert.equal(await until('!!window.OpenVibeSession', 1500), false, 'a visitor\'s menu loads no Vibe');
        assert.deepEqual(asked, [], 'nothing asked');
        await page.evaluate('OpenVibeSearch.close && OpenVibeSearch.close()');
        await until("!document.querySelector('.ovs.is-open')");

        // Signed in: open the menu, do not press Vibe, and Vibe's script is there.
        await page.evaluate(OPEN(true));
        assert.ok(await until('!!window.OpenVibeSession', 4000), 'Vibe is read while the menu is open, before Vibe is pressed');
        assert.deepEqual(asked, ['v=test'], 'once, by the URL the site serves for good');
        // Pressing Vibe draws at once: no "Opening Vibe…" to wait on.
        await page.evaluate("document.querySelector('.ovs-starttabs [data-dock=\"vibe\"]').click()");
        assert.ok(await until("!document.querySelector('.ovs-door-wait') && !!document.querySelector('.ovs-vibe-body .ovse')", 3000), 'Vibe draws at once');
        console.log('menu-vibe-warm-chrome: a visitor loads no Vibe; signed in, Vibe is read once the menu opens and draws at once');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
