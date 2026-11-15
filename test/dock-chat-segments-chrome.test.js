'use strict';
// The menu's Chat tab in four segments (4.263.0; the owner, 11-15: "segments Messages · Friends · Global · Servers; Friends
// Discord-style (online first with presence, pending with Accept/Decline, add a friend there …); no add field over the
// DMs; no Vibe row"). A local page mounts the Dock's Chats panel; the Network's friends read is sent to the local stand-in.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-chat-segments-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    html,body{margin:0;height:100%;font:14px system-ui;background:#161820;color:#eee}#host{position:fixed;inset:0;display:flex;flex-direction:column}</style>
    <script>const of = window.fetch.bind(window); window.fetch = (u, i) => of(String(u).replace('https://openvibe.network', location.origin), i);</script>
    <script src="/dock.js"></script></head><body><div id="host"></div>
    <script>OpenVibeDock.mount({token:()=>'local-token',me:'local',apiBase:location.origin,chatBase:location.origin,actorBase:location.origin,agentBase:location.origin,sibling:(n)=>'/'+n,status:()=>{},openMenu:()=>{}});
    setTimeout(() => { window.m = OpenVibeDock.mountInto(document.getElementById('host'), { tab: 'chats' }); }, 30);</script></body></html>`;
const me = { id: 1, username: 'local', display_name: 'Local' };
const calls = [];
const FIX = {
    '/api/dm/conversations': { conversations: [{ id: 11, is_group: false, last_message: 'see the shots?', last_sender_id: 2, last_message_at: ago(4), unread_count: 2, participants: [me, { id: 2, username: 'kai', display_name: 'Kai Moreno' }] }] },
    '/api/vibe/conversations': { conversations: [{ slug: 'v1', name: 'Plans', last_message_at: ago(1) }], count: 1 },
    '/api/chat/servers': { mine: [{ slug: 'saturday-raiders', name: 'Saturday Raiders', unread: 5 }, { slug: 'bad slug!', name: 'Nope' }] },
    '/api/chat/global/history': { messages: [{ id: 1, username: 'kai', display_name: 'Kai', message: '<b>hi</b> all', timestamp: ago(3) }, { id: 2, username: 'remy', message: 'later', timestamp: ago(1) }, { id: 3, username: 'x', message: '', is_deleted: true, timestamp: ago(2) }] },
    '/api/v1/me/friends': { mutual: [{ subject: 'usr_3', username: 'juno', display_name: 'Juno', online: false }, { subject: 'usr_1', username: 'kai', display_name: 'Kai Moreno', online: true, site: 'Live' }],
        requests: [{ subject: 'usr_9', username: 'lena', display_name: 'Lena' }, { subject: 'usr_7', username: 'bo', display_name: 'Bo' }], asked: [{ subject: 'usr_8', username: 'otto', display_name: 'Otto' }] },
};
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://local');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const file = /^\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (file && fs.existsSync(path.join(ROOT, file[1]))) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, file[1]))); }
    calls.push(`${req.method} ${u.pathname}`);
    if (req.method === 'POST' && /^\/api\/v1\/me\/friends\/[^/]+\/accept$/.test(u.pathname)) return json(200, { friend: { state: 'friends' } });
    if (FIX[u.pathname]) return json(200, FIX[u.pathname]);
    if (u.pathname === '/api/v1/me/dock') return json(200, { state: { open: false, tab: 'chats', pinned: true, place: { phone: {}, desktop: {} } }, counts: { unread: 2 } });
    if (u.pathname === '/api/dm/unread') return json(200, { unread: 2 });
    return json(404, {});
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expression, ms = 6000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = await p.evaluate(expression); if (v) return v; await pause(50); }
    throw new Error(`Timed out: ${expression}`);
}

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-chat-segs-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 780 });
        await p.goto(base, { maxMs: 6000 });
        const segs = await until(p, "(() => { const b = [...document.querySelectorAll('.ovdk-seg')]; return b.length === 4 ? b.map((x) => [x.dataset.seg, x.getAttribute('aria-selected'), (x.querySelector('.ovdk-seg-n') || {}).textContent || '']) : null; })()");
        assert.deepStrictEqual(segs, [['messages', 'true', '2'], ['friends', 'false', '2'], ['global', 'false', ''], ['servers', 'false', '5']], 'four segments, Messages first, each with what waits in it');
        // Messages: the conversations only (no friends strip, no add field, no Vibe row, no rail of places).
        const msgs = await until(p, "(() => { const s = document.querySelector('.ovdk-scroll'); const r = [...s.querySelectorAll('.ovdk-chat')]; return r.length ? { rows: r.map((b) => b.getAttribute('aria-label')), add: !!s.querySelector('.ovdk-addfriend'), rail: !!document.querySelector('.ovdk-rail'), vibe: /Vibe/.test(s.textContent) } : null; })()");
        assert.deepStrictEqual(msgs, { rows: ['Kai Moreno, 2 unread'], add: false, rail: false, vibe: false });
        assert.ok(!calls.includes('GET /api/vibe/conversations'), 'Vibe\'s conversations are not read for the Chat tab');
        // Friends: add at the top, then Pending, Online, Offline, Asked.
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=friends]').click()");
        const fr = await until(p, "(() => { const s = document.querySelector('.ovdk-fr'); return s ? { add: !!s.querySelector('.ovdk-addfriend input'), secs: [...s.querySelectorAll('.ovdk-sec')].map((x) => x.textContent), names: [...s.querySelectorAll('.ovdk-row-b b')].map((x) => x.textContent), online: [...s.querySelectorAll('.ovdk-av.is-online')].length } : null; })()");
        assert.deepStrictEqual(fr.secs, ['Pending · 2', 'Online · 1', 'Offline · 1', 'Asked · 1']);
        assert.deepStrictEqual(fr.names, ['Lena', 'Bo', 'Kai Moreno', 'Juno', 'Otto'], 'requests, then online first, then the rest, then the ones you asked');
        assert.ok(fr.add && fr.online === 1, 'add a friend here; the one online wears the green ring');
        await p.evaluate("[...document.querySelectorAll('.ovdk-fr .is-request')].find((r) => /Lena/.test(r.textContent)).querySelector('.ovdk-request-ok').click()");
        await until(p, "!document.querySelector('.ovdk-fr .is-request') || ![...document.querySelectorAll('.ovdk-fr .is-request')].some((r) => /Lena/.test(r.textContent))");
        assert.ok(calls.includes('POST /api/v1/me/friends/usr_9/accept'), 'Accept adds them back on the account');
        await p.evaluate("[...document.querySelectorAll('.ovdk-fr .is-request')].find((r) => /Bo/.test(r.textContent)).querySelector('.ovdk-request-no').click()");
        await until(p, "!document.querySelector('.ovdk-fr .is-request')");
        assert.ok(await p.evaluate("[...document.querySelectorAll('.ovdk-fr .ovdk-sec')].map((x) => x.textContent).join('|') === 'Online · 1|Offline · 2|Asked · 1'"), 'Lena is a friend now (offline); Bo is ignored');
        assert.ok(await p.evaluate("JSON.parse(localStorage.getItem('ovdk-fr-ignored')).includes('usr_7')"), 'an ignored request stays ignored here');
        // Global: what people wrote, as text, newest last, and the way into the room.
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=global]').click()");
        const gl = await until(p, "(() => { const r = [...document.querySelectorAll('.ovdk-gl-row')]; return r.length ? { rows: r.map((x) => x.querySelector('.ovdk-gl-t').textContent), bold: document.querySelectorAll('.ovdk-gl-t b').length, open: (document.querySelector('.ovdk-gl-open') || {}).href } : null; })()");
        assert.deepStrictEqual(gl.rows, ['<b>hi</b> all', 'later'], 'deleted lines left out; what people wrote is text');
        assert.strictEqual(gl.bold, 0);
        assert.strictEqual(gl.open, 'https://openvibe.chat/');
        // Servers: yours (a bad slug never becomes a link), then start or find one.
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=servers]').click()");
        const sv = await until(p, "(() => { const s = document.querySelector('.ovdk-sv'); return s ? { rows: [...s.querySelectorAll('a.ovdk-row')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]), acts: [...s.querySelectorAll('.ovdk-sv-act')].map((a) => a.textContent) } : null; })()");
        assert.deepStrictEqual(sv.rows, [['https://openvibe.chat/s/saturday-raiders', 'Saturday Raiders, 5 unread']]);
        assert.deepStrictEqual(sv.acts, ['Start a server', 'Find servers']);
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'no sideways scroll');
        // The chosen segment is kept: the panel opens there next time.
        await p.goto(base, { maxMs: 6000 });
        await until(p, "(() => { const b = document.querySelector('.ovdk-seg[aria-selected=true]'); return b && b.dataset.seg === 'servers'; })()");
        // Keys: the arrows move along the segments.
        await p.evaluate("document.querySelector('.ovdk-seg[aria-selected=true]').focus(); document.querySelector('.ovdk-segs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
        await until(p, "document.querySelector('.ovdk-seg[aria-selected=true]').dataset.seg === 'messages'");
        console.log('dock-chat-segments-chrome: four segments with counts, conversations alone, friends Discord-style (accept, ignore), Global as text, servers, kept and keyboard ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
