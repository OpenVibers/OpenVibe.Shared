'use strict';
// release-update.js through release-watch.js in a linkedom page (openvibe-shared/release-compat openPage):
// style and content changes applied in place, transactionally; deferral around focus and media; the
// fallback to a prompt; contract ranges forcing a reload only when safe; the update metrics (D46).
const assert = require('assert');
const { openPage, manifestFor, plan } = require('../release-compat');

const URL_ = 'https://site.test/docs/a';
const A = 'aaaaaaa'; const B = 'bbbbbbb';
const comps = (o) => ({
    styles: { kind: 'style', version: 'css1' }, extra: { kind: 'style', version: 'x1' }, docs: { kind: 'content', version: 'd1' },
    side: { kind: 'content', version: 's1' }, shell: { kind: 'script', version: 'sh1' }, server: { kind: 'server', version: 'r1' }, ...o,
});
const assets = (css) => ({
    '/css/app.css': { url: `/css/app.css?v=${css}`, component: 'styles', integrity: 'sha384-AAAA' },
    '/css/other.css': { url: '/css/other.css?v=222222222222', component: 'extra' },
    '/js/app.js': { url: '/js/app.js?v=999999999999', component: 'shell' },
});
const api = (version, accepts) => ({ 'test.web-api': { version, accepts } });
const M1 = manifestFor({ service: 'test', release: A, components: comps(), assets: assets('111111111111'), contracts: api('1.0.0', '^1.0.0'), metricsUrl: '/release-metrics' });
const M2 = manifestFor({ service: 'test', release: B, components: comps({ styles: { kind: 'style', version: 'css2' }, docs: { kind: 'content', version: 'd2' }, server: { kind: 'server', version: 'r2' } }), assets: assets('333333333333'), contracts: api('1.1.0', '^1.0.0'), metricsUrl: '/release-metrics' });

const PAGE = (region = '<p>old text</p>', rev = '1') => `<!doctype html><html><head>
<meta name="ov-release" content="${A}" data-url="/release.json">
<link rel="stylesheet" href="/css/app.css?v=111111111111">
<link rel="stylesheet" href="/css/other.css?v=222222222222">
<link rel="stylesheet" href="https://openvibe.network/shared/app.css">
</head><body>
<main data-ov-content="docs" data-ov-rev="${rev}">${region}</main>
<aside data-ov-content="side"><p>side</p></aside>
<section data-ov-content="side-2"><p>stays</p></section>
</body></html>`;
const NEW_PAGE = `<!doctype html><html><body>
<main data-ov-content="docs" data-ov-rev="2"><p onclick="evil()">new text</p><script>evil()</script><a href="javascript:evil()">x</a><meta http-equiv="refresh" content="0;url=/elsewhere"><img src="data:image/png;base64,AAAA"><iframe src="/x"></iframe></main>
<aside data-ov-content="side"><p>side, fresh</p></aside>
</body></html>`;

async function open({ served = M1, html = PAGE(), page = NEW_PAGE, config, hidden = true, updateScript } = {}) {
    const state = { served, page, pageStatus: 200 };
    const p = await openPage({
        url: URL_, html, hidden, config, updateScript,
        serve: (u) => {
            const { pathname } = new URL(u);
            if (pathname === '/release.json') return { json: state.served };
            if (pathname === '/docs/a') return { status: state.pageStatus, body: state.page };
            return { status: 404 };
        },
    });
    await p.settle();
    p.state = state;
    return p;
}
/** Serves `next` and runs a check through to the end, loading (or failing) the new stylesheets. */
async function update(p, next, { styles = true } = {}) {
    p.state.served = next;
    const done = p.release.check();
    await p.settle();
    if (styles === true) p.settleStyles(true);
    else if (styles === false) p.settleStyles(false);
    else if (styles === 'timeout') p.fireTimeouts();
    await done; await p.settle();
}
const hrefs = (p) => Array.from(p.document.querySelectorAll('link[rel~="stylesheet"]')).map((l) => l.getAttribute('href'));
const counts = (p) => p.beacons.reduce((acc, b) => { for (const [o, rs] of Object.entries(b.body.counts)) for (const [r, n] of Object.entries(rs)) { acc[o] = acc[o] || {}; acc[o][r] = (acc[o][r] || 0) + n; } return acc; }, {});

// Size: release-watch.js loads on every page after first paint; release-update.js only when a release
// can change something in place. Measured 2026-09-23: 3.2 KB and 3.0 KB brotli (release-watch was 1.7 KB).
// 2026-09-26 (1.17.0): release-watch 4.7 KB with the release notifications over Events realtime (+1.1 KB of
// code, +0.4 KB of comments); its budget moved from 3.5 to 5 KB for that, and only for that.
// 1.18.0: session beats and the prompted count (+0.25 KB) fit by shortening comments: 4.96 KB.
{
    const fs = require('fs'); const path = require('path'); const { brotli } = require('../scripts/size-report');
    const size = (f) => brotli(fs.readFileSync(path.join(__dirname, '..', f)));
    assert.ok(size('release-watch.js') <= 5 * 1024, `release-watch.js is ${(size('release-watch.js') / 1024).toFixed(1)} KB brotli, budget 5 KB`);
    assert.ok(size('release-update.js') <= 3.5 * 1024, `release-update.js is ${(size('release-update.js') / 1024).toFixed(1)} KB brotli, budget 3.5 KB`);
}

(async () => {
    // ── The plan, as a pure function ──
    assert.deepStrictEqual(plan(M1, M2).action, 'in-place');
    assert.deepStrictEqual(plan(M1, M2).changed.map((c) => c.id).sort(), ['docs', 'server', 'styles']);
    assert.strictEqual(plan(M1, { ...M2, components: comps({ shell: { kind: 'script', version: 'sh2' } }) }).action, 'prompt', 'a script change prompts');
    assert.strictEqual(plan(M1, { ...M2, components: comps({ nav: { kind: 'style', version: 'n1' } }) }).action, 'prompt', 'a new style component is not in place (the page has no <link> for it)');
    assert.strictEqual(plan(M1, { ...M2, components: comps({ styles: { kind: 'script', version: 'css1' } }) }).action, 'prompt', 'a kind change is not in place');
    assert.strictEqual(plan(M1, { ...M2, components: comps({ jobs: { kind: 'server', version: 'j1' } }) }).action, 'in-place', 'a new server component needs nothing from the tab');
    assert.deepStrictEqual(plan(M1, { ...M2, contract_ranges: api('2.0.0', '^2.0.0') }).reason, 'contract');
    assert.strictEqual(plan(M1, M1).action, 'none');

    // ── Style and content in place ──
    {
        const p = await open();
        let applied = 0; p.window.addEventListener('ov:release-applied', () => { applied++; });
        let updated = null; p.document.querySelector('main').addEventListener('ov:content-updated', (e) => { updated = e.detail.component; });
        // A stateless widget in the region is told to let go first (listeners, timers), then to mount again.
        const order = [];
        p.document.querySelector('main').addEventListener('ov:content-dispose', (e) => order.push(['dispose', e.detail.component, e.detail.release, /old text/.test(e.target.textContent)]));
        p.document.querySelector('main').addEventListener('ov:content-updated', (e) => order.push(['mount', e.detail.component, e.detail.release, /new text/.test(e.target.textContent)]));
        let stylesEvent = null; p.window.addEventListener('ov:styles-updated', (e) => { stylesEvent = e.detail.release; });
        // Scroll inside the region is kept across the patch.
        p.document.querySelector('main').scrollTop = 40;
        assert.strictEqual(p.release.current, A);
        assert.strictEqual(p.requests.length, 1, 'at load: only /release.json');
        await update(p, M2);
        assert.strictEqual(p.release.current, B, 'the tab is on the new release');
        assert.deepStrictEqual(hrefs(p), ['https://site.test/css/app.css?v=333333333333', '/css/other.css?v=222222222222', 'https://openvibe.network/shared/app.css'], 'only the changed stylesheet moved, in its place');
        assert.strictEqual(p.document.querySelector('link[href*="app.css?v=333"]').getAttribute('integrity'), 'sha384-AAAA');
        const main = p.document.querySelector('main');
        assert.match(main.textContent, /new text/);
        assert.strictEqual(main.getAttribute('data-ov-rev'), '2');
        assert.ok(!main.querySelector('script, iframe, meta, [onclick]'), 'no scripts, frames, meta refreshes or inline handlers come along');
        assert.strictEqual(main.querySelector('a').getAttribute('href'), null, 'javascript: links are dropped');
        assert.strictEqual(main.querySelector('img').getAttribute('src'), 'data:image/png;base64,AAAA', 'data: images stay');
        assert.match(p.document.querySelector('aside').textContent, /^side$/, 'a region whose component did not change is left alone');
        assert.strictEqual(updated, 'docs');
        assert.deepStrictEqual(order, [['dispose', 'docs', B, true], ['mount', 'docs', B, true]], 'disposed while the old content is there, mounted with the new');
        assert.strictEqual(stylesEvent, B, 'ov:styles-updated once the new stylesheets replaced the old');
        assert.strictEqual(p.document.querySelector('main').scrollTop, 40, 'scroll inside the region is kept');
        assert.strictEqual(applied, 1);
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 0], 'no reload, no prompt');
        assert.ok(p.document.querySelector('script[src="https://site.test/shared/release-update.js"]'), 'release-update.js was loaded from next to release-watch.js, on demand');
        assert.deepStrictEqual(p.beacons.map((b) => [b.to, b.body.release, b.body.to, b.body.counts]), [['/release-metrics', B, B, { applied: { 'content+server+style': 1 } }]]);
        // The same release again is nothing: no refetch, no new <link>, no remount.
        const before = p.requests.length;
        await update(p, M2);
        assert.strictEqual(p.requests.length, before + 1, 'only /release.json was read');
        assert.strictEqual(hrefs(p).length, 3);
        // A rollback to the previous release is applied in place too (the server is the authority).
        await update(p, { ...M1, contract_ranges: M2.contract_ranges });
        assert.strictEqual(p.release.current, A);
        assert.ok(hrefs(p).includes('https://site.test/css/app.css?v=111111111111'));
    }

    // ── Server-only change: nothing to fetch, adopted quietly ──
    {
        const p = await open();
        await update(p, { ...M1, release: B, components: comps({ server: { kind: 'server', version: 'r9' } }) });
        assert.deepStrictEqual([p.release.current, p.toasts.length, p.requests.length], [B, 0, 2]);
        assert.deepStrictEqual(counts(p), { applied: { server: 1 } });
    }

    // ── Focus inside a region: styles apply, the region waits, then commits ──
    {
        const p = await open({ html: PAGE('<p>old text</p><input>') });
        p.focus(p.document.querySelector('main input'));
        await update(p, M2);
        assert.ok(hrefs(p).includes('https://site.test/css/app.css?v=333333333333'), 'the stylesheet does not wait for the region');
        assert.match(p.document.querySelector('main').textContent, /old text/, 'the focused region is not replaced');
        assert.strictEqual(p.release.state().waiting, 1);
        assert.strictEqual(p.release.current, A, 'not adopted while a region waits');
        p.tick(); await p.settle();
        assert.deepStrictEqual(p.metrics(), { deferred: { typing: 1 } }, 'deferred once, however many ticks');
        const fetches = p.requests.filter((r) => r.url === URL_).length;
        await p.release.check(); await p.settle();
        assert.strictEqual(p.requests.filter((r) => r.url === URL_).length, fetches, 'a waiting region is not fetched again');
        p.blur(); p.tick(); await p.settle();
        assert.match(p.document.querySelector('main').textContent, /new text/);
        assert.strictEqual(p.release.current, B);
        assert.deepStrictEqual(counts(p), { deferred: { typing: 1 }, applied: { 'content+server+style': 1 } });
    }
    // Media playing inside a region, or a protected region: it waits (reason media / protected).
    {
        const p = await open({ html: PAGE('<p>old text</p><video></video>') });
        await update(p, M2);
        assert.deepStrictEqual([p.release.state().waiting, p.metrics()], [1, { deferred: { media: 1 } }]);
        const q = await open({ html: PAGE('<p data-ov-protected>editing</p>') });
        await update(q, M2);
        assert.deepStrictEqual([q.release.state().waiting, q.metrics()], [1, { deferred: { protected: 1 } }]);
    }
    // An unchanged data-ov-rev is not replaced (no remount).
    {
        const p = await open({ html: PAGE('<p>old text</p>', '2') });
        await update(p, M2);
        assert.match(p.document.querySelector('main').textContent, /old text/);
        assert.strictEqual(p.release.current, B);
    }

    // ── Failures keep the old page and fall back to the prompt ──
    {
        const p = await open();
        await update(p, M2, { styles: false });
        assert.deepStrictEqual(hrefs(p), ['/css/app.css?v=111111111111', '/css/other.css?v=222222222222', 'https://openvibe.network/shared/app.css'], 'a stylesheet that fails to load is removed; the old one stays');
        assert.match(p.document.querySelector('main').textContent, /old text/, 'nothing commits when a stylesheet fails');
        assert.deepStrictEqual([p.release.current, p.toasts.length, p.reloads], [A, 1, 0], 'prompted instead');
        assert.deepStrictEqual(counts(p), { failed: { style: 1 } });
        await update(p, M2);
        assert.strictEqual(p.document.querySelectorAll('link[href*="?v=333"]').length, 0, 'a release that failed in place is not retried in place');
    }
    {
        const p = await open();
        await update(p, M2, { styles: 'timeout' });
        assert.deepStrictEqual(counts(p), { failed: { 'style-timeout': 1 } });
        assert.strictEqual(hrefs(p)[0], '/css/app.css?v=111111111111');
    }
    {
        const p = await open();
        p.state.pageStatus = 500;
        await update(p, M2);
        assert.deepStrictEqual([counts(p), hrefs(p)[0], p.toasts.length], [{ failed: { content: 1 } }, '/css/app.css?v=111111111111', 1], 'a region that cannot be fetched: nothing changes, prompt');
    }
    {
        const p = await open({ updateScript: 'fail' });
        await update(p, M2);
        assert.deepStrictEqual([counts(p), p.toasts.length, p.release.current], [{ failed: { script: 1 } }, 1, A], 'release-update.js unavailable: the old prompt');
    }
    {
        const p = await open({ config: { inPlace: false } });
        await update(p, M2);
        assert.deepStrictEqual([p.toasts.length, hrefs(p)[0], p.release.current], [1, '/css/app.css?v=111111111111', A], 'inPlace: false prompts');
    }
    {
        const cross = { ...M2, assets: { ...M2.assets, '/css/app.css': { url: 'https://evil.test/css/app.css?v=3', component: 'styles' } } };
        const p = await open({ html: PAGE().replace('<link rel="stylesheet" href="/css/app.css?v=111111111111">', '<link rel="stylesheet" data-ov-asset="/css/app.css" href="/css/app.1111.css">') });
        await update(p, cross);
        assert.deepStrictEqual([counts(p), p.release.current], [{ failed: { origin: 1 } }, A], 'an asset on another origin is refused');
    }

    // ── A script change prompts; the contract ranges force a reload, only when safe ──
    {
        const p = await open();
        await update(p, { ...M2, components: comps({ shell: { kind: 'script', version: 'sh2' } }) });
        assert.deepStrictEqual([p.toasts.length, p.reloads, hrefs(p)[0]], [1, 0, '/css/app.css?v=111111111111']);
    }
    {
        const p = await open({ hidden: false });
        await update(p, { ...M2, contract_ranges: api('2.0.0', '^2.0.0') });
        assert.deepStrictEqual([p.reloads, p.metrics()], [0, { prompted: { contract: 1 }, deferred: { active: 1 } }], 'incompatible contracts: a reload (prompted), but not under the user');
        assert.strictEqual(hrefs(p)[0], '/css/app.css?v=111111111111', 'and nothing in place');
        p.setHidden(true);
        assert.strictEqual(p.reloads, 1);
        assert.deepStrictEqual(counts(p), { prompted: { contract: 1 }, deferred: { active: 1 }, reloaded: { contract: 1 } });
    }
    {
        // A page one release behind whose server kept accepting it: in place (the N-1 → N window).
        const p = await open();
        await update(p, { ...M2, contract_ranges: api('1.4.0', '>=1.0.0 <2.0.0') });
        assert.strictEqual(p.release.current, B);
    }

    console.log('release-update: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
