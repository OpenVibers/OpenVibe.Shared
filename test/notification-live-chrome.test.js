'use strict';
// notification-live.js in a real headless Chrome (a real EventSource) against a local stand-in for Network's
// ticket route and Events' /realtime/stream (single-use tickets, subject filtering, replay from last_event_id,
// `event: gap` past retention). Roadmap WS-F task 1's browser tests: a disconnect resumes from the cursor with a
// fresh ticket and nothing is lost or repeated; a gap is reported; an event for another person yields nothing.
// Events' own refusal of a guessed user:<other> topic and of other people's events is OpenVibe.Events
// test/realtime-tickets.test.js. Skipped (exit 0) when Chrome is not installed or OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('notification-live-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ALICE = 'usr_01JAB2C3D4E5F6G7H8J9K0MNPQ';
const BOB = 'usr_01JAB2C3D4E5F6G7H8J9K0MNPR';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The stand-in: a ticket route and an SSE stream with Events' rules, in memory ──
const log = [];          // { seq, subject, id }
let oldest = 1;          // retention: seqs below are gone
let seq = 0;
const issued = new Map(); // ticket -> subject (unused)
const streams = new Set(); // { res, subject }
const streamRequests = [];
let ticketN = 0;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>bell</title><link rel="icon" href="data:,"></head><body><p>bell</p>
<script src="/notification-live.js"></script>
<script>
  window.heard = []; window.gaps = []; window.states = [];
  window.live = OVNotificationLive.create({
    ticketUrl: '/api/v1/realtime/ticket', token: 'jwt-alice', credentials: 'omit',
    onNotification: (p, e) => heard.push(e.payload.notification_id), onGap: (g) => gaps.push(g.reason), onState: (s) => states.push(s),
  }).start();
</script></body></html>`;

function sendEvent(res, e) {
    const event = { event_id: `evt_${e.seq}`, event_type: 'network.notification.created', visibility: 'subject', subject: { type: 'user', id: e.subject }, payload: { notification_id: e.id, unread_count: e.seq } };
    res.write(`id: ${e.seq}\ndata: ${JSON.stringify({ seq: e.seq, event })}\n\n`);
}
/** A new notification: stored, then streamed to its person (or, `leak`, to everyone: a misbehaving server). */
function publish(subject, id, { leak = false } = {}) {
    const e = { seq: ++seq, subject, id };
    log.push(e);
    for (const s of streams) if (leak || s.subject === subject) sendEvent(s.res, e);
    return e.seq;
}
function dropAll() { for (const s of [...streams]) { streams.delete(s); s.res.socket.destroy(); } }

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (u.pathname === '/notification-live.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'notification-live.js'))); }
    if (u.pathname === '/api/v1/realtime/ticket') {
        if (req.method !== 'POST' || req.headers.authorization !== 'Bearer jwt-alice' || req.headers.cookie) { res.writeHead(401); return res.end('{}'); }
        const ticket = `tk-${++ticketN}`;
        issued.set(ticket, ALICE);
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ ticket, expires_at: new Date(Date.now() + 120000).toISOString(), expires_in: 120, stream_url: `${origin}/realtime/stream`, topics: ['network.notification.*'], subject: ALICE }));
    }
    if (u.pathname === '/realtime/stream') {
        const ticket = u.searchParams.get('ticket');
        const last = u.searchParams.get('last_event_id');
        streamRequests.push({ ticket, last, topics: u.searchParams.get('topics'), cookie: req.headers.cookie || null });
        if (!/^[a-z0-9_.*,]+$/.test(u.searchParams.get('topics') || '')) { res.writeHead(400); return res.end('{}'); }
        const subject = issued.get(ticket);
        if (!subject) { res.writeHead(401); return res.end('{"code":"ticket.used"}'); }   // unknown or already used
        issued.delete(ticket);
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        res.write('retry: 3000\n: connected user\n\n');
        if (last != null) {
            let cursor = Number(last);
            if (cursor < oldest - 1) { res.write(`event: gap\ndata: ${JSON.stringify({ reason: 'retention', from_seq: cursor + 1, to_seq: oldest - 1 })}\n\n`); cursor = oldest - 1; }
            for (const e of log) if (e.seq > cursor && e.seq >= oldest && e.subject === subject) sendEvent(res, e);
        }
        const s = { res, subject };
        streams.add(s);
        req.on('close', () => streams.delete(s));
        return undefined;
    }
    res.writeHead(404); res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-notif-live-'));
    const browser = await h.launch({ tmpDir });
    let context = null; let page = null;
    const read = () => page.evaluate('({ heard: window.heard, gaps: window.gaps, state: window.live.state() })');
    const until = async (pred, what, ms = 8000) => {
        const t0 = Date.now();
        for (;;) {
            const v = await read();
            if (pred(v)) return v;
            if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(v)}`);
            await sleep(100);
        }
    };
    try {
        context = await browser.newContext();
        page = await h.openPage(browser, context, { width: 390 });
        await page.goto(`${base}/`, { maxMs: 5000 });
        await until((v) => v.state.state === 'open', 'the stream to open');
        assert.deepStrictEqual(streamRequests.map((r) => [r.ticket, r.last, r.topics, r.cookie]), [['tk-1', null, 'network.notification.*', null]], 'first stream: a ticket, no cursor, no cookie');

        // Alice's notifications arrive; one delivered to her stream for Bob is ignored.
        publish(ALICE, 'a1');
        publish(BOB, 'b1', { leak: true });
        publish(ALICE, 'a2');
        let v = await until((x) => x.heard.length === 2, 'a1 and a2');
        assert.deepStrictEqual(v.heard, ['a1', 'a2']);
        assert.strictEqual(v.state.ignored, 1, 'another person\'s event yields nothing');
        assert.strictEqual(v.state.lastSeq, 3);

        // The connection drops (Events restarts); while it is down two more notifications are stored.
        dropAll();
        publish(ALICE, 'a3');
        publish(BOB, 'b2');
        publish(ALICE, 'a4');
        v = await until((x) => x.heard.length === 4 && x.state.state === 'open', 'the resume');
        assert.deepStrictEqual(v.heard, ['a1', 'a2', 'a3', 'a4'], 'the missed ones, in order, nothing twice');
        const resumed = streamRequests[streamRequests.length - 1];
        assert.deepStrictEqual([resumed.ticket, resumed.last], ['tk-2', '3'], 'a fresh ticket and the cursor');
        assert.strictEqual(new Set(streamRequests.filter((r) => issued.has(r.ticket) === false).map((r) => r.ticket)).size, streamRequests.length, 'a ticket is never used twice');
        publish(ALICE, 'a5');
        await until((x) => x.heard.length === 5, 'live again');

        // Past retention: the stream says so (event: gap) before what it still has.
        dropAll();
        publish(ALICE, 'a6');
        oldest = seq + 1;               // everything so far is pruned
        publish(ALICE, 'a7');
        v = await until((x) => x.gaps.length === 1 && x.heard.includes('a7'), 'the gap and a7');
        assert.deepStrictEqual(v.gaps, ['retention']);
        assert.ok(!v.heard.includes('a6'), 'a6 was pruned: the gap stands for it');
        assert.strictEqual(page.state.errors.filter((e) => !/realtime\/stream|EventSource|net::ERR/.test(`${e.text} ${e.url}`)).length, 0, JSON.stringify(page.state.errors));

        // stop(): the stream closes and nothing reconnects.
        await page.evaluate('window.live.stop(), 0');
        const n = streamRequests.length;
        await sleep(2500);
        assert.strictEqual(streamRequests.length, n);
        assert.strictEqual(streams.size, 0);
    } finally {
        if (page) await page.close();
        if (context) await context.dispose();
        await browser.close();
        server.close(); server.closeAllConnections?.();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('notification-live-chrome: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
