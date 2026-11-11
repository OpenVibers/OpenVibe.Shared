'use strict';
// Floating cards (overlay.js, 4.152.0; the owner, 11-08: a mini player you move and resize like YouTube on Android,
// with the room's chat, that works across OpenVibe sites). In a real headless Chrome: a card opens in the bottom
// corner above the phone's app bar; a drag settles it in the nearest corner; its chat opens beside it; a link to
// another OpenVibe site carries it in #ovo=; the next page opens it again and takes the hash out of the address; a
// source that is not first-party is never opened; a reload brings it back. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('overlay-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Overlay</title><link rel="icon" href="data:,">
<style>body{margin:0;background:#0b0f19} .openvibe-navbar{position:sticky;top:0;height:56px;background:#111827} .ovnav-appbar{position:fixed;left:0;right:0;bottom:0;height:58px;background:#111827}</style>
</head><body><nav class="openvibe-navbar"></nav><p style="height:2000px"><a id="away" href="https://openvibe.games/achievements">Games</a> <a id="here" href="/b">here</a></p><div class="ovnav-appbar"></div>
<script src="/shared/surfaces.js"></script><script src="/shared/overlay.js"></script></body></html>`;
const FRAME = '<!doctype html><body style="margin:0;background:#2b6;color:#fff;font:20px sans-serif">LIVE</body>';
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    if (u.pathname.startsWith('/frame')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(FRAME); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE);
});
const RECT = `(() => { const c = document.querySelector('.ovo-card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), corner: c.dataset.corner }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-overlay-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(50); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844 });
        await p.goto(`${base}/a`, { maxMs: 5000 });
        assert.ok(await until(p, `!!window.OVOverlay`), 'the host loads');
        await p.evaluate(`OVOverlay.open({ id: 'live', src: '/frame-a', title: 'maticus', live: true, href: '/a', side: { src: '/frame-chat', title: 'maticus · chat' } }), true`);
        await wait(500);
        const r0 = await p.evaluate(RECT); if (!r0 || r0.corner !== 'br') console.log('r0', JSON.stringify(r0), await p.evaluate('document.querySelectorAll(".ovo-card").length'));
        assert.ok(r0 && r0.corner === 'br', 'it opens in the bottom-right corner');
        assert.strictEqual(r0.y + r0.h, 844 - 58 - 10, 'it sits right above the phone\'s app bar, never under it');
        assert.strictEqual(r0.x + r0.w, 390 - 10, 'a margin from the side');

        // A drag settles it in the nearest corner (top-left), under the navbar.
        await p.evaluate(`(() => { const c = document.querySelector('.ovo-card'); const r = c.getBoundingClientRect();
            const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }));
            const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2; fire('pointerdown', x0, y0);
            for (let i = 1; i <= 10; i++) fire('pointermove', x0 - (x0 - 90) * i / 10, y0 - (y0 - 150) * i / 10);
            fire('pointerup', 90, 150); })(), true`);
        await wait(450);
        const r1 = await p.evaluate(RECT);
        assert.deepStrictEqual([r1.corner, r1.x, r1.y], ['tl', 10, 56 + 8], 'top-left, under the navbar');

        // Its chat opens as a sheet above the app bar on a phone.
        await p.evaluate(`document.querySelector('[data-ovo="side"]').click(), true`);
        assert.ok(await until(p, `getComputedStyle(document.querySelector('.ovo-side')).transform === 'none'`), 'the sheet has finished opening');
        const side = await p.evaluate(`(() => { const s = document.querySelector('.ovo-side'); const r = s.getBoundingClientRect(); return { open: s.classList.contains('is-open'), bottom: Math.round(r.bottom), src: s.querySelector('iframe').getAttribute('src') }; })()`);
        assert.deepStrictEqual(side, { open: true, bottom: 844 - 58 - 10, src: `${base}/frame-chat` }, 'the chat sheet, above the app bar');
        assert.strictEqual(await p.evaluate('document.body.style.position'), 'fixed', 'the chat sheet locks the page');
        await p.evaluate(`document.querySelector('[data-ovo="side"]').click(), true`);
        assert.strictEqual(await p.evaluate('document.body.style.position'), '', 'closing the chat sheet unlocks the page');

        // A link to another OpenVibe site carries it; one on this site does not.
        const away = await p.evaluate(`OVOverlay.handoffUrl('https://openvibe.games/achievements')`);
        assert.match(away, /^https:\/\/openvibe\.games\/achievements#ovo=[A-Za-z0-9_-]+$/);
        assert.strictEqual(await p.evaluate(`OVOverlay.current().href`), `${base}/a`, 'the active live card exposes its way back');
        assert.match(await p.evaluate(`OVOverlay.handoffUrl('https://openvibe.games/achievements#scores')`), /#scores&ovo=/, 'handoff keeps the destination section');
        const carried = JSON.parse(Buffer.from(away.split('#ovo=')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
        assert.deepStrictEqual(carried.map((d) => [d.id, d.title, d.live, d.src, d.side && d.side.src]), [['live', 'maticus', true, `${base}/frame-a`, `${base}/frame-chat`]]);
        assert.strictEqual(await p.evaluate(`OVOverlay.handoffUrl('${base}/b')`), `${base}/b`, 'the same site: no hash');
        assert.strictEqual(await p.evaluate(`OVOverlay.handoffUrl('https://example.com/x')`), 'https://example.com/x', 'not an OpenVibe site: no hash');

        // Arriving with the hash: the card opens and the hash leaves the address.
        const data = away.split('#ovo=')[1];
        const q = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await q.goto(`${base}/b#ovo=${data}`, { maxMs: 5000 });
        assert.ok(await until(q, `!!document.querySelector('.ovo-card')`), 'the carried card opens');
        assert.strictEqual(await q.evaluate(`location.hash`), '', 'the hash is gone from the address');
        assert.strictEqual(await q.evaluate(`document.querySelector('.ovo-card .ovo-name').textContent`), 'maticus');
        // Reload: it comes back (this site's session).
        await q.goto(`${base}/b`, { maxMs: 5000 });
        assert.ok(await until(q, `!!document.querySelector('.ovo-card')`), 'a reload brings it back');
        await q.evaluate(`OVOverlay.close('live'), true`);
        assert.strictEqual(await q.evaluate(`sessionStorage.getItem('ov-overlay')`), null, 'closed: nothing kept');

        // A source that is not first-party is never opened, from the hash or from a call.
        const evil = Buffer.from(JSON.stringify([{ id: 'x', src: 'https://evil.example/steal', title: 'x' }])).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const e = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await e.goto(`${base}/c#ovo=${evil}`, { maxMs: 5000 });
        await until(e, `!!window.OVOverlay`);
        await wait(200);
        assert.strictEqual(await e.evaluate(`document.querySelectorAll('.ovo-card').length`), 0, 'a foreign source is refused');
        assert.strictEqual(await e.evaluate(`OVOverlay.open({ src: 'javascript:alert(1)' })`), null);
        for (const host of ['portal--alex.openvibe.link', 'portal--alex.openvibe.website', 'nested.portal--alex.openvibe.link', 'unknown.openvibe.link']) {
            assert.strictEqual(await e.evaluate(`OVOverlay.safeSrc('https://${host}/')`), null, host);
            assert.strictEqual(await p.evaluate(`OVOverlay.handoffUrl('https://${host}/')`), `https://${host}/`, 'no card carried to a share');
        }
        for (const host of ['openvibe.link', 'connect.openvibe.link']) assert.ok(await e.evaluate(`OVOverlay.safeSrc('https://${host}/')`), host);
        assert.strictEqual(await e.evaluate(`OVOverlay.open({ src: 'http://openvibe.live/embed/x' })`), null, 'plain http to another site is refused');
        assert.ok(await e.evaluate(`!!OVOverlay.safeSrc('https://openvibe.live/embed/maticus')`), "Live's embed is first-party");
        console.log('overlay-chrome: ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((err) => { console.error(err); process.exit(1); });
