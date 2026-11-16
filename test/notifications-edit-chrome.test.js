'use strict';
// Alerts' Edit (4.284.0; the owner, 11-16: "people want to completely delete their notifications … the edit mode … all
// three … multi-select … easy and seamless"): with Edit on, a tap picks a notice (it never opens), the bar counts them;
// Mark read sends one read-batch; Delete dismisses each picked notice on the account and they fold away; Select all, then a
// second press arms "Delete all", and a third deletes every notice (DELETE /api/notifications). Real headless Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-edit-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const root = path.join(__dirname, '..');
let notes = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, type: 'system', category: 'system', title: `Notice ${i + 1}`, message: 'Something happened.', is_read: 0, created_at: new Date(Date.now() - i * 3600e3).toISOString() }));
const calls = [];
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (u === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
        if (u === '/api/notifications/unread-count') return json({ count: notes.filter((n) => !n.is_read).length });
        if (u === '/api/notifications/unread-by-tab') return json({ tabs: { all: notes.filter((n) => !n.is_read).length } });
        if (u === '/api/notifications' && req.method === 'GET') return json({ notifications: notes, total: notes.length, has_more: false });
        if (u === '/api/notifications' && req.method === 'DELETE') { calls.push('DELETE all'); notes = []; return json({ ok: true, changed: 5 }); }
        let m = /^\/api\/notifications\/(\d+)\/dismiss$/.exec(u);
        if (m && req.method === 'POST') { calls.push(`dismiss ${m[1]}`); notes = notes.filter((n) => String(n.id) !== m[1]); return json({ ok: true }); }
        if (u === '/api/notifications/read-batch' && req.method === 'POST') { const ids = (JSON.parse(body || '{}').ids || []).map(String); calls.push(`read ${ids.join(',')}`); notes.forEach((n) => { if (ids.includes(String(n.id))) n.is_read = 1; }); return json({ ok: true, changed: ids.length, unread: notes.filter((n) => !n.is_read).length }); }
        m = /^\/api\/notifications\/(\d+)\/read$/.exec(u);
        if (m) return json({ ok: true });
        if (u.startsWith('/api/')) return json({});
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7;font-family:sans-serif">
<div id="host" style="padding:8px"></div>
<script src="/notification-ui.js"></script>
<script>OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); window.v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
    });
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-edit-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what) => { for (let i = 0; i < 100; i++) { if (await p.evaluate(expr)) return; await wait(50); } assert.fail(what); };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item').length === 5", 'the five notices');
        await p.evaluate('v.edit(true), 1');
        await until(p, "!!document.querySelector('#host .ovn-ebar:not([hidden])')", 'the bar shows');
        const before = await p.evaluate('location.href');
        await p.evaluate("(() => { const r = document.querySelectorAll('#host .openvibe-notif-item'); r[0].click(); r[1].click(); })(), 1");
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item.is-picked').length === 2", 'two picked');
        let s = await p.evaluate(`({ picked: document.querySelectorAll('#host .openvibe-notif-item.is-picked').length, n: document.querySelector('#host .ovn-ebar-n').textContent, href: location.href, role: document.querySelector('#host .openvibe-notif-item').getAttribute('role') })`);
        assert.deepStrictEqual([s.picked, s.n, s.href, s.role], [2, '2 selected', before, 'checkbox'], `a tap picks, never opens (${JSON.stringify(s)})`);
        // Mark read: one batch with both.
        await p.evaluate("document.querySelector('#host .ovn-ebar [data-e=read]').click(), 1");
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item.is-picked').length === 0", 'picks cleared after Mark read');
        assert.ok(calls.some((c) => /^read 20[01],20[01]$/.test(c)), `one read-batch (${calls})`);
        // Delete two.
        await p.evaluate("(() => { const r = document.querySelectorAll('#host .openvibe-notif-item'); r[2].click(); r[3].click(); document.querySelector('#host .ovn-ebar [data-e=del]').click(); })(), 1");
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item').length === 3", 'two deleted, three left');
        assert.deepStrictEqual(calls.filter((c) => c.startsWith('dismiss')).sort(), ['dismiss 202', 'dismiss 203'], 'each dismissed on the account');
        // Delete all: Select all, then a second press arms it, a third deletes every notice.
        await p.evaluate("v.edit(true), 1");
        await p.evaluate("document.querySelector('#host .ovn-ebar [data-e=all]').click(), 1");
        await until(p, "document.querySelector('#host .ovn-ebar [data-e=all]').textContent === 'Delete everything'", 'all picked: it offers everything');
        await p.evaluate("document.querySelector('#host .ovn-ebar [data-e=all]').click(), 1");
        await until(p, "/^Delete all/.test(document.querySelector('#host .ovn-ebar [data-e=all]').textContent)", 'armed, in words');
        assert.ok(!calls.includes('DELETE all'), 'not yet');
        await p.evaluate("document.querySelector('#host .ovn-ebar [data-e=all]').click(), 1");
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item').length === 0", 'every notice gone');
        assert.ok(calls.includes('DELETE all'), 'DELETE /api/notifications');
        console.log('notifications-edit-chrome: a tap picks (never opens); Mark read in one batch; Delete dismisses each; Delete all only on the third press');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
