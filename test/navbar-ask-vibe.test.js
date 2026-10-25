'use strict';
// "Ask Vibe" and "Work together" in the account menu (the OpenVibe Frame's button): signed in only, it opens a new chat with Vibe (openvibe.chat/vibe)
// with the text selected on the page as the ask and the page as where it came from. The link part runs in plain node;
// the selection part runs in a real headless Chrome (skipped without Chrome or with OV_SKIP_BROWSER=1): text selected,
// then a real press on the avatar, must reach the link even though the press can clear the selection.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');

// ── The link, in plain node ──
global.window = global;
global.location = { href: 'https://openvibe.live/@someone#chat', hostname: 'openvibe.live', protocol: 'https:' };
global.document = { readyState: 'complete', cookie: '', addEventListener() {}, querySelector() { return null }, getElementById() { return null } };
const navbar = require(path.join(ROOT, 'navbar.js'));
const { askVibeHref } = navbar._ask;
assert.strictEqual(askVibeHref(''), 'https://openvibe.chat/vibe', 'no selection: the plain console');
const href = new URL(askVibeHref('what is this stream about?'));
assert.strictEqual(href.origin + href.pathname, 'https://openvibe.chat/vibe');
assert.strictEqual(href.searchParams.get('ask'), 'what is this stream about?');
assert.strictEqual(href.searchParams.get('from'), 'https://openvibe.live/@someone', 'the page, without its hash');
global.location.href = `https://openvibe.live/search?q=${'x'.repeat(420)}`;
assert.strictEqual(new URL(askVibeHref('hi')).searchParams.get('from'), null, 'a page address over 400 characters is left out');
global.location.href = 'http://127.0.0.1:3000/';
assert.strictEqual(new URL(askVibeHref('hi')).searchParams.get('from'), null, 'only https pages are named');
console.log('navbar-ask-vibe: link ok');

// ── The selection, in Chrome ──
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('navbar-ask-vibe: browser part skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const page = (user) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ask</title><link rel="icon" href="data:,">
<script src="/shared/navbar.js" defer></script></head>
<body><div id="navbar-mount"></div><main><p id="text">The   rover drives
 to the door.</p></main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: ${JSON.stringify(user)}, links: [], networkLinks: false, countViews: false, notifications: false, recent: false }); });</script>
</body></html>`;
const PAGES = { '/in': page({ id: 7, username: 'probe', display_name: 'Probe' }), '/out': page(null) };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (PAGES[u.pathname]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGES[u.pathname]); }
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-ask-vibe-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280, block: ['*openvibe.network*', '*openvibe.tools*', '*openvibe.media*', '*jsdelivr*'] });
        const ready = `new Promise((r) => { const t = setInterval(() => { if (document.querySelector('nav.openvibe-navbar')) { clearInterval(t); r(true); } }, 20); })`;
        const press = async () => {
            const box = await p.evaluate(`(() => { const r = document.getElementById('openvibe-avatar-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
            await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
            await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
        };
        const askHref = () => p.evaluate(`document.querySelector('[data-ov-ask]') && document.querySelector('[data-ov-ask]').href`);

        await p.goto(`${base}/out`, { maxMs: 5000 });
        await p.evaluate(ready);
        assert.strictEqual(await p.evaluate(`!!document.querySelector('[data-ov-ask]')`), false, 'signed out: no Ask Vibe');
        assert.strictEqual(await p.evaluate(`!!document.querySelector('[data-ov-work]')`), false, 'signed out: no Work together');

        await p.goto(`${base}/in`, { maxMs: 5000 });
        await p.evaluate(ready);
        assert.strictEqual(await p.evaluate(`document.querySelector('[data-ov-ask]').textContent.trim()`), 'Ask Vibe');
        // Work together: a new workspace room on OpenVibe.Chat (a team and Vibe, a work queue, a shared screen).
        assert.strictEqual(await p.evaluate(`document.querySelector('[data-ov-work]').href`), 'https://openvibe.chat/work');

        // Nothing selected: the plain console.
        await press();
        assert.strictEqual(await askHref(), 'https://openvibe.chat/vibe');
        await press();

        // Text selected on the page, then a real press on the avatar: the selection is the ask (spaces folded).
        await p.evaluate(`(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
        await press();
        const u = new URL(await askHref());
        assert.strictEqual(u.searchParams.get('ask'), 'The rover drives to the door.');
        assert.strictEqual(u.searchParams.get('from'), null, 'an http test page is not named');
        assert.strictEqual(await p.evaluate(`document.querySelector('.openvibe-navbar-dropdown').classList.contains('open')`), true, 'the menu opened');
        console.log('navbar-ask-vibe: browser ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
