'use strict';
// Repeats fold only when they come close together (4.289.0; the owner's phone, 11-16: the Live tab said 3 and showed one
// "Maticus is live! ×3", three go-lives hours apart, and Yesterday's "×24" was two weeks of them: "these should only
// consolidate if he goes live within like the same minute … an hour later … different notifications"). In a real
// headless Chrome:
//   • two go-lives 30 seconds apart (a stream that restarted) are one row, ×2;
//   • go-lives hours apart are rows of their own, so the Live tab's count matches what is listed;
//   • three of the same alert within minutes are one row, ×3; the same alert two hours later is its own row.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-fold-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const live = (id, at) => ({ id, type: 'STREAM_LIVE', category: 'stream', service: 'live', title: 'Maticus is live!', message: 'ROBOT', priority: 'normal', is_read: 0, created_at: ago(at) });
const check = (id, at) => ({ id, type: 'ALERT', category: 'system', service: 'network', title: 'Browser check failed', message: 'media', priority: 'normal', is_read: 0, created_at: ago(at) });
const MIN = 60e3, HOUR = 3600e3;
const NOTES = [live(1, 10 * MIN), live(2, 10 * MIN + 30e3), live(3, 3 * HOUR), live(4, 5 * HOUR),
    check(5, 6 * HOUR), check(6, 6 * HOUR + 2 * MIN), check(7, 6 * HOUR + 5 * MIN), check(8, 8 * HOUR)];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (u.pathname === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (u.pathname === '/api/notifications/unread-count') return json({ count: NOTES.length });
    if (u.pathname === '/api/notifications/unread-by-tab') return json({ tabs: { all: NOTES.length, live: 4, system: 4 } });
    if (u.pathname === '/api/notifications') {
        const pool = u.searchParams.get('read_only') === '1' ? [] : NOTES;
        return json({ notifications: pool, total: pool.length, has_more: false });
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div id="host"></div><script src="/notification-ui.js"></script>
<script>try { localStorage.removeItem('ovn-unread'); } catch (e) {} OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'notes-fold-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        const end = Date.now() + 8000;
        while (!(await p.evaluate("document.querySelectorAll('#host .openvibe-notif-item').length")) && Date.now() < end) await wait(80);
        const rows = await p.evaluate(`[...document.querySelectorAll('#host .openvibe-notif-item')].map((r) => [r.querySelector('.title .t').textContent, (r.querySelector('.count') || {}).textContent || '', r.dataset.ids])`);
        assert.deepEqual(rows, [
            ['Maticus is live!', '×2', '1,2'],
            ['Maticus is live!', '', '3'],
            ['Maticus is live!', '', '4'],
            ['Browser check failed', '×3', '5,6,7'],
            ['Browser check failed', '', '8'],
        ], 'a restart folds; go-lives hours apart are their own rows; an alert repeated within minutes folds, two hours later it does not');
        console.log('notifications-fold-chrome: a restart folds (×2), go-lives hours apart are separate rows, an alert repeated within minutes folds (×3)');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
