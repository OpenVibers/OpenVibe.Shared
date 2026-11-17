'use strict';
// The day headers go with their rows (4.304.0; the owner's phone, 11-17: "These dates don't clear when you swipe
// everything away": TODAY, YESTERDAY and SUNDAY stayed over an empty Unread list, above the Earlier line). In a real
// headless Chrome, the menu's Unread list:
//   • a swipe that clears a day's last row takes that day's header with it, and only that one;
//   • "Clear all" folds every unread row away (it left them standing), every header above the Earlier line goes, and
//     the list says "You're all caught up" in the one line a list that opened with nothing unread shows;
//   • the Earlier part keeps its own day headers and rows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('notifications-days-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const DAY = 24 * 3600e3;
const at = (ago) => new Date(Date.now() - ago).toISOString();
const note = (i, ago, read, type) => ({ id: i, type, category: 'system', service: 'live', title: `Notice ${i}`, message: `About ${i}`, priority: 'normal', is_read: read ? 1 : 0, created_at: at(ago) });
// Different types, so no two rows fold into one: one today, two yesterday, one three days ago.
let UNREAD = [note(1, 60e3, false, 'A'), note(2, DAY + 60e3, false, 'B'), note(3, DAY + 120e3, false, 'C'), note(4, 3 * DAY, false, 'D')];
const READ = Array.from({ length: 6 }, (_, k) => note(100 + k, k * 3600e3, true, `R${k}`));
const posts = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (u.pathname === '/notification-ui.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'notification-ui.js'))); }
    if (req.method === 'POST') {
        posts.push(u.pathname);
        if (u.pathname === '/api/notifications/read-all') UNREAD = [];
        const m = u.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
        if (m) UNREAD = UNREAD.filter((n) => String(n.id) !== m[1]);
        return json({ ok: true, unread: UNREAD.length });
    }
    if (u.pathname === '/api/notifications/unread-count') return json({ count: UNREAD.length });
    if (u.pathname === '/api/notifications/unread-by-tab') return json({ tabs: { all: UNREAD.length } });
    if (u.pathname === '/api/notifications') {
        const offset = Number(u.searchParams.get('offset')) || 0, limit = Number(u.searchParams.get('limit')) || 30;
        const pool = u.searchParams.get('unread_only') === '1' ? UNREAD : u.searchParams.get('read_only') === '1' ? READ : UNREAD.concat(READ);
        return json({ notifications: pool.slice(offset, offset + limit), total: pool.length, has_more: offset + limit < pool.length });
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div style="position:fixed;inset:0;display:flex;flex-direction:column"><div style="flex:none;height:96px">the menu's head</div>
<ul class="ovs-list" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;padding:6px;list-style:none"><li><div id="host"></div></li></ul></div>
<script src="/notification-ui.js"></script>
<script>try { localStorage.removeItem('ovn-unread'); localStorage.setItem('ovn-swiped', '1'); } catch (e) {} OpenVibeNotifications.init({ token: 'tok_1', apiBase: location.origin }); const v = OpenVibeNotifications.renderMenuNotifications(document.getElementById('host'), () => {}); v.showAll();</script>`);
});

// The list from the top: headers, rows (by id), the Earlier line and the caught-up line, in order.
const SHAPE = `[...document.querySelectorAll('#host [data-role="list"] > *')].map((el) =>
    el.classList.contains('openvibe-nv-day') ? 'day:' + el.textContent.trim()
    : el.classList.contains('openvibe-notif-item') ? 'row:' + el.dataset.id
    : el.classList.contains('openvibe-nv-earlier') ? 'EARLIER'
    : el.classList.contains('ovn-caught') ? 'caught' : null).filter(Boolean)`;
const above = (shape) => shape.slice(0, shape.indexOf('EARLIER'));

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-days-'));
    const browser = await h.launch({ tmpDir });
    const until = async (p, expr, what, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await new Promise((r) => setTimeout(r, 60)); } };
    try {
        const base = `http://127.0.0.1:${server.address().port}/`;
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(base, { maxMs: 6000 });
        await until(p, "!!document.querySelector('#host .openvibe-nv-earlier')", 'the Earlier line');
        const first = above(await p.evaluate(SHAPE));
        assert.equal(first.filter((x) => x.startsWith('day:')).length, 3, `three days above the Earlier line (${first.join(' ')})`);
        assert.equal(first[0], 'day:Today');
        assert.equal(first[1], 'row:1');

        // A swipe clears today's only row: Today's header goes with it, the others stay.
        await p.evaluate(`(() => {
            const row = document.querySelector('#host .openvibe-notif-item[data-id="1"] .ovn-row');
            const r = row.getBoundingClientRect(); const y = r.top + r.height / 2;
            const fire = (type, x) => row.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y, bubbles: true }));
            fire('pointerdown', 40); fire('pointermove', 70); fire('pointermove', 200); fire('pointermove', 340); fire('pointerup', 340);
        })()`);
        await until(p, `!${SHAPE}.includes('row:1')`, 'the swiped row folds away');
        await until(p, `!${SHAPE}.slice(0, ${SHAPE}.indexOf('EARLIER')).includes('day:Today')`, "today's header goes with its last row");
        const afterSwipe = above(await p.evaluate(SHAPE));
        assert.deepEqual(afterSwipe.filter((x) => x.startsWith('day:')).length, 2, `the other days stay (${afterSwipe.join(' ')})`);
        assert.ok(posts.includes('/api/notifications/1/read'), `the swipe read it on the account (${posts.join(' ')})`);

        // Clear all: every unread row folds, every header above the Earlier line goes, and the list says so in one line.
        await p.evaluate("document.querySelector('#host [data-act=\"read-all\"]').click()");
        await until(p, `(() => { const s = ${SHAPE}; const a = s.slice(0, s.indexOf('EARLIER')); return a.length === 1 && a[0] === 'caught'; })()`, 'nothing but the caught-up line above the Earlier line', 4000);
        const end = await p.evaluate(SHAPE);
        const below = end.slice(end.indexOf('EARLIER') + 1);
        assert.ok(below[0].startsWith('day:'), `the Earlier part keeps its day headers (${below.slice(0, 3).join(' ')})`);
        assert.ok(below.filter((x) => x.startsWith('row:')).length >= 6, 'and its rows');
        assert.ok(posts.includes('/api/notifications/read-all'));

        console.log('notifications-days-chrome: a cleared day takes its header; Clear all empties the unread part to one caught-up line; Earlier keeps its days');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
