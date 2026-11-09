'use strict';
// Feed v2 in the menu (owner, 11-09: "a real feed… you scroll through easy content… a filter system… clean"), in a real
// headless Chrome against a stand-in for Community's /api/v1/feed: chips on top, cards by kind, a chip refetches with its
// kind, the next page loads as the end comes near, the end says so, the Feed tab drops its old sections when the feed
// answers, and what people wrote is text. (Without the API the wall stands: menu-home-screen-chrome.test.js.)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-feed-v2-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const SITES = ['live', 'chat', 'community', 'video', 'pics', 'download', 'design', 'games', 'space', 'codes', 'news', 'tools', 'bot', 'fun']
    .map((id, i) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), url: `https://openvibe.${id}/`, icon: id, group: i < 10 ? 'play' : 'more' }))
    .concat([{ id: 'ai', name: 'AI', url: 'https://openvibe.exchange/', icon: 'ai', group: 'build' }, { id: 'run', name: 'Run', url: 'https://openvibe.run/', icon: 'run', group: 'build' }]);
const FRAME = { nav: SITES, groups: [{ id: 'play', name: 'Play' }, { id: 'more', name: 'More' }, { id: 'build', name: 'Build' }], soon: [], footer: {} };
const CATALOG = { families: [], tools: Array.from({ length: 30 }, (_, i) => ({ name: `Tool ${i + 1}`, icon: ['pdf', 'image', 'qr', 'audio'][i % 4], url: `https://openvibe.tools/t${i + 1}`, tagline: 'a tool' })) };
const PULSE = { items: [
    { title: 'ada went live: Coding at night', url: 'https://openvibe.live/ada', occurred_at: new Date(Date.now() - 60e3).toISOString(), ref: { service: 'live' } },
    { title: 'bo went live: Morning stream', url: 'https://openvibe.live/bo', occurred_at: new Date(Date.now() - 120e3).toISOString(), ref: { service: 'live' } },
    { title: 'A new clip: the jump', url: 'https://openvibe.video/c/1', occurred_at: new Date(Date.now() - 3600e3).toISOString(), ref: { service: 'video' } },
    { title: '<img src=x onerror="window.pwned=1"> a post', url: 'https://openvibe.community/p/1', occurred_at: new Date(Date.now() - 7200e3).toISOString(), ref: { service: 'community' } },
], next_cursor: 'c2' };
const TODAY = { people: { today: 1204, series: [800, 900, 1000, 1204] }, streams: { today: 37, series: [20, 30, 37] }, posts: { today: 210 }, videos: { today: 12 } };

const page = (signed) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home</title><link rel="icon" href="data:,">
<script>
  window.__calls = [];
  const J = (b, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => b });
  const realFetch = window.fetch;
  window.fetch = (u, o) => {
    const s = String(u); window.__calls.push({ u: s, m: (o && o.method) || 'GET', body: o && o.body, auth: o && o.headers && (o.headers.Authorization || o.headers.authorization) || '' });
    if (s.startsWith('https://openvibe.network/api/frame?')) return J(${JSON.stringify(FRAME)});
    if (s.startsWith('https://openvibe.network/api/catalog.json')) return J(${JSON.stringify(CATALOG)});
    if (s.startsWith('https://openvibe.network/api/v1/frame/today')) return J(${JSON.stringify(TODAY)});
    if (s.startsWith('https://openvibe.network/api/v1/changelog')) return J({ entries: [
      { service: 'live', subject: 'Go live from a phone: the Dock no longer covers the button (#711)', deployed_at: new Date(Date.now() - 3600e3).toISOString(), major: true },
      { service: 'live', subject: 'openvibe-shared v4.158.0 (was v4.157.0) (#712)', deployed_at: new Date(Date.now() - 600e3).toISOString() },
      { service: 'video', subject: 'Clips play from where you left off.', deployed_at: new Date(Date.now() - 7200e3).toISOString() } ] });
    if (s.startsWith('https://openvibe.network/api/history')) return J({ items: [{ title: 'A stream', url: 'https://openvibe.live/ada', service: 'live', updated_at: new Date().toISOString() }, { title: 'A pic', url: 'https://openvibe.pics/1', service: 'pics', updated_at: new Date(Date.now() - 1000).toISOString() }], services: [{ service: 'live', count: 5 }, { service: 'pics', count: 2 }] });
    if (s.startsWith('https://openvibe.network/api/v1/me/home-screen')) return (o && o.method === 'PUT') ? J({ ok: true }) : J({}, false, 404);
    if (s.startsWith('https://openvibe.community/api/v1/feed')) { window.__feedCalls = (window.__feedCalls || []).concat([s]); const u = new URL(s); const kind = u.searchParams.get('kind') || ''; const page = u.searchParams.get('cursor') ? 2 : 1;
      const mk = (i, k) => ({ id: k + i + '-' + page, kind: k, url: 'https://openvibe.video/c/' + i, title: (k === 'post' ? '<b>bold</b> ' : '') + k + ' ' + i + ' page ' + page, text: 'words', at: new Date(Date.now() - i * 60000).toISOString(), site: k === 'pic' ? 'pics' : 'video', site_name: 'Video', actor: { name: 'ada' }, media: k === 'post' || k === 'update' ? {} : { thumb: 'https://openvibe.media/t/x.webp', ratio: 1.7778, length: '0:30' }, counts: { views: 1200, likes: 3 } });
      const kinds = kind ? [kind] : ['live', 'clip', 'pic', 'post', 'update'];
      return J({ items: Array.from({ length: 12 }, (_, i) => mk(i, kinds[i % kinds.length])), next_cursor: page === 1 ? 'c2' : null }); }
    if (s.startsWith('https://openvibe.community/api/v1/pulse')) return J(Object.assign({}, ${JSON.stringify(PULSE)}, s.includes('after=c2') ? { items: [{ title: 'An older post', url: 'https://openvibe.community/p/0', occurred_at: new Date(Date.now() - 86400e3).toISOString(), ref: { service: 'community' } }], next_cursor: null } : {}, ${signed ? "{ viewer: { can_post: true } }" : '{}'}));
    if (s.startsWith('https://openvibe.actor/api/v1/me/actor')) return J({ id: 'act_1', name: 'Juniper', enabled: true, status: 'working', now: { current_step: 'Reading job posts' }, asks: [] });
    if (s.startsWith('https://')) return J({}, false, 404);
    return realFetch(u, o);
  };
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} OpenVibeNavbar.init({ service: 'site', user: ${signed ? "{ id: 'u1', username: 'ada', display_name: 'Ada' }" : 'null'}, token: ${signed ? "'tok-1'" : 'null'}, links: [{ label: 'Rooms', href: '/rooms' }], countViews: false, notifications: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[1].endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(u.searchParams.has('signed')));
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-feed-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.tools*', '*jsdelivr*', '*openvibe.media*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the navbar is up');
        await p.evaluate(`document.getElementById('openvibe-burger').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open [data-tab="feed"]')`), 'the menu opened');
        await p.evaluate(`document.querySelector('.ovs [data-tab="feed"]').click(), true`);
        assert.ok(await until(p, `document.querySelectorAll('.ovf-list > a').length >= 12`), 'the feed painted');
        const first = await p.evaluate(`({ chips: [...document.querySelectorAll('.ovf-chip')].map((b) => b.textContent), selected: (document.querySelector('.ovf-chip[aria-selected=true]') || {}).textContent,
            kinds: [...new Set([...document.querySelectorAll('.ovf-list > a')].map((a) => a.className))], live: !!document.querySelector('.ovf-livechip'), media: document.querySelectorAll('.ovf-media img').length,
            bolds: document.querySelectorAll('.ovf-list b b').length, posts: [...document.querySelectorAll('.ovf-post .ovf-title')].map((b) => b.textContent)[0],
            sections: [...document.querySelectorAll('.ovs-group')].map((g) => g.textContent.trim()).filter(Boolean), scroll: document.documentElement.scrollWidth })`);
        assert.deepStrictEqual(first.chips, ['For you', 'Live', 'Clips', 'Videos', 'Pics', 'Posts', 'Memes', 'Games', 'Updates']);
        assert.strictEqual(first.selected, 'For you');
        assert.ok(first.kinds.includes('ovf-card ovf-live') && first.kinds.includes('ovf-update') && first.kinds.includes('ovf-card ovf-pic'), `cards by kind (${first.kinds})`);
        assert.ok(first.live, 'a live card says LIVE');
        assert.ok(first.media >= 6, 'media cards show their picture');
        assert.strictEqual(first.bolds, 0, 'what people wrote is text');
        assert.ok(/^<b>bold<\/b> post/.test(first.posts), 'the markup shows as words');
        assert.ok(!first.sections.some((t) => /New to you|Next from|What's new/.test(t)), `the Feed tab is the stream when the feed answers (${first.sections})`);
        assert.ok(first.scroll <= 390, 'no sideways scroll');
        await p.evaluate(`(() => { const l = document.querySelector('.ovs-list'); l.scrollTop = l.scrollHeight; })()`);
        assert.ok(await until(p, `document.querySelectorAll('.ovf-list > a').length >= 24`), 'the next page loads as the end comes near');
        assert.ok(await until(p, `!!document.querySelector('.ovf-caught')`), 'the end says so');
        await p.evaluate(`[...document.querySelectorAll('.ovf-chip')].find((b) => b.textContent === 'Clips').click(), true`);
        assert.ok(await until(p, `(window.__feedCalls || []).some((u) => u.includes('kind=clip'))`), 'the chip asks for its kind');
        assert.ok(await until(p, `[...document.querySelectorAll('.ovf-list > a')].every((a) => a.className === 'ovf-card ovf-clip') && document.querySelectorAll('.ovf-list > a').length === 12`), 'only clips, from the first page');
        console.log('menu-feed-v2-chrome: chips, cards by kind, text only, the next page, caught up, a chip by kind, the stream alone ok');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
