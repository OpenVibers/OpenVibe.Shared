'use strict';
// The menu's Chat tab in four segments (4.263.0; the owner, 11-15: "segments Messages · Friends · Global · Servers; Friends
// Discord-style (online first with presence, pending with Accept/Decline, add a friend there …); no add field over the
// DMs; no Vibe row"). 4.275.0 (the owner's phone, 11-15: "auto fill", "icon", "improve", "built in"): names offered as you
// type, Global as the room itself (live, with a box to say something), Servers started and joined right here. A local page mounts the Dock's Chats panel; the Network's friends read is sent to the local stand-in.
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
const sent = [];
const FIX = {
    '/api/dm/conversations': { conversations: [{ id: 11, is_group: false, last_message: 'see the shots?', last_sender_id: 2, last_message_at: ago(4), unread_count: 2, participants: [me, { id: 2, username: 'kai', display_name: 'Kai Moreno' }] }] },
    '/api/vibe/conversations': { conversations: [{ slug: 'v1', name: 'Plans', last_message_at: ago(1) }], count: 1 },
    '/api/chat/servers': { mine: [{ slug: 'saturday-raiders', name: 'Saturday Raiders', unread: 5 }, { slug: 'bad slug!', name: 'Nope' }],
        public: [{ slug: 'openvibe', name: 'OpenVibe', official: true, members: 120, description: 'Help with any OpenVibe site' }, { slug: 'saturday-raiders', name: 'Saturday Raiders', members: 9 }, { slug: 'pixel-art', name: 'Pixel Art', members: 1 }] },
    '/api/dm/users/search': { users: [{ id: 21, username: 'lenore', display_name: 'Lenore Park' }, { id: 3, username: 'juno', display_name: 'Juno' }] },
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
    if (req.method === 'PUT' && /^\/api\/v1\/me\/friends\/[^/]+$/.test(u.pathname)) return json(200, { friend: { state: 'asked' } });
    if (req.method === 'POST' && u.pathname === '/api/chat/send') { sent.push(1); return json(200, { ok: true }); }
    if (u.pathname === '/api/chat/global/history' && u.searchParams.get('after_id')) return json(200, { messages: sent.length ? [{ id: 9, username: 'local', display_name: 'Local', message: 'hello all', timestamp: ago(0) }] : [] });
    if (req.method === 'POST' && u.pathname === '/api/chat/servers') return json(201, { server: { slug: 'night-owls', name: 'Night Owls', members: 1 } });
    if (req.method === 'POST' && /^\/api\/chat\/servers\/[a-z0-9-]+\/join$/.test(u.pathname)) return json(200, { ok: true, role: 'member' });
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
        assert.strictEqual(await p.evaluate("(() => { const b = document.querySelector('.ovdk-addfriend-go'); return [b.getAttribute('aria-label'), !!b.querySelector('svg'), b.textContent.trim()].join('|'); })()"), 'Add friend|true|', 'Add is an icon');
        await p.evaluate("(() => { const i = document.querySelector('.ovdk-addfriend input'); i.focus(); i.value = 'len'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        const offered = await until(p, "(() => { const l = [...document.querySelectorAll('.ovdk-suggest .ovdk-sug')]; return l.length ? l.map((x) => x.querySelector('b').textContent) : null; })()");
        assert.deepStrictEqual(offered, ['Lenore Park'], 'names offered as you type (a friend already, Juno, is not offered)');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovdk-addfriend input').getAttribute('aria-expanded')"), 'true');
        await p.evaluate("document.querySelector('.ovdk-suggest .ovdk-sug').click()");
        await until(p, "/lenore/.test((document.querySelector('.ovdk-addfriend-note') || {}).textContent || '')");
        assert.ok(calls.includes('PUT /api/v1/me/friends/lenore'), 'a press on a name asks them');
        // A hat or a badge (items.js puts it before the name) sits on the name's line, never a row above it (the owner,
        // 11-16: "these go way off"); the empty list of names under the field takes no room.
        const line = await p.evaluate(`(() => { const b = document.querySelector('.ovdk-fr .ovdk-row-n > b'); const s = document.createElement('span'); s.className = 'ov-hat'; s.textContent = 'H'; b.parentNode.insertBefore(s, b);
            const hr = s.getBoundingClientRect(), br = b.getBoundingClientRect(); const sug = document.querySelector('.ovdk-suggest'); return { dy: Math.round(Math.abs((hr.top + hr.height / 2) - (br.top + br.height / 2))), left: hr.right <= br.left + 1, sug: sug ? sug.getBoundingClientRect().height : 0 }; })()`);
        assert.deepStrictEqual(line, { dy: 0, left: true, sug: 0 }, `a hat sits beside the name (${JSON.stringify(line)})`);
        await p.evaluate("[...document.querySelectorAll('.ovdk-fr .is-request')].find((r) => /Lena/.test(r.textContent)).querySelector('.ovdk-request-ok').click()");
        await until(p, "!document.querySelector('.ovdk-fr .is-request') || ![...document.querySelectorAll('.ovdk-fr .is-request')].some((r) => /Lena/.test(r.textContent))");
        assert.ok(calls.includes('POST /api/v1/me/friends/usr_9/accept'), 'Accept adds them back on the account');
        await p.evaluate("[...document.querySelectorAll('.ovdk-fr .is-request')].find((r) => /Bo/.test(r.textContent)).querySelector('.ovdk-request-no').click()");
        await until(p, "!document.querySelector('.ovdk-fr .is-request')");
        assert.ok(await p.evaluate("[...document.querySelectorAll('.ovdk-fr .ovdk-sec')].map((x) => x.textContent).join('|') === 'Online · 1|Offline · 2|Asked · 1'"), 'Lena is a friend now (offline); Bo is ignored');
        assert.ok(await p.evaluate("JSON.parse(localStorage.getItem('ovdk-fr-ignored')).includes('usr_7')"), 'an ignored request stays ignored here');
        // Global: what people wrote, as text, newest last, and the way into the room.
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=global]').click()");
        const gl = await until(p, "(() => { const r = [...document.querySelectorAll('.ovdk-gl-row')]; return r.length ? { rows: r.map((x) => x.querySelector('.ovdk-gl-t').textContent), bold: document.querySelectorAll('.ovdk-gl-t b').length, open: (document.querySelector('.ovdk-gl-full') || {}).href, say: !!document.querySelector('.ovdk-gl-say input'), fail: !!document.querySelector('.ovdk-gl-fail') } : null; })()");
        assert.deepStrictEqual(gl.rows, ['<b>hi</b> all', 'later'], 'deleted lines left out; what people wrote is text');
        assert.strictEqual(gl.bold, 0);
        assert.strictEqual(gl.open, 'https://openvibe.chat/');
        assert.deepStrictEqual([gl.say, gl.fail], [true, false], 'a box to say something, right here');
        await p.evaluate("(() => { const i = document.querySelector('.ovdk-gl-say input'); i.value = 'hello all'; document.querySelector('.ovdk-gl-say').requestSubmit(); })()");
        await until(p, "[...document.querySelectorAll('.ovdk-gl-row .ovdk-gl-t')].some((x) => x.textContent === 'hello all')");
        assert.ok(calls.includes('POST /api/chat/send'), 'said in Global, as the person');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovdk-gl-say input').value"), '', 'the box empties');
        // Servers: yours (a bad slug never becomes a link), then start or find one.
        await p.evaluate("document.querySelector('.ovdk-seg[data-seg=servers]').click()");
        const sv = await until(p, "(() => { const s = document.querySelector('.ovdk-sv'); return s ? { rows: [...s.querySelectorAll('a.ovdk-row')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-label')]), start: !!s.querySelector('.ovdk-sv-new input'), find: [...s.querySelectorAll('.ovdk-sv-find .ovdk-row-b b')].map((b) => b.textContent), secs: [...s.querySelectorAll('.ovdk-sec')].map((x) => x.textContent) } : null; })()");
        assert.deepStrictEqual(sv.rows, [['https://openvibe.chat/s/saturday-raiders', 'Saturday Raiders, 5 unread']]);
        assert.deepStrictEqual(sv.secs, ['Your servers · 1', 'Find servers · 2'], 'yours, then the public ones right here');
        assert.deepStrictEqual(sv.find, ['OpenVibe', 'Pixel Art'], 'the public ones you are not in');
        assert.ok(sv.start, 'start one right here');
        await p.evaluate("[...document.querySelectorAll('.ovdk-sv-find > li')].find((li) => /Pixel Art/.test(li.textContent)).querySelector('.ovdk-request-ok').click()");
        await until(p, "[...document.querySelectorAll('.ovdk-sv .ovdk-sec')].map((x) => x.textContent).join('|') === 'Your servers · 2|Find servers · 1'");
        assert.ok(calls.includes('POST /api/chat/servers/pixel-art/join'), 'Join joins, and it is yours above');
        await p.evaluate("(() => { const i = document.querySelector('.ovdk-sv-new input'); i.value = 'Night Owls'; document.querySelector('.ovdk-sv-new').requestSubmit(); })()");
        await until(p, "[...document.querySelectorAll('.ovdk-sv a.ovdk-row')].some((a) => a.getAttribute('href') === 'https://openvibe.chat/s/night-owls')");
        assert.ok(calls.includes('POST /api/chat/servers'), 'a server started right here is listed with yours');
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
