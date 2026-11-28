'use strict';
// Global: reaching the end reads all of it (4.316.0; the owner's phone, 11-18: "1 new message" with Mark read, "doesn't
// work or clear on scroll"). The setup is dock-global-unread-chrome's: Chat has read up to line 40 of 60. (Its notes, kept:
// Global opens where you stopped (4.293.0; the owner, 11-17: "remember where you were in the chat last and … save it
// locally and on the server … it should say new messages … in the middle of the chat wherever you last read so that you
// can scroll through and read them all, and then that should actually mark these down as you scroll through them all
// … animated … smart and fast"). A local page mounts the Dock's Chats panel over a stand-in Chat that has read up to
// line 40 of 60: the Global count says 20; Global opens at a New messages line just under line 40 with what was read
// above it; lines seen on screen turn read and the count falls; the mark reaches this device and Chat; the pill says what
// waits below and takes you there; Mark all as read clears it; a line that comes while you read further up is new and
// the pill says so; older lines come as you scroll up.)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-global-unread-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;height:100%;font:14px system-ui;background:#161820;color:#eee}#host{position:fixed;inset:0;display:flex;flex-direction:column}</style>
    <script>const of = window.fetch.bind(window); window.fetch = (u, i) => of(String(u).replace('https://openvibe.network', location.origin), i);</script>
    <script src="/dock.js"></script></head><body><div id="host"></div>
    <script>try { localStorage.setItem('ovdk-chat-seg', 'messages'); } catch {}
    OpenVibeDock.mount({token:()=>'local-token',me:'local',apiBase:location.origin,chatBase:location.origin,actorBase:location.origin,agentBase:location.origin,sibling:(n)=>'/'+n,status:()=>{}});
    setTimeout(() => { window.m = OpenVibeDock.mountInto(document.getElementById('host'), { tab: 'chats' }); }, 30);</script></body></html>`;
const WHO = ['kai', 'remy', 'juno', 'mira'];
let tip = 60;
const line = (id) => ({ id, username: WHO[id % 4], display_name: WHO[id % 4].replace(/^./, (c) => c.toUpperCase()), message: `line ${id} of the day`, timestamp: ago(Math.max(0, 70 - id)) });
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const posted = [];
const asked = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const file = /^\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (file && fs.existsSync(path.join(ROOT, file[1]))) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, file[1]))); }
    if (u.pathname === '/api/chat/global/read') {
        if (req.method === 'POST') {
            let body = ''; req.on('data', (c) => { body += c; });
            return req.on('end', () => { posted.push(Number(JSON.parse(body).id)); json(200, { last_read_id: Math.max(...posted) }); });
        }
        return json(200, { last_read_id: 40, unread: 20, more: false });
    }
    if (u.pathname === '/api/chat/global/history') {
        asked.push(u.search);
        const after = u.searchParams.get('after_id'), before = u.searchParams.get('before'), limit = Number(u.searchParams.get('limit')) || 50;
        if (after != null) { const ids = range(Number(after) + 1, tip).slice(0, limit); return json(200, { messages: ids.map(line), latest_id: ids.length ? ids[ids.length - 1] : Number(after), complete: true }); }
        const hi = before ? Number(before) - 1 : tip; const ids = range(Math.max(1, hi - limit + 1), hi).reverse();
        return json(200, { messages: ids.map(line), latest_id: tip, more: ids.length && ids[ids.length - 1] > 1 });
    }
    if (u.pathname === '/api/dm/conversations') return json(200, { conversations: [] });
    if (u.pathname === '/api/chat/servers') return json(200, { mine: [], public: [] });
    if (u.pathname === '/api/v1/me/friends') return json(200, { mutual: [], requests: [], asked: [] });
    if (u.pathname === '/api/v1/me/dock') return json(200, { state: { open: false, tab: 'chats', pinned: true, place: { phone: {}, desktop: {} } }, counts: { unread: 0 } });
    if (u.pathname === '/api/dm/unread') return json(200, { unread: 0 });
    return json(404, {});
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expression, ms = 6000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = await p.evaluate(expression); if (v) return v; await pause(50); }
    throw new Error(`Timed out: ${expression}`);
}
const badge = `(document.querySelector('.ovdk-seg[data-seg=global] .ovdk-seg-n:not(.is-gone)') || {}).textContent || ''`;
const unreadCount = `document.querySelectorAll('.ovdk-gl-list > .is-unread').length`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-global-end-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 360, height: 740 });
        const errors = [];
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        assert.strictEqual(await until(p, badge), '20', 'twenty new in Global');
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=global]').click()");
        await until(p, "!!document.querySelector('.ovdk-gl-new')");
        // A flick straight to the end: the lines passed on the way were never on screen long enough to count, and before
        // 4.316.0 they stayed new (the owner: the pill does not "clear on scroll"). At the end, all of it is read.
        await p.evaluate("const sc = document.querySelector('.ovdk-scroll'); sc.scrollTop = sc.scrollHeight;");
        // 12 s, not 5: GitHub's macOS runner took 16 s for this file and timed out here (11-18, red on main twice). 20 s,
        // and the view kept at the end while it waits (11-28, red again on macOS at 12 s): on a slow runner the list was
        // still growing after the flick, so the view was no longer at the end; a person at the end stays there.
        await until(p, `(() => { const sc = document.querySelector('.ovdk-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; return ${unreadCount} === 0 && !document.querySelector('.ovdk-seg[data-seg=global] .ovdk-seg-n:not(.is-gone)'); })()`, 20000);
        // Off the screen, not only flagged hidden (4.332.0: the pill's display: flex beat its hidden attribute).
        await until(p, "(() => { const j = document.querySelector('.ovdk-gl-jump'); return !j || (getComputedStyle(j).display === 'none' && !j.querySelector('.ovdk-gl-jump-c').getClientRects().length); })()", 2000);
        await h.eventually(async () => assert.strictEqual(Math.max(...posted), 60, `Chat hears the newest line (${posted})`));
        assert.deepStrictEqual(errors, [], 'no page errors');
        console.log('dock-global-end-chrome: reaching the end of Global reads all of it, the count and the pill go');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
