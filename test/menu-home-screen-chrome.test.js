'use strict';
// The menu's You and Feed tabs, redone (plan 2026-11-09, ov-home.js), in a real headless Chrome:
//   You: the home grid of the most popular places until the person arranges it, the Tools and Build folders; a
//   long-press starts Edit and the same press drags an app to a new place; in Edit the arrow keys move the focused
//   app and − takes it off Home; All apps (N) puts it back with +; the Tools folder shows tools with their own icons
//   and the count of all; the arrangement is kept on the device and sent to Network (PUT /api/v1/me/home-screen);
//   signed in, the Actor strip is on top (or the invitation) and Recent shows the last places opened.
//   Feed: today's numbers when Network answers, the wall from Community's pulse with back-to-back "went live" items in
//   one row of names, Show more when there is more, and the composer only when Community says the person can post.
//   Nothing runs off a 390 px screen. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-home-screen-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

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
    if (s === 'https://openvibe.network/api/frame/attachments') return J({ attachment: { media_id: 'med_01ABCDEFGHJKMNPQRSTVWXYZ0' + (window.__calls.filter((c) => c.u === s).length) } }, true, 201);
    if (s === 'https://openvibe.network/api/frame/posts') return J({ id: 7 }, true, 201);
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-home-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    const openTab = async (p, which) => {
        await p.evaluate(`(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open [data-tab="${which}"]')`), 'the menu opened');
        await p.evaluate(`document.querySelector('.ovs [data-tab="${which}"]').click(), true`);
    };
    const order = (p) => p.evaluate(`[...document.querySelectorAll('.ovh-grid:not(.ovh-recent) .ovh-app')].map((a) => a.getAttribute('data-id'))`);
    const center = (p, sel) => p.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    try {
        const context = await browser.newContext();
        const blocked = ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'];

        // ── Signed out: the most popular places, the folders, edit, drag, keys, remove and put back.
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: blocked });
        await p.goto(`${base}/`, { maxMs: 6000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the navbar is up');
        await openTab(p, 'you');
        assert.ok(await until(p, `document.querySelectorAll('.ovh-grid .ovh-app').length >= 12`), 'the home grid painted');
        const first = await order(p);
        assert.strictEqual(first.length, 13, `thirteen on Home by default (${first})`);
        assert.deepStrictEqual(first.slice(-3), ['folder:g-play', 'folder:build', 'folder:tools'], 'the final group, Build and Quick tools folders stay at the end');
        assert.ok(!first.includes('ai') && !first.includes('run'), 'developer services wait in the Build folder');
        assert.strictEqual(await p.evaluate(`(document.querySelector('.ovh-sec span') || {}).textContent`), 'Popular on OpenVibe', 'until arranged, it says what it is');
        assert.notStrictEqual(await p.evaluate(`document.querySelector('.ovs [data-tab="here"]').textContent`), 'Home', 'a page titled Home never names the first tab');
        assert.ok(await p.evaluate(`!document.querySelector('[data-sec="recent"]') && ![...document.querySelectorAll('.ovs-group')].some((g) => /Recent searches/.test(g.textContent))`), 'no Recent searches');
        assert.ok(await p.evaluate(`(() => { const b = document.querySelector('.ovh-headtools .ovh-allbtn'); return !!b && /All apps \\(\\d+\\)/.test(b.getAttribute('aria-label')) && /^All\\d+$/.test(b.textContent.replace(/\\s/g, '')) && b.getBoundingClientRect().width < 120; })()`), 'All apps is a small button beside Edit, and says how many');
        assert.ok(await p.evaluate(`!document.querySelector('.ovh-actor')`), 'signed out: no Actor strip');

        // A long-press starts Edit, and the same press drags the first app onto the third's place.
        await wait(400);   // the menu's opening animation and the catalogue's repaint are over before measuring
        const a0 = await center(p, `.ovh-grid .ovh-app[data-id="${first[0]}"]`);
        const a2 = await center(p, `.ovh-grid .ovh-app[data-id="${first[2]}"]`);
        await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x, y: a0.y });
        await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a0.x, y: a0.y, button: 'left', clickCount: 1 });
        await wait(650);
        assert.ok(await p.evaluate(`!!document.querySelector('.ovh.is-edit')`), 'a long-press starts Edit');
        for (let k = 1; k <= 6; k++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x + ((a2.x - a0.x) * k) / 6, y: a0.y + ((a2.y - a0.y) * k) / 6, button: 'left' }); await wait(40); }
        await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a2.x, y: a2.y, button: 'left', clickCount: 1 });
        await wait(450);   // a person's pause after a drop (a tap within 300 ms of it is taken as part of the drag)
        const dragged = await order(p);
        assert.strictEqual(dragged.indexOf(first[0]), 2, `the app moved to where it was dropped (${dragged})`);
        assert.ok(await p.evaluate(`location.pathname === '/'`), 'the long-press did not open the app');
        const stored = await p.evaluate(`JSON.parse(localStorage.getItem('ovs-home')).home`);
        assert.deepStrictEqual(stored, dragged, 'the arrangement is kept on the device');
        assert.strictEqual(await p.evaluate(`(document.querySelector('.ovh-sec span') || {}).textContent`), 'Your home', 'once arranged it is yours');

        // Keys: the focused app moves; Delete takes it off Home.
        await p.evaluate(`document.querySelector('.ovh-grid .ovh-app[data-id="${dragged[0]}"]').focus(), true`);
        await p.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })), true`);
        const keyed = await order(p);
        assert.strictEqual(keyed.indexOf(dragged[0]), 1, 'ArrowRight moves the focused app one later');
        assert.strictEqual(await p.evaluate(`document.activeElement && document.activeElement.getAttribute('data-id')`), dragged[0], 'and it keeps the focus');
        await p.evaluate(`document.querySelector('.ovh-grid .ovh-app[data-id="${keyed[0]}"] .ovh-badge').click(), true`);
        const removed = await order(p);
        assert.ok(!removed.includes(keyed[0]) && removed.length === 12, '− takes it off Home');
        // Done, then All apps puts it back.
        await p.evaluate(`[...document.querySelectorAll('.ovh-sec button')].find((b) => b.textContent === 'Done').click(), true`);
        await p.evaluate(`document.querySelector('.ovh-allbtn').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovh-filter')`), 'the drawer opened');
        await p.evaluate(`document.querySelector('.ovh-grid .ovh-app[data-id="${keyed[0]}"] .ovh-badge.is-add').click(), true`);
        await p.evaluate(`document.querySelector('.ovh-back').click(), true`);
        assert.ok((await order(p)).includes(keyed[0]), 'All apps put it back on Home');

        // The Tools folder: tools with their own icons, and the count of all.
        await p.evaluate(`document.querySelector('.ovh-grid .ovh-app[data-id="folder:tools"]').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovh-head b') && document.querySelector('.ovh-head b').textContent === 'Quick tools'`), 'the folder opened');
        const folder = await p.evaluate(`({ n: document.querySelectorAll('.ovh-grid .ovh-app').length, icons: [...document.querySelectorAll('.ovh-grid .ovh-app .ov-icon')].slice(0, 4).map((i) => i.getAttribute('data-icon')), more: (document.querySelector('a.ovh-all') || {}).textContent })`);
        assert.strictEqual(folder.n, 24, 'the folder shows two dozen tools');
        assert.deepStrictEqual(folder.icons, ['pdf', 'image', 'qr', 'audio'], 'each tool wears its own icon');
        assert.strictEqual(folder.more, 'All 30 tools →', 'and says how many there are in all');
        assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= 390`), 'no sideways scroll on You');

        // ── Feed, signed out: today, the wall, went live in one row, text only, Show more; no composer.
        await p.evaluate(`document.querySelector('.ovs [data-tab="feed"]').click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovh-wall .ovh-entry')`), 'the wall painted');
        const wall = await p.evaluate(`({ today: [...document.querySelectorAll('.ovh-stat b')].map((b) => b.textContent), lives: [...document.querySelectorAll('.ovh-lives a')].map((a) => a.textContent),
            entries: [...document.querySelectorAll('.ovh-wall .ovh-entry-txt b')].map((b) => b.textContent), imgs: document.querySelectorAll('.ovh-wall img').length, pwned: !!window.pwned,
            compose: !!document.querySelector('.ovh-compose'), more: !document.querySelector('.ovh-all[hidden]') && !!document.querySelector('[data-sec="wall"] .ovh-all') })`);
        assert.deepStrictEqual(wall.today, ['1,204', '37', '210', '12'], 'today on OpenVibe');
        assert.deepStrictEqual(wall.lives, ['ada', 'bo'], 'back-to-back went live is one row of names');
        assert.strictEqual(wall.entries[0], 'Went live recently');
        assert.ok(wall.entries.includes('<img src=x onerror="window.pwned=1"> a post') && wall.imgs === 0 && !wall.pwned, 'what people wrote is text');
        assert.strictEqual(wall.compose, false, 'signed out: no composer');
        assert.ok(wall.more, 'Show more when there is more');
        await p.evaluate(`document.querySelector('[data-sec="wall"] .ovh-all').click(), true`);
        assert.ok(await until(p, `[...document.querySelectorAll('.ovh-wall .ovh-entry-txt b')].some((b) => b.textContent === 'An older post')`), 'Show more adds the next page');
        const news = await p.evaluate(`({ head: ([...document.querySelectorAll('.ovs-group')].find((g) => /What's new/.test(g.textContent)) || {}).textContent || '',
            rows: [...document.querySelectorAll('.ovs-item[data-sec="news"]')].map((r) => [r.querySelector('.ovs-title').firstChild.textContent, (r.querySelector('.ovs-meta') || {}).textContent, (r.querySelector('.ovs-snip') || {}).textContent]) })`);
        assert.match(news.head, /What's new \(2 today\)/, 'the recently updated stay on the Feed, counted (library bumps left out)');
        assert.deepStrictEqual(news.rows[0], ['Live', 'Updated 1 h ago · Big update', 'Go live from a phone: the Dock no longer covers the button'], 'each says what changed, when, and a big one says so');
        assert.deepStrictEqual(news.rows[1], ['Video', 'Updated 2 h ago', 'Clips play from where you left off']);
        assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= 390`), 'no sideways scroll on Feed');
        await p.close();

        // ── Signed in: the Actor strip, Recent, the composer, and the arrangement goes to Network.
        const s = await h.openPage(browser, context, { width: 390, height: 844, block: blocked });
        await s.goto(`${base}/?signed=1`, { maxMs: 6000 });
        assert.ok(await until(s, `!!document.getElementById('openvibe-burger')`), 'the navbar is up');
        await openTab(s, 'you');
        assert.ok(await until(s, `!!document.querySelector('.ovh-actor')`), 'the Actor strip is on top');
        assert.match(await s.evaluate(`document.querySelector('.ovh-actor').textContent`), /Juniper.*Working.*Reading job posts/, 'it names the Actor, its state and its step');
        // You on top: the name, Display (the Look panel) and Settings beside it; then your home, Most used and Jump back in.
        // 4.195.0 (the owner, the old block crossed out: "get rid of this thing … we didn't really need [it] here, other than
        // like adding your account"): one slim row of its own, and the old account block is not set in the menu at all.
        assert.strictEqual(await s.evaluate(`document.querySelector('.ovh-me .ovh-who-txt b').textContent`), 'Ada', 'your name on top');
        assert.ok(await s.evaluate(`!document.querySelector('.ovs .ovh-account, .ovs .openvibe-navbar-dropdown, .ovs .ud-grid')`), 'the old account block and its grid of tiles are not in the menu');
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-me > .ovh-ib')].map((b) => b.getAttribute('aria-label'))`), ['Add or switch account', 'Display: theme, text size, motion', 'Account and settings', 'Sign out'], 'add or switch account, Display, Settings, Sign out, in that order');
        assert.ok(await s.evaluate(`/[?&]add_account=1/.test(document.querySelector('.ovh-me > a.ovh-ib').getAttribute('href')) && !!document.querySelector('.ovh-me [data-ov-look-open]') && !!document.querySelector('.ovh-me a[href="https://openvibe.network/my"]')`), 'the add-account address is the bar\'s; Display and Settings are in the row');
        assert.ok(await s.evaluate(`!document.querySelector('.ovs-displayrow')`), 'Display is not at the foot any more');
        assert.ok(await until(s, `document.querySelectorAll('.ovh-rail .ovh-card').length === 2`), 'Jump back in shows the places opened lately');
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-rail .ovh-card')].map((a) => a.getAttribute('href'))`), ['https://openvibe.live/ada', 'https://openvibe.pics/1']);
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-use .ovh-key')].map((k) => k.textContent)`), ['Live5', 'Pics2'], 'Most used: pages opened per site');
        assert.strictEqual(await s.evaluate(`(document.querySelector('.ovh-sec a.ovh-link[href="https://openvibe.report/me"]') || {}).textContent`), 'Your stats', 'Most used links to your stats on Report');
        // The owner, 2026-11-10: "Your home should be above Jump back in… the thing at the top a little more compact… links
        // to whatever the user uses the most". Your home comes first, then what you use most, then where you were last;
        // the bar with your name is short; each most-used app is a way in (its icon, a full touch target), not a legend.
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-sec > span')].map((x) => x.textContent)`), ['Your home', 'Most used', 'Jump back in'], 'your home, then most used, then where you were');
        assert.ok(await s.evaluate(`document.querySelector('.ovh-me').getBoundingClientRect().height <= 64`), 'the row with your name is one short row');
        assert.ok(await s.evaluate(`[...document.querySelectorAll('.ovh-me > .ovh-ib')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.width >= 40; })`), 'and its buttons are full touch targets');
        assert.ok(await s.evaluate(`(() => { const m = document.querySelector('.ovh-me').getBoundingClientRect(); return m.right <= innerWidth && [...document.querySelectorAll('.ovh-me > *')].every((x) => x.getBoundingClientRect().right <= m.right + 1); })()`), 'all of it on the screen');
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-use .ovh-key')].map((k) => [k.getAttribute('href'), k.getAttribute('aria-label'), !!k.querySelector('.ovh-ic > *')].join('|'))`),
            ['https://openvibe.live/|Live, opened 5 times|true', 'https://openvibe.pics/|Pics, opened 2 times|true'], 'each most-used app is a link with its icon and says how often');
        assert.ok(await s.evaluate(`[...document.querySelectorAll('.ovh-use .ovh-key')].every((k) => { const r = k.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })`), 'each a full touch target');
        assert.strictEqual(await s.evaluate(`(document.querySelector('.ovh-rail').parentElement.querySelector('.ovh-sec small') || {}).textContent`), 'where you were last', 'Jump back in says what it is');
        assert.strictEqual(await s.evaluate(`(document.querySelector('.ovh-sec:not(:first-child) span, .ovh-grid:not(.ovh-recent)') && [...document.querySelectorAll('.ovh-sec span')].map((x) => x.textContent).find((x) => /home|Popular/i.test(x)))`), 'Your home', 'signed in, Home is theirs from the start');
        assert.deepStrictEqual(await s.evaluate(`[...document.querySelectorAll('.ovh-folder[data-id="folder:tools"] .ov-icon')].map((i) => i.getAttribute('data-icon'))`), ['pdf', 'image', 'qr', 'audio'], 'the Tools folder shows its tools\' own icons');
        await s.evaluate(`document.querySelector('.ovh-sec .ovh-edit').click(), true`);
        await s.evaluate(`(() => { const t = document.querySelector('.ovh-grid:not(.ovh-recent) .ovh-app'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); })()`);
        assert.ok(await until(s, `window.__calls.some((c) => c.m === 'PUT' && c.u.endsWith('/api/v1/me/home-screen') && c.auth === 'Bearer tok-1')`, 3000), 'the arrangement goes to Network with the bearer');
        await s.evaluate(`document.querySelector('.ovs [data-tab="feed"]').click(), true`);
        assert.ok(await until(s, `!!document.querySelector('.ovh-compose textarea')`), 'the composer shows when Community says you can post');
        assert.strictEqual(await s.evaluate(`document.querySelector('.ovh-compose textarea').placeholder`), "What's new, Ada?");
        // Pictures (11-09: "you can make posts and put images"): two picked, each must say what it shows, then each
        // uploads through Network and the post names them with that text.
        await s.evaluate(`(async () => {
            const ta = document.querySelector('.ovh-compose textarea'); ta.value = 'Golden hour'; ta.dispatchEvent(new Event('input'));
            const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30);
            const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
            const dt = new DataTransfer(); dt.items.add(new File([blob], 'a.png', { type: 'image/png' })); dt.items.add(new File([blob], 'b.png', { type: 'image/png' }));
            const input = document.querySelector('.ovh-compose input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change'));
        })(), true`);
        assert.ok(await until(s, `document.querySelectorAll('.ovh-pic img[src^="data:"]').length === 2`), 'two pictures, each with a preview');
        assert.ok(await s.evaluate(`document.querySelector('.ovh-post').disabled && document.querySelector('.ovh-compose-hint').textContent === 'Describe each picture'`), 'no post until each picture says what it shows');
        await s.evaluate(`[...document.querySelectorAll('.ovh-pic input')].forEach((x, i) => { x.value = ['A dark sky', 'The same sky'][i]; x.dispatchEvent(new Event('input')); }), true`);
        assert.ok(!(await s.evaluate(`document.querySelector('.ovh-post').disabled`)), 'described: Post is on');
        await s.evaluate(`document.querySelector('.ovh-post').click(), true`);
        assert.ok(await until(s, `/Posted/.test(document.querySelector('.ovh-compose ~ .ovh-note, .ovh-note').textContent)`), 'it posts');
        const sent = await s.evaluate(`window.__calls.filter((c) => c.u.endsWith('/api/frame/attachments') || c.u.endsWith('/api/frame/posts')).map((c) => ({ u: c.u.replace('https://openvibe.network/api/frame/', ''), auth: c.auth, body: typeof c.body === 'string' ? c.body : '' }))`);
        assert.deepStrictEqual(sent.map((c) => c.u), ['attachments', 'attachments', 'posts'], 'each picture, then the post');
        assert.ok(sent.every((c) => c.auth === 'Bearer tok-1'), 'with the person\'s token');
        assert.deepStrictEqual(JSON.parse(sent[2].body).pictures.map((x) => x.alt), ['A dark sky', 'The same sky']);
        // ── A phone's Dock opens out of the navbar's menu button, and that button is its close button (the owner,
        // 2026-11-10: "that close button should… fade and have an animation effect from the top right, the menu button
        // that already exists"). The close orb starts on the navbar's orb and settles into its x; the navbar's orb makes
        // the same move underneath; closing runs it back, then the sheet is gone. With motion off there is no move.
        await s.evaluate(`(document.querySelector('.ovs.is-open [data-close], .ovs-orb') || { click() {} }).click(), true`);
        await new Promise((ok) => setTimeout(ok, 700));
        assert.ok(await until(s, `!!(window.OpenVibeDock && window.OpenVibeDock.open)`), 'the Dock is loaded beside the navbar');
        const start = await s.evaluate(`(() => { const c = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
            const nav = [...document.querySelectorAll('.openvibe-navbar .ovnav-orb')].find((b) => b.getBoundingClientRect().width > 0);
            const before = c(nav.querySelector('svg'));
            window.OpenVibeDock.open({ tab: 'activity' });
            const dock = document.querySelector('.ovdk'), mine = dock.querySelector('.ovdk-orbx');
            return { before, at: c(mine.querySelector('svg')), fromOrb: dock.classList.contains('from-orb'), isFrom: mine.classList.contains('is-from') }; })()`);
        assert.ok(start.fromOrb && start.isFrom, 'the sheet opens from the orb');
        assert.ok(Math.abs(start.at[0] - start.before[0]) <= 1.5 && Math.abs(start.at[1] - start.before[1]) <= 1.5, `the close orb starts on the navbar's orb (${JSON.stringify(start)})`);
        await new Promise((ok) => setTimeout(ok, 900));
        const open = await s.evaluate(`(() => { const dock = document.querySelector('.ovdk'), mine = dock.querySelector('.ovdk-orbx'), sv = mine.querySelector('svg'), r = sv.getBoundingClientRect(), b = mine.getBoundingClientRect();
            return { settled: getComputedStyle(sv).transform === 'none' && !mine.classList.contains('is-from'), centred: Math.abs((r.left + r.width / 2) - (b.left + b.width / 2)) <= 1, navIsDock: !!document.querySelector('.openvibe-navbar .ovnav-orb.is-dock'), opacity: getComputedStyle(dock).opacity }; })()`);
        assert.ok(open.settled && open.centred, `it settles into its place in the header (${JSON.stringify(open)})`);
        assert.ok(open.navIsDock && open.opacity === '1', 'the navbar\'s orb made the same move underneath');
        const closing = await s.evaluate(`(() => { window.OpenVibeDock.close(); const dock = document.querySelector('.ovdk'); return { hidden: dock.hidden, out: dock.classList.contains('is-out'), back: dock.querySelector('.ovdk-orbx').classList.contains('is-from'), navIsDock: !!document.querySelector('.ovnav-orb.is-dock') }; })()`);
        assert.ok(!closing.hidden && closing.out && closing.back && !closing.navIsDock, `closing folds it back into the orb first (${JSON.stringify(closing)})`);
        assert.ok(await until(s, `document.querySelector('.ovdk').hidden`), 'then the sheet is gone');
        assert.ok(await s.evaluate(`!document.querySelector('.ovdk').classList.contains('from-orb') && !document.querySelector('.ovnav-orb.is-dock') && [...document.querySelectorAll('.openvibe-navbar .ovnav-orb')].every((b) => !b.style.transition)`), 'and the navbar\'s orb is as it was');
        const still = await s.evaluate(`(() => { document.documentElement.setAttribute('data-ov-motion', 'off'); window.OpenVibeDock.open({ tab: 'activity' }); const dock = document.querySelector('.ovdk'); const a = dock.classList.contains('from-orb'); window.OpenVibeDock.close(); const out = { fromOrb: a, hidden: dock.hidden }; document.documentElement.removeAttribute('data-ov-motion'); return out; })()`);
        assert.ok(!still.fromOrb && still.hidden, 'motion off: no move, and it closes at once');
        await s.close();
        console.log('menu-home-screen-chrome: home grid, long-press and drag, keys, remove and put back, folders with tool icons, the wall, today, the composer with pictures, Network sync ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
