'use strict';
// web-runtime.js (roadmap WS-P task 6), in a linkedom page where appended <script>/<link> tags "load" or "fail" on cue:
//   - a feature loads its fragment first, then deps, stylesheets and scripts (versioned, in order), then its hook, once;
//     tags the server already wrote count as loaded; nothing is added twice;
//   - asset groups are transactional: a failed script withdraws the stylesheets that attempt added (not one another
//     feature wants), removes its own tag, runs no hook, and a retry fetches only what is missing;
//   - route scopes release timers, listeners, observers, fetches and child scopes on nextRoute(); anything registered
//     on an ended route is refused and counted;
//   - prefetch stays within its count and byte budget, skips constrained connections, follows link intent (not //host);
//   - stubs load their feature and call the real function; showRouteError builds DOM (no markup from the error);
//   - diagnostics and leaks() report duplicate tags, failures, rollbacks and late registrations.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const linkedom = require('linkedom');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'web-runtime.js'), 'utf8');
// Values built inside the page's realm compare by their JSON form.
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m);

function page({ html = '', connection = null } = {}) {
    const { window: lw, document } = linkedom.parseHTML(`<!doctype html><html><head>${html}<meta name="anchor"></head><body><section id="page-player"></section><section id="page-ops"></section><a id="in" href="/ops?x=1">ops</a><a id="out" href="//evil.example/ops">x</a></body></html>`);
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    const out = { appended: [], fetches: [], timers: [], intervals: new Set(), log: [] };
    const behave = Object.create(null);   // path → 'fail' | 'hold'
    const effects = Object.create(null);  // path → function run when the script "executes"
    const held = [];
    let tid = 0;
    const ctx = {
        document, URL, Promise, JSON, Object, Array, Set, Error,
        console: { error: (...a) => out.log.push(['error', a.join(' ')]), warn: (...a) => out.log.push(['warn', a.join(' ')]), log() {} },
        CustomEvent: lw.CustomEvent || linkedom.CustomEvent, Event: lw.Event || linkedom.Event,
        location: { href: 'https://site.example/player', origin: 'https://site.example', pathname: '/player' },
        navigator: connection ? { connection } : {},
        AbortController,
        setTimeout: (f, ms) => { out.timers.push({ id: ++tid, f, ms }); return tid; },
        clearTimeout: (id) => { out.timers = out.timers.filter((t) => t.id !== id); },
        setInterval: () => { const id = ++tid; out.intervals.add(id); return id; },
        clearInterval: (id) => { out.intervals.delete(id); },
        addEventListener() {}, removeEventListener() {},
        fetch: async (u, init = {}) => {
            out.fetches.push({ url: String(u), init });
            if (/missing/.test(u)) return { ok: false, status: 404, text: async () => '' };
            return { ok: true, status: 200, text: async () => `<div class="frag">${String(u).split('?')[0]}</div>` };
        },
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    const fire = (node, kind) => { const h = node[`on${kind}`]; if (h) h(new ctx.Event(kind)); };
    const hook = (parent) => {
        const append = parent.appendChild.bind(parent);
        const insert = parent.insertBefore.bind(parent);
        const once = new WeakSet();   // linkedom's appendChild goes through insertBefore
        const seen = (node) => {
            if (once.has(node)) return;
            once.add(node);
            const src = node.tagName === 'SCRIPT' ? node.getAttribute('src') : node.tagName === 'LINK' && node.getAttribute('rel') === 'stylesheet' ? node.getAttribute('href') : null;
            if (!src) return;
            out.appended.push(src);
            const bare = src.split('?')[0];
            setImmediate(() => {
                if (behave[bare] === 'hold') { held.push(node); return; }
                if (behave[bare] === 'fail') return fire(node, 'error');
                if (effects[bare]) effects[bare](ctx);
                fire(node, 'load');
            });
        };
        parent.appendChild = (node) => { const r = append(node); seen(node); return r; };
        parent.insertBefore = (node, ref) => { const r = insert(node, ref); seen(node); return r; };
    };
    hook(document.head);
    vm.runInContext(SRC, ctx, { filename: 'web-runtime.js' });
    const tags = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute('src') || e.getAttribute('href'));
    return { ctx, document, out, behave, effects, held, fire, tags, RT: ctx.OVWebRuntime };
}

const FEATURES = {
    base: { css: ['/css/base.css'], js: ['/js/base.js'] },
    player: { fragment: 'player', deps: ['base'], css: ['/css/player.css', '/css/shared.css'], js: ['/js/p1.js', '/js/p2.js'], after: 'initPlayer', stubs: ['openPlayer'], idle: ['ops'] },
    ops: { fragment: 'ops', css: ['/css/shared.css', '/css/ops.css'], js: ['/js/ops.js'] },
    broken: { fragment: 'missing', section: 'page-ops', js: ['/js/never.js'] },
    big: { js: ['/js/big1.js', '/js/big2.js', '/js/big3.js'] },
};
const ROUTES = [{ path: '^/player', features: ['player'] }, { path: '^/ops', features: ['ops'] }, { path: '^/(player|ops)', features: ['base', 'player'] }];

(async () => {
    // ── A feature: fragment, deps, versioned assets in order, the hook once ──────────────────
    {
        const p = page({ html: '<script src="/js/base.js?v=old"></script>' });
        let hooks = 0;
        p.ctx.initPlayer = () => { hooks++; };
        const events = [];
        p.document.addEventListener('ov:feature', (e) => events.push(e.detail.name));
        const rt = p.RT.create({ features: FEATURES, routes: ROUTES, versions: { '/js/p1.js': 'aaa', '/fragments/player.html': 'fff' }, styleSlot: () => p.document.querySelector('meta[name="anchor"]') });
        rt.adoptExisting();
        deq(rt.featuresFor('/player/x'), ['player', 'base'], 'routes merged in order, without repeats');
        const a = rt.load('player');
        assert.strictEqual(rt.load('player'), a, 'one promise per feature');
        await a;
        await rt.load('player');
        assert.strictEqual(p.out.fetches[0].url, '/fragments/player.html?v=fff', 'the fragment first, versioned');
        assert.match(p.document.getElementById('page-player').innerHTML, /frag/);
        assert.strictEqual(p.document.getElementById('page-player').dataset.fragmentLoaded, '1');
        deq(p.out.appended, ['/css/base.css', '/css/player.css', '/css/shared.css', '/js/p1.js?v=aaa', '/js/p2.js'], 'base.js was the server\'s; dep first; scripts in order');
        deq(p.tags('script[src]'), ['/js/base.js?v=old', '/js/p1.js?v=aaa', '/js/p2.js']);
        assert.ok(p.document.querySelector('meta[name="anchor"]').previousElementSibling.getAttribute('href') === '/css/shared.css', 'styleSlot places stylesheets');
        deq([hooks, events], [1, ['base', 'player']]);
        assert.ok(rt.isLoaded('player'));
        deq(rt.diagnostics().features.loaded.sort(), ['base', 'player']);
        deq(rt.leaks(), []);
        // A route: its features, as one promise; nothing twice.
        await rt.route('/ops');
        assert.strictEqual(p.out.appended.filter((x) => x === '/css/shared.css').length, 1);
        assert.strictEqual(p.RT.assetKey('https://site.example/js/a.js?v=1'), '/js/a.js');
        assert.strictEqual(p.RT.assetKey('https://cdn.example/x/a.js?v=1'), 'https://cdn.example/x/a.js', 'another origin keeps its origin');
    }

    // ── Transactional groups: a failed script rolls the attempt back; a retry fetches only what is missing ──
    {
        const p = page();
        const rt = p.RT.create({ features: FEATURES, routes: ROUTES });
        let hooks = 0;
        p.ctx.initPlayer = () => { hooks++; };
        await rt.load('ops');                                   // owns /css/shared.css
        p.behave['/js/p2.js'] = 'fail';
        await assert.rejects(rt.load('player'), /Could not load \/js\/p2\.js/);
        deq(p.tags('link[rel="stylesheet"]').sort(), ['/css/base.css', '/css/ops.css', '/css/shared.css'], 'player.css withdrawn; shared.css stays (ops wants it); base loaded fine');
        assert.ok(!p.tags('script[src]').includes('/js/p2.js'), 'the failed tag is gone');
        assert.strictEqual(hooks, 0, 'no hook for a half-loaded feature');
        assert.ok(!rt.isLoaded('player'));
        let dg = rt.diagnostics();
        deq(dg.features.failed.map((f) => [f.name, f.attempts]), [['player', 1]]);
        deq(dg.assets.failed.map((f) => f.asset), ['/js/p2.js']);
        assert.strictEqual(dg.assets.rolledBack, 1);
        delete p.behave['/js/p2.js'];
        const before = p.out.appended.length;
        await rt.load('player');
        deq(p.out.appended.slice(before), ['/css/player.css', '/js/p2.js'], 'p1.js ran once and is not fetched again');
        assert.strictEqual(hooks, 1);
        dg = rt.diagnostics();
        deq([dg.features.failed, dg.assets.failed, dg.assets.duplicates], [[], [], []]);

        // A stylesheet another feature (still loading) wants stays when one feature's attempt fails.
        const q = page();
        const rt2 = q.RT.create({ features: { a: { css: ['/css/s.css'], js: ['/js/a.js'] }, b: { css: ['/css/s.css'], js: ['/js/b.js'] } } });
        q.behave['/js/a.js'] = 'fail'; q.behave['/js/b.js'] = 'hold';
        const pa = rt2.load('a'); const pb = rt2.load('b');
        await assert.rejects(pa);
        deq(q.tags('link[rel="stylesheet"]'), ['/css/s.css'], 'b (in flight) still wants it');
        await new Promise((r) => setImmediate(r));   // b.js has been appended and is held
        q.fire(q.held.pop(), 'load');
        await pb;
        deq(q.tags('link[rel="stylesheet"]'), ['/css/s.css']);

        // A failed stylesheet does not block; its tag is removed.
        const r = page();
        const rt3 = r.RT.create({ features: { c: { css: ['/css/gone.css'], js: ['/js/c.js'] } } });
        r.behave['/css/gone.css'] = 'fail';
        await rt3.load('c');
        deq(r.tags('link[rel="stylesheet"]'), []);
        deq(rt3.diagnostics().assets.failed.map((f) => f.kind), ['style']);
        // A missing fragment fails the feature and can be retried.
        const rt4 = r.RT.create({ features: FEATURES });
        await assert.rejects(rt4.load('broken'), /HTTP 404/);
        assert.strictEqual(r.document.getElementById('page-ops').getAttribute('aria-busy'), null);
    }

    // ── Route scopes ──────────────────────────────────────────────────────────────────────────
    {
        const p = page();
        const rt = p.RT.create({ features: FEATURES, debug: true });
        const g1 = rt.nextRoute();
        const s = rt.scope();
        assert.strictEqual(s.gen, g1);
        const target = p.document.getElementById('in');
        let clicks = 0;
        s.interval(() => {}, 1000);
        const tId = s.timeout(() => {}, 500);
        s.timeout(() => {}, 900);
        s.listen(target, 'click', () => { clicks++; });
        let disconnected = 0;
        s.observe({ disconnect() { disconnected++; } });
        const child = s.child();
        child.interval(() => {}, 50);
        let fetchSignal = null;
        p.ctx.fetch = async (u, init) => { fetchSignal = init.signal; return { ok: true }; };
        await s.fetch('/api/x');
        deq(s.held(), { interval: 1, timeout: 2, listener: 1, observer: 1, child: 1 });
        const due = p.out.timers.find((t) => t.id === tId);
        p.out.timers = p.out.timers.filter((t) => t !== due);
        due.f();                                                // a timeout that fired is no longer held
        assert.strictEqual(s.held().timeout, 1);
        child.dispose();
        assert.strictEqual(s.held().child, undefined, 'a child that ended early leaves its parent');
        target.dispatchEvent(new p.ctx.Event('click'));
        assert.strictEqual(clicks, 1);

        const g2 = rt.nextRoute();
        assert.ok(!rt.isCurrent(g1) && rt.isCurrent(g2) && rt.gen() === g2);
        assert.ok(s.disposed && fetchSignal.aborted, 'the route\'s signal aborts');
        assert.strictEqual(p.out.intervals.size, 0, 'every interval cleared (the child\'s too)');
        assert.strictEqual(p.out.timers.length, 0, 'every pending timeout cleared');
        target.dispatchEvent(new p.ctx.Event('click'));
        deq([clicks, disconnected], [1, 1]);

        // Late registrations: code that awaited past its route cannot leave anything running.
        assert.strictEqual(s.interval(() => {}, 10), 0);
        s.listen(target, 'click', () => { clicks++; });
        let ran = 0;
        s.onDispose(() => { ran++; });
        await assert.rejects(s.fetch('/api/y'), (e) => e.name === 'AbortError');
        target.dispatchEvent(new p.ctx.Event('click'));
        deq([p.out.intervals.size, clicks, ran], [0, 1, 1]);
        const dg = rt.diagnostics();
        assert.strictEqual(dg.scopes.late, 4);
        deq(dg.scopes.current, {});
        assert.ok(rt.leaks().some((x) => /4 registration\(s\) arrived after their route ended/.test(x)));
        assert.ok(p.out.log.some(([k, m]) => k === 'warn' && /interval registered after its route ended/.test(m)), 'debug warns');
    }

    // ── Prefetch: budget, constrained connections, link intent ───────────────────────────────
    {
        const p = page();
        const rt = p.RT.create({ features: FEATURES, routes: ROUTES, prefetch: { count: 4, bytes: 250, sizes: { '/js/big1.js': 100, '/js/big2.js': 100, '/js/big3.js': 100 } } });
        rt.prefetch('big');
        let links = p.tags('link[rel="prefetch"]');
        deq(links, ['/js/big1.js', '/js/big2.js'], 'the byte budget stops the third');
        rt.prefetch('ops');
        links = p.tags('link[rel="prefetch"]');
        assert.strictEqual(links.length, 4, 'the count budget');
        const dg = rt.diagnostics().prefetch;
        deq([dg.count, dg.bytes, dg.skipped > 0], [4, 200, true]);
        assert.strictEqual(p.document.querySelector('link[rel="prefetch"]').getAttribute('as'), 'script');

        const q = page();
        const rt2 = q.RT.create({ features: FEATURES, routes: ROUTES });
        await rt2.load('base');
        rt2.watchIntent(q.document);
        q.document.getElementById('out').dispatchEvent(new q.ctx.Event('pointerover', { bubbles: true }));
        deq(q.tags('link[rel="prefetch"]'), [], '//host is not this site');
        q.document.getElementById('in').dispatchEvent(new q.ctx.Event('pointerover', { bubbles: true }));
        deq(q.tags('link[rel="prefetch"]').sort(), ['/css/ops.css', '/css/player.css', '/css/shared.css', '/fragments/ops.html', '/fragments/player.html', '/js/ops.js', '/js/p1.js', '/js/p2.js'], 'the hovered route\'s features (ops, player), not base, which is loaded');

        const c = page({ connection: { saveData: true } });
        const rt3 = c.RT.create({ features: FEATURES });
        rt3.prefetch('ops');
        deq(c.tags('link[rel="prefetch"]'), []);
        assert.strictEqual(rt3.diagnostics().prefetch.constrained, 1);
    }

    // ── Stubs, route errors, duplicates ──────────────────────────────────────────────────────
    {
        const p = page();
        const errors = [];
        const rt = p.RT.create({ features: FEATURES, onStubError: (e, name) => errors.push(name), routeError: { icon: 'fa-solid fa-plug' } });
        p.effects['/js/p2.js'] = (ctx) => { ctx.openPlayer = (x) => `opened ${x}`; };
        rt.installStubs();
        assert.strictEqual(p.ctx.openPlayer.__ovStub, 'player');
        assert.strictEqual(await p.ctx.openPlayer('now'), 'opened now', 'the stub loads the feature, then calls the real function');
        const q = page();
        const rt2 = q.RT.create({ features: FEATURES, onStubError: (e, name) => errors.push(name) });
        q.behave['/js/p1.js'] = 'fail';
        rt2.installStubs();
        await q.ctx.openPlayer();
        deq(errors, ['player']);

        let retried = 0;
        rt.showRouteError('page-ops', new Error('<img src=x onerror=alert(1)>'), () => { retried++; });
        rt.showRouteError('page-ops', new Error('again'), () => { retried++; });
        const boxes = p.document.querySelectorAll('#page-ops > .ov-route-error');
        assert.strictEqual(boxes.length, 1, 'one box per page');
        assert.ok(!/img/.test(boxes[0].innerHTML), 'the error text is not markup');
        assert.strictEqual(boxes[0].querySelector('i').className, 'fa-solid fa-plug');
        boxes[0].querySelector('button').dispatchEvent(new p.ctx.Event('click'));
        assert.strictEqual(retried, 1);
        assert.strictEqual(p.document.querySelectorAll('.ov-route-error').length, 0);

        const extra = p.document.createElement('script');
        extra.setAttribute('src', '/js/p1.js?v=zzz');
        p.document.body.appendChild(extra);
        deq(rt.diagnostics().assets.duplicates, [{ asset: '/js/p1.js', count: 2 }]);
        assert.ok(rt.leaks().some((x) => /\/js\/p1\.js is in the document 2 times/.test(x)));
    }

    // ── Size: it replaces a site's own loader ────────────────────────────────────────────────
    const { brotli } = require('../scripts/size-report');
    const kb = brotli(Buffer.from(SRC)) / 1024;
    assert.ok(kb <= 6.5, `web-runtime.js is ${kb.toFixed(2)} KB brotli, budget 6.5 KB (Live's own loader was 4.25 KB)`);

    console.log('web runtime: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
