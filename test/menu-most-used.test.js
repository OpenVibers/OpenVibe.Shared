'use strict';
// The menu's You tab: "Most used" (the person's top eight sites this month, as app icons) above Recent, with "Your
// stats" linking OpenVibe.Report's /me. The owner, 11-09. Runs in a real headless Chrome (skipped without Chrome or
// with OV_SKIP_BROWSER=1), with Network's Frame/history and Report's stats served through a stubbed fetch.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-most-used: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const site = (id, name = id.charAt(0).toUpperCase() + id.slice(1), url = `https://openvibe.${id}/`) => ({ id, name, url, icon: id, tagline: `${name} things.`, group: 'people' });
const FRAME = {
    nav: [site('live'), site('community'), site('chat'), site('games'), site('network'), site('here', 'Here', 'https://127.0.0.1/')],
    groups: [{ id: 'people', name: 'People & you' }], soon: [], footer: {},
};
const HISTORY = {
    items: [{ service: 'live', service_label: 'Live', title: 'A stream', url: 'https://openvibe.live/watch/7', updated_at: '2026-11-09T10:00:00Z' }],
    services: [{ service: 'live', label: 'Live', count: 4 }],
};
const STATS = {
    generated_at: '2026-11-09T12:00:00Z',
    person: { username: 'goosely', display_name: 'Goosely' },
    window: { days: 30, from: '2026-10-11', to: '2026-11-09' },
    published: { sites: false, activity: false, made: false, ai: false, money: false },
    sections: {
        sites: {
            week: [], month: [],
            top: [
                { service: 'live', label: 'Live', url: 'https://openvibe.live/', visits: 12 },
                { service: 'community', label: 'Community', url: 'https://openvibe.community/', visits: 8 },
                { service: 'chat', label: 'Chat', url: 'https://openvibe.chat/', visits: 5 },
                { service: 'games', label: 'Games', url: 'https://openvibe.games/', visits: 3 },
                { service: 'network', label: 'Network', url: 'https://openvibe.network/', visits: 2 },
            ],
        },
    },
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Menu</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u);
    if (s.startsWith('https://openvibe.network/api/frame')) return Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) });
    if (s.includes('/api/history')) return Promise.resolve({ ok: true, json: async () => (${JSON.stringify(HISTORY)}) });
    if (s.includes('openvibe.report/api/v1/me/stats')) return Promise.resolve({ ok: true, json: async () => (${JSON.stringify(STATS)}) });
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: { username: 'goosely', display_name: 'Goosely', is_anon: false }, token: 'test-token', countViews: false, notifications: false, links: [{ label: 'Home', href: '/' }] }); });</script>
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-most-used-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, block: ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (localStorage.getItem('ov_frame_v2')) { clearInterval(t); r(true); } }, 20); })`);
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (document.querySelector('.ovs.is-open')) { clearInterval(t); r(true); } }, 20); })`);
        await p.evaluate(`document.querySelector('.ovs-starttabs [data-tab="you"]').click(), true`);
        // The home screen arrives as a sibling; the stats answer arrives after the first paint and repaints.
        const read = () => p.evaluate(`(() => {
            const root = document.querySelector('.ovs-list .ovh');
            const heads = root ? [...root.querySelectorAll('.ovh-sec')].map((e) => e.textContent.trim()) : [];
            const most = root ? root.querySelector('.ovh-grid[aria-label="Most used this month"]') : null;
            const cells = most ? [...most.querySelectorAll('.ovh-app')].map((a) => a.querySelector('.ovh-name').textContent) : [];
            const link = root ? [...root.querySelectorAll('.ovh-sec a.ovh-link')].find((a) => a.textContent.trim() === 'Your stats') : null;
            return { heads, cells, href: link && link.href, recent: !!root && !!root.querySelector('.ovh-recent'), aria: most && most.getAttribute('aria-label') };
        })()`);
        let r = await read();
        for (let i = 0; i < 80 && !(r.cells.length === 5 && r.recent); i++) { await new Promise((ok) => setTimeout(ok, 50)); r = await read(); }
        assert.ok(r.heads.some((x) => x.startsWith('Most used')), `the You tab has Most used: ${JSON.stringify(r)}`);
        assert.ok(r.heads.findIndex((x) => x.startsWith('Most used')) < r.heads.findIndex((x) => x.startsWith('Recent')), `Most used is above Recent: ${JSON.stringify(r.heads)}`);
        assert.deepStrictEqual(r.cells, ['Live', 'Community', 'Chat', 'Games', 'Network'], 'the top sites, in the stats order');
        assert.strictEqual(r.aria, 'Most used this month');
        assert.strictEqual(r.href, 'https://openvibe.report/me', 'Your stats links Report /me');
        assert.ok(r.recent, 'Recent is still there below');
        // The answer is kept on this device for an hour, so opening the menu again does not ask Report again.
        const cached = await p.evaluate(`JSON.parse(localStorage.getItem('ov_stats:test-token') || localStorage.getItem('ov_stats:goosely') || 'null')`);
        assert.ok(cached && Array.isArray(cached.top) && cached.top.length === 5, 'the top sites are cached');
        console.log('menu-most-used: all checks passed');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
