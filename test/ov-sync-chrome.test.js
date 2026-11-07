'use strict';
// ov-sync.js in a real headless Chrome (seven domains B4): two <video> elements follow one
// common.sync-clock@1 timeline over two mock room sockets. The clock is measured with the same
// `time` ping/pong frames Chat sends; the test watches both players for 10 s, then pauses, seeks,
// changes the room's rate, and checks that a non-holder's local seek is put back with a notice
// while a holder's local seek becomes the room's new state. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-sync-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const VIDEO = path.join(__dirname, 'fixtures', 'ov-sync-clock.webm');

// The page is both ends of the room protocol: a fake socket per player, one server clock 5 s ahead
// of the browser's, the same `time` and `sync` frames Chat sends, and a lease ann holds.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ov-sync</title>
<link rel="icon" href="data:,"><style>video{width:160px;height:90px;background:#000}</style></head>
<body><video id="a" muted playsinline preload="auto" src="/ov-sync-clock.webm"></video>
<video id="b" muted playsinline preload="auto" src="/ov-sync-clock.webm"></video>
<script src="/ov-sync.js"></script>
<script>
(function () {
    const ROOM = 'friday-film';
    const SERVER_OFFSET = 5000;
    const serverNow = () => Date.now() + SERVER_OFFSET;
    let seq = 1;
    const state = { room: ROOM, media: '/ov-sync-clock.webm', position_ms: 0, rate: 1, paused: false,
        at_ms: serverNow(), set_by: 'usr_ann', seq: seq };
    let lease = { thing: 'chat.room:' + ROOM, holder: { kind: 'person', subject: 'usr_ann' },
        since_ms: serverNow(), watchers: ['usr_ann', 'usr_bob'], seq: 1 };
    const sockets = [];

    function broadcast(frame) { for (const s of sockets) s.emit(frame); }
    function makeSocket(subject) {
        const listeners = { message: new Set(), open: new Set() };
        const s = {
            readyState: 1, subject, sent: [],
            addEventListener(type, fn) { if (listeners[type]) listeners[type].add(fn); },
            removeEventListener(type, fn) { if (listeners[type]) listeners[type].delete(fn); },
            send(raw) {
                const msg = JSON.parse(raw);
                s.sent.push(msg);
                if (msg.type === 'time') {
                    const t0 = msg.t0;
                    setTimeout(() => s.emit({ type: 'time', id: msg.id, t0, t_server: serverNow() }), 2 + Math.random() * 8);
                } else if (msg.type === 'sync') {
                    if (lease.holder.kind !== 'person' || lease.holder.subject !== subject) {
                        s.emit({ type: 'sync_error', code: 'sync.not_holder', message: 'Only the holder may set the clock.' });
                        return;
                    }
                    state.media = msg.media === undefined ? state.media : msg.media;
                    state.position_ms = msg.position_ms;
                    state.rate = msg.rate === undefined ? state.rate : msg.rate;
                    state.paused = msg.paused === undefined ? state.paused : msg.paused;
                    state.at_ms = serverNow();
                    state.set_by = subject;
                    state.seq = ++seq;
                    broadcast({ type: 'sync', room: ROOM, state: state });
                }
            },
            emit(msg) { for (const fn of listeners.message) fn({ data: JSON.stringify(msg) }); },
        };
        sockets.push(s);
        return s;
    }

    function currentPosition() {
        return state.paused ? state.position_ms : state.position_ms + (serverNow() - state.at_ms) * state.rate;
    }
    function change(patch) {
        Object.assign(state, patch);
        state.at_ms = serverNow();
        state.seq = ++seq;
        broadcast({ type: 'sync', room: ROOM, state: state });
    }
    window.__server = {
        state, lease, serverNow, currentPosition,
        pause() { change({ paused: true, position_ms: Math.max(0, Math.round(currentPosition())) }); },
        seek(position_ms) { change({ paused: true, position_ms: position_ms }); },
        play(rate) { change({ paused: false, rate: rate || 1, position_ms: Math.max(0, Math.round(currentPosition())) }); },
        setLease(next) { lease = next; broadcast({ type: 'lease', room: ROOM, state: lease }); },
    };
    window.__drifts = [];
    window.__start = function () {
        const a = document.getElementById('a');
        const b = document.getElementById('b');
        window.__a = OVSync.attach(a, { room: ROOM, socket: makeSocket('usr_ann'), self: 'usr_ann' });
        window.__b = OVSync.attach(b, { room: ROOM, socket: makeSocket('usr_bob'), self: 'usr_bob' });
        setTimeout(() => {
            broadcast({ type: 'lease', room: ROOM, state: lease });
            broadcast({ type: 'sync', room: ROOM, state: state });
        }, 50);
        setInterval(() => {
            if (!window.__a || !window.__b) return;
            window.__drifts.push({ a: window.__a.drift(), b: window.__b.drift(),
                ca: window.__a.clock().ready, cb: window.__b.clock().ready });
        }, 200);
        return true;
    };
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(PAGE);
    }
    if (req.url === '/ov-sync.js') {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        return res.end(fs.readFileSync(path.join(ROOT, 'ov-sync.js')));
    }
    if (req.url === '/ov-sync-clock.webm') {
        const body = fs.readFileSync(VIDEO);
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (range) {
            const start = range[1] ? Number(range[1]) : 0;
            const end = range[2] ? Number(range[2]) : body.length - 1;
            res.writeHead(206, {
                'content-type': 'video/webm', 'accept-ranges': 'bytes',
                'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1,
            });
            return res.end(body.subarray(start, end + 1));
        }
        res.writeHead(200, { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-length': body.length });
        return res.end(body);
    }
    res.writeHead(404);
    res.end();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-sync-test-'));
    const browser = await h.launch({ tmpDir, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 640 });
        await p.goto(`${base}/`, { maxMs: 10000 });
        assert.strictEqual(await p.evaluate('document.readyState'), 'complete');
        await p.evaluate('window.__start()');

        const until = Date.now() + 8000;
        while (Date.now() < until) {
            const ready = await p.evaluate('window.__a.clock().ready && window.__b.clock().ready');
            if (ready) break;
            await sleep(100);
        }
        assert.ok(await p.evaluate('window.__a.clock().ready && window.__b.clock().ready'), 'both players measured the room clock');
        const clocks = await p.evaluate('[window.__a.clock(), window.__b.clock()]');
        for (const c of clocks) {
            assert.ok(Number.isFinite(c.offset) && Math.abs(c.offset - 5000) < 1500, `the 5 s server offset is measured (${JSON.stringify(c)})`);
        }

        // Play from one timeline for 10 s and keep every sample.
        await sleep(1500);
        await p.evaluate('window.__drifts = []');
        await sleep(10000);
        const stats = await p.evaluate(`(() => {
            const ds = window.__drifts.filter((x) => x.ca && x.cb);
            return { n: ds.length, maxA: Math.max(...ds.map((x) => Math.abs(x.a))), maxB: Math.max(...ds.map((x) => Math.abs(x.b))) };
        })()`);
        assert.ok(stats.n >= 40, `sampled the 10 s (${stats.n} samples)`);
        assert.ok(stats.maxA <= 80 && stats.maxB <= 80, `both stay inside ±80 ms (${JSON.stringify(stats)})`);

        // Pause: both elements stop and hold the room's position.
        await p.evaluate('window.__server.pause()');
        await sleep(500);
        const paused = await p.evaluate(`(() => ({ a: document.getElementById('a').paused, b: document.getElementById('b').paused,
            ta: document.getElementById('a').currentTime, tb: document.getElementById('b').currentTime, want: window.__server.currentPosition() }))()`);
        assert.ok(paused.a && paused.b, `both pause with the room: ${JSON.stringify(paused)}`);
        assert.ok(Math.abs(paused.ta * 1000 - paused.want) <= 80 && Math.abs(paused.tb * 1000 - paused.want) <= 80,
            `both hold the paused position: ${JSON.stringify(paused)}`);

        // Seek: a paused seek lands on both.
        await p.evaluate('window.__server.seek(12000)');
        await sleep(600);
        const sought = await p.evaluate('[document.getElementById("a").currentTime, document.getElementById("b").currentTime]');
        for (const t of sought) assert.ok(Math.abs(t * 1000 - 12000) <= 80, `a seek reaches both (${JSON.stringify(sought)})`);

        // Rate change: both play at the room's 1.25 (a nudge may ride on top of it).
        await p.evaluate('window.__server.play(1.25)');
        await sleep(2500);
        const rate = await p.evaluate(`(() => ({ a: document.getElementById('a').playbackRate, b: document.getElementById('b').playbackRate,
            pa: document.getElementById('a').paused, pb: document.getElementById('b').paused,
            da: window.__a.drift(), db: window.__b.drift() }))()`);
        assert.ok(!rate.pa && !rate.pb, `both play at the room's rate: ${JSON.stringify(rate)}`);
        for (const r of [rate.a, rate.b]) assert.ok(r >= 1.25 * 0.95 - 0.001 && r <= 1.25 * 1.05 + 0.001, `rate nudge stays 0.95–1.05 of 1.25 (${r})`);
        assert.ok(Math.abs(rate.da) <= 80 && Math.abs(rate.db) <= 80, `still in sync after the rate change: ${JSON.stringify(rate)}`);

        // A non-holder's local seek snaps back, with a short notice.
        const before = await p.evaluate('({ want: window.__server.currentPosition(), seq: window.__server.state.seq })');
        await p.evaluate('document.getElementById("b").currentTime = 3');
        await sleep(700);
        const back = await p.evaluate(`(() => ({ t: document.getElementById('b').currentTime,
            want: window.__server.currentPosition(),
            notice: document.querySelector('[data-ov-sync-notice]') ? document.querySelector('[data-ov-sync-notice]').textContent : null,
            seq: window.__server.state.seq }))()`);
        assert.ok(Math.abs(back.t * 1000 - back.want) <= 150,
            `a non-holder's seek is put back (${JSON.stringify(back)})`);
        assert.match(back.notice || '', /Only the person with the remote/, 'the snap-back says why');
        assert.strictEqual(back.seq, before.seq, 'a non-holder cannot change the room');

        // A holder's local seek becomes the room's new state and reaches the other player.
        await p.evaluate('document.getElementById("a").currentTime = 18');
        await sleep(700);
        const held = await p.evaluate(`(() => ({ set_by: window.__server.state.set_by, position: window.__server.state.position_ms,
            want: window.__server.currentPosition(),
            ta: document.getElementById('a').currentTime, tb: document.getElementById('b').currentTime }))()`);
        assert.strictEqual(held.set_by, 'usr_ann', 'the holder set the room');
        assert.ok(Math.abs(held.position - 18000) < 600, `the holder's seek is the timeline (${held.position})`);
        assert.ok(Math.abs(held.ta * 1000 - held.want) <= 200 && Math.abs(held.tb * 1000 - held.want) <= 300,
            `both follow the holder's seek (${JSON.stringify(held)})`);

        assert.deepStrictEqual(p.state.errors, [], 'no page errors');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('ov-sync-chrome: 2 players in sync for 10 s, through a pause, a seek and a rate change');
})().catch((err) => {
    server.close();
    console.error(err);
    process.exit(1);
});
