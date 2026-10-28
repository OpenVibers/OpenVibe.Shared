'use strict';
// Every open site of the network, in the Frame's groups, most used first within each: Network's /api/frame sends 40
// entries (the navbar used to keep 12, so 28 sites were missing from the menu, owner 2026-10-17). Since 4.23.0 they are
// the OpenVibe menu's Sites tab (search.js: the launcher and search became one menu, the owner 2026-10-28), opened by
// the magnifier or the drawer's "All sites". Runs in a real headless Chrome (skipped without Chrome or with
// OV_SKIP_BROWSER=1), with the Frame answer served through a stubbed fetch.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('navbar-launcher: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const GROUPS = [{ id: 'watch', name: 'Watch & stream' }, { id: 'talk', name: 'Talk & learn' }, { id: 'you', name: 'Your OpenVibe' }];
const site = (id, name, group, url = `https://openvibe.${id}/`) => ({ id, name, url, icon: id, tagline: `${name} things.`, group });
const nav = [site('live', 'Live', 'watch'), site('chat', 'Chat', 'talk'), site('here', 'Here', 'talk', 'https://127.0.0.1/'),
    site('network', 'Network', 'you'), site('mystery', 'Mystery', 'brand-new-group')];
for (let i = 0; i < 15; i++) nav.push(site(`w${i}`, `Watch ${i}`, 'watch'));   // 20 entries: more than the old cut of 12
nav.push({ id: 'pics', name: 'Pics', url: 'https://openvibe.pics/', icon: 'pics', tagline: 'Share pictures', group: 'watch', of: 'media-hub' });
const FRAME = { nav, groups: GROUPS, soon: [], footer: {} };

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Launcher</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : realFetch(u, o));
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

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-launcher-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        // The navbar asks for the Frame at render; the launcher paints from what it kept.
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (localStorage.getItem('ov_frame_v2')) { clearInterval(t); r(true); } }, 20); })`);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        // The drawer's "All sites" opens the one menu on its Sites tab.
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        await wait(150);
        await p.evaluate(`document.querySelector('#openvibe-drawer [data-open-launcher]').click(), true`);
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (document.querySelector('.ovs.is-open .ovs-grid.is-sites')) { clearInterval(t); r(true); } }, 20); })`);
        const read = () => p.evaluate(`(() => { const l = document.querySelector('.ovs-list'); return {
            tab: (document.querySelector('.ovs-tab[aria-selected="true"]') || {}).textContent,
            heads: [...l.querySelectorAll('.ovs-group')].map((e) => e.firstChild.textContent.trim()),
            groups: [...l.querySelectorAll('.ovs-grid.is-sites')].map((g) => [...g.querySelectorAll('b')].map((x) => x.textContent)),
            here: [...l.querySelectorAll('.ovs-tile.is-here')].map((a) => a.querySelector('b').textContent + '|' + a.getAttribute('aria-current')),
            small: (l.querySelector('.ovs-tile small') || {}).textContent,
            rows: [...l.querySelectorAll('.ovs-item .ovs-title')].map((t) => t.textContent) } })()`);
        const r = await read();
        assert.strictEqual(r.tab, 'Sites', 'the Sites tab');
        assert.deepStrictEqual(r.heads.slice(0, 3), ['Watch & stream', 'Talk & learn', 'Your OpenVibe'], 'the Frame\'s groups, in its order');
        assert.strictEqual(r.groups.flat().length, 21, 'every site of the Frame (21 here; the navbar used to keep 12)');
        assert.deepStrictEqual(r.groups[0].slice(0, 2), ['Live', 'Watch 0'], 'most used first within a group');
        assert.ok(r.groups[0].includes('Pics'), 'a product on its own domain sits in its group');
        assert.deepStrictEqual(r.groups[2], ['Network', 'Mystery'], 'a site in a group the navbar does not know goes in the last one');
        assert.deepStrictEqual(r.here, ['Here|page'], 'the page\'s own site is marked');
        assert.strictEqual(r.small, 'Live things', 'taglines without a closing period');
        // Typing goes to a site by its name, first.
        await p.evaluate(`(() => { const q = document.querySelector('.ovs-input'); q.value = 'pic'; q.dispatchEvent(new Event('input')); return true; })()`);
        await wait(500);
        const f = await read();
        assert.strictEqual(f.heads[0], 'Go to', JSON.stringify(f));
        assert.strictEqual(f.rows[0], 'Pics', 'the site whose name starts so is the first answer');
        console.log('navbar-launcher: all checks passed');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
