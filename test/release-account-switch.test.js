'use strict';
// An account switch during an update (D46 scenario 9), release-watch.js + release-update.js in a linkedom page.
// Sites like Live switch accounts in place: the page stays, the session cookie changes and the app announces
// it with the `openvibe-auth-changed` window event. An in-place update fetches its regions with the session
// (credentials: same-origin), so what a region holds can depend on who is signed in. Checked:
//   - /release.json is always read without credentials: whether a tab updates never depends on the account;
//   - a region fetched for the previous account and still waiting (focus inside it) is fetched again for the
//     new one, never committed as it was;
//   - a region whose fetch was in flight when the account changed is fetched again, not committed;
//   - the switch itself reloads nothing, prompts nothing, opens no second release stream, and a switch with no
//     update pending fetches nothing;
//   - a required reload deferred by typing is not hurried by a switch.
// Lines `[metric] name=value` are read by OpenVibe.Host's release-acceptance runner.
const assert = require('assert');
const { openPage, manifestFor } = require('../release-compat');

const URL_ = 'https://site.test/docs/a';
const A = 'aaaaaaa'; const B = 'bbbbbbb';
const comps = (o) => ({ styles: { kind: 'style', version: 'css1' }, docs: { kind: 'content', version: 'd1' }, server: { kind: 'server', version: 'r1' }, ...o });
const assets = { '/css/app.css': { url: '/css/app.css?v=111111111111', component: 'styles' } };
const M1 = manifestFor({ service: 'test', release: A, components: comps(), assets });
const M2 = manifestFor({ service: 'test', release: B, components: comps({ docs: { kind: 'content', version: 'd2' }, server: { kind: 'server', version: 'r2' } }), assets });

const PAGE = (extra = '') => `<!doctype html><html><head>
<meta name="ov-release" content="${A}" data-url="/release.json">
<link rel="stylesheet" href="/css/app.css?v=111111111111">
</head><body><main data-ov-content="docs" data-ov-rev="1"><p>old text for alice</p>${extra}</main></body></html>`;
// The server renders the region for whoever the request's cookie names (none: a guest).
const REGION = (who) => `<!doctype html><html><body><main data-ov-content="docs" data-ov-rev="2"><p>new text for ${who || 'a guest'}</p></main></body></html>`;

function fakeEventSource() {
    const all = [];
    class FakeEventSource {
        constructor(url) { this.url = url; this.closed = false; all.push(this); }
        addEventListener() {}
        close() { this.closed = true; }
    }
    return { FakeEventSource, all };
}

async function open({ html = PAGE(), served = M1, hidden = true, hold = false } = {}) {
    const es = fakeEventSource();
    const state = { served, account: 'alice', held: [], requests: [] };
    const p = await openPage({
        url: URL_, html, hidden, globals: { EventSource: es.FakeEventSource },
        config: { eventsUrl: 'https://events.test/realtime/stream', service: 'test' },
        serve: (u, init) => {
            const { pathname } = new URL(u);
            // The cookie goes along unless the request omits credentials.
            const who = init && init.credentials === 'omit' ? null : state.account;
            state.requests.push({ pathname, credentials: init && init.credentials, who });
            if (pathname === '/release.json') return { json: state.served };
            if (pathname === '/docs/a') {
                if (hold) return new Promise((resolve) => state.held.push(() => resolve({ body: REGION(who) })));
                return { body: REGION(who) };
            }
            return { status: 404 };
        },
    });
    await p.settle();
    p.state = state; p.es = es;
    p.switchTo = async (who) => { state.account = who; p.dispatch('openvibe-auth-changed'); await p.settle(); };
    p.regionFetches = () => state.requests.filter((r) => r.pathname === '/docs/a');
    p.text = () => p.document.querySelector('main').textContent.trim();
    return p;
}

const metrics = { 'account-switch.stale-regions-committed': 0, 'account-switch.reloads': 0, 'account-switch.prompts': 0, 'account-switch.release-streams': 0, 'account-switch.manifest-reads-with-credentials': 0 };
const printMetrics = () => { for (const [k, v] of Object.entries(metrics)) console.log(`[metric] ${k}=${v}`); };
const note = (p) => {
    if (/alice/.test(p.text()) && p.release.current === B) metrics['account-switch.stale-regions-committed']++;
    metrics['account-switch.reloads'] += p.reloads;
    metrics['account-switch.prompts'] += p.toasts.length;
    metrics['account-switch.release-streams'] = Math.max(metrics['account-switch.release-streams'], p.es.all.filter((s) => !s.closed).length);
    metrics['account-switch.manifest-reads-with-credentials'] += p.state.requests.filter((r) => r.pathname === '/release.json' && r.credentials !== 'omit').length;
};

(async () => {
    // ── A region waiting (focus inside it) when the account changes: fetched again for the new account ──
    {
        const p = await open({ html: PAGE('<input>') });
        p.focus(p.document.querySelector('main input'));
        p.state.served = M2;
        await p.release.check(); await p.settle();
        assert.strictEqual(p.release.state().waiting, 1, 'the focused region waits');
        assert.deepStrictEqual(p.regionFetches().map((r) => r.who), ['alice'], 'fetched once, with alice\'s session');
        await p.switchTo('bob');
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 0], 'the switch reloads nothing and prompts nothing');
        assert.strictEqual(p.es.all.length, 1, 'still one release stream');
        p.blur(); p.tick(); await p.settle();
        note(p);
        assert.match(p.text(), /new text for bob/, 'the region committed is the one rendered for the account now signed in');
        assert.ok(!/alice/.test(p.text()), 'nothing rendered for alice reaches the page after the switch');
        assert.deepStrictEqual(p.regionFetches().map((r) => r.who), ['alice', 'bob'], 'fetched again for bob, once');
        assert.strictEqual(p.release.current, B, 'and the release is adopted');
        assert.strictEqual(p.release.state().waiting, 0);
        p.stop();
    }

    // ── The region fetch is in flight when the account changes: that answer is not committed ──
    {
        const p = await open({ hold: true });
        p.state.served = M2;
        const done = p.release.check();
        await p.settle();
        assert.deepStrictEqual(p.regionFetches().map((r) => r.who), ['alice'], 'the region fetch started with alice\'s session');
        await p.switchTo('bob');
        p.state.held.shift()();   // alice's answer arrives after the switch
        await p.settle();
        // The answer for bob is fetched and arrives too.
        while (p.state.held.length) { p.state.held.shift()(); await p.settle(); }
        await done; await p.settle();
        note(p);
        assert.match(p.text(), /new text for bob/, 'the page shows what the server renders for bob');
        assert.deepStrictEqual(p.regionFetches().map((r) => r.who), ['alice', 'bob']);
        assert.strictEqual(p.release.current, B);
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 0]);
        assert.deepStrictEqual(p.metrics(), { deferred: { account: 1 }, applied: { 'content+server': 1 } }, 'counted: the stale answer as deferred (account), then the update');
        p.stop();
    }

    // ── Signing out is an account change too: a guest never sees the signed-in rendering ──
    {
        const p = await open({ html: PAGE('<input>') });
        p.focus(p.document.querySelector('main input'));
        p.state.served = M2;
        await p.release.check(); await p.settle();
        await p.switchTo(null);
        p.blur(); p.tick(); await p.settle();
        note(p);
        assert.match(p.text(), /new text for a guest/);
        p.stop();
    }

    // ── Nothing pending: a switch fetches nothing and changes nothing ──
    {
        const p = await open();
        const before = p.state.requests.length;
        await p.switchTo('bob');
        note(p);
        assert.strictEqual(p.state.requests.length, before, 'no request');
        assert.deepStrictEqual([p.reloads, p.toasts.length, p.es.all.length, p.release.current], [0, 0, 1, A]);
        p.stop();
    }

    // ── A required reload deferred by typing is not hurried by a switch ──
    {
        const p = await open({ html: PAGE('<textarea></textarea>'), hidden: false });
        p.focus(p.document.querySelector('textarea'));
        p.state.served = { ...M2, components: comps({ shell: { kind: 'script', version: 's2' } }), min_client_release: B };
        await p.release.check(); await p.settle();
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 1], 'required: prompted, not reloaded under the person');
        await p.switchTo('bob');
        p.tick(); await p.settle();
        metrics['account-switch.reloads'] += p.reloads;
        assert.strictEqual(p.reloads, 0, 'not while the text field has focus, switch or not');
        p.blur(); p.setHidden(true);
        assert.strictEqual(p.reloads, 1, 'reloaded at the next safe moment');
        p.stop();
    }

    // The update decision is the same for every account: /release.json never carries the session.
    assert.strictEqual(metrics['account-switch.manifest-reads-with-credentials'], 0);
    assert.strictEqual(metrics['account-switch.stale-regions-committed'], 0);
    assert.strictEqual(metrics['account-switch.release-streams'], 1);
    printMetrics();
    console.log('release account switch: all checks passed');
})().catch((e) => { printMetrics(); console.error(e); process.exit(1); });
