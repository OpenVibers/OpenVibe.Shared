'use strict';
// metrics.js: Prometheus text format, cardinality guard, route templates (never raw URLs), the
// loopback-only /metrics handler, and the golden-signal middleware on a real Express-shaped app.
const assert = require('assert');
const http = require('http');
const metrics = require('../metrics');

(async () => {
    // ── Registry and text format ──
    const r = metrics.createRegistry({ maxSeries: 3 });
    const c = r.counter({ name: 'jobs_total', help: 'Jobs\nrun', labelNames: ['state'] });
    c.inc({ state: 'done' });
    c.inc({ state: 'done' }, 2);
    c.inc({ state: 'a"b\\c\nd' });
    assert.strictEqual(c.get({ state: 'done' }), 3);
    assert.throws(() => c.inc({ state: 'done' }, -1), /only increase/);
    assert.throws(() => r.counter({ name: 'jobs_total', help: 'x' }), /already registered/);
    assert.throws(() => r.counter({ name: 'bad-name', help: 'x' }), /invalid metric name/);
    assert.throws(() => r.histogram({ name: 'h_bad', help: 'x', labelNames: ['le'] }), /invalid label/);
    assert.throws(() => r.gauge({ name: 'no_help' }), /help/);

    const g = r.gauge({ name: 'queue_depth', help: 'Depth', labelNames: ['status'] });
    g.set({ status: 'pending' }, 4); g.inc({ status: 'pending' }); g.dec({ status: 'pending' }, 2);
    assert.strictEqual(g.get({ status: 'pending' }), 3);
    const collected = r.gauge({ name: 'objects', help: 'Objects by state', labelNames: ['state'], collect: () => [{ labels: { state: 'local' }, value: 7 }, { labels: { state: 'b2' }, value: 2 }] });
    r.gauge({ name: 'broken', help: 'Collect throws', collect: () => { throw new Error('db gone'); } });
    r.gauge({ name: 'scalar', help: 'A plain number', collect: () => 5 });
    assert.ok(collected);

    const h = r.histogram({ name: 'lat_seconds', help: 'Latency', labelNames: ['op'], buckets: [0.1, 1] });
    h.observe({ op: 'x' }, 0.05); h.observe({ op: 'x' }, 0.5); h.observe({ op: 'x' }, 3); h.observe({ op: 'x' }, NaN);
    assert.deepStrictEqual(h.get({ op: 'x' }), { count: 3, sum: 3.55, buckets: { 0.1: 1, 1: 2 } });
    const end = h.startTimer({ op: 'y' });
    assert.ok(end() >= 0);

    let text = r.metrics();
    assert.ok(text.endsWith('\n'));
    assert.ok(text.includes('# HELP jobs_total Jobs\\nrun\n# TYPE jobs_total counter\n'));
    assert.ok(text.includes('jobs_total{state="done"} 3\n'));
    assert.ok(text.includes('jobs_total{state="a\\"b\\\\c\\nd"} 1\n'), 'label values are escaped');
    assert.ok(text.includes('queue_depth{status="pending"} 3\n'));
    assert.ok(text.includes('objects{state="local"} 7\nobjects{state="b2"} 2\n'));
    assert.ok(text.includes('scalar 5\n'));
    assert.ok(!text.includes('broken'), 'a throwing collect is left out, never reported stale');
    assert.ok(text.includes('lat_seconds_bucket{op="x",le="0.1"} 1\nlat_seconds_bucket{op="x",le="1"} 2\nlat_seconds_bucket{op="x",le="+Inf"} 3\nlat_seconds_sum{op="x"} 3.55\nlat_seconds_count{op="x"} 3\n'));

    // Cardinality guard: past maxSeries, new combinations fold into one _overflow series.
    for (let i = 0; i < 50; i++) c.inc({ state: `s${i}` });
    text = r.metrics();
    assert.strictEqual((text.match(/^jobs_total\{/gm) || []).length, 4, 'three series plus _overflow');
    assert.ok(text.includes('jobs_total{state="_overflow"} 49\n'));
    assert.ok(text.includes('metrics_series_overflow_total{metric="jobs_total"} 49\n'));

    // ── Route templates ──
    assert.strictEqual(metrics.templatePath('/api/v1/pastes/12345?x=1'), '/api/v1/pastes/:id');
    assert.strictEqual(metrics.templatePath('/u/usr_01J9ZX4YQ0ABCDEF/x'), '/u/:id/x');
    assert.strictEqual(metrics.templatePath('/o/0f8fad5b-d9cb-469f-a165-70867728950e'), '/o/:id');
    assert.strictEqual(metrics.templatePath('/o/01J9ZX4YQ0ABCDEFGHJKMNPQRS'), '/o/:id');
    assert.strictEqual(metrics.templatePath('/api/v1/live/vods'), '/api/v1/live/vods', 'route words stay');
    assert.strictEqual(metrics.routeLabel({ route: { path: '/:id' }, baseUrl: '/api/v1/live/vods' }), '/api/v1/live/vods/:id');
    assert.strictEqual(metrics.routeLabel({ route: { path: '/' }, baseUrl: '/api/things' }), '/api/things');
    assert.strictEqual(metrics.routeLabel({ route: { path: '/' }, baseUrl: '' }), '/');
    assert.strictEqual(metrics.routeLabel({ route: { path: /^\/x/ }, baseUrl: '' }), '(regex)');
    assert.strictEqual(metrics.routeLabel({ route: { path: ['/a', '/b'] }, baseUrl: '' }), '/a');
    assert.strictEqual(metrics.routeLabel({ route: { path: ['/a', '/b'] }, baseUrl: '', path: '/b' }), '/b');
    assert.strictEqual(metrics.routeLabel({ route: { path: ['/a', '/b/:id'] }, baseUrl: '', path: '/b/7' }), '/a', 'a parameterised member never labels with the raw path');
    assert.strictEqual(metrics.routeLabel({ baseUrl: '/secret/123', originalUrl: '/secret/123?q=1' }), 'unmatched');

    // ── Loopback-only guard ──
    const req = (addr, headers = {}) => ({ socket: { remoteAddress: addr }, headers });
    assert.ok(metrics.isLoopbackDirect(req('127.0.0.1')));
    assert.ok(metrics.isLoopbackDirect(req('::1')));
    assert.ok(metrics.isLoopbackDirect(req('::ffff:127.0.0.1')));
    assert.ok(!metrics.isLoopbackDirect(req('10.0.0.2')));
    assert.ok(!metrics.isLoopbackDirect(req('::ffff:10.0.0.2')));
    assert.ok(!metrics.isLoopbackDirect(req('127.0.0.1', { 'x-forwarded-for': '1.2.3.4' })), 'nginx on loopback is not a local caller');
    assert.ok(!metrics.isLoopbackDirect(req('127.0.0.1', { 'x-real-ip': '1.2.3.4' })));
    assert.ok(!metrics.isLoopbackDirect(req('127.0.0.1', { forwarded: 'for=1.2.3.4' })));

    // ── The whole thing on a real server (a minimal Express-compatible router stand-in is not
    //    enough for req.route; use express when it is installed, else a hand-rolled app) ──
    let express = null;
    try { express = require('express'); } catch { /* not a dependency of this package */ }
    if (express) {
        const app = express();
        const m = metrics.instrument(app, { service: 'shared-test', release: 'abc1234', skip: (q) => q.path === '/sse' });
        const router = express.Router();
        router.get('/:id', (q, s) => s.status(q.params.id === '0' ? 404 : 200).json({ id: q.params.id }));
        app.use('/api/items', router);
        app.get('/boom', () => { throw new Error('x'); });
        app.get('/sse', (_q, s) => s.end('ok'));
        const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const get = (p, headers = {}) => new Promise((resolve, reject) => http.get(base + p, { headers }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b, type: res.headers['content-type'] })); }).on('error', reject));
        await get('/api/items/42?token=secret');
        await get('/api/items/43');
        await get('/api/items/0');
        await get('/boom');
        await get('/sse');
        await get('/nope/9999/secret-path');
        // The event-loop histogram only reports once it has samples; on a fast CI runner the scrape
        // could otherwise come before the first sampling interval has elapsed.
        await new Promise((r) => setTimeout(r, 150));
        const out = await get('/metrics');
        assert.strictEqual(out.status, 200);
        assert.match(out.type, /^text\/plain; version=0\.0\.4/);
        assert.ok(out.body.includes('http_requests_total{method="GET",route="/api/items/:id",status_class="2xx"} 2\n'), out.body);
        assert.ok(out.body.includes('http_requests_total{method="GET",route="/api/items/:id",status_class="4xx"} 1\n'));
        assert.ok(out.body.includes('http_requests_total{method="GET",route="/boom",status_class="5xx"} 1\n'));
        assert.ok(out.body.includes('http_requests_total{method="GET",route="unmatched",status_class="4xx"} 1\n'));
        const labelSets = out.body.split('\n').filter((l) => l.startsWith('http_')).map((l) => (l.match(/\{[^}]*\}/) || [''])[0]).join('\n');
        assert.ok(!/42|43|secret|9999|nope/.test(labelSets), 'no ids, queries or raw paths in labels');
        assert.ok(!out.body.includes('route="/sse"'), 'skipped requests are not recorded');
        assert.ok(out.body.includes('http_request_duration_seconds_count{method="GET",route="/api/items/:id"} 3\n'));
        assert.ok(/http_requests_in_flight 1\n/.test(out.body), 'the scrape itself is in flight');
        assert.ok(out.body.includes('release_info{service="shared-test",release="abc1234"} 1\n'));
        for (const n of ['process_resident_memory_bytes', 'nodejs_heap_used_bytes', 'process_uptime_seconds', 'process_cpu_seconds_total', 'nodejs_eventloop_lag_seconds{stat="p99"}']) assert.ok(out.body.includes(`\n${n} `), n);
        const proxied = await get('/metrics', { 'X-Forwarded-For': '203.0.113.9' });
        assert.strictEqual(proxied.status, 404, 'a proxied caller gets 404');
        m.stop();
        server.close();
    } else {
        console.log('metrics: express not installed; middleware checked through the handler only');
    }

    // Handler without express: 404 to non-loopback, text to loopback.
    const reg = metrics.createRegistry();
    metrics.releaseInfo(reg, { service: 's', release: 'r' });
    const handler = metrics.metricsHandler(reg);
    const fakeRes = () => { const o = { headers: {}, statusCode: 0, body: '' }; o.setHeader = (k, v) => { o.headers[k] = v; }; o.end = (b) => { o.body = b; }; return o; };
    let res = fakeRes(); handler(req('192.0.2.1'), res);
    assert.strictEqual(res.statusCode, 404);
    res = fakeRes(); handler(req('127.0.0.1'), res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('release_info{service="s",release="r"} 1'));
    console.log('metrics: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
