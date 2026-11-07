'use strict';
// Touch targets measured to a finger, in a real headless Chrome (4.107.2, the 11-03 re-audit of every site's home:
// tools/tap-audit.js). A target's effective size is the run of points around its centre that land on it
// (document.elementFromPoint), so an invisible ::after hit area counts and a neighbour that covers it does not.
// From 320px to 430px, signed in and out: Sign In and the OpenVibe menu's orb measure 44px or more each way, and the
// footer's brand 44px tall. The orb's extra width goes right, so the site's name keeps the taps on its own last
// letters, and nothing in the bar's right-hand group loses its own. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('tap-areas-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = (signedIn) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live · OpenVibe.Live</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main style="min-height:40px"><h1>Live</h1></main><footer id="footer-mount"></footer>
<script>
  localStorage.setItem('ov-wallet:42', JSON.stringify({ coins: 161000, vibes: 400 }));
  window.fetch = async () => new Response('{}', { status: 404 });
</script>
<script src="/navbar.js"></script><script src="/footer.js"></script>
<script>
  OpenVibeNavbar.init({ service: 'live', brandName: 'OpenVibe.Live', wallet: true, messages: { href: 'https://openvibe.chat/messages' }, ${signedIn ? "token: 'x', user: { id: 42, username: 'moosely', display_name: 'moosely', avatar_url: null }," : 'user: null,'}
    links: [{ label: 'Home', href: '/', icon: 'fa-house' }] });
  OpenVibeFooter.init({ service: 'live', mount: '#footer-mount', variant: 'full' });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/in' || u.pathname === '/out') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE(u.pathname === '/in')); }
    const name = u.pathname.slice(1);
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

// The effective size of a target: the longest run of points through its centre, 1px apart, that land on it.
const MEASURE = `(() => {
    const on = (el, x, y) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit)); };
    const size = (el) => {
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const run = (dx, dy) => { let a = 0, b = 0; while (a < 60 && on(el, cx - (a + 1) * dx, cy - (a + 1) * dy)) a++; while (b < 60 && on(el, cx + (b + 1) * dx, cy + (b + 1) * dy)) b++; return a + b + 1; };
        return { w: run(1, 0), h: run(0, 1), box: [Math.round(r.left), Math.round(r.right)] };
    };
    const bar = document.querySelector('.openvibe-navbar');
    scrollTo(0, 0);
    const name = bar.querySelector('.openvibe-navbar-brand .name');
    const nameLinks = [...name.querySelectorAll('a')];
    const lastLink = nameLinks[nameLinks.length - 1];
    const lr = lastLink.getBoundingClientRect();
    // At 320px the name is cut short (it reads whole from 360px): its last link ends where the name's box does.
    const edge = Math.min(lr.right, name.getBoundingClientRect().right);
    const nameKeepsItsEnd = on(lastLink, edge - 2, lr.top + lr.height / 2) || !on(bar.querySelector('.ovnav-orb'), edge - 2, lr.top + lr.height / 2);
    const right = bar.querySelector('.openvibe-navbar-right');
    const firstRight = right && [...right.querySelectorAll('a, button')].find((el) => el.getBoundingClientRect().width > 0);
    const fr = firstRight && firstRight.getBoundingClientRect();
    const rightKeepsItsStart = !firstRight || on(firstRight, fr.left + 2, fr.top + fr.height / 2);
    // The menu's way in on a phone is the burger when the bar has page links (4.137.0: the orb steps aside), else the orb.
    const orbEl = bar.querySelector('.ovnav-orb');
    const menuEl = orbEl && getComputedStyle(orbEl).display !== 'none' ? orbEl : bar.querySelector('#openvibe-burger');
    const out = { signIn: size(bar.querySelector('#openvibe-login-btn')), orb: size(menuEl), nameKeepsItsEnd, rightKeepsItsStart };
    out.flame = size(bar.querySelector('.flame'));
    out.tld = size(bar.querySelector('a.b-tld'));
    out.tldBox = bar.querySelector('a.b-tld').getBoundingClientRect().width;
    document.querySelectorAll('.ovf-fold').forEach((fold) => { fold.open = true; });
    out.footerLinks = [...document.querySelectorAll('.ovf-fold a')].map((el) => ({ ...size(el), height: el.getBoundingClientRect().height }));
    out.footerBrand = size(document.querySelector('.ovf-brand'));
    return out;
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-taps-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        for (const width of [320, 360, 390, 393, 430]) {
            for (const who of ['out', 'in']) {
                const p = await h.openPage(browser, context, { width, height: 800 });
                await p.goto(`${base}/${who}`, { maxMs: 5000 });
                await wait(300);
                const v = await p.evaluate(MEASURE);
                const at = `${width}px signed ${who}`;
                if (who === 'out') assert.ok(v.signIn && v.signIn.h >= 44 && v.signIn.w >= 44, `${at}: Sign In ${JSON.stringify(v.signIn)}`);
                assert.ok(v.orb && v.orb.w >= 44 && v.orb.h >= 44, `${at}: the menu button ${JSON.stringify(v.orb)}`);
                assert.ok(v.flame.w >= 44 && v.flame.h >= 44, `${at}: site switcher ${JSON.stringify(v.flame)}`);
                assert.ok(v.nameKeepsItsEnd, `${at}: the site's name keeps the taps on its last letters`);
                assert.ok(v.rightKeepsItsStart, `${at}: the right-hand group keeps its own first taps`);
                assert.ok(v.footerBrand && v.footerBrand.h >= 44, `${at}: the footer's brand ${JSON.stringify(v.footerBrand)}`);
                if (width === 390) {
                    assert.ok(v.tldBox >= 44 && v.tld.w >= 44, `${at}: TLD has its own 44px width ${JSON.stringify(v.tld)}`);
                    assert.ok(v.footerLinks.length > 0);
                    for (const link of v.footerLinks) assert.ok(link.height >= 44 && link.h >= 44, `${at}: footer link has its own 44px height ${JSON.stringify(link)}`);
                }
                await p.close();
            }
        }
        console.log('tap-areas-chrome: Sign In, the orb and the footer brand reach 44px; the name and the right group keep their taps ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
