'use strict';
// Your feeds in the OpenVibe menu (4.132.0; the owner, 11-07: "integrate OpenVibe.Today and OpenVibe.News … the user
// should be able to configure which data feed streams are shown"). With the Frame's cards (each site's
// /.well-known/openvibe-menu.json): the first two show by default; "Choose your feeds (N)" lists every card with a tick
// and arrows; ticking one shows it, an arrow reorders, at most four, and the choice is kept on this device. A real
// headless Chrome; skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-feeds-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const card = (site, id, title, n) => ({ id, site, title, kind: 'rows', items: Array.from({ length: n }, (_, i) => ({ title: `${title} ${i + 1}`, url: `https://openvibe.${site === 'media-hub' ? 'video' : site}/x/${i}`, meta: `${i + 1} things` })) });
const FRAME = { nav: [{ id: 'live', name: 'Live', url: 'https://openvibe.live/', icon: 'live', group: 'watch' }], groups: [{ id: 'watch', name: 'Watch' }], soon: [], footer: {},
    cards: [card('media-hub', 'trending', 'Trending', 3), card('games', 'new-worlds', 'New worlds', 2), card('news', 'top', 'Top stories', 4), card('today', 'today', 'Today', 2), card('bad', 'empty', 'Nothing', 0)] };
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Feeds</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame?') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : String(u).startsWith('https://openvibe.network') ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : realFetch(u, o));
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});
const SHOWN = `[...document.querySelectorAll('.ovs-list .ovs-group[data-sec^="net:"]')].map((g) => g.firstChild.textContent)`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-feeds-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await until(p, `!!localStorage.getItem('ov_frame_v2')`);
        await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-group')`), 'the menu opened');
        await wait(150);
        assert.deepStrictEqual(await p.evaluate(SHOWN), ['Trending', 'New worlds'], 'by default, the Network\'s first two');
        const fold = await p.evaluate(`(document.querySelector('[data-ovs-fold="feeds"]') || {}).textContent`);
        assert.strictEqual(fold, 'Choose your feeds (4)', 'every card with entries can be chosen; the empty one is not offered');

        await p.evaluate(`document.querySelector('[data-ovs-fold="feeds"]').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs-feeds')`), 'the chooser opens in the menu');
        assert.deepStrictEqual(await p.evaluate(`[...document.querySelectorAll('.ovs-feed b')].map((b) => b.textContent)`), ['Trending', 'New worlds', 'Top stories', 'Today']);
        assert.deepStrictEqual(await p.evaluate(`[...document.querySelectorAll('[data-ovs-feed]')].map((x) => x.checked)`), [true, true, false, false]);

        // Tick Today: it shows, after the two.
        await p.evaluate(`document.querySelector('[data-ovs-feed="today:today"]').click(), true`);
        await wait(100);
        assert.deepStrictEqual(await p.evaluate(SHOWN), ['Trending', 'New worlds', 'Today']);
        // Move Today up twice: first.
        await p.evaluate(`document.querySelector('[data-ovs-feed-move="up|today:today"]').click(), true`);
        await wait(60);
        await p.evaluate(`document.querySelector('[data-ovs-feed-move="up|today:today"]').click(), true`);
        await wait(100);
        assert.deepStrictEqual(await p.evaluate(SHOWN), ['Today', 'Trending', 'New worlds'], 'the arrows order them');
        assert.strictEqual(await p.evaluate(`document.activeElement && document.activeElement.getAttribute('data-ovs-feed-move')`), 'up|today:today', 'focus stays on the arrow');
        // Untick Trending; tick Top stories: four at most.
        await p.evaluate(`document.querySelector('[data-ovs-feed="media-hub:trending"]').click(), true`);
        await wait(60);
        await p.evaluate(`document.querySelector('[data-ovs-feed="news:top"]').click(), true`);
        await wait(100);
        assert.deepStrictEqual(await p.evaluate(SHOWN), ['Today', 'New worlds', 'Top stories']);
        assert.deepStrictEqual(await p.evaluate(`JSON.parse(localStorage.getItem('ovs-feeds'))`), { on: ['today:today', 'games:new-worlds', 'news:top'] }, 'kept on this device');
        const box = await p.evaluate(`document.documentElement.scrollWidth`);
        assert.ok(box <= 390, `nothing runs off a phone (${box})`);

        // Reopened later: the choice holds.
        await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`);
        await wait(200);
        await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-group')`));
        await wait(150);
        assert.deepStrictEqual(await p.evaluate(SHOWN), ['Today', 'New worlds', 'Top stories'], 'your feeds, in your order');
        console.log('menu-feeds-chrome: two by default, every card choosable, tick, reorder, four at most, kept on this device');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
