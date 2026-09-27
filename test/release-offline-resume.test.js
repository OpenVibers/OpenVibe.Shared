'use strict';
// Resuming an offline tab (D46 scenario 14), release-watch.js + release-update.js in a linkedom page with a
// fake clock and a fake EventSource. A laptop lid closes or the network drops; releases ship meanwhile; the
// tab comes back. Checked:
//   - offline, the checks fail quietly: no prompt, no reload, no failure counted, the release stream backs off;
//   - back online (the `online` event), the release stream reconnects at once from its cursor, whether it had
//     given up or was still backing off, and one /release.json read brings the tab to the newest release,
//     skipping the ones it missed, in place when the change allows;
//   - a connection lost in the middle of an in-place update leaves the page whole (old styles, old region)
//     and prompts once; coming back does not prompt again;
//   - a tab away past the mixed-version window reloads only when safe (never under a focused field);
//   - a hidden tab keeps its stream closed until it is shown again, then resumes from the cursor.
// Lines `[metric] name=value` are read by OpenVibe.Host's release-acceptance runner.
const assert = require('assert');
const { openPage, manifestFor } = require('../release-compat');

const URL_ = 'https://site.test/docs/a';
const A = 'aaaaaaa'; const B = 'bbbbbbb'; const C = 'ccccccc';
const comps = (o) => ({ styles: { kind: 'style', version: 'css1' }, docs: { kind: 'content', version: 'd1' }, shell: { kind: 'script', version: 'sh1' }, server: { kind: 'server', version: 'r1' }, ...o });
const assets = (v) => ({ '/css/app.css': { url: `/css/app.css?v=${v}`, component: 'styles' } });
const M = (release, o = {}, css = '111111111111', releasedAt) => manifestFor({ service: 'test', release, components: comps(o), assets: assets(css), releasedAt, metricsUrl: '/release-metrics' });
const M1 = M(A);
const MB = M(B, { docs: { kind: 'content', version: 'd2' } });
const MC = M(C, { docs: { kind: 'content', version: 'd3' }, styles: { kind: 'style', version: 'css3' } }, '333333333333');

const PAGE = (extra = '') => `<!doctype html><html><head>
<meta name="ov-release" content="${A}" data-url="/release.json">
<link rel="stylesheet" href="/css/app.css?v=111111111111">
</head><body><main data-ov-content="docs" data-ov-rev="1"><p>old text</p>${extra}</main></body></html>`;
const REGION = (rev) => `<!doctype html><html><body><main data-ov-content="docs" data-ov-rev="${rev}"><p>text of ${rev}</p></main></body></html>`;

function fakeEventSource() {
    const all = [];
    class FakeEventSource {
        constructor(url) { this.url = url; this.closed = false; this.listeners = {}; all.push(this); }
        addEventListener(type, f) { (this.listeners[type] = this.listeners[type] || []).push(f); }
        close() { this.closed = true; }
        opened() { if (this.onopen) this.onopen({}); }
        send(seq, event) { if (this.onmessage) this.onmessage({ data: JSON.stringify({ seq, event }), lastEventId: String(seq) }); }
        fail() { if (this.onerror) this.onerror({}); }
    }
    return { FakeEventSource, all };
}
const released = (service, release, n) => ({
    event_id: `evt_01JAB2C3D4E5F6G7H8J9K0M${String(n).padStart(3, '0')}`, event_type: 'host.release.published', version: 1, source: 'host',
    visibility: 'public', subject: { type: 'release', id: `${service}:${release}` }, payload: { service, release, commit: null, deployed_at: '2026-09-27T08:00:00.000Z' },
});

async function open({ html = PAGE(), served = M1, hidden = true } = {}) {
    const clock = { now: Date.parse('2026-09-27T10:00:00Z') };
    class FakeDate extends Date {
        constructor(...a) { super(...(a.length ? a : [clock.now])); }
        static now() { return clock.now; }
    }
    const es = fakeEventSource();
    const state = { served, offline: false, failNext: false, requests: [] };
    const p = await openPage({
        url: URL_, html, hidden,
        config: { eventsUrl: 'https://events.test/realtime/stream', service: 'test' },
        globals: { EventSource: es.FakeEventSource, Date: FakeDate, Math: Object.assign(Object.create(Math), { random: () => 0 }) },
        serve: (u) => {
            const { pathname } = new URL(u);
            state.requests.push({ pathname, at: clock.now, offline: state.offline });
            if (state.offline) throw new TypeError('Failed to fetch');
            if (pathname === '/release.json') return { json: state.served };
            if (pathname === '/docs/a') {
                if (state.failNext) { state.failNext = false; throw new TypeError('Failed to fetch'); }
                return { body: REGION(state.served.components.docs.version) };
            }
            return { status: 404 };
        },
    });
    await p.settle();
    p.state = state; p.es = es; p.clock = clock;
    p.later = (ms) => { clock.now += ms; };
    p.manifestReads = () => state.requests.filter((r) => r.pathname === '/release.json' && !r.offline).length;
    p.rt = () => p.release.state().realtime;
    p.text = () => p.document.querySelector('main').textContent.trim();
    p.css = () => Array.from(p.document.querySelectorAll('link[rel~="stylesheet"]')).map((l) => l.getAttribute('href'));
    return p;
}

const printMetrics = () => { for (const [k, v] of Object.entries(metrics)) console.log(`[metric] ${k}=${v}`); };
const metrics = { 'offline-resume.reloads-while-offline': 0, 'offline-resume.prompts-while-offline': 0, 'offline-resume.failures-counted-offline': 0, 'offline-resume.stream-reconnect-delay-ms': 0, 'offline-resume.manifest-reads-on-resume': 0, 'offline-resume.partial-pages': 0, 'offline-resume.reloads-while-typing': 0 };

(async () => {
    // ── Offline while two releases ship, the stream still backing off; then back online ──
    for (const failures of [3, 6]) {
        const p = await open({ hidden: false });
        const s0 = p.es.all[0];
        s0.opened();
        s0.send(7, released('other', B, 1));
        assert.strictEqual(p.rt().lastSeq, 7);
        // The network drops.
        p.state.offline = true;
        s0.fail();
        let retrySetAt = p.clock.now;
        for (let i = 1; i < failures; i++) {
            assert.strictEqual(p.rt().state, 'backoff');
            const wait = Math.min(...p.timeouts());
            p.later(wait); p.fireTimeouts((ms) => ms === wait); await p.settle();
            p.es.all[p.es.all.length - 1].fail();
            retrySetAt = p.clock.now;
        }
        assert.strictEqual(p.rt().state, failures >= 6 ? 'failed' : 'backoff', `${failures} failures`);
        // Releases ship while it is away (30 s more, less than any pending backoff); its checks fail quietly.
        p.state.served = MB;
        p.later(30 * 1000); p.tick(); await p.settle();
        p.dispatch('focus'); await p.release.check(); await p.settle();
        p.state.served = MC;
        assert.ok(p.state.requests.some((r) => r.offline && r.pathname === '/release.json'), 'it did try');
        metrics['offline-resume.reloads-while-offline'] += p.reloads;
        metrics['offline-resume.prompts-while-offline'] += p.toasts.length;
        metrics['offline-resume.failures-counted-offline'] += Object.values(p.metrics().failed || {}).reduce((a, b) => a + b, 0);
        assert.deepStrictEqual([p.reloads, p.toasts.length, p.metrics(), p.release.current], [0, 0, {}, A], 'offline: no prompt, no reload, nothing counted as failed');

        // Back online.
        p.state.offline = false;
        const streams = p.es.all.length; const reads = p.manifestReads();
        const retry = p.timeouts().length ? Math.min(...p.timeouts()) - (p.clock.now - retrySetAt) : 0;   // what is left of the backoff
        p.dispatch('online'); await p.settle();
        const reconnected = p.es.all.length > streams;
        // Not reconnected at once: the stream waits out its backoff, and that wait is the delay.
        if (!reconnected) metrics['offline-resume.stream-reconnect-delay-ms'] = Math.max(metrics['offline-resume.stream-reconnect-delay-ms'], retry);
        assert.ok(reconnected, `back online after ${failures} failures: the release stream reconnects at once`);
        assert.match(p.es.all[p.es.all.length - 1].url, /last_event_id=7$/, 'from its cursor');
        assert.strictEqual(p.rt().failures, 0);
        p.settleStyles(true); await p.settle();
        metrics['offline-resume.manifest-reads-on-resume'] = Math.max(metrics['offline-resume.manifest-reads-on-resume'], p.manifestReads() - reads);
        assert.strictEqual(p.manifestReads() - reads, 1, 'one /release.json read');
        assert.strictEqual(p.release.current, C, 'straight to the newest release, the missed one skipped');
        assert.match(p.text(), /text of d3/);
        assert.deepStrictEqual(p.css(), ['https://site.test/css/app.css?v=333333333333']);
        assert.deepStrictEqual([p.reloads, p.toasts.length, p.metrics()], [0, 0, { applied: { 'content+style': 1 } }], 'in place, nothing asked of the person');
        assert.deepStrictEqual(p.timeouts().filter((ms) => ms >= 15000), [], 'no retry left pending');
        // Focus and visibility right after: nothing more to read.
        p.dispatch('focus'); p.setHidden(false); await p.settle();
        assert.strictEqual(p.manifestReads() - reads, 1);
        p.stop();
    }

    // ── The connection drops in the middle of an in-place update ──
    {
        const p = await open();
        p.state.served = MC;
        p.state.failNext = true;
        await p.release.check(); await p.settle();
        if (p.text() !== 'old text' || p.css().join() !== '/css/app.css?v=111111111111') metrics['offline-resume.partial-pages']++;
        assert.deepStrictEqual([p.text(), p.css()], ['old text', ['/css/app.css?v=111111111111']], 'the page is whole: old region, old styles');
        assert.deepStrictEqual([p.release.current, p.toasts.length, p.reloads, p.metrics()], [A, 1, 0, { failed: { content: 1 }, prompted: { optional: 1 } }], 'failed in place: prompted once');
        p.later(5 * 60 * 1000);
        p.dispatch('online'); await p.settle();
        p.tick(); await p.settle();
        assert.deepStrictEqual([p.toasts.length, p.reloads], [1, 0], 'coming back does not prompt again');
        p.stop();
    }

    // ── Away past the mixed-version window, a text field focused ──
    {
        const p = await open({ html: PAGE('<textarea></textarea>'), hidden: false });
        p.focus(p.document.querySelector('textarea'));
        p.state.offline = true;
        p.later(30 * 3600 * 1000);
        p.state.served = M(B, { shell: { kind: 'script', version: 'sh2' } }, '111111111111', new Date(p.clock.now - 29 * 3600 * 1000).toISOString());
        p.tick(); await p.settle();
        p.state.offline = false;
        p.dispatch('online'); await p.settle();
        metrics['offline-resume.reloads-while-typing'] += p.reloads;
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 1], 'outside the window: prompted, not reloaded under the person');
        p.tick(); await p.settle();
        metrics['offline-resume.reloads-while-typing'] += p.reloads;
        assert.deepStrictEqual(p.metrics(), { prompted: { window: 1 }, deferred: { typing: 1 } });
        p.blur(); p.setHidden(true);
        assert.strictEqual(p.reloads, 1, 'and reloads at the next safe moment');
        p.stop();
    }

    // ── Hidden: the stream stays closed until the tab is shown, then resumes from the cursor ──
    {
        const p = await open({ hidden: true });
        const s0 = p.es.all[0];
        s0.opened(); s0.send(11, released('other', B, 2));
        p.fireTimeouts((ms) => ms === 300000);
        assert.deepStrictEqual([s0.closed, p.rt().state], [true, 'hidden'], 'hidden 5 minutes: closed');
        p.state.offline = true; p.later(3600e3); p.tick(); await p.settle();
        p.state.offline = false;
        p.dispatch('online'); await p.settle();
        assert.strictEqual(p.es.all.length, 1, 'online while hidden: no stream yet');
        p.setHidden(false); await p.settle();
        assert.strictEqual(p.es.all.length, 2, 'shown: one stream');
        assert.match(p.es.all[1].url, /last_event_id=11$/);
        p.stop();
    }

    printMetrics();
    console.log('release offline resume: all checks passed');
})().catch((e) => { printMetrics(); console.error(e); process.exit(1); });
