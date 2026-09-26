'use strict';
// openvibe-shared/browser-harness (WS-Q task 3, WS-T tasks 3–4): the parts that need no browser.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');

(async () => {
    // Routes: strings become objects; a non-200 route skips the crawler checks unless it asks for them.
    const routes = h.normalizeRoutes(['/', { path: '/gone', status: 404 }, { path: '/x', checks: { axe: false } }]);
    assert.deepStrictEqual(routes.map((r) => [r.path, r.status]), [['/', 200], ['/gone', 404], ['/x', 200]]);
    assert.deepStrictEqual(routes[1].checks, { nojs: false, canonical: false, jsonld: false });
    assert.deepStrictEqual(routes[2].checks, { axe: false });
    assert.deepStrictEqual(h.normalizeRoutes().map((r) => r.path), ['/']);
    assert.throws(() => h.normalizeRoutes(['nope']), /must start with \//);

    // JSON-LD: parse errors per block; top-level and @graph entities; headline before name; breadcrumbs skipped.
    const ld = h.jsonLdEntities([
        JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'OpenVibe.Wiki' }, { '@type': 'BreadcrumbList', name: 'crumbs' }] }),
        JSON.stringify([{ '@type': 'Article', headline: 'Hello  world', name: 'ignored' }, { '@type': 'Thing' }]),
        '{not json',
    ]);
    assert.deepStrictEqual(ld.entities, [
        { type: 'WebSite', field: 'name', value: 'OpenVibe.Wiki' },
        { type: 'Article', field: 'headline', value: 'Hello  world' },
    ]);
    assert.strictEqual(ld.parseErrors.length, 1);
    assert.ok(/^block 3: /.test(ld.parseErrors[0]));

    // Visible-text matching: case, whitespace and typographic quotes do not matter; a long value may match by prefix.
    assert.strictEqual(h.findText('Welcome to  OPENVIBE.WIKI today', 'OpenVibe.Wiki'), 'full');
    assert.strictEqual(h.findText('It’s “here”', 'It\'s "here"'), 'full');
    const long = 'A very long headline that the page shows only in part because it is far too long for one line of text';
    assert.strictEqual(h.findText(`… ${long.slice(0, 70)} …`, long), 'prefix');
    assert.strictEqual(h.findText('nothing here', 'Missing'), null);
    assert.strictEqual(h.findText('anything', '   '), null);

    // A title-style name matches by its leading part; a web page's name by the document title.
    const html = { text: 'Content Live now Recent clips', title: 'Content — OpenVibe.Live' };
    assert.strictEqual(h.visibleIn({ type: 'CollectionPage', value: 'Content — OpenVibe.Live' }, html, ''), 'html');
    assert.strictEqual(h.visibleIn({ type: 'WebPage', value: 'Content — OpenVibe.Live' }, { text: '', title: 'Content — OpenVibe.Live' }, ''), 'html');
    assert.strictEqual(h.visibleIn({ type: 'Article', value: 'Content — OpenVibe.Live' }, { text: '', title: 'Content — OpenVibe.Live' }, ''), null, 'only web pages are named by their title');
    assert.strictEqual(h.visibleIn({ type: 'ItemList', value: 'Live & recent' }, html, 'LIVE &  Recent'), 'js');
    assert.strictEqual(h.visibleIn({ type: 'Thing', value: 'A - B' }, { text: 'a', title: '' }, ''), null, 'a leading part under 3 characters is not enough');

    // An ItemList is judged by its items (80 % visible), not by its label.
    const list = h.jsonLdEntities([JSON.stringify({ '@type': 'ItemList', name: 'Tool families', itemListElement: ['Image', 'Audio', 'Video', 'Text', 'Network'].map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })) })]).entities[0];
    assert.deepStrictEqual([list.field, list.value, list.name, list.items.length], ['items', '5 items', 'Tool families', 5]);
    assert.strictEqual(h.visibleIn(list, { text: 'image audio video text', title: '' }, ''), 'html', '4 of 5 is enough');
    assert.strictEqual(h.visibleIn(list, { text: 'image audio', title: '' }, 'image audio video text network'), 'js');
    assert.strictEqual(h.visibleIn(list, { text: 'image', title: '' }, 'audio'), null);
    assert.deepStrictEqual(h.jsonLdEntities([JSON.stringify({ '@type': 'ItemList', name: 'Empty list', itemListElement: [] })]).entities, [{ type: 'ItemList', field: 'name', value: 'Empty list' }], 'a list without item names falls back to its name');

    // Ignore rules: a RegExp on the message or URL, or { label, text, url } with every given RegExp matching; counted.
    const split = h.splitErrors([
        { source: 'security', text: "Loading the script 'https://static.cloudflareinsights.com/beacon.min.js' violates CSP", url: 'https://a.example/' },
        { source: 'network', text: 'Failed to load resource: the server responded with a status of 401 ()', url: 'https://a.example/api/auth/refresh' },
        { source: 'network', text: 'Failed to load resource: the server responded with a status of 401 ()', url: 'https://a.example/api/secret' },
        { source: 'exception', text: 'TypeError: x', url: '' },
    ], [/cloudflareinsights/, { label: 'signed-out session probe', text: /status of 401/, url: /\/auth\/refresh$/ }]);
    assert.deepStrictEqual(split.kept.map((e) => e.url), ['https://a.example/api/secret', '']);
    assert.deepStrictEqual(split.ignored, { '/cloudflareinsights/': 1, 'signed-out session probe': 1 });

    // Growth: from the end of lap 2 to the last lap, over budget and still growing over the last half.
    const s = (nodes, heapKB = 1000) => ({ nodes, heapKB, listeners: 10, documents: 1, intervals: 2, timeouts: 1, sockets: 0 });
    let g = h.growth([s(100), s(200), s(500), s(800), s(1100)]);
    assert.deepStrictEqual(g.over.map((o) => [o.name, o.delta]), [['nodes', 900]]);
    assert.strictEqual(g.from, 2);
    g = h.growth([s(100), s(200), s(900), s(600), s(550)]); // a one-off spike that came back down
    assert.deepStrictEqual(g.over, []);
    g = h.growth([s(100), s(200), s(250), s(300), s(350)]); // under budget (300)
    assert.deepStrictEqual(g.over, []);
    assert.strictEqual(g.deltas.nodes, 150);
    assert.strictEqual(h.growth([s(1), s(2)]).measured, false, 'needs at least three laps');
    assert.deepStrictEqual(h.growth([s(1), s(2), s(3000, 9000), s(9000, 90000)], { heapKB: 100 }).over.map((o) => o.name), ['heapKB'], 'custom budgets');

    // Sitemaps: same origin only, one path per first segment, capped, the home page left out.
    const xml = `<urlset><url><loc>https://a.example/</loc></url><url><loc>https://a.example/p/one</loc></url>
        <url><loc>https://a.example/p/two</loc></url><url><loc> https://a.example/s/x?y=1&amp;z=2 </loc></url>
        <url><loc>https://b.example/p/other</loc></url><url><loc>https://a.example/@ann</loc></url><url><loc>https://a.example/@bob</loc></url>
        <url><loc>https://a.example/tool/t</loc></url><url><loc>https://a.example/docs/d</loc></url></urlset>`;
    assert.deepStrictEqual(h.sitemapPaths(xml, 'https://a.example', 4), ['/p/one', '/s/x?y=1&z=2', '/@ann', '/tool/t']);

    // Judging a route from what the browser saw.
    const base = { width: 1280, status: 200, errors: [], overflow: false, offenders: [], duplicateScripts: [], canonical: ['https://a.example/p'], text: 'Only With JS' };
    const nojs = { status: 200, textChars: 500, canonical: ['https://a.example/p'], jsonld: [JSON.stringify({ '@type': 'Article', headline: 'The Title' })], text: 'the title and more' };
    let r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [{ ...base, width: 390 }, base], nojs, axe: { violations: [], critical: 0, serious: 0, moderate: 0, minor: 0 } }, { minText: 200 });
    assert.deepStrictEqual(r.checks, { status: 'pass', errors: 'pass', overflow: 'pass', scripts: 'pass', nojs: 'pass', canonical: 'pass', jsonld: 'pass', axe: 'pass' });
    assert.strictEqual(r.ok, true);
    r = h.checkRoute(h.normalizeRoutes(['/p'])[0], {
        url: 'https://a.example/p',
        widths: [{ ...base, width: 390, status: 500, errors: [{ source: 'exception', text: 'TypeError: x', url: '' }, { source: 'network', text: 'Failed to load resource', url: 'https://t.example/beacon' }], overflow: true, duplicateScripts: [{ url: 'https://a.example/app.js', count: 2 }] }, { ...base, canonical: ['https://a.example/other'] }],
        nojs: { ...nojs, textChars: 20, canonical: ['https://other.example/p'], jsonld: [JSON.stringify({ '@type': 'Article', headline: 'Only With JS' }), JSON.stringify({ '@type': 'Person', name: 'Nobody' })] },
        axe: { violations: [{ id: 'color-contrast', impact: 'serious', help: 'contrast', nodes: 2, targets: ['a'] }], critical: 0, serious: 1, moderate: 0, minor: 0 },
    }, { minText: 200, ignoreErrors: [/beacon/] });
    assert.deepStrictEqual(r.checks, { status: 'fail', errors: 'fail', overflow: 'fail', scripts: 'fail', nojs: 'fail', canonical: 'warn', jsonld: 'fail', axe: 'fail' });
    assert.deepStrictEqual(r.errors, ['exception: TypeError: x'], 'ignoreErrors matches the URL too');
    assert.ok(/points to https:\/\/other\.example; JavaScript changes it/.test(r.canonical.note));
    assert.deepStrictEqual(r.jsonld.entities.map((e) => e.found), ['js', null]);
    // No canonical, two canonicals, a relative one.
    for (const [canonical, note] of [[[], 'no canonical link'], [['a', 'b'], 'more than one canonical link'], [['/p'], 'not an absolute URL']]) {
        r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [base], nojs: { ...nojs, canonical }, axe: { skipped: true } }, { minText: 200 });
        assert.strictEqual(r.checks.canonical, 'fail', note);
        assert.strictEqual(r.canonical.note, note);
        assert.strictEqual(r.checks.axe, 'skip');
    }
    // A noindex page (meta robots or X-Robots-Tag) needs no canonical; one it has is still judged.
    r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [base], nojs: { ...nojs, canonical: [], robots: 'noindex, nofollow' }, axe: { skipped: true } }, { minText: 200 });
    assert.deepStrictEqual([r.checks.canonical, r.canonical.note], ['skip', 'noindex page: no canonical needed']);
    r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [base], nojs: { ...nojs, canonical: ['/p'], robots: 'noindex' }, axe: { skipped: true } }, { minText: 200 });
    assert.strictEqual(r.checks.canonical, 'fail');
    // A 404 route: the status is what counts; no crawler checks; a no-JS load that failed fails the status.
    r = h.checkRoute(h.normalizeRoutes([{ path: '/gone', status: 404 }])[0], { url: 'https://a.example/gone', widths: [{ ...base, status: 404 }], nojs: null, axe: { skipped: true } }, { minText: 200 });
    assert.deepStrictEqual([r.checks.status, r.checks.nojs, r.checks.canonical, r.checks.jsonld], ['pass', 'skip', 'skip', 'skip']);
    r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [base], nojs: { error: 'net::ERR_TIMED_OUT' }, axe: { skipped: true } }, { minText: 200 });
    assert.deepStrictEqual([r.checks.nojs, r.checks.canonical, r.checks.jsonld], ['fail', 'fail', 'fail']);
    // A JSON answer (an API's 404) is not a page: only its status counts, whatever the browser showed.
    r = h.checkRoute(h.normalizeRoutes([{ path: '/api/x', status: 404 }])[0], { path: '/api/x', url: 'https://a.example/api/x',
        widths: [{ ...base, status: 404, contentType: 'application/problem+json', errors: [{ source: 'network', text: 'favicon 404', url: 'https://a.example/favicon.ico' }] }],
        nojs: null, axe: { violations: [{ id: 'document-title', impact: 'serious' }], critical: 0, serious: 1, moderate: 0, minor: 0 } }, { minText: 200 });
    assert.deepStrictEqual(r.checks, { status: 'pass', errors: 'skip', overflow: 'skip', scripts: 'skip', nojs: 'skip', canonical: 'skip', jsonld: 'skip', axe: 'skip' });
    assert.strictEqual(r.contentType, 'application/problem+json');
    assert.ok(h.format({ base: 'https://a.example', routes: [r], ok: true }).includes('/api/x: pass (application/problem+json: only the status is checked)'));
    // Moderate axe findings are reported, not failed.
    r = h.checkRoute(h.normalizeRoutes(['/p'])[0], { url: 'https://a.example/p', widths: [base], nojs, axe: { violations: [], critical: 0, serious: 0, moderate: 2, minor: 1 } }, { minText: 200 });
    assert.strictEqual(r.checks.axe, 'warn');
    assert.strictEqual(r.ok, true);

    // Summary and text output.
    const report = { base: 'https://a.example', chrome: 'Chrome/1', routes: [r, { ...r, path: '/q', checks: { ...r.checks, overflow: 'fail' }, widths: [{ ...base, overflow: true, scrollWidth: 900, offenders: ['div.wide (right 900px)'] }], ok: false }],
        navigation: { from: '/', to: '/p', laps: 5, mode: 'link', ok: true, growth: h.growth([s(1), s(2), s(3), s(4), s(5)]), idle: { seconds: 5, cpuPct: 0.4, requests: 1, kb: 0.5 } } };
    const sum = h.summarize(report);
    assert.strictEqual(sum.ok, false);
    assert.deepStrictEqual(sum.checks.overflow, { pass: 1, warn: 0, fail: 1, skip: 0 });
    assert.deepStrictEqual(sum.checks.navigation, { pass: 1, warn: 0, fail: 0, skip: 0 });
    assert.strictEqual(sum.axe.moderate, 4);
    report.ok = sum.ok;
    const text = h.format(report);
    assert.ok(text.includes('overflow at 1280px: page 900px wide; div.wide (right 900px)'), text);
    assert.ok(text.includes('navigation / ↔ /p ×5 (link): pass; growth lap 2→5: heap 0 KB, nodes +3'), text);
    assert.ok(h.format(report, { markdown: true }).includes('`/q`'));

    // axe-core: an explicit source wins; the download is checked against its pinned hash and cached.
    assert.strictEqual(await h.axeSource({ source: 'window.axe=1' }), 'window.axe=1');
    const body = Buffer.from('/*! fake axe */ window.axe = {};');
    const server = http.createServer((req, res) => { res.end(req.url === '/bad.js' ? 'tampered' : body); });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-harness-test-'));
    process.env.XDG_CACHE_HOME = cache;
    const sha384 = crypto.createHash('sha384').update(body).digest('base64');
    const at = `http://127.0.0.1:${server.address().port}`;
    await assert.rejects(h.axeSource({ url: `${at}/bad.js`, sha384 }), /does not match its pinned sha384/);
    // (An installed axe-core package would be preferred; none is installed in this repository.)
    assert.throws(() => require.resolve('axe-core/axe.min.js'));
    assert.strictEqual(await h.axeSource({ url: `${at}/axe.js`, sha384 }), body.toString());
    assert.strictEqual(fs.readdirSync(path.join(cache, 'openvibe-shared')).length, 1, 'cached');
    server.close();
    fs.rmSync(cache, { recursive: true, force: true });
    assert.strictEqual(h.AXE.version, '4.13.0');
    assert.ok(h.AXE.url.includes(`axe-core@${h.AXE.version}/`));
    console.log('browser-harness: helpers ok');
})().catch((e) => { console.error(e); process.exit(1); });
