'use strict';
// A guest sees what signing in adds (plan §Z.2, 4.247.0): the menu's You opens with one card that says it in four
// lines and a Sign in button whose link is the bar's own (it knows this host's sign-in), at 390 px with no sideways
// scroll; a signed-in person never sees it. A real headless Chrome; skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-guest-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const FRAME = { nav: [{ id: 'chat', name: 'Chat', url: 'https://openvibe.chat/', icon: 'chat', group: 'talk' }], groups: [{ id: 'talk', name: 'Talk' }], soon: [], footer: {} };
const PAGE = (user) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guest</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame?') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : String(u).startsWith('https://') ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : realFetch(u, o));
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: ${JSON.stringify(user)}, token: ${user ? "'tok'" : 'null'}, loginUrl: '/auth/login?next={url}', links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.(js|css))$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': m[2] === 'css' ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE(u.pathname === '/in' ? { id: 1, username: 'kim', display_name: 'Kim' } : null));
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-guest-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    const openYou = async (p) => {
        assert.ok(await until(p, `!!(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn'))`), 'the menu button is there');
        await p.evaluate(`(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open')`), 'the menu opened');
        await p.evaluate(`(() => { const t = document.querySelector('.ovs [data-tab="you"]'); if (t) t.click(); return true; })()`);
        assert.ok(await until(p, `!!document.querySelector('.ovs [data-sec]')`), 'You has drawn its sections');
    };
    try {
        let p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await openYou(p);
        const seen = await until(p, `!!document.querySelector('.ovs [data-sec="signin"] .ovs-guest')`);
        if (!seen) console.log('DEBUG', await p.evaluate(`JSON.stringify({ tabs: [...document.querySelectorAll('.ovs [data-tab]')].map((t) => t.getAttribute('data-tab') + (t.getAttribute('aria-selected') === 'true' ? '*' : '')), secs: [...document.querySelectorAll('.ovs [data-sec]')].map((x) => x.getAttribute('data-sec')), login: !!document.getElementById('openvibe-login-btn') })`));
        assert.ok(seen, 'a guest sees the card');
        const card = await p.evaluate(`(() => { const c = document.querySelector('.ovs [data-sec="signin"] .ovs-guest'); return { head: c.querySelector('b').textContent, lines: [...c.querySelectorAll('li')].length, go: c.querySelector('a.ovs-guest-go').getAttribute('href'), bar: (document.getElementById('openvibe-login-btn') || {}).href || '' }; })()`);
        assert.strictEqual(card.head, 'Sign in to make OpenVibe yours');
        assert.strictEqual(card.lines, 4);
        assert.ok(card.bar && new URL(card.go, base).href === card.bar, `the card's link is the bar's own (${card.go} vs ${card.bar})`);
        assert.ok(/\/auth\/login\?next=/.test(card.go), 'this host\'s sign-in, with the way back');
        assert.strictEqual(await p.evaluate(`document.documentElement.scrollWidth`), 390, 'no sideways scroll');
        const tall = await p.evaluate(`document.querySelector('.ovs a.ovs-guest-go').getBoundingClientRect().height`);
        assert.ok(tall >= 44, `the button is a finger tall (${tall})`);
        await p.close();

        p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await p.goto(`${base}/in`, { maxMs: 6000 });
        await openYou(p);
        assert.strictEqual(await p.evaluate(`!!document.querySelector('.ovs [data-sec="signin"]')`), false, 'a signed-in person never sees it');
        await p.close();
        console.log('menu-guest-chrome: a guest sees what signing in adds, with the bar\'s own sign-in link');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
