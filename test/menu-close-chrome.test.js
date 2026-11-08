'use strict';
// The menu on a phone has a close button (the owner, 11-07: "This needs a close button"). The menu covers the whole
// screen, the navbar's burger too, so a round x sits at the end of the search pill: a 40 px button with a 48 px hit
// area, named for a screen reader, and a tap closes the menu. On a wide screen the button keeps its word, Close.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-close-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rooms · OpenVibe.Chat</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><p>Rooms</p></main>
<script src="/navbar.js"></script>
<script>
  window.__realFetch = window.fetch;
  window.fetch = async (u, init) => {
    const url = new URL(String(u), location.href);
    if (url.hostname !== location.hostname) return new Response('{}', { status: 404 });
    return window.__realFetch(u, init);
  };
  OpenVibeNavbar.init({ service: 'chat', user: null, links: [{ label: 'Rooms', href: '/rooms', icon: 'fa-people-group' }, { label: 'Servers', href: '/servers', icon: 'fa-server' }],
    search: { label: 'OpenVibe.Chat', page: '/search' } });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const name = u.pathname.slice(1);
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); res.end();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// A phone: the menu's close is the orb in the button's place (4.150.0); a wide screen: the word Close.
const BUTTON = `(() => { const b = innerWidth <= 640 ? document.querySelector('.ovs.is-open .ovs-orb') : document.querySelector('.ovs.is-open .ovs-x'); if (!b) return null; const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    const svg = b.querySelector('svg'); const word = b.querySelector('span');
    return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0, w: Math.round(r.width), h: Math.round(r.height), right: r.right, top: r.top,
        vw: document.documentElement.clientWidth, label: b.getAttribute('aria-label'), icon: !!svg && getComputedStyle(svg).display !== 'none',
        word: !!word && getComputedStyle(word).display !== 'none' }; })()`;

async function openMenu(p) {
    await p.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })); 1');
    for (let i = 0; i < 50 && !(await p.evaluate('!!document.querySelector(".ovs.is-open .ovs-input")')); i++) await wait(100);
    await wait(450);   // the phone's reveal animation
}

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-menu-close-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(200);
        await openMenu(p);
        const x = await p.evaluate(BUTTON);
        assert.ok(x && x.shown, 'the close button shows on a phone');
        assert.strictEqual(x.vw, 390, 'a phone layout');
        assert.ok(x.w >= 40 && x.h >= 40 && x.right <= x.vw && x.top >= 0, `a 40 px target on screen: ${JSON.stringify(x)}`);
        assert.deepStrictEqual([x.label, x.icon, x.word], ['Close the menu', true, false], 'the orb, named for a screen reader');
        assert.strictEqual(await p.evaluate(`(() => { const o = document.querySelector('.ovs.is-open .ovs-orb'); return o.classList.contains('is-x') && o.querySelectorAll('.ovo-d').length === 9; })()`), true, 'its nine dots have turned into an x');
        assert.strictEqual(await p.evaluate(`getComputedStyle(document.querySelector('.ovs.is-open .ovs-x')).display`), 'none', 'one close: the round x steps aside for the orb');
        const hit = await p.evaluate(`(() => { const b = document.querySelector('.ovs.is-open .ovs-orb').getBoundingClientRect(); const e = document.elementFromPoint(b.left - 2, b.top + b.height / 2); return !!e && !!e.closest('.ovs-orb'); })()`);
        assert.ok(hit, 'the hit area reaches past the circle');
        await p.evaluate('document.querySelector(".ovs.is-open .ovs-orb").click(); 1');
        await wait(450);   // the menu folds back into the orb
        assert.strictEqual(await p.evaluate('!!document.querySelector(".ovs.is-open")'), false, 'a tap closes the menu');

        const wide = await h.openPage(browser, context, { width: 1280, height: 900 });
        await wide.goto(`${base}/`, { maxMs: 5000 });
        await wait(200);
        await openMenu(wide);
        const d = await wide.evaluate(BUTTON);
        assert.ok(d && d.shown && d.word && !d.icon, `a wide screen keeps the word Close: ${JSON.stringify(d)}`);
        console.log('menu-close-chrome: a phone has a round close button (40 px, 48 px hit area) that closes the menu; wide screens keep Close');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
