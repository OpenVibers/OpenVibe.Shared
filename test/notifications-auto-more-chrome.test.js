'use strict';
// The menu's alerts, 4.260.0 (the owner, 11-15: "more minimalist … use more icons … make those fixed on top so that
// there's more space … auto-load more as you scroll down … lazy load type shit in an optimized async way"). In a real
// headless Chrome, the menu's shape (one scroller), 95 notices served 30 a page:
//   • the tabs carry their icons, and a slim bar under them says how many, with Clear all and Inbox; there is no foot;
//   • the tabs and the bar stay at the top while the list scrolls under them;
//   • scrolling to the end loads the next page by itself, a page at a time, until every notice is there; no button;
//   • unread is a dot, not a bar down the side; nothing runs off a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-auto-more-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const NOTES = Array.from({ length: 95 }, (_, i) => ({ id: i + 1, type: 'mention', category: 'social', service: 'chat', title: `kai mentioned you ${i + 1}`, message: 'look at the shots?', priority: 'normal', is_read: 0, created_at: new Date(Date.now() - i * 3600e3).toISOString() }));
const asked = [];
const queries = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (u.pathname === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (u.pathname === '/api/notifications/unread-count') return json({ count: 95 });
    if (u.pathname === '/api/notifications/unread-by-tab') return json({ tabs: { all: 95, mentions: 12, system: 40, live: 0 } });
    if (u.pathname === '/api/notifications') {
        const offset = Number(u.searchParams.get('offset')) || 0, limit = Number(u.searchParams.get('limit')) || 30;
        // The earlier ones (read, 4.274.0): none here, every notice is unread.
        if (u.searchParams.get('read_only') === '1') return json({ notifications: [], total: 0, has_more: false });
        asked.push(offset); queries.push(u.search);
        return setTimeout(() => json({ notifications: NOTES.slice(offset, offset + limit), total: NOTES.length, has_more: offset + limit < NOTES.length }), 80);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div style="position:fixed;inset:0;display:flex;flex-direction:column"><div style="flex:none;height:96px">the menu's head</div>
<ul class="ovs-list" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:6px;list-style:none"><li><div id="host"></div></li></ul></div>
<script src="/notification-ui.js"></script>
<script>OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-more-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await until(p, "document.querySelectorAll('#host .openvibe-notif-item').length >= 30", 'the first page');
        const top = await p.evaluate(`(() => { const q = (s) => document.querySelector('#host ' + s);
            return { tabIcons: document.querySelectorAll('#host .openvibe-nv-tabs button .ovn-tab-ic').length, tabs: document.querySelectorAll('#host .openvibe-nv-tabs button').length,
                bar: !!q('.openvibe-nv-tools .openvibe-nv-bar'), clear: !!q('.openvibe-nv-bar [data-act="read-all-foot"]'), inbox: !!q('.openvibe-nv-bar a.is-go'),
                foot: !!q('.openvibe-nv-foot'), status: (q('.openvibe-nv-bar [data-role="status"]') || {}).textContent, button: !!q('[data-act="more"]'),
                sticky: getComputedStyle(q('.openvibe-nv-tools')).position, side: getComputedStyle(q('.openvibe-notif-item.unread .ovn-row')).boxShadow }; })()`);
        assert.equal(top.tabIcons, top.tabs, 'every tab has its icon');
        assert.deepEqual([top.bar, top.clear, top.inbox, top.foot], [true, true, true, false], 'Clear all and Inbox in a bar at the top; no foot');
        assert.equal(top.status, '30 of 95 unread');
        assert.equal(top.sticky, 'sticky', 'the tabs and the bar stay at the top');
        assert.equal(top.button, false, 'no Load more button');
        assert.equal(top.side, 'none', 'unread is a dot, not a bar down the side');
        // Sorted by what is unread (All first), the counts red; search and Unread on a row of their own above the tabs
        // (4.284.0, the owner 11-16: the old disk over the tabs was "buggy"; inside the menu its box is the search).
        const tabs = await p.evaluate(`(() => { const b = [...document.querySelectorAll('#host .openvibe-nv-tabs [data-tab]')];
            const n = document.querySelector('#host .openvibe-nv-tabs [data-n="mentions"]'); const f = document.querySelector('#host .openvibe-nv-find').getBoundingClientRect();
            const t = document.querySelector('#host .openvibe-nv-tabs').getBoundingClientRect();
            return { order: b.map((x) => x.dataset.tab), red: getComputedStyle(n).backgroundColor, above: f.bottom <= t.top + 2 }; })()`);
        assert.deepEqual(tabs.order, ['all', 'system', 'mentions', 'live', 'alerts', 'agents'], 'All, then the most unread (System 40, Mentions 12), then the default order');
        assert.equal(tabs.red, 'rgb(239, 68, 68)', 'an unread count is red');
        assert.ok(tabs.above, 'search and Unread on their own row, above the tabs');
        // Scroll to the end: the rest load by themselves, a page at a time.
        for (let i = 0; i < 12; i++) {
            await p.evaluate("(() => { const l = document.querySelector('.ovs-list'); l.scrollTop = l.scrollHeight; })()");
            await wait(260);
            if (await p.evaluate("document.querySelectorAll('#host .openvibe-notif-item').length") >= 95) break;
        }
        assert.equal(await p.evaluate("document.querySelectorAll('#host .openvibe-notif-item').length"), 95, 'every notice loaded by scrolling alone');
        // The first page is asked for by the preview, Show all and the count's refresh; the pages after it once each.
        assert.deepEqual(asked.filter((o) => o > 0), [30, 60, 90], `one page at a time, never twice (${asked})`);
        // The three offset-0 asks are three different things (4.262.0, after "the first page fetched 3x"): the preview's
        // three, the full first page once, and the check for anything new since; the full page is never asked twice.
        assert.strictEqual(queries.filter((q) => /[?&]offset=0(&|$)/.test(q) && /[?&]limit=30(&|$)/.test(q)).length, 1, `the full first page once (${queries.join(' ')})`);
        // Past the unread the list asks once for the earlier ones (4.274.0): none here, so the end mark goes.
        await p.evaluate("(() => { const l = document.querySelector('.ovs-list'); l.scrollTop = l.scrollHeight; })()");
        await until(p, "!document.querySelector('#host .openvibe-nv-more')", 'the end of the list');
        const after = await p.evaluate(`({ status: document.querySelector('#host .openvibe-nv-bar [data-role="status"]').textContent, more: !!document.querySelector('#host .openvibe-nv-more'),
            barTop: Math.round(document.querySelector('#host .openvibe-nv-tools').getBoundingClientRect().top), listTop: Math.round(document.querySelector('.ovs-list').getBoundingClientRect().top), wide: document.documentElement.scrollWidth })`);
        assert.equal(after.status, '95 of 95 unread');
        assert.equal(after.more, false, 'nothing left to load, nothing waiting at the end');
        assert.ok(Math.abs(after.barTop - after.listTop) <= 8, `scrolled down, the tabs and the bar are still at the top (${after.barTop} vs ${after.listTop})`);
        assert.equal(after.wide, 390, 'nothing runs off a phone');
        if (process.env.OV_CAPTURE) { await p.evaluate("document.querySelector('.ovs-list').scrollTop = 0"); await wait(200); const r = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE, 'alerts-390.png'), Buffer.from(r.data, 'base64')); }
        await p.close();
        console.log('notifications-auto-more-chrome: icons on the tabs, the bar pinned on top, pages that load themselves, a dot for unread');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
