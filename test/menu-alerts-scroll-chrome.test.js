'use strict';
// The menu's Alerts round trip (plan §AB.32; the owner, 11-14: Alerts tab → another tab → back to Alerts and the list
// cannot scroll). In a real headless Chrome at 390 × 844, signed in, with 40 notifications, by finger (touch events): the
// list scrolls on the first visit, after Apps, History and Feed and back, and on the list's own Deals & alerts tab after
// Mentions or All and back. (It did not reproduce on 4.248.0 either; this keeps every round trip honest.) Skipped
// without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-alerts-scroll-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const SITES = ['live', 'chat', 'community', 'video', 'pics', 'download', 'design', 'games', 'space', 'codes']
    .map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), url: `https://openvibe.${id}/`, icon: id, group: 'play' }));
const FRAME = { nav: SITES, groups: [{ id: 'play', name: 'Play' }], soon: [], footer: {} };
const NOTES = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, type: 'follow', title: `Person ${i + 1} followed you`, body: 'Say hello back.',
    url: `https://openvibe.live/p${i + 1}`, is_read: i > 5, created_at: new Date(Date.now() - i * 600e3).toISOString(), service: 'live' }));

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alerts</title><link rel="icon" href="data:,">
<script>
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b, headers: new Headers({ 'content-type': 'application/json' }) });
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s.includes('/api/notifications/unread-count')) return J({ count: 6 });
    if (s.includes('/api/notifications/unread-by-tab')) return J({ tabs: {} });
    if (s.includes('/api/notifications?')) { const q = new URL(s).searchParams; const off = Number(q.get('offset') || 0), lim = Number(q.get('limit') || 20);
      const all = ${JSON.stringify(NOTES)}; return J({ notifications: all.slice(off, off + lim), total: all.length, has_more: off + lim < all.length }); }
    if (s.startsWith('https://')) return J({}, false, 404);
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div><main style="height:2000px">Page</main>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: { id: 'u1', username: 'ada', display_name: 'Ada' }, token: 'tok-1', links: [], countViews: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page());
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-alerts-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(60); } };
    // A finger dragged upward by `dy` px in small steps, as a thumb scrolls.
    const drag = async (p, x, y, dy) => {
        await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 12; i++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y - dy * i / 12) }] }); await wait(16); }
        await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // Which element scrolls the list, and does a wheel over the list move it? (A wheel, as a person scrolls.)
    const scrolls = async (p, label) => {
        assert.ok(await until(p, "document.querySelectorAll('.ovs.is-open .openvibe-notif-item, .ovs.is-open .ovn-row').length >= 10"), `${label}: the list is drawn`);
        await wait(400);
        const at = await p.evaluate(`(() => {
            const row = document.querySelector('.ovs.is-open .openvibe-notif-item, .ovs.is-open .ovn-row'); const r = row.getBoundingClientRect();
            const sc = []; for (let e = row; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) sc.push(e); }
            window.__sc = sc; return { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + 20, innerHeight - 200)), before: sc.map((e) => e.scrollTop), n: sc.length, names: sc.map((e) => e.className.toString().split(' ')[0]) };
        })()`);
        assert.ok(at.n >= 1, `${label}: something around the list can scroll (${JSON.stringify(at)})`);
        // A finger, as on a phone: a touch drag upward over the list (the owner scrolls with a thumb).
        await drag(p, at.x, at.y, 400);
        await wait(600);
        const after = await p.evaluate('window.__sc.map((e) => e.scrollTop)');
        assert.ok(after.some((v, i) => v > at.before[i] + 50), `${label}: a finger over the list scrolls it (${at.names.join(' > ')}: ${at.before} → ${after})`);
        await p.evaluate('window.__sc.forEach((e) => { e.scrollTop = 0; })');
    };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await p.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!document.getElementById('openvibe-burger') || !!document.getElementById('openvibe-search-btn')");
        await p.evaluate("(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true");
        assert.ok(await until(p, "!!document.querySelector('.ovs.is-open [data-tab=\"you\"]')"), 'the menu opened');
        await p.evaluate("document.querySelector('.ovs [data-tab=\"you\"]').click(), true");
        assert.ok(await until(p, "!!document.querySelector('.ovh-tab[data-tab=\"notifications\"]')"), 'You, with its tabs');
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"notifications\"]').click(), true");
        await scrolls(p, 'first visit');
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"apps\"]').click(), true");
        assert.ok(await until(p, "!!document.querySelector('.ovh-grid .ovh-app')"), 'Apps');
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"notifications\"]').click(), true");
        await scrolls(p, 'after Apps and back');
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"recent\"]').click(), true");
        await wait(500);
        await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"notifications\"]').click(), true");
        await scrolls(p, 'after History and back');
        // And through the menu's own tabs: Feed, then You again (it opens where it was).
        await p.evaluate("document.querySelector('.ovs [data-tab=\"feed\"]').click(), true");
        await wait(600);
        await p.evaluate("document.querySelector('.ovs [data-tab=\"you\"]').click(), true");
        if (await until(p, "(document.querySelector('.ovh-tab[aria-selected=\"true\"]') || {}).dataset && document.querySelector('.ovh-tab[aria-selected=\"true\"]').dataset.tab === 'notifications'", 2000) !== true) {
            await p.evaluate("document.querySelector('.ovh-tab[data-tab=\"notifications\"]').click(), true");
        }
        await scrolls(p, 'after Feed and back');
        // The list's own tabs (the owner's "Alerts tab" is Deals & alerts): Alerts, another tab, Alerts again.
        const inner = (id) => p.evaluate(`document.querySelector('.ovs.is-open .openvibe-nv-tabs [data-tab="${id}"]').click(), true`);
        assert.ok(await until(p, "!!document.querySelector('.ovs.is-open .openvibe-nv-tabs [data-tab=\"alerts\"]')"), 'the list has its tabs');
        await inner('alerts'); await wait(500);
        await scrolls(p, 'on Deals & alerts');
        await inner('mentions'); await wait(500);
        await inner('alerts'); await wait(500);
        await scrolls(p, 'Deals & alerts after Mentions and back');
        await inner('all'); await wait(500);
        await inner('alerts'); await wait(500);
        await scrolls(p, 'Deals & alerts after All and back');
        console.log('menu-alerts-scroll-chrome: ok');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
