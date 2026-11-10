'use strict';
// The menu's head is one row of places (4.194.0) in a real headless Chrome. The owner, 2026-11-10, with the menu and the
// Dock side by side: "combine and consolidate these two menus into one unified menu … It just seems a little much with
// all the buttons on the first one". Where the bar can open the Dock for the person: this site, Feed, Messages, AI, You,
// in that order, in ONE row, with no second row under it; Messages and AI open the Dock on those places and are never
// the chosen tab here. For a visitor: this site, Feed, You, as before.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-places-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title><link rel="icon" href="data:,"></head>
<body style="margin:0;min-height:100vh;background:#0b1120"><script>window.fetch = async () => new Response('{}', { status: 404 });</script><script src="/search.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const OPEN = (dock) => `OpenVibeSearch.open({ service: 'chat', scope: { label: 'Chat', page: '/search' }, links: [{ label: 'Rooms', href: '/rooms' }], frame: {}, token: ${dock ? "'t'" : 'null'},
    user: ${dock ? "{ id: 7, username: 'maya', display_name: 'Maya' }" : 'null'}, dock: ${dock ? '(id) => { window.went = id; }' : 'null'} })`;
const ROW = `Array.from(document.querySelectorAll('.ovs-starttabs .ovs-tab')).map((t) => { const r = t.getBoundingClientRect(); return { label: t.textContent.trim(), chosen: t.getAttribute('aria-selected') === 'true', door: t.getAttribute('data-dock') || '', role: t.getAttribute('role'), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; })`;
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-places-'));
    const browser = await h.launch({ tmpDir });
    try {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const [width, height, name] of [[390, 780, 'a phone'], [1200, 800, 'a computer']]) {
            const page = await h.openPage(browser, await browser.newContext(), { width, height });
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
            const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { if (await page.evaluate(expr)) return true; await wait(60); } return false; };
            // Signed in, with the Dock: five places in one row.
            await page.evaluate(OPEN(true));
            assert.ok(await until(`document.querySelectorAll('.ovs.is-open .ovs-starttabs .ovs-tab').length === 5`), `${name}: five places`);
            await wait(350);
            const row = await page.evaluate(ROW);
            assert.deepEqual(row.map((t) => t.label + (t.chosen ? '*' : '') + (t.door ? `>${t.door}` : '')), ['Chat*', 'Feed', 'Messages>chats', 'AI>vibe', 'You'], `${name}: this site, Feed, Messages, AI, You, in that order`);
            assert.ok(row.every((t) => t.top === row[0].top), `${name}: one row (${row.map((t) => t.top).join(',')})`);
            assert.ok(row.every((t) => Math.abs(t.w - row[0].w) <= 1 && t.h >= 42), `${name}: the same width each, and tall enough to press (${row.map((t) => `${t.w}x${t.h}`).join(' ')})`);
            assert.ok(row.every((t) => t.role === 'tab') && row[row.length - 1].right <= width, `${name}: all on the screen`);
            assert.equal(await page.evaluate(`document.querySelectorAll('.ovs-bridge, .ovs-bridge-b').length`), 0, `${name}: no second row of buttons under the tabs`);
            assert.equal(await page.evaluate(`document.querySelectorAll('.ovs-starttabs .ovs-tab svg, .ovs-starttabs .ovs-tab .ovs-tab-ic').length >= 4`), true, `${name}: each place has its icon`);
            // AI opens the Dock on Vibe; Messages on the conversations; neither becomes the chosen tab.
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="vibe"]').click()`);
            assert.equal(await page.evaluate('window.went'), 'vibe', `${name}: AI opens the Dock's Vibe`);
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-dock="chats"]').click()`);
            assert.equal(await page.evaluate('window.went'), 'chats', `${name}: Messages opens the Dock's conversations`);
            assert.deepEqual((await page.evaluate(ROW)).filter((t) => t.chosen).map((t) => t.label), ['Chat'], `${name}: the chosen tab is still this site's`);
            // Feed is a tab of this sheet.
            await page.evaluate(`document.querySelector('.ovs-starttabs [data-tab="feed"]').click()`);
            assert.ok(await until(`(document.querySelector('.ovs-starttabs [aria-selected="true"]') || {}).textContent.trim().startsWith('Feed')`), `${name}: Feed is chosen in place`);
            await page.evaluate('OpenVibeSearch.close()'); await wait(300);
            // A visitor: three places, as before.
            await page.evaluate(OPEN(false));
            assert.ok(await until(`document.querySelectorAll('.ovs.is-open .ovs-starttabs .ovs-tab').length === 3`), `${name}: a visitor has this site, Feed and You`);
            assert.deepEqual((await page.evaluate(ROW)).map((t) => t.label), ['Chat', 'Feed', 'You'].map((x, i) => x), `${name}: in that order`);
            await page.close();
        }
        console.log('menu-places-chrome: one row of five places signed in (this site, Feed, Messages, AI, You), no second row, the doors open the Dock, three places for a visitor');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
