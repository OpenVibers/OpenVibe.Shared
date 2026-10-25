'use strict';
// profile-panel.js in a real headless Chrome at phone width: [data-ov-profile] elements become a person's stuff from
// the Network's public profile JSON (worn items, counts, achievements by game, badges, links); every value is text
// (a name with markup stays text), only https links on OpenVibe's own hosts become hrefs, a private profile shows its
// name only, a missing one leaves the fallback link, "me" is whoever the site's /auth/me names (a hidden element shows
// once drawn), and nothing on the panel widens the page past the phone.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('profile-panel: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const ANA = {
    username: 'ana', display_name: 'Ana <img src=x onerror=alert(1)>', profile_url: 'https://openvibe.network/@ana', private: false,
    showcase: [
        { kind: 'live.hat', kind_name: 'Hat', name: 'Royal Crown', rarity: 'legendary', art: { emoji: '👑' }, url: 'https://inventory.openvibe.network/items/itd_1' },
        { kind: 'live.name_effect', kind_name: 'Name effect', name: 'Rainbow', rarity: 'epic', art: { emoji: '🌈' }, url: 'javascript:alert(1)' },
    ],
    items: { count: 12 }, inventory_url: 'https://inventory.openvibe.network/u/usr_1',
    badges: [{ id: 'first-follow', name: 'First Follow' }],
    achievements: { total: 3, games: [{ title: 'salvage-rush', name: 'Salvage Rush', count: 2, url: 'https://play.openvibe.network/t/salvage-rush', recent: [{ name: 'Big Haul' }] }, { title: 'x', name: 'Evil', count: 1, url: 'https://evil.example/t/x', recent: [] }] },
};
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/shared/profile-panel.css"></head>
<body style="margin:0;padding:16px"><div id="ana" data-ov-profile="ana"><a href="https://openvibe.network/@ana">Ana</a></div>
<div id="priv" data-ov-profile="hidden"><a href="https://openvibe.network/@hidden">Hidden</a></div>
<div id="none" data-ov-profile="nobody"><a href="https://openvibe.network/@nobody">Nobody</a></div>
<section id="me" data-ov-profile="me" hidden><a href="https://openvibe.network/my">Your stuff</a></section>
<script>window.OpenVibeProfilePanelConfig = { api: location.origin };</script>
<script src="/shared/profile-panel.js" defer></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (u.pathname === '/api/v1/profiles/ana') return json(200, { profile: ANA });
    // Signed in on the main page; signed out on /out (told apart by the page that asks).
    if (u.pathname === '/auth/me') return json(200, { user: /\/out$/.test(req.headers.referer || '') ? null : { id: 7, username: 'ana' } });
    if (u.pathname === '/out') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE.replace(/<div id="ana"[\s\S]*?<\/section>/, '<section id="me" data-ov-profile="me" hidden><a href="https://openvibe.network/my">Your stuff</a></section>')); }
    if (u.pathname === '/api/v1/profiles/hidden') return json(200, { profile: { username: 'hidden', display_name: 'Hidden', profile_url: 'https://openvibe.network/@hidden', private: true } });
    if (u.pathname.startsWith('/api/v1/profiles/')) return json(404, { error: 'not_found' });
    if (u.pathname.startsWith('/avatar/')) { res.writeHead(204); return res.end(); }
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': m[1].endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-profile-panel-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 360, height: 900 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        const got = JSON.parse(await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (document.querySelector('#ana .ovpp') && document.querySelector('#priv .ovpp') && document.querySelector('#me .ovpp')) { clearInterval(t); setTimeout(() => {
            const ana = document.querySelector('#ana .ovpp');
            r(JSON.stringify({
                name: ana.querySelector('.ovpp-who b').textContent,
                imgs: ana.querySelectorAll('img').length,
                stats: [...ana.querySelectorAll('.ovpp-stats li')].map((li) => li.textContent),
                worn: [...ana.querySelectorAll('.ovpp-wear a')].map((a) => [a.textContent, a.getAttribute('href')]),
                games: [...ana.querySelectorAll('.ovpp-ach a')].map((a) => [a.textContent, a.getAttribute('href')]),
                latest: ana.querySelector('.ovpp-latest') && ana.querySelector('.ovpp-latest').textContent,
                badges: [...ana.querySelectorAll('.ovpp-badges li')].map((li) => li.textContent),
                links: [...ana.querySelectorAll('.ovpp-links a')].map((a) => a.getAttribute('href')),
                priv: document.querySelector('#priv .ovpp').textContent,
                none: document.getElementById('none').innerHTML,
                wide: document.documentElement.scrollWidth,
                me: [document.getElementById('me').hidden, document.querySelector('#me .ovpp-who small').textContent],
            }));
        }, 100); } }, 30); })`));
        assert.strictEqual(got.name, 'Ana <img src=x onerror=alert(1)>', 'a name with markup stays text');
        assert.strictEqual(got.imgs, 1, 'only the picture is an image (no injected img)');
        assert.deepStrictEqual(got.stats, ['12items', '1badges', '3achievements', '2games']);
        assert.deepStrictEqual(got.worn, [['👑Royal Crown', 'https://inventory.openvibe.network/items/itd_1'], ['🌈Rainbow', null]], 'a javascript: link never becomes an href');
        assert.deepStrictEqual(got.games, [['Salvage Rush', 'https://play.openvibe.network/t/salvage-rush'], ['Evil', null]], 'only OpenVibe hosts are linked');
        assert.strictEqual(got.latest, '🏆 Big Haul');
        assert.deepStrictEqual(got.badges, ['🏅 First Follow']);
        assert.deepStrictEqual(got.links, ['https://openvibe.network/@ana', 'https://inventory.openvibe.network/u/usr_1']);
        assert.match(got.priv, /Hidden[\s\S]*This profile is private\./);
        assert.match(got.none, /href="https:\/\/openvibe\.network\/@nobody"/, 'no profile: the fallback link stays');
        assert.ok(got.wide <= 360, `fits a 360 px phone (${got.wide})`);
        assert.deepStrictEqual(got.me, [false, '@ana'], '"me" is whoever /auth/me names, shown once drawn');
        await p.goto(`${base}/out`, { maxMs: 5000 });
        const out = await p.evaluate(`new Promise((r) => setTimeout(() => r(JSON.stringify([document.getElementById('me').hidden, !!document.querySelector('#me .ovpp')])), 700))`);
        assert.deepStrictEqual(JSON.parse(out), [true, false], 'signed out: "me" stays hidden and undrawn');
        console.log('profile-panel: ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
