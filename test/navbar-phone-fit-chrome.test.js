'use strict';
// The navbar on a phone, signed in with balances (4.22.1), in a real headless Chrome. On openvibe.games the site's
// name was drawn under the launcher and the magnifier (the owner's screenshot, 2026-10-28): the right-hand group
// (magnifier, balances, bell, picture, menu) left the brand ~19px and the name did not clip. Now, from 320px to 430px:
// nothing in the bar overlaps or runs off the screen, the site's word reads whole from 360px, the folded balances
// show the first one, and a signed-in phone keeps the launcher in the menu. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('navbar-phone-fit-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = (signedIn) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Games · OpenVibe.Games</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><h1>Games</h1></main>
<script>
  localStorage.setItem('ov-wallet:42', JSON.stringify({ coins: 4100, vibes: 1250 }));
  window.fetch = async () => new Response('{}', { status: 404 });
</script>
<script src="/navbar.js"></script>
<script>
  OpenVibeNavbar.init({ service: 'games', brandName: 'OpenVibe.Games', wallet: true, ${signedIn ? "token: 'x', user: { id: 42, username: 'moosely', display_name: 'moosely', avatar_url: null }," : 'user: null,'}
    links: [{ label: 'Games', href: '/', icon: 'fa-gamepad' }, { label: 'Leaderboard', href: '/top', icon: 'fa-star' }] });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/in' || u.pathname === '/out') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE(u.pathname === '/in')); }
    const name = u.pathname.slice(1);
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

const MEASURE = `(() => {
    const bar = document.querySelector('.openvibe-navbar');
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; };
    const name = bar.querySelector('.openvibe-navbar-brand .name');
    const parts = [['name', name], ['launcher', bar.querySelector('.ovnav-launch')], ['search', bar.querySelector('#openvibe-search-btn')],
        ['balances', bar.querySelector('.ovnav-chip--all')], ['sign in', bar.querySelector('#openvibe-login-btn')],
        ['picture', bar.querySelector('#openvibe-avatar-btn')], ['menu', bar.querySelector('#openvibe-burger')]].filter(([, el]) => vis(el)).map(([k, el]) => [k, box(el)]);
    const minis = [...bar.querySelectorAll('.ovnav-chip--all .ovnav-chip-mini')].filter(vis).length;
    return { parts, clipped: name.scrollWidth > name.clientWidth + 1, visibleText: name.innerText, minis, width: innerWidth };
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-navfit-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        for (const width of [320, 360, 393, 412, 430]) {
            for (const who of ['in', 'out']) {
                const p = await h.openPage(browser, context, { width });
                await p.goto(`${base}/${who}`, { maxMs: 5000 });
                await wait(300);
                const v = await p.evaluate(MEASURE);
                const at = `${width}px signed ${who}`;
                for (let i = 1; i < v.parts.length; i++) {
                    const [a, ra] = v.parts[i - 1]; const [b, rb] = v.parts[i];
                    assert.ok(rb[0] >= ra[1] - 1, `${at}: ${a} ${JSON.stringify(ra)} runs into ${b} ${JSON.stringify(rb)}`);
                }
                const last = v.parts[v.parts.length - 1];
                assert.ok(last[1][1] <= width, `${at}: ${last[0]} runs off the screen`);
                if (width >= 360) assert.ok(!v.clipped && /Games/.test(v.visibleText), `${at}: the site's word reads whole (${v.visibleText})`);
                if (who === 'in') {
                    assert.strictEqual(v.minis, 1, `${at}: the folded balances show the first one`);
                    assert.ok(!v.parts.some(([k]) => k === 'launcher'), `${at}: a signed-in phone keeps the launcher in the menu`);
                } else if (width >= 375) {
                    assert.ok(v.parts.some(([k]) => k === 'launcher'), `${at}: signed out, the launcher stays by the name`);
                }
                await p.close();
            }
        }
        console.log('navbar-phone-fit-chrome: signed in or out, 320-430px, nothing overlaps; the name reads whole from 360px ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
