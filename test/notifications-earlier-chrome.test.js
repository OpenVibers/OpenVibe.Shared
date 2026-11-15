'use strict';
// The menu's alerts go on past the unread (4.274.0; the owner's phone, 11-15: "not loading": the list opened on the 11
// unread, as asked 11-14, and the other 710 never came). In a real headless Chrome, the menu's shape (one scroller):
//   • the list opens on what is unread, and the status says how many unread and how many in all;
//   • past them an Earlier line, and the read ones load under it a page at a time as you scroll, asked with read_only;
//   • with nothing unread the list says so in one short line and the earlier ones follow at once (never an empty list);
//   • a search stays within the unread.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-earlier-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const note = (i, read) => ({ id: i, type: 'STREAM_LIVE', category: 'stream', service: 'live', title: `Streamer ${i} is live!`, message: 'Night owl mode', priority: 'normal', is_read: read ? 1 : 0, created_at: new Date(Date.now() - i * 3600e3).toISOString() });
let UNREAD = [1, 2, 3].map((i) => note(i, false));
const READ = Array.from({ length: 70 }, (_, k) => note(100 + k, true));
const queries = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (u.pathname === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (u.pathname === '/api/notifications/unread-count') return json({ count: UNREAD.length });
    if (u.pathname === '/api/notifications/unread-by-tab') return json({ tabs: { all: UNREAD.length, live: UNREAD.length } });
    if (u.pathname === '/api/notifications') {
        queries.push(u.search);
        const offset = Number(u.searchParams.get('offset')) || 0, limit = Number(u.searchParams.get('limit')) || 30;
        const q = (u.searchParams.get('q') || '').toLowerCase();
        let pool = u.searchParams.get('unread_only') === '1' ? UNREAD : u.searchParams.get('read_only') === '1' ? READ : UNREAD.concat(READ);
        if (q) pool = pool.filter((n) => n.title.toLowerCase().includes(q));
        return setTimeout(() => json({ notifications: pool.slice(offset, offset + limit), total: pool.length, has_more: offset + limit < pool.length }), 60);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div style="position:fixed;inset:0;display:flex;flex-direction:column"><div style="flex:none;height:96px">the menu's head</div>
<ul class="ovs-list" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:6px;list-style:none"><li><div id="host"></div></li></ul></div>
<script src="/notification-ui.js"></script>
<script>try { localStorage.removeItem('ovn-unread'); } catch (e) {} OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-earlier-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    const items = "document.querySelectorAll('#host .openvibe-notif-item').length";
    const status = "(document.querySelector('#host [data-role=\"status\"]') || {}).textContent";
    const scrollEnd = async (p, want) => {
        for (let i = 0; i < 14; i++) {
            await p.evaluate("(() => { const l = document.querySelector('.ovs-list'); l.scrollTop = l.scrollHeight; })()");
            await wait(220);
            if (await p.evaluate(items) >= want) break;
        }
    };
    try {
        const base = `http://127.0.0.1:${server.address().port}/`;
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(base, { maxMs: 6000 });
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item.unread').length >= 1", 'the unread ones');
        // The three unread come first (grouped as one "is live" run or not, they are unread), then Earlier and the read.
        await until(p, "!!document.querySelector('#host .openvibe-nv-earlier')", 'the Earlier line');
        const order = await p.evaluate(`(() => { const all = [...document.querySelectorAll('#host .openvibe-notif-item, #host .openvibe-nv-earlier')];
            const e = all.findIndex((x) => x.classList.contains('openvibe-nv-earlier'));
            return { before: all.slice(0, e).every((x) => x.classList.contains('unread')), after: all.slice(e + 1).every((x) => !x.classList.contains('unread')), n: all.length - 1 }; })()`);
        assert.deepEqual([order.before, order.after], [true, true], 'unread above the Earlier line, read below it');
        await scrollEnd(p, 70);
        const read = await p.evaluate("document.querySelectorAll('#host .openvibe-notif-item:not(.unread)').length");
        assert.ok(read >= 60, `the earlier ones load as you scroll (${read} read rows; runs of the same notice may be one row)`);
        assert.equal(await p.evaluate(status), '3 unread · 73 in all', 'the status says both');
        assert.ok(queries.some((q) => /[?&]read_only=1/.test(q) && /[?&]offset=30/.test(q)), `the earlier ones a page at a time (${queries.filter((q) => /[?&]read_only/.test(q)).join(' ')})`);
        assert.ok(!queries.some((q) => /[?&]read_only=1/.test(q) && /[?&]unread_only=1/.test(q)), 'never both filters at once');

        // Nothing unread: one short line, and the earlier ones follow at once.
        UNREAD = [];
        const q2 = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await q2.goto(base, { maxMs: 6000 });
        await until(q2, "document.querySelectorAll('#host .openvibe-notif-item').length >= 10", 'the earlier ones with nothing unread');
        const empty = await q2.evaluate(`({ caught: (document.querySelector('#host .ovn-caught') || {}).textContent, bigEmpty: !!document.querySelector('#host .openvibe-nv-empty') })`);
        assert.deepEqual(empty, { caught: "You're all caught up", bigEmpty: false }, 'caught up in one line, never an empty list');
        console.log('notifications-earlier-chrome: unread first, Earlier and the read ones as you scroll (read_only), both counts, caught up in one line');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
