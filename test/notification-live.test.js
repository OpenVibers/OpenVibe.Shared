'use strict';
// notification-live.js and the bell (roadmap WS-E task 3, WS-F task 1; ADR-005 amendment 2), in a linkedom page
// with a fake EventSource, fetch and timers:
//   - it asks Network for a realtime ticket (Bearer, no cookies across sites) and opens Events' stream with it,
//     topics=network.notification.*, never with credentials; the ticket is never kept;
//   - the person's own network.notification.created calls onNotification; another person's (a guessed topic),
//     other types and replayed seqs do nothing;
//   - a disconnect reconnects with a fresh ticket and last_event_id; a gap is reported; hidden 5 min closes and
//     showing resumes; 401/403, 503 and a CSP refusal stop it; ten failures in a row stop it, `online` revives it;
//   - notification-ui with realtime on loads it from beside itself, re-reads the count on an event (once per burst,
//     and again when a poll was already in flight), re-reads the lists on a gap, and polls every 2 min while the
//     stream is open, every 15 s otherwise (CSP-blocked included); with realtime off nothing of it runs.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const linkedom = require('linkedom');

const ROOT = path.join(__dirname, '..');
const LIVE_SRC = fs.readFileSync(path.join(ROOT, 'notification-live.js'), 'utf8');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'notification-ui.js'), 'utf8');
const ALICE = 'usr_01JAB2C3D4E5F6G7H8J9K0MNPQ';
const BOB = 'usr_01JAB2C3D4E5F6G7H8J9K0MNPR';
const API = 'https://openvibe.network';
const STREAM = 'https://events.openvibe.network/realtime/stream';

function page({ url = 'https://openvibe.live/', eventSource = true, random = 0.5 } = {}) {
    const { window: lw, document } = linkedom.parseHTML('<!doctype html><html><head></head><body></body></html>');
    const origin = new URL(url).origin;
    const out = { requests: [], es: [], timers: new Map(), intervals: [], scripts: [], now: Date.parse('2026-09-26T18:00:00Z') };
    const state = { ticketStatus: 200, subject: ALICE, count: 0, tickets: 0, newest: '2026-09-26 17:00:00', fresh: [], slow: null };
    let hidden = false; let tid = 0; let currentSrc = null;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => (currentSrc ? { src: currentSrc } : null) });
    class FakeEventSource {
        constructor(u, init) { this.url = u; this.init = init; this.closed = false; this.listeners = {}; out.es.push(this); }
        addEventListener(type, f) { (this.listeners[type] = this.listeners[type] || []).push(f); }
        close() { this.closed = true; }
        opened() { if (this.onopen) this.onopen({}); }
        send(seq, event) { if (this.onmessage) this.onmessage({ data: JSON.stringify({ seq, event }), lastEventId: String(seq) }); }
        emit(type, data) { (this.listeners[type] || []).forEach((f) => f({ data: JSON.stringify(data) })); }
        fail() { if (this.onerror) this.onerror({}); }
    }
    const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    const listeners = {};
    class FakeDate extends Date {
        constructor(...a) { if (a.length) super(...a); else super(out.now); }
        static now() { return out.now; }
    }
    const ctx = {
        document, console, URL, URLSearchParams, JSON, Promise, Math: Object.assign(Object.create(Math), { random: () => random }), Date: FakeDate,
        Event: lw.Event || linkedom.Event, CustomEvent: lw.CustomEvent || linkedom.CustomEvent,
        location: { href: url, origin }, navigator: {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout: (f, ms) => { out.timers.set(++tid, { f, ms: Number(ms) || 0 }); return tid; },
        clearTimeout: (id) => { out.timers.delete(id); },
        setInterval: (f, ms) => { out.intervals.push({ f, ms }); return out.intervals.length; },
        clearInterval: (id) => { if (out.intervals[id - 1]) out.intervals[id - 1].f = () => {}; },
        addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener: () => {},
        dispatchEvent: (e) => { for (const f of listeners[e.type] || []) f(e); return true; },
        fetch: async (u, init = {}) => {
            const abs = new URL(String(u), url).href;
            const req = { url: abs, method: (init.method || 'GET').toUpperCase(), headers: init.headers || {}, credentials: init.credentials };
            out.requests.push(req);
            const p = new URL(abs);
            if (p.pathname === '/api/v1/realtime/ticket') {
                if (state.ticketStatus !== 200) return json(state.ticketStatus, { code: 'x' });
                state.tickets++;
                return json(200, { ticket: `hdr.T${state.tickets}.sig`, expires_at: '2026-09-26T18:02:00.000Z', expires_in: 120, stream_url: STREAM, topics: ['network.notification.*'], subject: state.subject });
            }
            if (p.pathname === '/api/notifications/unread-count') {
                if (state.slow) { const s = state.slow; state.slow = null; await s; }
                return json(200, { ok: true, count: state.count });
            }
            if (p.pathname === '/api/notifications/newest') return json(200, { ok: true, notification: { created_at: state.newest } });
            if (p.pathname === '/api/notifications') return json(200, { ok: true, notifications: p.searchParams.get('since') ? state.fresh : [], has_more: false, total: 0 });
            return json(404, {});
        },
    };
    if (eventSource) ctx.EventSource = FakeEventSource;
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    // A script the page appends "loads": notification-live.js runs, then onload fires.
    const append = document.head.appendChild.bind(document.head);
    document.head.appendChild = (node) => {
        const r = append(node);
        const src = node && node.tagName === 'SCRIPT' ? String(node.src || node.getAttribute('src') || '') : '';
        if (src) {
            out.scripts.push(src);
            setImmediate(() => {
                if (!/notification-live\.js$/.test(src)) { if (node.onerror) node.onerror(new ctx.Event('error')); return; }
                vm.runInContext(LIVE_SRC, ctx, { filename: 'notification-live.js' });
                if (node.onload) node.onload(new ctx.Event('load'));
            });
        }
        return r;
    };
    return {
        ctx, document, out, state,
        get es() { return out.es[out.es.length - 1]; },
        run(src, file, as) { currentSrc = as || null; try { vm.runInContext(src, ctx, { filename: file }); } finally { currentSrc = null; } },
        async settle(turns = 12) { for (let i = 0; i < turns; i++) await new Promise((r) => setImmediate(r)); },
        timeouts() { return [...out.timers.values()].map((x) => x.ms); },
        fire(filter) { const due = [...out.timers].filter(([, x]) => !filter || filter(x.ms)); for (const [id] of due) out.timers.delete(id); due.forEach(([, x]) => x.f()); return due.length; },
        tick(ms = 15000) { out.now += ms; out.intervals.filter((i) => i.ms === 15000).forEach((i) => i.f()); },
        setHidden(h) { hidden = !!h; document.dispatchEvent(new ctx.Event('visibilitychange')); },
        dispatch(type) { ctx.dispatchEvent(new ctx.Event(type)); },
        csp(blockedURI) { const e = new ctx.Event('securitypolicyviolation'); e.blockedURI = blockedURI; document.dispatchEvent(e); },
        tickets() { return out.requests.filter((r) => r.url === `${API}/api/v1/realtime/ticket`); },
        counts() { return out.requests.filter((r) => r.url === `${API}/api/notifications/unread-count`).length; },
    };
}

let seq = 0;
const created = (subject, over = {}) => ({
    event_id: `evt_01JAB2C3D4E5F6G7H8J9K0M${String(++seq).padStart(3, '0')}`, event_type: 'network.notification.created', version: 1, source: 'network',
    actor: { type: 'system', id: 'network' }, visibility: 'subject', subject: { type: 'user', id: subject },
    payload: { notification_id: `n${seq}`, type: 'STREAM_LIVE', category: 'stream', priority: 'normal', service: 'live', created_at: '2026-09-26T18:00:00.000Z', unread_count: seq },
    ...over,
});

(async () => {
    // ── The feed on its own ──────────────────────────────────────────────────────────────
    {
        const p = page();
        p.run(LIVE_SRC, 'notification-live.js');
        const heard = []; const gaps = []; const states = [];
        const live = p.ctx.OVNotificationLive.create({
            ticketUrl: `${API}/api/v1/realtime/ticket`, token: () => 'jwt-alice', credentials: 'omit',
            onNotification: (payload, ev) => heard.push([payload.notification_id, ev.subject.id]), onGap: (g) => gaps.push(g), onState: (s) => states.push(s),
        });
        live.start();
        await p.settle();
        // A ticket from Network with the person's token, no cookies; then the stream, without credentials.
        const tk = p.tickets();
        assert.strictEqual(tk.length, 1);
        assert.deepStrictEqual([tk[0].method, tk[0].headers.Authorization, tk[0].credentials], ['POST', 'Bearer jwt-alice', 'omit']);
        assert.strictEqual(p.out.es.length, 1);
        const s1 = p.es;
        assert.strictEqual(s1.url.split('?')[0], STREAM);
        assert.strictEqual(new URL(s1.url).searchParams.get('topics'), 'network.notification.*');
        assert.strictEqual(new URL(s1.url).searchParams.get('ticket'), 'hdr.T1.sig');
        assert.strictEqual(new URL(s1.url).searchParams.get('last_event_id'), null, 'nothing to resume on the first open');
        assert.strictEqual(s1.init, undefined, 'never withCredentials: the ticket is the credential');
        assert.strictEqual(live.state().state, 'connecting');
        s1.opened();
        assert.strictEqual(live.state().state, 'open');

        // The person's own notification is heard; another person's (a guessed topic), other types and replays are not.
        s1.send(10, created(ALICE));
        s1.send(11, created(BOB));
        s1.send(12, { ...created(ALICE), event_type: 'live.stream.started' });
        s1.send(13, { ...created(ALICE), subject: { type: 'stream', id: ALICE } });
        s1.send(10, created(ALICE));
        assert.deepStrictEqual(heard.map((h) => h[1]), [ALICE]);
        assert.deepStrictEqual([live.state().events, live.state().ignored, live.state().lastSeq], [1, 3, 13]);
        assert.ok(!JSON.stringify(live.state()).includes('T1'), 'the ticket is not kept');

        // A gap is reported.
        s1.emit('gap', { reason: 'retention', from_seq: 1, to_seq: 9 });
        assert.deepStrictEqual(gaps, [{ reason: 'retention', from_seq: 1, to_seq: 9 }]);

        // A disconnect: closed at once (the browser's own retry would reuse a spent ticket), then after 1-2 s a
        // fresh ticket and the cursor.
        s1.fail();
        assert.strictEqual(s1.closed, true);
        assert.strictEqual(live.state().state, 'backoff');
        assert.deepStrictEqual(p.timeouts(), [1500], 'the first retry after 1 to 2 s (jitter)');
        p.fire(); await p.settle();
        assert.strictEqual(p.tickets().length, 2, 'a new ticket for the reconnect');
        const s2 = p.es;
        assert.notStrictEqual(s2, s1);
        assert.deepStrictEqual([new URL(s2.url).searchParams.get('ticket'), new URL(s2.url).searchParams.get('last_event_id')], ['hdr.T2.sig', '13']);
        s2.opened();
        s2.send(14, created(ALICE));
        assert.deepStrictEqual(heard.map((h) => h[0]).length, 2);

        // Failures back off (2 s doubling, jitter) and give up after ten in a row; `online` revives it.
        const delays = [];
        for (let i = 0; i < 10; i++) {
            p.es.fail();
            if (i < 9) { delays.push(p.timeouts()[0]); p.fire(); await p.settle(); }
        }
        assert.deepStrictEqual(delays, [1500, 3000, 6000, 12000, 24000, 48000, 96000, 192000, 384000]);
        assert.strictEqual(live.state().state, 'failed');
        assert.deepStrictEqual(p.timeouts(), [], 'nothing scheduled: the page polls');
        const n = p.out.es.length;
        p.dispatch('online'); await p.settle();
        assert.strictEqual(p.out.es.length, n + 1, 'back online: a new stream');
        assert.strictEqual(new URL(p.es.url).searchParams.get('last_event_id'), '14', 'from the cursor');
        p.es.opened();

        // Hidden for 5 minutes: closed; shown: resumed from the cursor with a fresh ticket.
        p.setHidden(true);
        assert.deepStrictEqual(p.timeouts(), [300000]);
        const s3 = p.es;
        p.fire(); assert.strictEqual(s3.closed, true);
        assert.strictEqual(live.state().state, 'hidden');
        const t3 = p.tickets().length;
        p.setHidden(false); await p.settle();
        assert.strictEqual(p.tickets().length, t3 + 1);
        assert.strictEqual(new URL(p.es.url).searchParams.get('last_event_id'), '14');
        p.es.opened();

        // A Content-Security-Policy refusal of Events: closed, and nothing reopens it.
        const s4 = p.es;
        p.csp('https://events.openvibe.network/realtime/stream');
        assert.deepStrictEqual([s4.closed, live.state().state], [true, 'blocked']);
        s4.fail(); p.dispatch('online'); await p.settle();
        assert.strictEqual(live.state().state, 'blocked');
        assert.deepStrictEqual(p.timeouts(), []);
        // A refusal of anything else is not ours.
        live.restart(); await p.settle(); p.es.opened();
        p.csp('https://cdn.example.test/x.js');
        assert.strictEqual(live.state().state, 'open');
        assert.strictEqual(new URL(p.es.url).searchParams.get('last_event_id'), null, 'restart (another account) forgets the cursor');
        live.stop();
        assert.strictEqual(p.es.closed, true);
        assert.ok(states.includes('ticket') && states.includes('connecting') && states.includes('hidden'));
    }

    // ── Refusals from Network: signed out, realtime off, a transient error ───────────────────
    for (const [status, want] of [[401, 'signed-out'], [403, 'signed-out'], [503, 'unavailable'], [404, 'unavailable'], [500, 'backoff'], [429, 'backoff']]) {
        const p = page();
        p.run(LIVE_SRC, 'notification-live.js');
        p.state.ticketStatus = status;
        const live = p.ctx.OVNotificationLive.create({ ticketUrl: `${API}/api/v1/realtime/ticket`, token: 'jwt' }).start();
        await p.settle();
        assert.strictEqual(live.state().state, want, `ticket ${status}`);
        assert.strictEqual(p.out.es.length, 0, `no stream after a ${status}`);
        assert.deepStrictEqual(p.timeouts(), want === 'backoff' ? [1500] : [], `ticket ${status}: retry only when it may pass`);
    }
    // A ticket for someone else than the stream sends is never believed over the event's subject.
    {
        const p = page();
        p.run(LIVE_SRC, 'notification-live.js');
        p.state.subject = BOB;
        const heard = [];
        p.ctx.OVNotificationLive.create({ ticketUrl: `${API}/api/v1/realtime/ticket`, token: 'jwt', onNotification: (x) => heard.push(x) }).start();
        await p.settle(); p.es.opened();
        p.es.send(1, created(ALICE));
        assert.deepStrictEqual(heard, []);
        p.es.send(2, created(BOB));
        assert.strictEqual(heard.length, 1);
    }

    // ── The bell with realtime on ─────────────────────────────────────────────────────────
    {
        const p = page();
        p.run(UI_SRC, 'notification-ui.js', 'https://openvibe.live/shared/notification-ui.js?v=abc123');
        const N = p.ctx.OpenVibeNotifications;
        p.state.count = 2;
        N.init({ token: 'jwt-alice', apiBase: API, realtime: true });
        const bell = N.createBell(p.document.body);
        await p.settle();
        assert.deepStrictEqual(p.out.scripts, ['https://openvibe.live/shared/notification-live.js'], 'loaded from beside notification-ui.js');
        assert.strictEqual(p.tickets().length, 1);
        assert.strictEqual(p.tickets()[0].headers.Authorization, 'Bearer jwt-alice');
        assert.strictEqual(p.tickets()[0].credentials, 'omit', 'cross-site: the token, never cookies');
        assert.strictEqual(bell.querySelector('.badge').textContent, '2');
        p.es.opened();
        assert.strictEqual(N.realtimeState().state, 'open');

        // An event: one re-read of the count 300 ms later, however many arrive; new items toast.
        const before = p.counts();
        p.state.count = 5;
        p.state.fresh = [{ id: 'n9', type: 'STREAM_LIVE', title: 'carol is live!', priority: 'normal', created_at: '2026-09-26 18:00:01', is_read: 0 }];
        p.es.send(20, created(ALICE)); p.es.send(21, created(ALICE)); p.es.send(22, created(ALICE));
        assert.deepStrictEqual(p.timeouts().filter((ms) => ms === 300), [300]);
        p.fire((ms) => ms === 300); await p.settle();
        assert.strictEqual(p.counts(), before + 1, 'a burst is one request');
        assert.strictEqual(bell.querySelector('.badge').textContent, '5');
        assert.ok(p.document.querySelector('.openvibe-toast, .ov-toast, [class*="toast"]'), 'the new item toasts');

        // Another person's event (a guessed topic) re-reads nothing.
        p.es.send(23, created(BOB));
        assert.deepStrictEqual(p.timeouts().filter((ms) => ms === 300), []);

        // A poll already in flight when the event arrives may predate it: the re-read waits for it, then runs.
        let release; p.state.slow = new Promise((r) => { release = r; });
        p.tick(120000);                                   // the 2-min safety poll starts (and hangs)
        await p.settle(2);
        const inflight = p.counts();
        p.state.count = 6;
        p.es.send(24, created(ALICE));
        p.fire((ms) => ms === 300); await p.settle(2);
        assert.deepStrictEqual(p.timeouts().filter((ms) => ms === 300), [300], 're-armed behind the poll in flight');
        release(); await p.settle();
        p.fire((ms) => ms === 300); await p.settle();
        assert.strictEqual(p.counts(), inflight + 1);
        assert.strictEqual(bell.querySelector('.badge').textContent, '6');

        // While the stream is open, the 15 s tick polls only every 2 minutes.
        let c = p.counts();
        p.tick(15000); p.tick(15000); await p.settle();
        assert.strictEqual(p.counts(), c, 'no poll inside 2 minutes of the last one');
        p.tick(120000); await p.settle();
        assert.strictEqual(p.counts(), c + 1, 'the safety-net poll');

        // A gap re-reads the count and the open lists.
        const lists = p.out.requests.filter((r) => r.url.startsWith(`${API}/api/notifications?`)).length;
        N.togglePanel(); await p.settle();
        const listsOpen = p.out.requests.filter((r) => r.url.startsWith(`${API}/api/notifications?`)).length;
        assert.ok(listsOpen > lists, 'opening the panel lists');
        p.es.emit('gap', { reason: 'replay_limit' });
        p.fire((ms) => ms === 300); await p.settle();
        assert.ok(p.out.requests.filter((r) => r.url.startsWith(`${API}/api/notifications?`)).length > listsOpen, 'the gap reloaded the panel');

        // Blocked by CSP: polling every 15 s again.
        p.csp(`${STREAM}?topics=x`);
        assert.strictEqual(N.realtimeState().state, 'blocked');
        c = p.counts();
        p.tick(15000); await p.settle(); p.tick(15000); await p.settle();
        assert.strictEqual(p.counts(), c + 2, 'CSP-blocked: the 15 s poll is back');

        // Sign-out stops the feed; a new token starts it again with a new ticket and no cursor.
        N.setToken(null); await p.settle();
        assert.strictEqual(N.realtimeState().state, 'off');
        const t = p.tickets().length;
        N.setToken('jwt-bob'); await p.settle();
        assert.strictEqual(p.tickets().length, t + 1);
        assert.strictEqual(p.tickets()[t].headers.Authorization, 'Bearer jwt-bob');
        assert.strictEqual(new URL(p.es.url).searchParams.get('last_event_id'), null);
        N.destroy();
        assert.strictEqual(p.es.closed, true);
    }

    // ── Realtime off (the default), or no EventSource: nothing of it runs; on openvibe.network, cookies ──
    {
        const p = page();
        p.run(UI_SRC, 'notification-ui.js', 'https://openvibe.live/shared/notification-ui.js');
        p.ctx.OpenVibeNotifications.init({ token: 'jwt', apiBase: API });
        await p.settle();
        assert.deepStrictEqual([p.out.scripts.length, p.tickets().length, p.out.es.length, p.ctx.OpenVibeNotifications.realtimeState()], [0, 0, 0, null]);
        const c = p.counts();
        p.tick(15000); await p.settle();
        assert.strictEqual(p.counts(), c + 1, 'polling every 15 s as before');
    }
    {
        const p = page({ eventSource: false });
        p.run(UI_SRC, 'notification-ui.js', 'https://openvibe.live/shared/notification-ui.js');
        p.ctx.OpenVibeNotifications.init({ token: 'jwt', apiBase: API, realtime: true });
        await p.settle();
        assert.deepStrictEqual([p.out.scripts.length, p.tickets().length], [0, 0], 'no EventSource: polling only');
    }
    {
        const p = page({ url: 'https://openvibe.network/my' });
        p.run(UI_SRC, 'notification-ui.js', 'https://openvibe.network/shared/notification-ui.js');
        p.ctx.OpenVibeNotifications.init({ apiBase: API, realtime: true });
        await p.settle();
        assert.deepStrictEqual(p.out.scripts, ['https://openvibe.network/shared/notification-live.js']);
        assert.strictEqual(p.tickets()[0].credentials, 'include', 'on openvibe.network the session cookie asks for the ticket');
        assert.strictEqual(p.tickets()[0].headers.Authorization, undefined);
    }

    // ── Size: loaded on demand, after sign-in ──────────────────────────────────────────────
    const { brotli } = require('../scripts/size-report');
    const size = (f) => brotli(fs.readFileSync(path.join(ROOT, f)));
    assert.ok(size('notification-live.js') <= 3 * 1024, `notification-live.js is ${(size('notification-live.js') / 1024).toFixed(2)} KB brotli, budget 3 KB`);
    assert.ok(size('notification-ui.js') <= 13 * 1024, `notification-ui.js is ${(size('notification-ui.js') / 1024).toFixed(2)} KB brotli, budget 13 KB`);

    console.log('notification live: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
