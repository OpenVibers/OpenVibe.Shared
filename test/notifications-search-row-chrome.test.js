'use strict';
// The menu's Alerts search (4.284.0; the owner, 11-16: "this input is really buggy and it doesn't match the style and
// interconnect with the openvibe.design properly … redesign"): in the menu (dock mode) the search is a field of its own
// on a row above the tabs, always there, full width beside an Unread pill that says Unread; it never lies over the tabs,
// its ✕ shows only once something is typed, and one ring shows on focus. Real headless Chrome at 390 px; shots for the eye.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-search-row-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const root = path.join(__dirname, '..');
const NOTES = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, type: 'system', category: 'system', title: `Notice ${i + 1}`, message: 'Something happened.', is_read: i > 2 ? 1 : 0, created_at: new Date(Date.now() - i * 3600e3).toISOString() }));
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (u === '/api/notifications/unread-count') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"count":3}'); }
    if (u === '/api/notifications/unread-by-tab') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"tabs":{"all":3,"system":3}}'); }
    if (u === '/api/notifications') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ notifications: NOTES, total: NOTES.length, has_more: false })); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7;font-family:sans-serif">
<div id="host" style="padding:8px"></div>
<script src="/notification-ui.js"></script>
<script>OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-search-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        for (let i = 0; i < 80 && !(await p.evaluate("document.querySelectorAll('#host .openvibe-notif-item').length >= 6")); i++) await wait(50);
        const g = await p.evaluate(`(() => { const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const x = e.getBoundingClientRect(); return { l: Math.round(x.left), t: Math.round(x.top), w: Math.round(x.width), h: Math.round(x.height), b: Math.round(x.bottom) }; };
            const clear = document.querySelector('#host .openvibe-nv-search .clear');
            return { search: r('#host .openvibe-nv-search'), input: r('#host .openvibe-nv-search input'), unread: r('#host .openvibe-nv-unread'), tabs: r('#host .openvibe-nv-tabs'),
                word: (document.querySelector('#host .openvibe-nv-unread') || {}).innerText, clear: clear ? getComputedStyle(clear).display : null,
                wide: document.documentElement.scrollWidth }; })()`);
        assert.ok(g.search && g.search.w >= 220, `the search is a field, not a disk (${JSON.stringify(g.search)})`);
        assert.ok(g.input.w >= g.search.w - 2, 'its input fills it');
        assert.ok(g.search.b <= g.tabs.t + 1, `above the tabs, never over them (search ${g.search.b}, tabs ${g.tabs.t})`);
        assert.ok(Math.abs(g.unread.t - g.search.t) <= 2 && g.unread.l > g.search.l + g.search.w - 2, 'Unread beside it on the same row');
        assert.match(String(g.word || ''), /Unread/, 'the pill says Unread');
        assert.ok(g.unread.w >= 80, `the word shows, not only the dot (${g.unread.w} px)`);
        assert.ok(g.search.h >= 44 && g.unread.h >= 44, '44 px to press');
        assert.strictEqual(g.clear, 'none', 'no ✕ until something is typed');
        assert.strictEqual(g.wide, 390, 'nothing wider than the phone');
        await p.evaluate("(() => { const i = document.querySelector('#host .openvibe-nv-search input'); i.focus(); i.value = 'notice'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await wait(200);
        const typed = await p.evaluate(`(() => { const s = document.querySelector('#host .openvibe-nv-search'); return { clear: getComputedStyle(s.querySelector('.clear')).display, ring: getComputedStyle(s).boxShadow, still: Math.round(s.getBoundingClientRect().top) }; })()`);
        assert.notStrictEqual(typed.clear, 'none', 'the ✕ once something is typed');
        assert.ok(/rgb/.test(typed.ring), 'one ring on focus');
        assert.strictEqual(typed.still, g.search.t, 'focusing it moves nothing');
        if (process.env.OV_SHOTS) { const shot = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: 420, scale: 2 } }); fs.writeFileSync(path.join(process.env.OV_SHOTS, 'notifications-search-row.png'), Buffer.from(shot.data, 'base64')); }
        console.log('notifications-search-row-chrome: a field of its own above the tabs, Unread beside it in words, the ✕ once typed, one ring, 44 px, nothing wider than the phone');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
