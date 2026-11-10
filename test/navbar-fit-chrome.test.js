'use strict';
// The bar holds one row at every width (4.190.0), in a real headless Chrome. The owner, 2026-11-10, with openvibe.chat in
// Chrome's desktop mode on a phone: "Global chat" on two lines, the balances cut, the bell under the Ask button. With
// eight links and a signed-in person: nothing wraps, nothing is cut, and the links that do not fit step out whole.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('navbar-fit-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const LINKS = [['vibe', 'Vibe'], ['global', 'Global chat'], ['rooms', 'Rooms'], ['messages', 'Messages'], ['inbox', 'Inbox'], ['servers', 'Servers'], ['explore', 'Explore'], ['admin', 'Admin']];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bar</title></head><body style="margin:0;min-height:120vh">
<script>const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b, text: async () => JSON.stringify(b) });
  window.fetch = (u) => { const s = String(u); if (s.includes('/api/frame?')) return J({ nav: [], groups: [], soon: [], footer: {} });
    if (s.includes('/wallet')) return J({ bits_per_usd: 100, balances: { coins: { amount: '160799', scale: 0, currency: 'opencoins' }, vibes: { amount: '400', scale: 0, currency: 'vibes-bits' }, balance: { amount: '0', scale: 2, currency: 'USD' } } });
    return J({}, false, 404); };</script>
<script src="/shared/navbar.js"></script>
<script>OpenVibeNavbar.init({ service: 'chat', auth: 'external', apiBase: 'https://openvibe.network', user: { id: 7, subject: 'usr_7', username: 'maya', display_name: 'Maya' }, token: 'tok', presence: false, dock: false,
  links: ${JSON.stringify(LINKS.map(([id, label]) => ({ id, label, href: `/${id}`, icon: 'fa-circle' })))} });</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u.startsWith('/shared/')) { const f = path.join(root, u.slice(8)); if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': f.endsWith('.woff2') ? 'font/woff2' : 'application/javascript' }); return res.end(fs.readFileSync(f)); } res.writeHead(404); return res.end(''); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
});
const READ = `(() => { const nav = document.querySelector('.openvibe-navbar'); if (!nav) return null; const r = nav.getBoundingClientRect();
    const parts = [...nav.querySelectorAll('.openvibe-navbar-links > *, .openvibe-navbar-right > *, .openvibe-navbar-brand')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect());
    const links = [...nav.querySelectorAll('.openvibe-navbar-links > *')];
    return { h: Math.round(r.height), low: parts.filter((q) => q.bottom > r.bottom + 1 || q.top < r.top - 1).length, tall: parts.filter((q) => q.height > r.height + 1).length, off: parts.filter((q) => q.right > innerWidth + 1).length,
        over: nav.scrollWidth - nav.clientWidth, shown: links.filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim()), out: links.filter((e) => e.classList.contains('ovnav-out')).length, total: links.length }; })()`;
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-navfit-'));
    const browser = await h.launch({ tmpDir });
    try {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const seen = {};
        for (const width of [880, 940, 1010, 1100, 1400]) {
            const page = await h.openPage(browser, await browser.newContext(), { width, height: 500 });
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });
            let v = null;
            const end = Date.now() + 6000;
            while (Date.now() < end) { v = await page.evaluate(READ); if (v && v.total === LINKS.length && v.over <= 1) break; await wait(120); }
            await wait(400); v = await page.evaluate(READ);
            assert.ok(v && v.total === LINKS.length, `${width}: the bar drew its links`);
            assert.deepEqual([v.low, v.tall, v.off], [0, 0, 0], `${width}: nothing wraps under the bar, nothing is taller than the bar, nothing runs off the right edge (${JSON.stringify(v)})`);
            assert.ok(v.over <= 1, `${width}: the bar holds its row (${v.over} px over)`);
            assert.deepEqual(v.shown, LINKS.slice(0, v.shown.length).map((l) => l[1]), `${width}: the links that stay are the first ones, in order, whole`);
            seen[width] = v.shown.length;
            await page.close();
        }
        assert.ok(seen[880] < LINKS.length, 'a narrow bar lets its last links step out');
        assert.equal(seen[1400], LINKS.length, 'a wide bar shows them all');
        assert.ok(seen[880] <= seen[940] && seen[940] <= seen[1010] && seen[1010] <= seen[1100] && seen[1100] <= seen[1400], 'more room, more links');
        console.log(`navbar-fit-chrome: one row from 880 to 1400 px with eight links signed in (${Object.entries(seen).map(([w, n]) => `${w}:${n}`).join(' ')})`);
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
