'use strict';
// The site switcher behind the OpenVibe mark (site-switcher.js, 4.48.0; the owner, 2026-10-30: "clicking the icon …
// its own drop-down … all the sites, so you can hop between them fast"). In a real headless Chrome (skipped without
// Chrome or with OV_SKIP_BROWSER=1), with the Frame and the account's sites served through a stubbed fetch.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('site-switcher: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const GROUPS = [{ id: 'watch', name: 'Watch and stream' }, { id: 'talk', name: 'Talk and share' }, { id: 'build', name: 'Build on OpenVibe' }];
const site = (id, name, group, url = `https://openvibe.${id}/`) => ({ id, name, url, icon: id, tagline: `${name} things`, group });
const nav = [site('live', 'Live', 'watch'), site('video', 'Video', 'watch'), site('chat', 'Chat', 'talk', 'https://127.0.0.1/'),
    site('community', 'Community', 'talk'), site('design', 'Design', 'build'), site('pics', 'Pics', 'watch'), site('mystery', 'Mystery', 'new-group')];
const FRAME = { nav, groups: GROUPS, soon: [], footer: {} };
const MINE = { pinned: ['design'], recent: ['chat', 'video', 'live'] };

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Switcher</title><link rel="icon" href="data:,">
<script>
  window.__calls = [];
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame')) return Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) });
    if (s.startsWith('https://openvibe.network/api/themes/me/sites')) {
      window.__calls.push({ url: s, method: (o && o.method) || 'GET', body: o && o.body, auth: o && o.headers && o.headers.Authorization });
      return Promise.resolve({ ok: true, json: async () => (${JSON.stringify(MINE)}) });
    }
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'chat', user: { id: 7, username: 'viewer' }, token: 'tok_test', links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-switcher-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (localStorage.getItem('ov_frame_v2') && document.getElementById('openvibe-switch-btn')) { clearInterval(t); r(true); } }, 20); })`);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const brand = await p.evaluate(`(() => { const b = document.getElementById('openvibe-switch-btn'); return { tag: b.tagName, popup: b.getAttribute('aria-haspopup'), expanded: b.getAttribute('aria-expanded'), home: !!document.querySelector('.openvibe-navbar-brand .name a[href]') }; })()`);
        assert.deepStrictEqual(brand, { tag: 'BUTTON', popup: 'dialog', expanded: 'false', home: true }, 'the mark opens the switcher; the name stays the link home');
        const visits = await p.evaluate(`window.__calls.filter((c) => c.method === 'POST')`);
        assert.strictEqual(visits.length, 1, 'one visit recorded for a signed-in person');
        assert.deepStrictEqual([JSON.parse(visits[0].body).site, visits[0].auth], ['chat', 'Bearer tok_test'], 'this site, with the Network token');

        await p.evaluate(`document.getElementById('openvibe-switch-btn').click(), true`);
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { const h = [...document.querySelectorAll('.ovsw.is-open .ovsw-h')].map((x) => x.firstChild.textContent); if (h.includes('Recent')) { clearInterval(t); r(true); } }, 20); })`);
        const read = () => p.evaluate(`(() => { const box = document.querySelector('.ovsw-panel'); return {
            open: !!document.querySelector('.ovsw.is-open'),
            expanded: document.getElementById('openvibe-switch-btn').getAttribute('aria-expanded'),
            heads: [...box.querySelectorAll('.ovsw-h')].map((x) => x.firstChild.textContent),
            rows: [...box.querySelectorAll('section')].map((s) => [...s.querySelectorAll('.ovsw-t')].map((t) => t.textContent.replace('★', ''))),
            here: [...box.querySelectorAll('.ovsw-t.is-here')].map((t) => t.textContent + '|' + t.getAttribute('aria-current')),
            hrefs: [...box.querySelectorAll('.ovsw-t')].every((t) => /^https?:/.test(t.getAttribute('href'))),
            width: document.documentElement.scrollWidth } })()`);
        let r = await read();
        assert.deepStrictEqual([r.open, r.expanded], [true, 'true']);
        assert.deepStrictEqual(r.heads, ['Recent', 'Pinned', 'Watch and stream', 'Talk and share', 'Build on OpenVibe'], 'recent, pinned, then the frame\'s groups');
        assert.deepStrictEqual(r.rows[0], ['Video', 'Live'], 'recent from the account, newest first, without the page\'s own site');
        assert.deepStrictEqual(r.rows[1], ['Design'], 'pinned from the account');
        assert.deepStrictEqual(r.rows[2], ['Live', 'Video', 'Pics'], 'a group in the frame\'s order');
        assert.deepStrictEqual(r.rows[4], ['Design', 'Mystery'], 'a site in an unknown group joins the last one');
        assert.deepStrictEqual(r.here, ['Chat|page'], 'the page\'s own site is marked by its address');
        assert.ok(r.hrefs, 'every tile is a real link');

        // Typing filters every site by name.
        await p.evaluate(`(() => { const q = document.querySelector('.ovsw-top input'); q.value = 'pic'; q.dispatchEvent(new Event('input')); return true; })()`);
        await wait(50);
        r = await read();
        assert.deepStrictEqual(r.rows, [['Pics']], JSON.stringify(r));

        // Right-click pins (saved to the account), and Escape closes.
        await p.evaluate(`(() => { const q = document.querySelector('.ovsw-top input'); q.value = ''; q.dispatchEvent(new Event('input')); return true; })()`);
        await wait(50);
        await p.evaluate(`(() => { const t = [...document.querySelectorAll('.ovsw-t')].find((x) => x.textContent === 'Community'); t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return true; })()`);
        await wait(50);
        const puts = await p.evaluate(`window.__calls.filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body))`);
        assert.deepStrictEqual(puts, [{ pinned: ['community', 'design'] }], 'a pin goes to the account');
        r = await read();
        assert.deepStrictEqual(r.rows[1], ['Community', 'Design'], 'and shows at once');
        await p.evaluate(`document.querySelector('.ovsw-panel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`);
        await wait(50);
        r = await p.evaluate(`({ open: !!document.querySelector('.ovsw.is-open'), expanded: document.getElementById('openvibe-switch-btn').getAttribute('aria-expanded'), overflow: document.documentElement.style.overflow })`);
        assert.deepStrictEqual(r, { open: false, expanded: 'false', overflow: '' }, 'Escape closes it and gives the page its scroll back');
        console.log('site-switcher: all checks passed');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
