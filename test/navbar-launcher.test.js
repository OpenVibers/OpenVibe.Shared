'use strict';
// The launcher (the grid button beside the brand) lists every open site of the network, in the Frame's groups, most used
// first within each: Network's /api/frame sends 40 entries (the navbar used to keep 12, so 28 sites were missing from the
// menu, owner 2026-10-17). Runs in a real headless Chrome (skipped without Chrome or with OV_SKIP_BROWSER=1), with the
// Frame answer served through a stubbed fetch so the navbar's own cleaning of it is what is tested.
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
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [], countViews: false, notifications: false }); });</script>
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
        await p.evaluate(`document.getElementById('openvibe-launcher-btn').click(), true`);
        const read = () => p.evaluate(`(() => { const b = document.querySelector('.ovnav-launcher .ovl-body'); return {
            heads: [...b.querySelectorAll('.ovl-h')].map((e) => e.firstChild.textContent.trim()),
            groups: [...b.querySelectorAll('.ovl-apps')].map((g) => [...g.querySelectorAll('b')].map((x) => x.textContent)),
            here: [...b.querySelectorAll('.ovl-app.is-here')].map((a) => a.querySelector('b').textContent + '|' + a.getAttribute('aria-current')),
            small: (b.querySelector('.ovl-app small') || {}).textContent } })()`);
        const r = await read();
        assert.deepStrictEqual(r.heads.slice(0, 3), ['Watch & stream', 'Talk & learn', 'Your OpenVibe'], 'the Frame\'s groups, in its order');
        assert.strictEqual(r.groups.flat().length, 21, 'every site of the Frame (21 here; the navbar used to keep 12)');
        assert.deepStrictEqual(r.groups[0].slice(0, 2), ['Live', 'Watch 0'], 'most used first within a group');
        assert.ok(r.groups[0].includes('Pics'), 'a product on its own domain sits in its group');
        assert.deepStrictEqual(r.groups[2], ['Network', 'Mystery'], 'a site in a group the navbar does not know goes in the last one');
        assert.deepStrictEqual(r.here, ['Here|page'], 'the page\'s own site is marked');
        assert.strictEqual(r.small, 'Live things', 'taglines without a closing period');
        // Typing filters the sites (and the search box stays on top of the scrolling panel).
        await p.evaluate(`(() => { const q = document.querySelector('.ovnav-launcher .ovl-q'); q.value = 'pic'; q.dispatchEvent(new Event('input')); return true; })()`);
        const f = await read();
        assert.deepStrictEqual(f.groups[0], ['Pics'], JSON.stringify(f));
        assert.strictEqual(await p.evaluate(`getComputedStyle(document.querySelector('.ovnav-launcher .ovl-top')).position`), 'sticky');
        console.log('navbar-launcher: all checks passed');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
