'use strict';
// release-watch.js release notifications (1.17.0, WS-P task 9): one anonymous EventSource on the Events
// realtime stream (topic host.release.published); an event for this page's service with a new release runs
// the ordinary check after a 0-20 s jitter, bursts collapse into one check per 30 s, the release the tab
// runs or already knows is ignored, errors back off, hidden tabs close the stream, stop() closes it, and
// polling is unchanged. A fake EventSource stands in for the browser's.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { openPage, manifestFor } = require('../release-compat');

const A = 'aaaaaaa1'; const B = 'bbbbbbb2'; const C = 'ccccccc3';
const DEFAULT = 'https://events.openvibe.network/realtime/stream';
const PAGE = (attrs = '') => `<!doctype html><html><head><meta name="ov-release" content="${A}" data-url="/release.json"${attrs}></head><body></body></html>`;

function fakeEventSource() {
    const all = [];
    class FakeEventSource {
        constructor(url, init) { this.url = url; this.init = init; this.closed = false; this.listeners = {}; all.push(this); }
        addEventListener(type, f) { (this.listeners[type] = this.listeners[type] || []).push(f); }
        close() { this.closed = true; }
        opened() { if (this.onopen) this.onopen({}); }
        send(seq, event) { if (this.onmessage) this.onmessage({ data: JSON.stringify({ seq, event }), lastEventId: String(seq) }); }
        emit(type, data) { (this.listeners[type] || []).forEach((f) => f({ data: JSON.stringify(data) })); }
        fail() { if (this.onerror) this.onerror({}); }
    }
    return { FakeEventSource, all };
}

let n = 0;
const released = (service, release, extra = {}) => ({
    event_id: `evt_01JAB2C3D4E5F6G7H8J9K0M${String(++n).padStart(3, '0')}`, event_type: 'host.release.published', version: 1, source: 'host',
    visibility: 'public', subject: { type: 'release', id: `${service}:${release}` },
    payload: { service, release, commit: null, origin: 'https://openvibe.live', deployed_at: '2026-09-26T08:00:00.000Z' }, ...extra,
});

async function open({ url = 'https://openvibe.live/', html = PAGE(), config = null, hidden = false, eventSource = true, random = 0.5, served = manifestFor({ service: 'live', release: A }) } = {}) {
    const es = fakeEventSource();
    const state = { served };
    const globals = { Math: Object.assign(Object.create(Math), { random: () => random }) };
    if (eventSource) globals.EventSource = es.FakeEventSource;
    const p = await openPage({
        url, html, hidden, config, globals,
        serve: (u) => (new URL(u).pathname === '/release.json' && state.served ? { json: state.served } : { status: 404 }),
    });
    await p.settle();
    p.es = es; p.state = state;
    p.fetches = () => p.requests.filter((r) => r.url.endsWith('/release.json')).length;
    p.rt = () => p.release.state().realtime;
    return p;
}

(async () => {
    // ── One stream, anonymous, on the default URL, once the page's release and service are known ──
    {
        const p = await open();
        assert.strictEqual(p.es.all.length, 1);
        const s = p.es.all[0];
        assert.strictEqual(s.url, `${DEFAULT}?topics=host.release.published`);
        assert.strictEqual(s.init, undefined, 'no withCredentials: public events need no account');
        assert.strictEqual(p.rt().state, 'connecting');
        s.opened();
        assert.deepStrictEqual([p.rt().state, p.rt().service], ['open', 'live']);
        assert.deepStrictEqual(p.timeouts(), [], 'nothing scheduled before an event');
        assert.strictEqual(p.intervals.length, 2, 'the 30 s tick and the 10 min poll stay');

        // Other services, tenant activations, the running release (or a hex prefix of it), other topics.
        s.send(1, released('tools', B));
        s.send(2, { ...released('live', B), event_type: 'host.deploy.activated', subject: { type: 'deploy', id: 'dpl_x' }, payload: { project_id: 'prj_x', site_id: 'site_x', site: 'x', deploy_id: 'dpl_x', previous_deploy_id: null, rollback: false } });
        s.send(3, released('live', A));
        s.send(4, released('live', 'aaaaaaa'));
        s.send(5, { ...released('live', B), event_type: 'live.stream.started' });
        assert.deepStrictEqual(p.timeouts(), [], 'none of those schedules a check');
        assert.deepStrictEqual([p.rt().events, p.rt().ignored], [2, 2]);

        // A new release: one check after the jitter (random 0.5 → 10 s); a burst collapses into it.
        const before = p.fetches();
        s.send(6, released('live', B));
        assert.deepStrictEqual(p.timeouts(), [10000]);
        const set = p.timeoutsSet;
        s.send(7, released('live', B));
        s.send(8, released('live', C));
        s.send(8, released('live', 'ddddddd4'));   // a replayed seq is dropped before anything else
        assert.deepStrictEqual(p.timeouts(), [10000], 'the burst collapses into the one pending check');
        assert.strictEqual(p.timeoutsSet, set, 'and does not push it back');
        assert.strictEqual(p.fetches(), before, 'nothing fetched before the jitter ends');
        p.state.served = manifestFor({ service: 'live', release: B });
        assert.strictEqual(p.fireTimeouts((ms) => ms === 10000), 1);
        await p.settle();
        assert.strictEqual(p.fetches(), before + 1, 'exactly one /release.json fetch');
        assert.strictEqual(p.toasts.length, 1, 'the ordinary path: a new release without components prompts');
        assert.strictEqual(p.rt().checks, 1);
        assert.deepStrictEqual(p.timeouts(), [30000], 'then 30 s of quiet');

        // During the quiet: the release it now knows (B) and the one it runs (A, still: the prompt waits
        // for the person) are ignored; a newer one waits for the quiet to end.
        const ignored = p.rt().ignored;
        s.send(9, released('live', B));
        s.send(11, released('live', A));
        assert.strictEqual(p.rt().ignored, ignored + 2);
        assert.strictEqual(p.release.current, A);
        assert.deepStrictEqual(p.timeouts(), [30000]);
        s.send(12, released('live', C));
        assert.deepStrictEqual(p.timeouts(), [30000], 'no second check inside 30 s');
        p.fireTimeouts((ms) => ms === 30000);
        assert.deepStrictEqual(p.timeouts(), [10000], 'one more check after the quiet');
        p.state.served = manifestFor({ service: 'live', release: C });
        p.fireTimeouts((ms) => ms === 10000);
        await p.settle();
        assert.strictEqual(p.fetches(), before + 2);
        assert.strictEqual(p.release.state().latest.release, C);

        // A repeated event id is ignored even with a higher seq (and after its check found nothing new).
        const e = released('live', 'eeeeeee5');
        p.fireTimeouts();
        s.send(20, e);
        p.fireTimeouts((ms) => ms === 10000); await p.settle();   // the server still says C
        p.fireTimeouts();
        const ign = p.rt().ignored;
        s.send(21, e);
        assert.strictEqual(p.rt().ignored, ign + 1, 'the same event id twice is one event');
        assert.deepStrictEqual(p.timeouts(), []);

        // A gap (events missed while away) checks too, through the same coalescing.
        p.fireTimeouts(); await p.settle();
        s.emit('gap', { reason: 'public_window' });
        assert.strictEqual(p.timeouts().length, 1);

        // An account switch changes nothing: still one stream. A second copy of the script is a no-op.
        p.dispatch('openvibe-auth-changed');
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'release-watch.js'), 'utf8'), p.window);
        assert.strictEqual(p.es.all.length, 1, 'never a second EventSource');

        // stop(): the stream closes, every timer goes, and a late message does nothing.
        p.release.stop();
        assert.strictEqual(s.closed, true);
        assert.deepStrictEqual(p.timeouts(), []);
        assert.strictEqual(p.rt().state, 'off');
        s.send(30, released('live', 'fffffff6'));
        s.fail();
        assert.deepStrictEqual(p.timeouts(), [], 'a closed stream\'s late message or error does nothing');
        assert.strictEqual(p.es.all.length, 1);
    }

    // ── Errors back off (30 s doubling, jittered), resume with last_event_id, and give up after 6 ──
    {
        const p = await open({ random: 0 });
        const s0 = p.es.all[0];
        s0.opened();
        s0.send(41, released('tools', B));
        s0.fail();
        assert.strictEqual(s0.closed, true, 'closed at once, so the browser does not retry every 3 s on its own');
        assert.strictEqual(p.rt().state, 'backoff');
        assert.deepStrictEqual(p.timeouts(), [15000], 'the first retry after 15-30 s');
        p.fireTimeouts();
        assert.strictEqual(p.es.all.length, 2);
        assert.strictEqual(p.es.all[1].url, `${DEFAULT}?topics=host.release.published&last_event_id=41`, 'resumes after the last seq seen');
        const waits = [];
        for (let i = 1; i < 6; i++) {
            p.es.all[i].fail();
            waits.push(...p.timeouts());
            p.fireTimeouts();
        }
        assert.deepStrictEqual(waits, [30000, 60000, 120000, 240000], 'doubling, then no retry after the 6th failure');
        assert.strictEqual(p.rt().state, 'failed');
        assert.strictEqual(p.es.all.length, 6);
        const before = p.fetches();
        p.tick(); await p.settle();
        assert.ok(p.fetches() >= before, 'polling goes on');
        assert.strictEqual(p.intervals.length, 2);
        p.dispatch('online');
        assert.strictEqual(p.es.all.length, 7, 'back online: one more try');
        p.es.all[6].opened();
        assert.strictEqual(p.rt().failures, 0, 'an open stream resets the count');
        p.release.stop();
    }

    // ── A page whose CSP connect-src leaves Events out: one refusal, then polling only ──
    {
        const p = await open();
        const s = p.es.all[0];
        const v = new p.window.Event('securitypolicyviolation');
        v.blockedURI = 'https://other.example/x';
        p.document.dispatchEvent(v);
        assert.strictEqual(p.rt().state, 'connecting', 'another URL\'s violation is not ours');
        const mine = new p.window.Event('securitypolicyviolation');
        mine.blockedURI = 'https://events.openvibe.network';
        p.document.dispatchEvent(mine);
        s.fail();
        assert.deepStrictEqual([s.closed, p.rt().state, p.timeouts()], [true, 'blocked', []], 'no retry');
        p.dispatch('online');
        assert.strictEqual(p.es.all.length, 1, 'not even when back online');
        assert.strictEqual(p.intervals.length, 2);
        p.release.stop();
    }

    // ── A tab hidden for 5 minutes closes its stream; it reopens on return ──
    {
        const p = await open();
        const s = p.es.all[0];
        s.opened();
        s.send(50, released('tools', B));
        p.setHidden(true);
        assert.deepStrictEqual(p.timeouts(), [300000]);
        p.setHidden(false);
        assert.deepStrictEqual(p.timeouts(), [], 'back within 5 minutes: nothing changes');
        p.setHidden(true);
        p.fireTimeouts((ms) => ms === 300000);
        assert.deepStrictEqual([s.closed, p.rt().state], [true, 'hidden']);
        p.setHidden(false);
        assert.strictEqual(p.es.all.length, 2);
        assert.match(p.es.all[1].url, /last_event_id=50$/);
        p.release.stop();

        const bg = await open({ hidden: true });
        assert.strictEqual(bg.es.all.length, 1, 'a page opened in the background still listens');
        assert.deepStrictEqual(bg.timeouts(), [300000], 'for 5 minutes');
        bg.release.stop();
    }

    // ── Where the stream comes from, and when there is none ──
    {
        const off = await open({ config: { eventsUrl: false } });
        assert.strictEqual(off.es.all.length, 0, 'eventsUrl: false turns it off');
        assert.strictEqual(off.rt().state, 'off');
        off.release.stop();

        const metaUrl = await open({ html: PAGE(' data-events="https://events.example.test/realtime/stream" data-service="docs"') });
        assert.strictEqual(metaUrl.es.all[0].url, 'https://events.example.test/realtime/stream?topics=host.release.published');
        assert.strictEqual(metaUrl.rt().service, 'docs', 'data-service names the service');
        metaUrl.release.stop();

        const metaOff = await open({ html: PAGE(' data-events="off"') });
        assert.strictEqual(metaOff.es.all.length, 0);
        metaOff.release.stop();

        const cfgService = await open({ config: { service: 'tools', eventsUrl: '/realtime/stream' } });
        assert.strictEqual(cfgService.es.all[0].url, 'https://openvibe.live/realtime/stream?topics=host.release.published');
        cfgService.es.all[0].send(1, released('tools', B));
        assert.deepStrictEqual(cfgService.timeouts(), [10000], 'OVReleaseConfig.service decides which events count');
        cfgService.release.stop();

        const local = await open({ url: 'http://localhost:3000/' });
        assert.strictEqual(local.es.all.length, 0, 'no default stream on a plain-http page');
        local.release.stop();
        const localSet = await open({ url: 'http://localhost:3000/', config: { eventsUrl: 'http://localhost:4300/realtime/stream' } });
        assert.strictEqual(localSet.es.all.length, 1, 'unless it is configured');
        localSet.release.stop();

        const noES = await open({ eventSource: false });
        assert.strictEqual(noES.rt().state, 'off', 'no EventSource: polling only');
        noES.state.served = manifestFor({ service: 'live', release: B });
        await noES.release.check(); await noES.settle();
        assert.strictEqual(noES.toasts.length, 1, 'and the check path still works');
        noES.release.stop();

        const none = await open({ html: '<!doctype html><html><head></head><body></body></html>', served: null });
        assert.strictEqual(none.es.all.length, 0, 'a site that serves no /release.json and has no meta is left alone');

        const lateService = await open({ served: null });
        assert.strictEqual(lateService.es.all.length, 0, 'service unknown yet: no stream');
        lateService.state.served = manifestFor({ service: 'live', release: A });
        await lateService.release.check(); await lateService.settle();
        assert.strictEqual(lateService.es.all.length, 1, 'opened once a check learns the service');
        lateService.release.stop();
    }

    console.log('release-watch realtime: ok');
})().catch((err) => { console.error(err); process.exit(1); });
