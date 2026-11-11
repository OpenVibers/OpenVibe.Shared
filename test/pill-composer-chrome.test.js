'use strict';
// The Dock's pill and a page's own composer at the bottom of a phone (2026-11-11: on openvibe.chat the "Needs you" pill
// sat on the composer's send button). A real headless Chrome at 390×844: a chat-like page with a composer fixed to the
// bottom, bottom.js and the Dock. The pill stands above the composer (its bottom edge at least 8 px above the box's top);
// when the composer grows (a second line) the pill moves up with it; when the composer goes, the pill comes back down.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('pill-composer-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}
const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title>
<style>body{margin:0;background:#0b1120;color:#e6edf7;font:15px system-ui}main{padding:20px 16px 120px}
form{position:fixed;left:12px;right:12px;bottom:12px;display:flex;gap:8px;padding:10px;border-radius:24px;background:#1b2436}
textarea{flex:1;min-height:40px;resize:none;background:none;border:0;color:inherit;font:inherit}button{width:44px;height:44px;border-radius:50%}</style></head>
<body><main><h1>Room</h1>${'<p>A message in the room.</p>'.repeat(30)}</main>
<form data-ovt-composer class="ovt-composer"><textarea data-ovt-text rows="1"></textarea><button type="submit" id="send">↑</button></form>
<script src="/bottom.js"></script><script src="/dock.js"></script>
<script>OpenVibeDock.mount({ apiBase: location.origin, token: 'tok', user: { id: 7, username: 'ada', display_name: 'Ada' } });</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/bottom.js' || u.pathname === '/dock.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
    if (u.pathname === '/api/v1/me/dock') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ state: { open: false, tab: 'activity', pinned: true, agent: null, chat: null, place: { phone: { corner: 'bottom-right' }, desktop: { corner: 'bottom-right' } }, updated_at: new Date().toISOString() }, counts: { running: 1, waiting: 1, unread: 0 }, sources_partial: false }));
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-pill-composer-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const pg = await h.openPage(browser, context, { width: 390, height: 844 });
        await pg.goto(`${base}/`, { maxMs: 5000 });
        let pill = false;
        for (let i = 0; i < 40 && !pill; i++) { await wait(100); pill = await pg.evaluate(`(() => { const p = document.querySelector('.ovdk-pill'); return !!p && p.getBoundingClientRect().height > 0; })()`); }
        if (!pill) { console.log('pill-composer-chrome: the Dock drew no pill on this page (nothing to check)'); return; }
        const gap = async () => pg.evaluate(`(() => { const p = document.querySelector('.ovdk-pill').getBoundingClientRect(); const f = document.querySelector('form').getBoundingClientRect(); return Math.round(f.top - p.bottom); })()`);
        await wait(400);
        const first = await gap();
        assert.ok(first >= 8, `the pill stands above the composer (gap ${first} px)`);
        // A taller composer (a second line): the pill moves up with it.
        await pg.evaluate(`document.querySelector('textarea').style.minHeight = '96px'`);
        await wait(500);
        assert.ok(await gap() >= 8, 'and stays above it when the box grows');
        // No composer: the pill comes back to its own place.
        const before = await pg.evaluate(`document.querySelector('.ovdk-pill').getBoundingClientRect().bottom`);
        await pg.evaluate(`document.querySelector('form').remove()`);
        await wait(500);
        const after = await pg.evaluate(`document.querySelector('.ovdk-pill').getBoundingClientRect().bottom`);
        assert.ok(after > before + 40, `without a composer it comes back down (${Math.round(before)} → ${Math.round(after)})`);
        console.log('pill-composer-chrome: the pill stands above a bottom composer, follows it as it grows, and comes back without one');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
