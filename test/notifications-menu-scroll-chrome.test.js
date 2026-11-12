'use strict';
// The menu's notifications scroll with the menu (4.225.0; the owner, 11-12: "scrolling is very buggy and doesn't work
// on mobile … in the menu especially in notifications tab"). The list inside the menu was a scroll box of its own that
// held its overscroll: it never overflowed there, so a swipe that began on a notice moved nothing at all. In a real
// headless Chrome with touch: a swipe on a notice scrolls the menu's list, and the list inside it is no scroll box.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-menu-scroll-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const NOTES = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, type: 'mention', category: 'social', service: 'chat', title: `kai mentioned you ${i + 1}`, message: 'look at the shots?', priority: 'normal', is_read: i > 5 ? 1 : 0, created_at: new Date(Date.now() - i * 600e3).toISOString() }));
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (u === '/api/notifications/unread-count') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"count":6}'); }
    if (u === '/api/notifications/unread-by-tab') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"tabs":{"all":6}}'); }
    if (u === '/api/notifications') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ notifications: NOTES, total: NOTES.length, has_more: false })); }
    res.writeHead(200, { 'content-type': 'text/html' });
    // The menu's shape: a fixed sheet whose list is the one scroller, the notifications drawn inside it.
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div style="position:fixed;inset:0;display:flex;flex-direction:column"><div style="flex:none;height:96px">the menu's head</div>
<ul class="ovs-list" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:6px;list-style:none"><li><div id="host"></div></li></ul></div>
<script src="/notification-ui.js"></script>
<script>OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-scroll-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        let n = 0;
        for (let i = 0; i < 80 && n < 20; i++) { await wait(50); n = await p.evaluate(`document.querySelectorAll('#host .openvibe-notif-item').length`); }
        assert.ok(n >= 20, `the notices are drawn (${n})`);
        const inner = await p.evaluate(`(() => { const l = document.querySelector('#host .openvibe-nv-list'); const cs = getComputedStyle(l); return { overflow: cs.overflowY, overscroll: cs.overscrollBehaviorY }; })()`);
        assert.deepEqual(inner, { overflow: 'visible', overscroll: 'auto' }, 'inside the menu the list is no scroll box of its own');
        const at = await p.evaluate(`(() => { const r = document.querySelectorAll('#host .openvibe-notif-item')[2].getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
        for (let k = 1; k <= 12; k++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x, y: at.y - (400 * k) / 12 }] }); await wait(16); }
        await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await wait(500);
        const top = await p.evaluate(`document.querySelector('.ovs-list').scrollTop`);
        assert.ok(top > 150, `a swipe that begins on a notice scrolls the menu (scrollTop ${top}; it was 0)`);
        await p.close();
        console.log('notifications-menu-scroll-chrome: a swipe on a notice scrolls the menu; the list inside it is no scroll box');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
