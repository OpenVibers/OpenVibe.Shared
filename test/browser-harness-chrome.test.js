'use strict';
// openvibe-shared/browser-harness in a real headless Chrome against a local fixture: each check catches the
// defect planted for it, a clean page passes, and an in-page navigation that leaks DOM and intervals fails the
// growth budget. Skipped (exit 0) when Chrome is not installed or OV_SKIP_BROWSER=1. axe-core is a stub here
// (no network): the real rules run in the Host CLI.
const assert = require('assert');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('browser-harness-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const words = 'This page has enough server-rendered words to count as meaningful content for a crawler. '.repeat(4);
const page = (body, head = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T</title><link rel="icon" href="data:,">${head}</head><body>${body}</body></html>`;
const ROUTES = {
    '/': () => page(`<main><h1>Good Page</h1><p>${words}</p><a href="/b">B page</a></main>`,
        '<link rel="canonical" href="ORIGIN/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Good Page"}</script>'),
    '/b': () => page(`<div id="root"></div><div style="width:2000px" class="wide">wide</div>
        <script src="/s.js?v=1"></script><script src="/s.js?v=2"></script>
        <script>document.getElementById('root').innerHTML = '<p>${words}</p>'; console.error('boom from b'); window.onload = () => { null.x; };</script>`,
    '<script type="application/ld+json">{"@type":"Article","headline":"Not On The Page"}</script><script type="application/ld+json">{bad json</script>'),
    // Every in-page navigation adds 200 nodes and an interval that nothing removes; a spinner never stops.
    '/spa': () => page(`<main><h1>SPA</h1><p>${words}</p><a href="/spa?b">to b</a> <a href="/spa">to a</a><div id="junk"></div><i class="spinner">*</i>
        <style>@keyframes spin { to { transform: rotate(1turn); } } .spinner { display: inline-block; animation: spin 1s linear infinite; }</style>
        <script>document.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); history.pushState(null, '', a.getAttribute('href'));
          const j = document.getElementById('junk'); for (let i = 0; i < 200; i++) j.appendChild(document.createElement('span')); setInterval(() => {}, 100000); });</script></main>`,
    '<link rel="canonical" href="ORIGIN/spa">'),
    '/private': () => page(`<main><h1>Private</h1><p>${words}</p></main>`),
    '/s.js': () => 'window.__s = (window.__s || 0) + 1;',
    // ADR-024 (checkUnreachable): an inline default theme, then the theme service's stylesheet (blocked in the check).
    '/themed': () => page(`<main><h1>Themed</h1><p>${words}</p></main>`, '<style>:root{--accent:#5b7cfa}html{background:#0a0f1c}</style><link rel="stylesheet" href="/theme.css">'),
    '/unstyled': () => page(`<main><h1>Unstyled</h1><p>${words}</p></main>`),
    '/theme.css': () => ':root{--accent:#ff0000}',
};
// axe stand-in: one critical violation on /b, none elsewhere.
const AXE_STUB = `window.axe = { run: () => Promise.resolve({ violations: location.pathname === '/b'
    ? [{ id: 'image-alt', impact: 'critical', help: 'Images must have alternative text', nodes: [{ target: ['img'] }] }] : [] }) };`;

(async () => {
    const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://x');
        const origin = `http://127.0.0.1:${server.address().port}`;
        const route = ROUTES[u.pathname];
        if (!route) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(page(`<h1>Not found</h1><p>${words}</p>`)); return; }
        res.writeHead(200, { 'content-type': u.pathname.endsWith('.js') ? 'application/javascript' : u.pathname.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8', ...(u.pathname === '/private' ? { 'x-robots-tag': 'noindex, nofollow' } : {}) });
        res.end(route().replace(/ORIGIN/g, origin));
    });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'ov-harness-test-'));
    const report = await h.run({ chrome: { tmpDir },
        base, routes: ['/', '/b', { path: '/missing', status: 404 }, '/private'], widths: [390, 1280], settleMs: 300, idleMs: 1000,
        navigation: { from: '/spa', to: '/spa?b', laps: 4 }, axe: { source: AXE_STUB },
    });
    // ADR-024 (WS-E task 1): with the theme host unreachable the page still paints, with the default theme.
    const down = await h.checkUnreachable(`${base}/themed`, { block: ['*/theme.css*'], widths: [390], minText: 50, chrome: { tmpDir } });
    assert.strictEqual(down.ok, true, JSON.stringify(down));
    assert.strictEqual(down.widths[0].accent, '#5b7cfa', 'the blocked theme did not apply: the inline default stands');
    assert.deepStrictEqual(down.widths[0].errors, [], 'the blocked request is not counted as a page error');
    const reached = await h.checkUnreachable(`${base}/themed`, { block: ['*/nothing-matches*'], widths: [390], minText: 50, chrome: { tmpDir } });
    assert.strictEqual(reached.widths[0].accent, '#ff0000', 'without the block the theme applies (so the block is what made the difference)');
    const bare = await h.checkUnreachable(`${base}/unstyled`, { block: ['*/theme.css*'], widths: [390], minText: 50, chrome: { tmpDir } });
    assert.strictEqual(bare.ok, false, 'no theme token at all fails');
    server.close();
    // Chrome is gone and so is its profile (a leftover per run fills a small disk).
    assert.deepStrictEqual(require('fs').readdirSync(tmpDir), [], 'the Chrome profile is removed when run() returns');
    require('fs').rmdirSync(tmpDir);
    const [good, bad, missing, priv] = report.routes;
    const text = h.format(report);

    assert.ok(/^Chrome\/|HeadlessChrome\//.test(report.chrome), report.chrome);
    assert.deepStrictEqual(good.checks, { status: 'pass', errors: 'pass', overflow: 'pass', scripts: 'pass', nojs: 'pass', canonical: 'pass', jsonld: 'pass', axe: 'pass' }, text);
    assert.strictEqual(good.canonical.href, `${base}/`);
    assert.deepStrictEqual(good.jsonld.entities.map((e) => e.found), ['html']);

    assert.deepStrictEqual(bad.checks, { status: 'pass', errors: 'fail', overflow: 'fail', scripts: 'fail', nojs: 'fail', canonical: 'fail', jsonld: 'fail', axe: 'fail' }, text);
    assert.ok(bad.errors.some((e) => e.startsWith('console: boom from b (')), bad.errors.join(' | '));
    assert.ok(bad.errors.some((e) => /^exception: .*TypeError/.test(e)), bad.errors.join(' | '));
    assert.deepStrictEqual(bad.widths.map((w) => [w.width, w.overflow]), [[390, true], [1280, true]]);
    assert.ok(bad.widths[0].offenders[0].startsWith('div.wide'), bad.widths[0].offenders.join());
    assert.deepStrictEqual(bad.widths[0].duplicateScripts, [{ url: `${base}/s.js`, count: 2 }]);
    assert.ok(bad.nojs.textChars < 200, 'the text only arrives with JavaScript');
    assert.strictEqual(bad.jsonld.parseErrors.length, 1);
    assert.deepStrictEqual(bad.jsonld.entities.map((e) => [e.value, e.found]), [['Not On The Page', null]]);
    assert.strictEqual(bad.axe.critical, 1);

    // The 404 page: the expected status, and its own 404 is not counted as a console error.
    assert.deepStrictEqual([missing.checks.status, missing.checks.errors, missing.widths[0].status], ['pass', 'pass', 404], text);

    // X-Robots-Tag: noindex, so no canonical is needed.
    assert.deepStrictEqual([priv.checks.canonical, priv.ok], ['skip', true], text);

    // In-page navigation (the link is clicked, the document stays), growth caught, idle measured.
    const nav = report.navigation;
    assert.strictEqual(nav.mode, 'in-page');
    assert.strictEqual(nav.samples.length, 4);
    assert.deepStrictEqual(nav.growth.over.map((o) => o.name).sort(), ['intervals', 'nodes'], text);
    assert.strictEqual(nav.growth.deltas.nodes, 800);
    assert.strictEqual(nav.ok, false);
    assert.ok(nav.idle && nav.idle.seconds === 1 && nav.idle.requests === 0, JSON.stringify(nav.idle));
    assert.deepStrictEqual(nav.idle.animations, { running: 1, infinite: 1, list: ['spin on i.spinner'] }, 'the idle report names what keeps painting');

    assert.strictEqual(report.ok, false);
    assert.deepStrictEqual(report.summary.checks.overflow, { pass: 3, warn: 0, fail: 1, skip: 0 });
    assert.ok(text.includes('nodes grew'), text);
    console.log('browser-harness-chrome: ok');
})().catch((e) => { console.error(e); process.exit(1); });
