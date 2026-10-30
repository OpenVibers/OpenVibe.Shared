'use strict';
// The Dock (dock.js, the pill in navbar.js; Dock plan 2026-10-30 K-D1) in a real headless Chrome, against a local
// stand-in for the Network's GET/PUT /api/v1/me/dock, /api/v1/me/actions and the notification routes:
//   • the pill shows only while an agent works, one needs you, or it is pinned; it names both, in its corner;
//   • a 404 (Network without the route yet) keeps it away, and signed out there is none;
//   • a tap opens the card on Agents when something needs you (waiting first, approve in place), Activity is the
//     bell's list, Escape closes and gives the focus back to the pill;
//   • every change reaches the Network as one debounced PUT; on a desktop the head drags the card to a corner and the
//     free corner resizes it inside 320-720 × 360-900; an open Dock reopens by itself on a desktop, never on a phone;
//   • desktop toasts are told to stack above the pill; nothing runs off a 320 px screen;
//   • Chats (K-D2): the person's conversations from Chat's API with their unread counts, a thread opened in place (theirs
//     and mine), Enter sends, the thread is marked read, the open chat is the Dock's state, and opening one on a phone
//     never reads as a tap outside the sheet;
//   • Pop out (K-D4): the button only where the browser can open a window of its own; the panel moves into it with
//     its tabs and its styles, the page keeps the pill saying where the Dock went, and closing the window brings the
//     panel back; the Network is told.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const iso = (ago) => new Date(Date.now() - ago).toISOString();
const item = (o) => ({ actions: [], cost_usd: null, steps: null, kind: 'task', error: null, next_run_at: null, updated_at: iso(60e3), ...o });
const ACTIONS = {
    generated_at: iso(2000), sources: { actor: 'ok', codes: 'ok' },
    counts: { running: 2, waiting: 1, scheduled: 0, done: 0, failed: 0 },
    buckets: {
        waiting: [item({ id: 'apr_1', service: 'actor', agent: 'Researcher', bucket: 'waiting', state: 'waiting', title: 'Send the weekly digest?', summary: 'It wants to send from your address.', href: 'https://openvibe.actor/tasks/t1', actions: ['approve', 'decline'] })],
        running: [
            item({ id: 'tsk_1', service: 'codes', agent: 'Codex', bucket: 'running', state: 'running', title: 'Fix the flaky upload test', summary: 'Step 14: the suite.', href: 'https://openvibe.codes/run/tasks/tsk_1', steps: 14 }),
            item({ id: 't2', service: 'actor', agent: 'Actor', bucket: 'running', state: 'running', title: 'Compare three VPS offers', summary: 'Reading the providers.', href: 'https://openvibe.actor/tasks/t2', steps: 6 }),
        ],
        scheduled: [], done: [], failed: [],
    },
};
const NOTES = [
    { id: 1, type: 'agent_done', category: 'agents', service: 'codes', title: 'Codes finished a task', message: 'The suite passed.', priority: 'normal', is_read: 0, created_at: iso(300e3) },
    { id: 2, type: 'mention', category: 'social', service: 'chat', title: 'kai mentioned you', message: 'look at the shots?', priority: 'normal', is_read: 0, created_at: iso(900e3) },
];

// The stand-in's state for the scenario under way.
let scenario = {};
const puts = [], decided = [], said = [], reads = [];
const defaultState = () => ({ open: false, tab: 'activity', pinned: false, agent: null, chat: null, place: { phone: { corner: 'bottom-right' }, desktop: { corner: 'bottom-right', width: null, height: null } }, updated_at: iso(0) });

const PAGE = (o) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tasks</title><link rel="icon" href="data:,">
<style>body{margin:0;font:15px system-ui}main{padding:16px}p{margin:0 0 12px}</style></head>
<body><div id="navbar-mount"></div><main>${'<p>Fix the flaky upload test in the Media client and add a regression case.</p>'.repeat(30)}</main>
<script src="/navbar.js"></script>
<script>OpenVibeNavbar.init({ service: 'codes', brandName: 'OpenVibe.Codes', notifications: false, dockApiBase: location.origin, dockChatBase: location.origin,
  ${o.signedIn === false ? 'user: null,' : "token: 'tok_user', user: { id: 7, username: 'ada', display_name: 'Ada', avatar_url: null },"}
  links: [{ label: 'Tasks', href: '/', icon: 'fa-list' }] });</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        if (u.pathname === '/page') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE({ signedIn: u.searchParams.get('in') !== '0' })); }
        if (u.pathname === '/api/v1/me/dock') {
            if (scenario.missing) return json(404, { code: 'not_found' });
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', 'the Dock reads with the person\'s token');
            if (req.method === 'PUT') { const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); puts.push(b); scenario.state = { ...(scenario.state || defaultState()), ...b, place: { ...((scenario.state || defaultState()).place), ...(b.place || {}) } }; }
            return json(200, { state: scenario.state || defaultState(), counts: scenario.counts || { running: 0, waiting: 0, unread: 0 }, sources_partial: false });
        }
        if (u.pathname === '/api/v1/me/actions') return json(200, ACTIONS);
        const m = /^\/api\/v1\/me\/actions\/(\w+)\/(\w+)\/(approve|decline)$/.exec(u.pathname);
        if (m && req.method === 'POST') { decided.push(m.slice(1).join(':')); return json(200, { item: ACTIONS.buckets.waiting[0] }); }
        // Chat's DM API, as OpenVibe.Chat answers it (server/chat/dm-routes.js).
        if (u.pathname === '/api/dm/unread') return json(200, { unread: 3 });
        if (u.pathname === '/api/dm/conversations') {
            const ada = { id: 1, username: 'ada', display_name: 'Ada' }, kai = { id: 2, username: 'kai', display_name: 'Kai Moreno' }, jo = { id: 3, username: 'jo', display_name: 'Jo' };
            return json(200, { conversations: [
                { id: 11, name: null, is_group: false, last_message: 'see the shots?', last_sender_id: 2, last_message_at: iso(240e3), unread_count: 2, participants: [ada, kai] },
                { id: 12, name: 'Design crit', is_group: true, last_message: 'Shipped it', last_sender_id: 1, last_message_at: iso(3600e3), unread_count: 0, participants: [ada, kai, jo] },
            ] });
        }
        const dm = /^\/api\/dm\/conversations\/(\d+)\/(messages|read)$/.exec(u.pathname);
        if (dm && dm[2] === 'read') { reads.push(dm[1]); return json(200, { ok: true }); }
        if (dm && req.method === 'POST') { said.push(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').message); return json(201, { message: { id: 900 + said.length } }); }
        if (dm) {
            const after = Number(u.searchParams.get('after')) || 0;
            const all = [{ id: 101, username: 'kai', display_name: 'Kai Moreno', message: 'see the shots?', created_at: iso(240e3) }, { id: 102, username: 'ada', display_name: 'Ada', message: '<b>on it</b>', created_at: iso(120e3) }]
                .concat(said.map((m, i) => ({ id: 901 + i, username: 'ada', display_name: 'Ada', message: m, created_at: iso(0) })));
            return json(200, { messages: all.filter((m) => m.id > after) });
        }
        if (u.pathname === '/api/notifications/unread-count') return json(200, { count: 2 });
        if (u.pathname === '/api/notifications/unread-by-tab') return json(200, { tabs: { all: 2 } });
        if (u.pathname === '/api/notifications') return json(200, { notifications: NOTES, total: NOTES.length, has_more: false });
        const name = u.pathname.slice(1);
        if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
        res.writeHead(404); res.end();
    });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(p, expr, what, ms = 5000) {
    const end = Date.now() + ms;
    for (;;) {
        const v = await p.evaluate(expr);
        if (v) return v;
        if (Date.now() > end) throw new Error(`timed out: ${what}`);
        await wait(80);
    }
}
const PILL = `(() => { const p = document.getElementById('ovdk-pill'); if (!p || p.hidden) return null; const b = p.getBoundingClientRect();
    return { text: p.innerText.trim(), label: p.getAttribute('aria-label'), corner: p.dataset.corner, tone: p.dataset.tone, l: b.left, r: b.right, t: b.top, bt: b.bottom,
        clear: getComputedStyle(document.documentElement).getPropertyValue('--ov-dock-clear').trim() }; })()`;
const CARD = `(() => { const c = document.querySelector('.ovdk'); if (!c || c.hidden) return null; const b = c.getBoundingClientRect();
    return { corner: c.dataset.corner, w: Math.round(b.width), h: Math.round(b.height), l: b.left, t: b.top, tab: (c.querySelector('[role=tab][aria-selected=true]') || {}).dataset?.tab,
        groups: [...c.querySelectorAll('.ovac-group')].map((g) => g.dataset.bucket), items: c.querySelectorAll('.ovac-item').length, notes: c.querySelectorAll('.openvibe-notif-item').length }; })()`;

// A stand-in for the browser's Document Picture-in-Picture window: a same-origin frame with a real document, so the
// Dock can move into it (K-D4) and be seen coming back. `__pip.close()` is the person closing that window.
const PIP = `(() => {
    const f = document.createElement('iframe');
    f.id = 'pip-stub';
    f.style.cssText = 'position:fixed;right:16px;bottom:16px;width:360px;height:520px;border:0;z-index:99999;background:#0d0d12';
    document.body.appendChild(f);
    const w = f.contentWindow;
    const shut = () => { try { w.dispatchEvent(new w.Event('pagehide')); } catch (e) { } try { f.remove(); } catch (e) { } };
    w.close = shut;
    window.__pip = { win: w, frame: f, close: shut };
    window.documentPictureInPicture = { requestWindow: async (o) => { window.__pip.opts = o || null; return w; } };
    return true;
})()`;

async function drag(p, from, to) {
    await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0], y: from[1] });
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from[0], y: from[1], button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 8; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from[0] + (to[0] - from[0]) * i / 8, y: from[1] + (to[1] - from[1]) * i / 8, button: 'left', buttons: 1 });
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to[0], y: to[1], button: 'left', buttons: 0, clickCount: 1 });
}

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-'));
    const browser = await h.launch({ tmpDir });
    const fresh = async (width, height = 860) => { const context = await browser.newContext(); const p = await h.openPage(browser, context, { width, height }); return p; };
    try {
        // ── Nothing runs, nothing waits, not pinned: no pill. Pinned: the pill, a mark alone. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 3 } };
            const p = await fresh(390);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await wait(700);
            assert.strictEqual(await p.evaluate(PILL), null, 'no pill while nothing runs or waits (unread alone is the bell\'s)');
            scenario.state = { ...defaultState(), pinned: true };
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const pin = await until(p, PILL, 'the pinned pill');
            assert.deepStrictEqual([pin.text, pin.tone, pin.label], ['', 'idle', 'Open the Dock'], 'pinned and idle: the mark alone');
            await p.close();
        }

        // ── A phone: the pill says what matters, the sheet opens on Agents, Escape closes it. ──
        {
            scenario = { counts: { running: 2, waiting: 1, unread: 2 } };
            puts.length = 0; decided.length = 0;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const pill = await until(p, PILL, 'the pill');
            assert.deepStrictEqual([pill.text, pill.label, pill.corner, pill.tone], ['Needs you', '1 needs you, 2 working', 'bottom-right', 'waiting']);
            assert.ok(pill.r <= 390 - 16 + 0.5 && pill.bt <= 780 - 16 + 0.5, `the pill keeps its 16 px from the edges (${pill.r}, ${pill.bt})`);
            assert.strictEqual(pill.clear, '0px', 'phones: the toasts are at the top, nothing to clear');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            const card = await until(p, `(() => { const c = ${CARD}; return c && c.items ? c : null; })()`, 'the Agents tab');
            assert.deepStrictEqual([card.tab, card.groups, card.items], ['agent', ['waiting', 'running'], 3], 'what needs you first, then what runs');
            assert.ok(card.w === 390 && card.t > 60, 'a sheet across the phone, under the bar');
            assert.strictEqual(await p.evaluate('document.getElementById("ovdk-pill").hidden'), true, 'the pill steps aside while the Dock is open');
            await p.evaluate("document.querySelector('.ovdk .ovac-item[data-bucket=waiting] button[data-do=approve]').click()");
            await until(p, "document.querySelector('.ovdk .ovac-item[data-bucket=waiting] .primary').textContent === 'Approved'", 'approved in place');
            assert.deepStrictEqual(decided, ['actor:apr_1:approve'], 'the approval goes to the Network for that item');
            await p.evaluate("document.getElementById('ovdk-tab-activity').click()");
            await until(p, `(() => { const c = ${CARD}; return c && c.tab === 'activity' && c.notes === 2; })()`, 'the Activity tab');
            await p.evaluate("document.querySelector('.ovdk [role=tab][aria-selected=true]').focus(); document.querySelector('.ovdk').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
            await until(p, `!(${CARD})`, 'Escape closes');
            assert.strictEqual(await p.evaluate('document.activeElement && document.activeElement.id'), 'ovdk-pill', 'the focus goes back to the pill');
            await wait(900);
            const all = Object.assign({}, ...puts);
            assert.deepStrictEqual([all.open, all.tab], [false, 'activity'], `the Network heard where the Dock was left (${JSON.stringify(puts)})`);
            assert.ok(puts.length <= 3, `changes go as debounced PUTs, not one per click (${puts.length})`);
            // The Network says it was left open: a phone does not throw a sheet over the next page.
            scenario.state = { ...scenario.state, open: true };
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, PILL, 'the pill again');
            await wait(400);
            assert.strictEqual(await p.evaluate(CARD), null, 'a phone opens the Dock only when asked');
            await p.close();
        }

        // ── Chats (K-D2): the list, a thread in place, Enter sends, read, remembered; a phone keeps the sheet open. ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            puts.length = 0; said.length = 0; reads.length = 0;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, PILL, 'the pill');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            await until(p, "!!document.getElementById('ovdk-tab-chats')", 'the Chats tab');
            await until(p, "document.querySelector('[data-n=chats]').textContent === '3'", 'the unread count from Chat');
            await p.evaluate("document.getElementById('ovdk-tab-chats').click()");
            const rows = await until(p, "(() => { const r = [...document.querySelectorAll('.ovdk .ovdk-chat')]; return r.length ? r.map((b) => b.getAttribute('aria-label') + ' | ' + b.querySelector('.ovdk-chat-p').textContent) : null; })()", 'the conversations');
            assert.deepStrictEqual(rows, ['Kai Moreno, 2 unread | see the shots?', 'Design crit | You: Shipped it'], 'named for the other person (or the group), unread first, mine as "You:"');
            await p.evaluate("document.querySelector('.ovdk .ovdk-chat').click()");
            const thread = await until(p, "(() => { const m = [...document.querySelectorAll('.ovdk .ovdk-msg')]; return m.length === 2 ? m.map((x) => (x.classList.contains('is-mine') ? 'me: ' : 'them: ') + x.querySelector('.ovdk-text').textContent) : null; })()", 'the thread');
            assert.deepStrictEqual(thread, ['them: see the shots?', 'me: <b>on it</b>'], 'theirs and mine, and what people wrote is text, never markup');
            assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk:not([hidden])')"), true, 'opening a chat on a phone is not a tap outside the sheet');
            await p.evaluate("(() => { const b = document.querySelector('.ovdk-send textarea'); b.value = 'Looks good'; b.dispatchEvent(new Event('input')); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()");
            await until(p, "document.querySelectorAll('.ovdk .ovdk-msg').length === 3", 'the sent message in the thread');
            assert.deepStrictEqual(said, ['Looks good'], 'Enter sends it to Chat');
            assert.ok(reads.includes('11'), 'the thread is marked read as it is shown');
            await wait(900);
            assert.ok(puts.some((b) => b.chat === '11'), `the open chat is the Dock's state (${JSON.stringify(puts)})`);
            await p.evaluate("document.querySelector('.ovdk-back').click()");
            await until(p, "document.querySelectorAll('.ovdk .ovdk-chat').length === 2", 'back to the list');
            await p.close();
        }

        // ── 320 px: nothing runs off the screen, closed or open. ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            const p = await fresh(320, 640);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const pill = await until(p, PILL, 'the pill at 320');
            assert.strictEqual(pill.text, 'Working');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            await until(p, CARD, 'the sheet at 320');
            assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 320, 'no sideways scroll');
            await p.close();
        }

        // ── A desktop: the card at the corner, dragged and resized; an open Dock reopens by itself; toasts clear it. ──
        {
            scenario = { counts: { running: 2, waiting: 1, unread: 2 } };
            puts.length = 0;
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const pill = await until(p, PILL, 'the desktop pill');
            assert.strictEqual(pill.clear, '58px', 'desktop toasts stack above the pill in their corner');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            await until(p, `(() => { const c = ${CARD}; return c && c.items ? c : null; })()`, 'the desktop card');
            await wait(400); // past the grow-in (a transform), so the box is the card's own
            let card = await p.evaluate(CARD);
            assert.deepStrictEqual([card.corner, card.w, card.h], ['bottom-right', 400, 560], 'a 400 × 560 card in the pill\'s corner');
            // Drag the head from its middle to near the top left: it snaps to that corner.
            await drag(p, [card.l + 120, card.t + 26], [180, 90]); // from the Activity tab: a drag, not a tap
            card = await until(p, `(() => { const c = ${CARD}; return c && c.corner === 'top-left' ? c : null; })()`, 'the card snaps to the top left');
            assert.strictEqual(card.tab, 'agent', 'a drag that began on a tab does not pick it');
            await wait(400);
            card = await p.evaluate(CARD);
            assert.ok(card.l <= 17 && card.t >= 60 && card.t < 80, `it sits in the top-left corner, under the bar (${card.l}, ${card.t})`);
            // The free corner (bottom right, now) resizes it, inside the limits.
            await drag(p, [card.l + card.w - 8, card.t + card.h - 8], [card.l + card.w + 2000, card.t + card.h - 400]);
            card = await p.evaluate(CARD);
            assert.deepStrictEqual([card.w, card.h], [720, 360], 'it stops at 720 wide and 360 tall');
            await wait(900);
            const place = Object.assign({}, ...puts.filter((b) => b.place).map((b) => b.place.desktop));
            assert.deepStrictEqual([place.corner, place.width, place.height], ['top-left', 720, 360], `the Network keeps where and how big (${JSON.stringify(puts)})`);
            // The next page restores it open on a desktop, where it was left.
            await p.goto(`${base}/page`, { maxMs: 5000 });
            card = await until(p, `(() => { const c = ${CARD}; return c && c.corner === 'top-left' ? c : null; })()`, 'the Dock reopens where it was');
            assert.deepStrictEqual([card.w, card.h], [720, 360], 'the same size');
            await p.close();
        }

        // ── Pop out (K-D4): the button only where the browser can open a window; the panel goes there and comes back. ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            puts.length = 0;
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            // Where the browser cannot open a window of its own, there is nothing to press.
            await p.evaluate("(() => { Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, writable: true, configurable: true }); return true; })()");
            await until(p, PILL, 'the pill');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            await until(p, CARD, 'the card');
            const POP = "document.querySelector('.ovdk [data-act=pop]')";
            assert.strictEqual(await p.evaluate(`!!${POP}`), true, 'the header carries a pop-out button');
            assert.strictEqual(await p.evaluate(`${POP}.hidden`), true, 'hidden where the browser cannot open a window of its own');
            // The browser can: the button appears.
            await p.evaluate(PIP);
            await p.evaluate("document.querySelector('.ovdk [data-act=close]').click()");
            await until(p, PILL, 'the pill again');
            await p.evaluate("document.getElementById('ovdk-pill').click()");
            await until(p, `(() => { const b = ${POP}; return b && !b.hidden ? true : null; })()`, 'the pop-out button');
            // The panel moves into the window: the same DOM, the same tabs, the styles come with it.
            await p.evaluate(`${POP}.click()`);
            await until(p, "!!(window.__pip && window.__pip.win.document.querySelector('.ovdk'))", 'the panel in the window');
            assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk')"), false, 'and not in the page any more');
            assert.strictEqual(await p.evaluate("window.__pip.win.document.querySelectorAll('.ovdk [role=tab]').length"), 3, 'the same three tabs');
            assert.strictEqual(await p.evaluate("!!window.__pip.win.document.getElementById('ovdk-styles')"), true, "the Dock's styles come with it");
            assert.deepStrictEqual(await p.evaluate("window.__pip.opts"), { width: 360, height: 520 }, 'a window of about 360 × 520');
            const inWindow = await until(p, PILL, 'the pill stays');
            assert.strictEqual(inWindow.text, 'In a window', 'the page keeps the pill, and it says where the Dock went');
            await wait(900);
            assert.ok(puts.some((b) => b.popped === true && b.open === true), `the Network is told the Dock is in a window (${JSON.stringify(puts)})`);
            // The window is closed: the panel comes back to the page.
            await p.evaluate("window.__pip.close()");
            await until(p, "!!document.querySelector('.ovdk')", 'the panel back on the page');
            assert.strictEqual(await p.evaluate("!!window.__pip.win.document.querySelector('.ovdk')"), false, 'and out of the window');
            await wait(900);
            assert.ok(puts.some((b) => b.popped === false), `and told it is back (${JSON.stringify(puts)})`);
            await p.close();
        }

        // ── Network without the route yet (404): no pill, and the site stops asking for a day. Signed out: none. ──
        {
            scenario = { missing: true };
            const p = await fresh(1280);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await wait(700);
            assert.strictEqual(await p.evaluate(PILL), null, 'no pill without the route');
            const off = await p.evaluate("JSON.parse(localStorage.getItem('ov-dock') || 'null')");
            assert.ok(off && off.off > Date.now() + 23 * 3600e3, 'and it waits a day before asking again');
            await p.evaluate("localStorage.removeItem('ov-dock')");
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            await p.goto(`${base}/page?in=0`, { maxMs: 5000 });
            await wait(600);
            assert.strictEqual(await p.evaluate("document.getElementById('ovdk-pill')"), null, 'signed out: no pill at all');
            await p.close();
        }
        console.log('dock-chrome: the pill only when it matters, Agents, Chats and Activity, debounced state, drag and resize, restore on desktops only, 320 px clean, the Dock pops out and comes back');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
