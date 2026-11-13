'use strict';
// §Z.2 (11-13), the owner: navigation "aware of rank". The menu's You apps start with what the viewer's rank opens, read
// from the viewer model (OV.viewer()): the owner and admins get Admin (Network's panel, admins only), a global mod gets
// Moderation (Live's staff console, global_mod and up), a member gets neither. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const { eventually } = h;

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-viewer-places-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PEOPLE = {
    owner: { id: 1, subject_id: 'usr_01JZZZVIEWERTEST000000000', username: 'boss', role: 'admin', is_owner: true },
    mod: { id: 2, username: 'moddy', role: 'global_mod' },
    member: { id: 3, username: 'maya', role: 'user' },
};
const PAGE = (user) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rooms · OpenVibe.Chat</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><p>Rooms</p></main>
<script src="/navbar.js"></script>
<script>
  window.__realFetch = window.fetch;
  window.fetch = async (u, init) => {
    const url = new URL(String(u), location.href);
    if (url.hostname !== location.hostname) return new Response('{}', { status: 404 });
    return window.__realFetch(u, init);
  };
  OpenVibeNavbar.init({ service: 'chat', auth: 'external', token: 'tok', user: ${JSON.stringify(user)},
    links: [{ label: 'Rooms', href: '/rooms' }], search: { label: 'OpenVibe.Chat', page: '/search' } });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE(PEOPLE[u.searchParams.get('who')] || null)); }
    const name = u.pathname.slice(1);
    if (/^[a-z0-9-]+\.(js|css)$/.test(name) && fs.existsSync(path.join(ROOT, name))) {
        res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(fs.readFileSync(path.join(ROOT, name)));
    }
    res.writeHead(404); res.end();
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PLACES = `[...document.querySelectorAll('.ovs a, .ovs button')].map((a) => (a.textContent || '').trim()).filter((t) => t === 'Admin' || t === 'Moderation')`;
const HREF = (word) => `(() => { const a = [...document.querySelectorAll('.ovs a')].find((x) => (x.textContent || '').trim() === ${JSON.stringify(word)}); return a ? a.href : null; })()`;

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-menu-viewer-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const expect = { owner: ['Admin', 'https://openvibe.network/admin'], mod: ['Moderation', 'https://openvibe.live/admin'], member: null };
        const seen = [];
        await Object.keys(PEOPLE).reduce((prev, who) => prev.then(async () => {
            const p = await h.openPage(browser, context, { width: 390, height: 844 });
            await p.goto(`${base}/?who=${who}`, { maxMs: 5000 });
            await wait(300);
            await p.evaluate("OpenVibeNavbar.openMenu('you'); 1");
            const want = expect[who];
            if (want) {
                await eventually(async () => assert.deepStrictEqual([...new Set(await p.evaluate(PLACES))], [want[0]], `${who} sees ${want[0]}`));
                assert.strictEqual(await p.evaluate(HREF(want[0])), want[1], `${who}'s ${want[0]} opens ${want[1]}`);
            } else {
                // Absence is checked once the You apps are drawn (their own first), never after a fixed sleep.
                await eventually(async () => assert.ok(await p.evaluate("document.querySelectorAll('.ovs .ovh-app').length > 0"), 'the You apps are drawn'));
                assert.deepStrictEqual(await p.evaluate(PLACES), [], 'a member sees no staff place');
            }
            seen.push(`${who}: ${want ? want[0] : 'none'}`);
        }), Promise.resolve());
        console.log(`menu-viewer-places-chrome: ${seen.join('; ')}`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
