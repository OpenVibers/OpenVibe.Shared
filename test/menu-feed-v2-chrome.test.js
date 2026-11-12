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
    if (s.startsWith('https://openvibe.network/api/frame/feed')) { window.__feedCalls = (window.__feedCalls || []).concat([s]); const u = new URL(s); const kind = u.searchParams.get('kind') || ''; const page = u.searchParams.get('cursor') ? 2 : 1;
      const mk = (i, k) => ({ id: k + i + '-' + page, kind: k, live_now: k === 'live', url: 'https://openvibe.video/c/' + i, title: (k === 'post' ? '<b>bold</b> ' : '') + k + ' ' + i + ' page ' + page, text: 'words', at: new Date(Date.now() - i * 60000).toISOString(), site: k === 'pic' ? 'pics' : 'video', site_name: 'Video', actor: { name: 'ada' }, media: k === 'post' || k === 'update' ? {} : { thumb: 'https://openvibe.media/t/x.webp', ratio: 1.7778, length: '0:30' }, counts: { views: 1200, likes: 3 } });
      if (kind === 'event') { const at = (h) => new Date(Date.now() - h * 3600e3).toISOString(); const y = new Date(Date.now() - 86400e3); y.setHours(12, 0, 0, 0);
        return J({ items: [
          { id: 'r', kind: 'report', url: 'https://openvibe.report/network', title: 'Peak today: 1,204 people online at 9 PM', text: 'Online peak across the network', at: at(0.03), site: 'report', site_name: 'Report', actor: null, subject: null, media: null, counts: { people: 1204 }, trend: { direction: 'up', pct: 12, previous: 1075 }, label: 'System' },
          { id: 'j', kind: 'work', url: 'https://openvibe.work/jobs', title: '14 new jobs this hour', text: 'Remote: GIS engineer, and more', at: at(0.04), site: 'work', site_name: 'Work', actor: null, subject: null, media: null, counts: { people: 14 }, group: { count: 14, items: [{ id: 'j1', url: 'https://openvibe.work/j/1', title: 'GIS engineer', media: null }, { id: 'j2', url: 'https://openvibe.work/j/2', title: 'Product manager', media: { thumb: 'https://openvibe.media/t/j2.jpg' } }, { id: 'j3', url: 'https://openvibe.work/j/3', title: 'Infra lead', media: null }, { id: 'j4', url: 'https://openvibe.work/j/4', title: 'Designer', media: null }] } },
          { id: 'v', kind: 'poll', url: 'https://openvibe.community/forum/status/poll', title: 'Which feed kind do you open first?', text: 'A poll', at: at(0.05), site: 'community', site_name: 'Community', actor: { name: 'Alex', avatar: null }, subject: 'usr_01JQ8Z6K6M0V8Y2Q3R4S5T6V7W', media: null, counts: { people: 41 } },
          { id: 'rd', kind: 'rundown', url: 'https://openvibe.live/rundown/e/3005', title: 'Rundown: The Case Against Smooth Apologies', text: 'What the episode was about.', at: at(0.06), site: 'live', site_name: 'Live', actor: { name: 'Maticus', avatar: null }, subject: 'usr_01JQ8Z6K6M0V8Y2Q3R4S5T6V7W', media: null, counts: {} },
          { id: 'm', kind: 'member', url: 'https://openvibe.network/stats', title: '3 people joined today', text: '520 people on OpenVibe so far', at: at(0.01), site: 'network', site_name: 'Network', actor: null, media: null, counts: {} },
          { id: 'c', kind: 'chat', url: 'https://openvibe.chat/rooms/general', title: '#general: 15 messages this hour', text: '', at: at(0.02), site: 'chat', site_name: 'Chat', actor: null, media: null, counts: {} },
          { id: 'q', kind: 'quest', url: 'https://openvibe.quest/', title: 'Finished a quest: First Post', text: '', at: y.toISOString(), site: 'quest', site_name: 'Quest', actor: { name: 'Josh', avatar: null }, media: null, counts: {} },
          { id: 'e', kind: 'event', url: 'https://openvibe.today/e/1', title: 'Event: Launch party', text: 'Starts 2026-11-12 18:00 UTC', at: y.toISOString(), site: 'today', site_name: 'Today', actor: null, media: null, counts: {} },
          { id: 'w', kind: 'wiki', url: 'https://openvibe.wiki/openvibe/japanese-old-guy', title: 'Wiki: openvibe / japanese-old-guy', text: '', at: y.toISOString(), site: 'wiki', site_name: 'Wiki', actor: { name: '2fat', avatar: '' }, media: null, counts: {} },
        ], next_cursor: null }); }
      const kinds = kind ? [kind] : ['live', 'clip', 'pic', 'post', 'update'];
      return J({ items: Array.from({ length: 12 }, (_, i) => mk(i, kinds[i % kinds.length])), next_cursor: page === 1 ? 'c2' : null }); }
    if (s.startsWith('https://openvibe.network/api/frame/wall')) return J(Object.assign({}, ${JSON.stringify(PULSE)}, s.includes('after=c2') ? { items: [{ title: 'An older post', url: 'https://openvibe.community/p/0', occurred_at: new Date(Date.now() - 86400e3).toISOString(), ref: { service: 'community' } }], next_cursor: null } : {}, ${signed ? "{ viewer: { can_post: true } }" : '{}'}));
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
        assert.ok(await until(p, `document.querySelectorAll('.ovfd-list > a').length >= 12`), 'the feed painted');
        const first = await p.evaluate(`({ chips: [...document.querySelectorAll('.ovfd-chip')].map((b) => b.textContent), selected: (document.querySelector('.ovfd-chip[aria-selected=true]') || {}).textContent,
            kinds: [...new Set([...document.querySelectorAll('.ovfd-list > a')].map((a) => a.className))], live: !!document.querySelector('.ovfd-livechip'), media: document.querySelectorAll('.ovfd-media img').length,
            bolds: document.querySelectorAll('.ovfd-list b b').length, posts: [...document.querySelectorAll('.ovfd-k-post .ovfd-title')].map((b) => b.textContent)[0],
            sections: [...document.querySelectorAll('.ovs-group')].map((g) => g.textContent.trim()).filter(Boolean), scroll: document.documentElement.scrollWidth })`);
        assert.deepStrictEqual(first.chips, ['For you', 'Live', 'Videos', 'Clips', 'Pics', 'Posts', 'Memes', 'Games', 'Chat', 'Events', 'Wiki', 'Quests', 'Updates'], 'signed out: no Following chip');
        assert.strictEqual(first.selected, 'For you');
        assert.ok(first.kinds.some((c) => /\bovfd-k-live\b/.test(c)) && first.kinds.some((c) => /\bovfd-act\b/.test(c) && /\bovfd-k-update\b/.test(c)) && first.kinds.some((c) => /\bovfd-k-pic\b/.test(c)), `cards by kind (${first.kinds})`);
        assert.ok(first.live, 'a channel live now says LIVE (live_now)');
        assert.ok(first.media >= 6, 'media cards show their picture');
        assert.strictEqual(first.bolds, 0, 'what people wrote is text');
        assert.ok(/^<b>bold<\/b> post/.test(first.posts), 'the markup shows as words');
        assert.ok(!first.sections.some((t) => /New to you|Next from|What's new/.test(t)), `the Feed tab is the stream when the feed answers (${first.sections})`);
        assert.ok(first.scroll <= 390, 'no sideways scroll');
        await p.evaluate(`(() => { const l = document.querySelector('.ovs-list'); l.scrollTop = l.scrollHeight; })()`);
        assert.ok(await until(p, `document.querySelectorAll('.ovfd-list > a').length >= 24`), 'the next page loads as the end comes near');
        assert.ok(await until(p, `!!document.querySelector('.ovfd-caught')`), 'the end says so');
        await p.evaluate(`[...document.querySelectorAll('.ovfd-chip')].find((b) => b.textContent === 'Clips').click(), true`);
        assert.ok(await until(p, `(window.__feedCalls || []).some((u) => u.includes('kind=clip'))`), 'the chip asks for its kind');
        assert.ok(await until(p, `[...document.querySelectorAll('.ovfd-list > a')].every((a) => a.className === 'ovfd-card ovfd-k-clip') && document.querySelectorAll('.ovfd-list > a').length === 12`), 'only clips, from the first page');
        await p.evaluate(`[...document.querySelectorAll('.ovfd-chip')].find((b) => b.textContent === 'Events').click(), true`);
        assert.ok(await until(p, `document.querySelectorAll('.ovfd-act').length === 5`), 'every activity kind is one row');
        const acts = await p.evaluate(`({ titles: [...document.querySelectorAll('.ovfd-act-txt > b')].map((b) => b.textContent), days: [...document.querySelectorAll('.ovfd-day')].map((d) => d.textContent),
            plus: (document.querySelector('.ovfd-tile-num b') || {}).textContent, date: (document.querySelector('.ovfd-tile-date') || {}).textContent || '', badge: !!document.querySelector('.ovfd-badge svg'),
            selfImages: [...document.querySelectorAll('.ovfd-list img')].filter((i) => !i.getAttribute('src') || i.src === location.href).length })`);
        assert.deepStrictEqual(acts.titles, ['3 people joined today', '#general is busy', 'First Post', 'Launch party', 'Japanese old guy'], `rows say what happened (${acts.titles})`);
        assert.deepStrictEqual(acts.days, ['Today', 'Yesterday'], 'a day line where the day changes');
        assert.strictEqual(acts.plus, '+3', 'people joined: the count on the tile');
        assert.ok(/^Nov1[12]$/.test(acts.date), `an event with a start: the date tile (${acts.date})`);
        assert.ok(acts.badge, 'a quest: the trophy on the face');
        assert.strictEqual(acts.selfImages, 0, 'no picture means no image (an empty address drew the page itself)');
        // 4.226.0, the one feed's new kinds (feed.item@1): a report is its number with its trend; a folded run lists its
        // first three; what counts.people means is said; the Rundown is about its actor (its subject is an id).
        const kinds = await p.evaluate(`(() => { const q = (s) => document.querySelector(s);
            return { stat: (q('.ovfd-k-report .ovfd-stat-n') || {}).textContent, trend: (q('.ovfd-k-report .ovfd-trend') || {}).textContent, was: (q('.ovfd-k-report .ovfd-stat-was') || {}).textContent,
                up: !!q('.ovfd-k-report .ovfd-trend.is-up'), group: [...document.querySelectorAll('.ovfd-k-work .ovfd-group-i')].map((r) => r.textContent), more: (q('.ovfd-k-work .ovfd-group-more') || {}).textContent,
                groupImgs: document.querySelectorAll('.ovfd-k-work .ovfd-group-i img').length, jobs: (q('.ovfd-k-work .ovfd-counts') || {}).textContent, voted: (q('.ovfd-k-poll .ovfd-counts') || {}).textContent,
                about: (q('.ovfd-k-rundown .ovfd-who small') || {}).textContent || '' }; })()`);
        assert.deepStrictEqual([kinds.stat, kinds.trend, kinds.was, kinds.up], ['1,204', '▲ 12%', 'was 1,075', true], 'a report: its number, which way it moved, and from what');
        assert.deepStrictEqual(kinds.group, ['GIS engineer', 'Product manager', 'Infra lead'], 'a folded run: its first three');
        assert.deepStrictEqual([kinds.more, kinds.groupImgs], ['and 11 more', 1], 'and how many more; a picture where there is one');
        assert.strictEqual(kinds.jobs, '14 jobs', 'what the count means for jobs');
        assert.strictEqual(kinds.voted, '41 voted', 'and for a poll');
        assert.match(kinds.about, /about Maticus/, `the Rundown is about its actor (${kinds.about})`);
        if (process.env.OV_CAPTURE_FEED) { await p.evaluate(`document.querySelector('.ovfd-k-report').scrollIntoView({ block: 'start' }), true`); await new Promise((r) => setTimeout(r, 400)); const shot = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.OV_CAPTURE_FEED, Buffer.from(shot.data, 'base64')); }
        console.log('menu-feed-v2-chrome: chips, cards by kind, text only, the next page, caught up, a chip by kind, the stream alone, activity rows and day lines ok');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
