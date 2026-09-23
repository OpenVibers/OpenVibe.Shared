'use strict';
// release.js (GET /release.json, the manifest fields, the contract filter, POST /release-metrics) and
// release-watch.js on a manifest without components (prompt, and reload only when safe).
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const os = require('os'); const crypto = require('crypto');
const { createRelease, normalizeRange, satisfies, project } = require('../release');
const { createRegistry } = require('../metrics');
const { openPage } = require('../release-compat');

const ROOT = path.join(__dirname, '..');
const FIXTURE = require('./fixtures/release-manifest.v1.1.0.json');
const Ajv2020 = require(require.resolve('ajv/dist/2020', { paths: [path.dirname(require.resolve('openvibe-contracts/package.json'))] }));
const addFormats = require(require.resolve('ajv-formats', { paths: [path.dirname(require.resolve('openvibe-contracts/package.json'))] }));
const contracts = require('openvibe-contracts');

// The schema a full manifest is checked against: the installed openvibe-contracts once it has 1.1.0,
// else the copy of Contracts' proposed 1.1.0 in test/fixtures (drop it when the devDependency moves on).
const installed = contracts.schema('registry.release-manifest@1');
const v11 = installed.properties.components ? installed : FIXTURE;
for (const k of Object.keys(installed.properties)) assert.ok(FIXTURE.properties[k], `the 1.1.0 fixture keeps ${k}`);
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }); addFormats(ajv);
const validate11 = ajv.compile(v11);
const valid11 = (m) => { const ok = validate11(m); return ok || JSON.stringify(validate11.errors); };

(async () => {
    // ── Ranges ─────────────────────────────────────────────────
    assert.strictEqual(normalizeRange('^1.2.0'), '>=1.2.0 <2.0.0');
    assert.strictEqual(normalizeRange('^0.4.1'), '>=0.4.1 <0.5.0');
    assert.strictEqual(normalizeRange('~1.2.3'), '>=1.2.3 <1.3.0');
    assert.strictEqual(normalizeRange('1.x'), '>=1.0.0 <2.0.0');
    assert.strictEqual(normalizeRange('1.2'), '>=1.2.0 <1.3.0');
    assert.strictEqual(normalizeRange('1.2.3'), '>=1.2.3 <1.2.4');
    assert.strictEqual(normalizeRange('>=1.1.0'), '>=1.1.0 <2.0.0');
    assert.strictEqual(normalizeRange('>= 1.1.0 < 3.0.0'), '>=1.1.0 <3.0.0');
    assert.strictEqual(normalizeRange('', '2.3.4'), '>=2.3.4 <3.0.0', 'empty is ^version');
    assert.throws(() => normalizeRange('>=2.0.0 <1.0.0'));
    assert.throws(() => normalizeRange('latest'));
    assert.ok(satisfies('1.9.9', '>=1.0.0 <2.0.0') && !satisfies('2.0.0', '>=1.0.0 <2.0.0') && !satisfies('0.9.0', '>=1.0.0 <2.0.0'));

    // ── A service with no contracts installed: the 1.0.0 manifest, as before ──
    const r = createRelease({ service: 'community', root: os.tmpdir(), env: { RELEASE_COMMIT: 'ABCDEF1234567890', RELEASE_AT: '2026-09-23T01:00:00Z' }, minClientRelease: 'nope', schema: null });
    const m = r.manifest();
    assert.deepStrictEqual(Object.keys(m), ['service', 'release', 'released_at', 'booted_at', 'contracts_version', 'packages', 'min_client_release', 'mixed_version_window_hours']);
    assert.strictEqual(m.release, 'abcdef123456');
    assert.strictEqual(r.release, 'abcdef123456');
    assert.strictEqual(m.released_at, '2026-09-23T01:00:00.000Z');
    assert.strictEqual(m.min_client_release, null, 'a malformed MIN_CLIENT_RELEASE is ignored');
    assert.strictEqual(m.mixed_version_window_hours, 24);
    assert.match(r.metaTag(), /^<meta name="ov-release" content="abcdef123456" data-released-at="2026-09-23T01:00:00.000Z" data-url="\/release.json">$/);
    const headers = {}; let body = '';
    r.handler({}, { setHeader: (k, v) => { headers[k] = v; }, end: (b) => { body = b; } });
    assert.strictEqual(headers['Cache-Control'], 'no-cache, max-age=0');
    assert.deepStrictEqual(JSON.parse(body), JSON.parse(JSON.stringify(m)));
    assert.throws(() => createRelease({ service: 'Bad Name' }));
    assert.strictEqual(r.full().components.shell.version, 'abcdef123456', 'no declared shell: its version is the release, so every release reloads');
    assert.strictEqual(r.full().components.server.kind, 'server');

    // ── Components, the asset map, schema generation and contract ranges ──
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-release-'));
    const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
    write('public/css/app.css', 'body{color:red}');
    write('public/js/app.js', 'console.log(1)');
    write('server/web/layout.js', 'module.exports = 1;');
    write('docs/a.md', '# A');
    write('docs/b.md', '# B');
    const sha12 = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);
    const spec = {
        service: 'test', root: tmp, env: { RELEASE_COMMIT: '1234567abcdef', RELEASE_AT: '2026-09-23T02:00:00Z' }, schema: v11,
        components: {
            styles: { kind: 'style', assets: ['/css/app.css'] },
            docs: { kind: 'content', files: ['docs'] },
            shell: { kind: 'script', assets: ['/js/app.js'], files: ['server/web/layout.js'] },
        },
        contracts: { 'test.web-api': { version: '1.2.0', accepts: '^1.0.0' }, 'media.object': { version: '1.0.0', role: 'consumes' } },
        schemaGeneration: () => 7, schemaCompatibleFrom: 5, logger: { warn() {} },
    };
    let rel = createRelease(spec);
    let full = rel.full();
    assert.strictEqual(valid11(full), true, 'the full manifest validates against registry.release-manifest 1.1.0');
    assert.deepStrictEqual(rel.manifest(), full, 'a 1.1.0 schema serves every field');
    assert.deepStrictEqual(Object.keys(full.components).sort(), ['docs', 'server', 'shell', 'styles']);
    assert.strictEqual(full.components.styles.kind, 'style');
    assert.match(full.components.styles.version, /^[0-9a-f]{12}$/);
    assert.strictEqual(full.components.server.version, '1234567abcde');
    assert.deepStrictEqual(full.assets['/css/app.css'], { url: `/css/app.css?v=${sha12('body{color:red}')}`, component: 'styles', integrity: `sha384-${crypto.createHash('sha384').update('body{color:red}').digest('base64')}` });
    assert.strictEqual(full.assets['/js/app.js'].component, 'shell');
    assert.strictEqual(full.schema_generation, 7);
    assert.strictEqual(full.schema_compatible_from, 5);
    assert.deepStrictEqual(full.contract_ranges, { 'test.web-api': { version: '1.2.0', accepts: '>=1.0.0 <2.0.0' }, 'media.object': { version: '1.0.0', accepts: '>=1.0.0 <2.0.0', role: 'consumes' } });
    assert.strictEqual(full.metrics_url, null);
    assert.deepStrictEqual(rel.warnings, []);
    const before = full.components;
    // A CSS-only change moves only the style component; a doc edit only the content one.
    write('public/css/app.css', 'body{color:blue}');
    full = rel.refresh() && rel.full();
    assert.notStrictEqual(full.components.styles.version, before.styles.version);
    assert.strictEqual(full.components.docs.version, before.docs.version);
    assert.strictEqual(full.components.shell.version, before.shell.version);
    write('docs/b.md', '# B, edited');
    full = rel.refresh() && rel.full();
    assert.notStrictEqual(full.components.docs.version, before.docs.version);
    assert.strictEqual(full.components.shell.version, before.shell.version);
    // A platform package bump is a shell change (the navbar is code the page runs).
    fs.mkdirSync(path.join(tmp, 'node_modules/openvibe-sdk'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'node_modules/openvibe-sdk/package.json'), '{"name":"openvibe-sdk","version":"9.9.9"}');
    full = rel.refresh() && rel.full();
    assert.strictEqual(full.packages['openvibe-sdk'], '9.9.9');
    assert.notStrictEqual(full.components.shell.version, before.shell.version);
    // recheckMs: a static-only switch is noticed without a restart.
    rel = createRelease({ ...spec, recheckMs: 1 });
    const v1 = rel.full().components.styles.version;
    write('public/css/app.css', 'body{color:green}');
    await new Promise((res) => setTimeout(res, 5));
    let served = '';
    rel.handler({}, { setHeader() {}, end: (b) => { served = b; } });
    assert.notStrictEqual(JSON.parse(served).components.styles.version, v1, 'the handler re-reads changed files after recheckMs');
    // Mistakes: a missing file warns (the manifest is advisory); a bad declaration throws at boot.
    const warned = createRelease({ ...spec, components: { styles: { kind: 'style', assets: ['/css/gone.css'] } } });
    assert.match(warned.warnings[0], /gone\.css/);
    assert.throws(() => createRelease({ ...spec, components: { styles: { kind: 'layout' } } }), /kind/);
    assert.throws(() => createRelease({ ...spec, components: { styles: { kind: 'style', assets: ['/../etc/passwd'] } } }), /publicDir/);
    assert.throws(() => createRelease({ ...spec, components: { shell: { kind: 'style' } } }), /shell/);
    assert.throws(() => createRelease({ ...spec, contracts: { 'test.web-api': { version: '1.2.0', accepts: '>=2.0.0' } } }), /excludes its own version/);
    assert.throws(() => createRelease({ ...spec, contracts: { nodot: '1.0.0' } }), /owner/);
    fs.rmSync(tmp, { recursive: true, force: true });

    // ── The contract filter: /release.json validates against the contracts the service pins ──
    const pinned = createRelease({ service: 'shared', root: ROOT, env: {}, components: spec.components, contracts: spec.contracts, logger: { warn() {} } });
    const v = pinned.validate();
    assert.strictEqual(v.contract, installed.properties.components ? v.contract : '1.0.0');
    assert.strictEqual(v.valid, true, `the served manifest validates against the installed openvibe-contracts: ${JSON.stringify(v.errors)}`);
    if (!installed.properties.components) {
        assert.deepStrictEqual(pinned.fields(), ['service', 'release', 'released_at', 'booted_at', 'contracts_version', 'packages', 'min_client_release', 'mixed_version_window_hours'], 'contracts 0.30.x: only the 1.0.0 fields are served');
        assert.strictEqual(contracts.validate('registry.release-manifest@1', pinned.full()).valid, false, 'the unfiltered manifest would fail 1.0.0');
    }
    assert.strictEqual(valid11(pinned.full()), true, 'and the full manifest validates against 1.1.0');
    assert.deepStrictEqual(project({ a: 1, b: { c: 2, d: 3 }, e: { x: { y: 1, z: 2 } } }, { additionalProperties: false, properties: { a: {}, b: { additionalProperties: false, properties: { c: {} } }, e: { additionalProperties: { additionalProperties: false, properties: { y: {} } } } } }), { a: 1, b: { c: 2 }, e: { x: { y: 1 } } });

    // ── POST /release-metrics into release_client_updates_total ──
    const registry = createRegistry();
    const collect = r.collect(registry, { perMinute: 3 });
    const { Readable } = require('stream');
    const post = async (payload, hdrs = {}, ip = '127.0.0.1') => {
        const req = Readable.from([Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))]);
        req.headers = hdrs; req.socket = { remoteAddress: ip };
        const res = { statusCode: 0, setHeader() {}, end() {} };
        await collect(req, res);
        return res.statusCode;
    };
    const counter = (outcome, reason) => { const line = registry.metrics().split('\n').find((l) => l.startsWith(`release_client_updates_total{outcome="${outcome}",reason="${reason}"}`)); return line ? Number(line.split(' ').pop()) : 0; };
    assert.strictEqual(await post({ counts: { applied: { 'content+style': 1 }, deferred: { typing: 2, bogus: 1 }, failed: { style: 500 } } }), 204);
    assert.strictEqual(counter('applied', 'content+style'), 1);
    assert.strictEqual(counter('deferred', 'typing'), 2);
    assert.strictEqual(counter('deferred', 'other'), 1, 'an unknown reason counts as other');
    assert.strictEqual(counter('failed', 'style'), 50, 'one report counts at most 50 per reason');
    assert.strictEqual(await post('not json', {}, '10.0.0.2'), 400);
    assert.strictEqual(await post({ counts: { reloaded: { user: 1 } } }, { 'sec-gpc': '1' }, '10.0.0.3'), 204);
    assert.strictEqual(counter('reloaded', 'user'), 0, 'Sec-GPC reports are not counted');
    assert.strictEqual(await post('x'.repeat(5000), {}, '10.0.0.4'), 413);
    assert.strictEqual(await post({ counts: {} }), 204);
    assert.strictEqual(await post({ counts: {} }), 204);
    assert.strictEqual(await post({ counts: {} }), 429, 'an address sends at most perMinute reports a minute');

    // mount(): GET /release.json and POST /release-metrics on a real app, behind express.json(), fed by
    // the text/plain body navigator.sendBeacon sends; the manifest then says where to report.
    {
        const express = require('express');
        const app = express();
        app.use(express.json());
        const reg = createRegistry();
        const svc = createRelease({ service: 'test', root: ROOT, env: {}, schema: v11, logger: { warn() {} } }).mount(app, { registry: reg });
        assert.strictEqual(svc.full().metrics_url, '/release-metrics');
        assert.match(svc.metaTag(), /data-metrics="\/release-metrics"/);
        const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const got = await (await fetch(`${base}/release.json`)).json();
        assert.strictEqual(got.metrics_url, '/release-metrics');
        const beacon = await fetch(`${base}/release-metrics`, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ counts: { applied: { style: 1 }, reloaded: { window: 1 } } }) });
        assert.strictEqual(beacon.status, 204);
        const json = await fetch(`${base}/release-metrics`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ counts: { applied: { style: 1 } } }) });
        assert.strictEqual(json.status, 204);
        assert.match(reg.metrics(), /release_client_updates_total\{outcome="applied",reason="style"\} 2/);
        assert.match(reg.metrics(), /release_client_updates_total\{outcome="reloaded",reason="window"\} 1/);
        server.close();
    }

    // ── The tab, on manifests without components (every service before 1.5.0 + contracts 0.31) ──
    const fresh = new Date(Date.now() - 3600e3).toISOString();
    const stale = new Date(Date.now() - 30 * 3600e3).toISOString();
    const HTML = (extra = '', body = '') => `<!doctype html><html><head><meta name="ov-release" content="aaaaaaa" data-url="/release.json">${extra}</head><body>${body}</body></html>`;
    async function tab({ server, releasedAt = fresh, min = null, hidden = true, html = HTML(), protectedFn = null, focus = null, config = { metricsUrl: '/release-metrics' } }) {
        const manifest = { service: 'test', release: server, released_at: releasedAt, min_client_release: min, mixed_version_window_hours: 24 };
        const page = await openPage({ url: 'https://site.test/', html, hidden, protectedFn, config, serve: (u) => (u.endsWith('/release.json') ? { json: manifest } : { status: 404 }) });
        if (focus) page.focus(page.document.querySelector(focus));
        await page.settle();
        return page;
    }
    let p = await tab({ server: 'aaaaaaa' });
    await p.release.check(); await p.settle();
    assert.strictEqual(p.toasts.length, 0, 'same release: nothing');

    p = await tab({ server: 'bbbbbbb' });
    assert.strictEqual(p.toasts.length, 1, 'newer release: one prompt');
    assert.strictEqual(p.toasts[0].o.ttl, 0, 'the prompt stays until dismissed');
    assert.strictEqual(p.reloads, 0, 'inside the window: never an automatic reload');
    await p.release.check(); await p.settle();
    assert.strictEqual(p.toasts.length, 1, 'prompted once');
    assert.ok(!p.document.querySelector('script[src*="release-update.js"]'), 'a manifest without components needs no release-update.js');
    p.toasts[0].o.action.onClick();
    assert.strictEqual(p.reloads, 1, 'Reload reloads');
    assert.deepStrictEqual(p.beacons.at(-1).body.counts, { reloaded: { user: 1 } }, 'and is counted before the page goes');

    p = await tab({ server: 'bbbbbbb', releasedAt: stale });
    assert.strictEqual(p.reloads, 1, 'outside the window and hidden: reloads');
    assert.deepStrictEqual(p.beacons[0].body.counts, { reloaded: { window: 1 } });
    assert.strictEqual(p.beacons[0].to, '/release-metrics');

    p = await tab({ server: 'bbbbbbb', min: 'bbbbbbb' });
    assert.strictEqual(p.reloads, 1, 'server requires the new release: reloads when safe');
    assert.deepStrictEqual(p.metrics(), { reloaded: { required: 1 } });

    p = await tab({ server: 'bbbbbbb', releasedAt: stale, html: HTML('', '<textarea></textarea>'), focus: 'textarea' });
    assert.strictEqual(p.reloads, 0, 'never while a text field has focus');
    p.tick(); p.tick();
    assert.deepStrictEqual(p.metrics(), { deferred: { typing: 1 } }, 'a deferral is counted once per release and reason');
    p.blur(); p.tick();
    assert.strictEqual(p.reloads, 1, 'and reloads once the field lets go');

    p = await tab({ server: 'bbbbbbb', releasedAt: stale, protectedFn: () => true });
    assert.strictEqual(p.reloads, 0, 'never during a protected session (upload, call, broadcast)');
    assert.deepStrictEqual(p.metrics(), { deferred: { protected: 1 } });

    p = await tab({ server: 'bbbbbbb', releasedAt: stale, html: HTML('', '<form data-dirty="true"></form>') });
    assert.deepStrictEqual([p.reloads, p.metrics()], [0, { deferred: { dirty: 1 } }], 'never with unsent form input');

    p = await tab({ server: 'bbbbbbb', releasedAt: stale, html: HTML('', '<video></video>') });
    assert.deepStrictEqual([p.reloads, p.metrics()], [0, { deferred: { media: 1 } }], 'never while a stream is playing (a linkedom <video> is not paused)');
    {
        // A paused <video> with a live camera track is a capture: served stale, it waits.
        const html = HTML('', '<video></video>');
        const manifest = { service: 'test', release: 'bbbbbbb', released_at: stale, min_client_release: null, mixed_version_window_hours: 24 };
        const page = await openPage({ url: 'https://site.test/', html, hidden: true, serve: () => ({ json: manifest }) });
        const vid = page.document.querySelector('video');
        vid.paused = true; vid.srcObject = { getTracks: () => [{ readyState: 'live' }] };
        await page.settle();
        assert.deepStrictEqual([page.reloads, page.metrics()], [0, { deferred: { capture: 1 } }], 'never while the camera/mic is live');
    }

    p = await tab({ server: 'bbbbbbb', releasedAt: stale, hidden: false });
    assert.deepStrictEqual([p.reloads, p.metrics()], [0, { deferred: { active: 1 } }], 'a visible tab someone just used is not reloaded');
    p.setHidden(true);
    assert.strictEqual(p.reloads, 1, 'hiding it is the safe moment');
    assert.deepStrictEqual(p.beacons.map((b) => b.body.counts), [{ deferred: { active: 1 } }, { reloaded: { window: 1 } }], 'hiding sends the deferral, the reload its own count');

    // Without a meta tag the first /release.json read is the baseline; a later release prompts.
    {
        let served = 'ccccccc';
        const page = await openPage({ url: 'https://site.test/', html: '<html><head></head><body></body></html>', hidden: true, serve: () => ({ json: { service: 'test', release: served, released_at: fresh, min_client_release: null, mixed_version_window_hours: 24 } }) });
        await page.settle();
        assert.strictEqual(page.release.current, 'ccccccc', 'baseline learned from /release.json');
        await page.release.check(); await page.settle();
        assert.strictEqual(page.toasts.length, 0);
        served = 'ddddddd';
        await page.release.check(); await page.settle();
        assert.strictEqual(page.toasts.length, 1, 'a later release prompts');
        assert.strictEqual(page.beacons.length, 0, 'no metrics URL configured: nothing is sent');
    }
    {
        const page = await openPage({ url: 'https://site.test/', html: '<html><head></head><body></body></html>', hidden: true, serve: () => ({ status: 404 }) });
        await page.settle();
        page.tick(); await page.settle();
        assert.strictEqual(page.requests.length, 1, 'a site without /release.json is asked once, then left alone');
    }
    {
        // A metrics URL on another origin is never used.
        const page = await tab({ server: 'bbbbbbb', releasedAt: stale, config: { metricsUrl: 'https://elsewhere.test/collect' } });
        assert.strictEqual(page.reloads, 1);
        assert.strictEqual(page.beacons.length, 0);
    }

    console.log('release: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
