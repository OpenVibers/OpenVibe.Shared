'use strict';
// The menu's Chat → Global and Servers (4.312.0; the owner's phone, 11-18: "tap don't open user menu", "3 updates shipped
// … improve", the ↓ ✓ pill on the last card, and on Servers the name box and New server both showing, "dupe … float down …
// fixed"), over a local Dock at 390 px:
//   - a press on a name opens that person's sheet (Profile, Message, Mention, their channel); Mention puts @name in the box;
//   - a run of shipped updates says what shipped before it opens;
//   - Servers: the name box shows only after New server, and the foot sits at the pane's bottom.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('dock-global-people-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;height:100%;font:14px system-ui;background:#161820;color:#eee}#host{position:fixed;inset:0;display:flex;flex-direction:column}</style>
    <script>const of = window.fetch.bind(window); window.fetch = (u, i) => of(String(u).replace('https://openvibe.network', location.origin), i);
    window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };</script>
    <script src="/dock.js"></script></head><body><div id="host"></div>
    <script>try { localStorage.setItem('ovdk-chat-seg', 'global'); } catch {}
    OpenVibeDock.mount({token:()=>'local-token',me:'local',apiBase:location.origin,chatBase:location.origin,actorBase:location.origin,agentBase:location.origin,sibling:(n)=>'/'+n,status:()=>{}});
    setTimeout(() => { window.m = OpenVibeDock.mountInto(document.getElementById('host'), { tab: 'chats' }); }, 30);</script></body></html>`;
const lines = [
    { id: 1, username: 'kai', display_name: 'Kai', message: 'hello all', timestamp: ago(30) },
    { id: 2, username: 'openvibe', display_name: 'OpenVibe', message_type: 'system', message: '\u{1F680} 3 updates shipped: Faster search · A new menu · Fewer bugs', timestamp: ago(20) },
    { id: 3, username: 'remy', display_name: 'Remy', message: 'nice', timestamp: ago(10) },
];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const file = /^\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (file && fs.existsSync(path.join(ROOT, file[1]))) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, file[1]))); }
    if (u.pathname === '/api/chat/global/read') return json(200, { last_read_id: 3, unread: 0, more: false });
    if (u.pathname === '/api/chat/global/history') {
        if (u.searchParams.get('after_id') != null) return json(200, { messages: [], latest_id: 3, complete: true });
        return json(200, { messages: [...lines].reverse(), latest_id: 3, more: false });
    }
    if (u.pathname === '/api/dm/conversations') return json(200, { conversations: [] });
    if (u.pathname === '/api/chat/servers') return json(200, { mine: [{ id: 1, slug: 'openvibe', name: 'OpenVibe', member_count: 1 }, { id: 2, slug: 'test', name: 'Test', member_count: 1 }], public: [] });
    if (u.pathname === '/api/v1/me/friends') return json(200, { mutual: [], requests: [], asked: [] });
    if (u.pathname === '/api/v1/me/dock') return json(200, { state: { open: false, tab: 'chats', pinned: true, place: { phone: {}, desktop: {} } }, counts: { unread: 0 } });
    if (u.pathname === '/api/dm/unread') return json(200, { unread: 0 });
    return json(404, {});
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-people-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(base, { maxMs: 8000 });
        await until(p, "!!document.querySelector('.ovdk-seg[data-seg=global]')");
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=global]').click()");
        await until(p, "document.querySelectorAll('.ovdk-gl-list > [data-id]').length >= 3");

        // A run of shipped updates says what shipped before it opens.
        const pv = await until(p, "(document.querySelector('.ovcc--shipped .ovcc-pv') || {}).textContent");
        assert.strictEqual(pv, 'Faster search · A new menu · Fewer bugs');

        // A name opens the person's sheet; Mention puts @name in the box.
        const nm = await p.evaluate("(() => { const b = document.querySelector('.ovdk-gl-row .ovdk-gl-h b.ovdk-person'); return b && { role: b.getAttribute('role'), text: b.textContent }; })()");
        assert.deepStrictEqual(nm, { role: 'button', text: 'Kai' });
        await p.evaluate("document.querySelector('.ovdk-gl-row .ovdk-gl-h b.ovdk-person').click()");
        const sheet = await until(p, "(() => { const s = document.querySelector('.ovp.is-in'); return s && s.querySelectorAll('.ovp-row').length && { title: s.querySelector('.ovp-title').textContent, intro: (s.querySelector('.ovp-intro') || {}).textContent, rows: [...s.querySelectorAll('.ovp-row b')].map((b) => b.textContent) }; })()");
        assert.deepStrictEqual(sheet, { title: 'Kai', intro: '@kai', rows: ['Profile', 'Message', 'Mention', 'Channel'] });
        await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row')].find((r) => /Mention/.test(r.textContent)).click()");
        await until(p, "(document.querySelector('.ovdk-gl-say input') || {}).value === '@kai '");
        // Profile opens the person's page on the Network.
        await pause(300);
        await p.evaluate("document.querySelector('.ovdk-gl-row .ovdk-av.ovdk-person').click()");
        await until(p, "!!document.querySelector('.ovp.is-in .ovp-row')");
        await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row')].find((r) => /Profile/.test(r.textContent)).click()");
        assert.strictEqual(await until(p, 'window.__opened[0]'), 'https://openvibe.network/@kai');

        // Servers: no name box until New server; the foot at the pane's bottom.
        await pause(300);
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=servers]').click()");
        await until(p, "!!document.querySelector('.ovdk-fab')");
        const sv = await p.evaluate(`(() => { const f = document.querySelector('.ovdk-sv-new'); const foot = document.querySelector('.ovdk-sv-foot').getBoundingClientRect(); const sc = document.querySelector('.ovdk-scroll').getBoundingClientRect();
            return { box: !!f && getComputedStyle(f).display !== 'none', gap: Math.round(sc.bottom - foot.bottom) }; })()`);
        assert.strictEqual(sv.box, false, 'the name box waits for New server');
        assert.ok(sv.gap <= 24, `the foot sits at the bottom (${sv.gap} px above it)`);
        await p.evaluate("document.querySelector('.ovdk-fab').click()");
        await until(p, "getComputedStyle(document.querySelector('.ovdk-sv-new')).display !== 'none'");
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'nothing off the screen');
        assert.deepStrictEqual(errors, []);
        console.log('dock-global-people-chrome: a name opens the person (Profile, Message, Mention, Channel), shipped says what, Servers without the duplicate box, the foot at the bottom ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
