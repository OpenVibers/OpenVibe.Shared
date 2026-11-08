'use strict';
// The menu marks the page you are on (owner, 11-08, on openvibe.chat/messages: "highlight based on page"): in "On <site>",
// the link whose path is this page's, or the longest one this page sits under, wears is-here and aria-current; "/" only
// on the home itself. And on a phone the orb opens a menu, not a search: the field is not focused, so the keyboard does
// not come up over the menu (it still is on a computer, and when the menu opens with "/"). A real headless Chrome;
// skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('menu-here-current-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const FRAME = { nav: [{ id: 'chat', name: 'Chat', url: 'https://openvibe.chat/', icon: 'chat', group: 'talk' }], groups: [{ id: 'talk', name: 'Talk' }], soon: [], footer: {} };
const LINKS = [{ label: 'Vibe', href: '/' }, { label: 'Global chat', href: '/global' }, { label: 'Messages', href: '/messages' }, { label: 'Message settings', href: '/messages/settings' }, { label: 'Elsewhere', href: 'https://example.test/messages/abc' }];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Here</title><link rel="icon" href="data:,">
<script>
  const realFetch = window.fetch;
  window.fetch = (u, o) => (String(u).startsWith('https://openvibe.network/api/frame?') ? Promise.resolve({ ok: true, json: async () => (${JSON.stringify(FRAME)}) }) : String(u).startsWith('https://') ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : realFetch(u, o));
</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: ${JSON.stringify(LINKS)}, countViews: false, notifications: false }); });</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE);
});
const HERE = `[...document.querySelectorAll('.ovs-links .ovs-link')].filter((a) => a.classList.contains('is-here') || a.getAttribute('aria-current')).map((a) => a.textContent + ':' + a.getAttribute('aria-current'))`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-here-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    const openWith = async (p, how) => {
        if (how === 'button') await p.evaluate(`(document.getElementById('openvibe-burger') || document.getElementById('openvibe-search-btn')).click(), true`);
        else await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })), true`);
        assert.ok(await until(p, `!!document.querySelector('.ovs.is-open .ovs-links')`), 'the menu opened with this site\'s links');
        await wait(120);
    };
    const visit = async (p, where) => {
        await p.goto(`${base}${where}`, { maxMs: 5000 });
        assert.ok(await until(p, `!!document.getElementById('openvibe-burger')`), 'the phone menu button is there');
        await openWith(p, 'button');
        return p.evaluate(HERE);
    };
    try {
        const context = await browser.newContext();
        const blocked = ['*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'];
        // A page under Messages, on a phone, opened from the orb.
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: blocked });
        assert.deepStrictEqual(await visit(p, '/messages/abc'), ['Messages:page'], 'the longest link this page sits under; not Vibe ("/"), not another site');
        assert.notStrictEqual(await p.evaluate(`!!(document.activeElement && document.activeElement.classList.contains('ovs-input'))`), true, 'on a phone the field is not focused (no keyboard over the menu)');
        assert.strictEqual(await p.evaluate(`!!(document.activeElement && document.activeElement.closest('.ovs'))`), true, 'focus is inside the menu');
        // An exact match wins over a shorter one; the home marks "/" only on itself; a page with no link marks none.
        assert.deepStrictEqual(await visit(p, '/messages/settings'), ['Message settings:page'], 'the exact page');
        assert.deepStrictEqual(await visit(p, '/'), ['Vibe:page'], 'the home');
        assert.deepStrictEqual(await visit(p, '/nowhere'), [], 'a page with no link of its own marks none');

        // On a computer the menu is a search: the field is focused.
        const d = await h.openPage(browser, context, { width: 1280, height: 900, block: blocked });
        await d.goto(`${base}/global`, { maxMs: 5000 });
        assert.ok(await until(d, `!!document.querySelector('.openvibe-navbar')`), 'the navbar is up');
        await openWith(d, 'key');
        assert.deepStrictEqual(await d.evaluate(HERE), ['Global chat:page'], 'the same highlight on a computer');
        assert.ok(await until(d, `!!(document.activeElement && document.activeElement.classList.contains('ovs-input'))`, 1500), 'on a computer the field is focused');
        console.log('menu-here-current-chrome: ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((err) => { console.error(err); process.exit(1); });
