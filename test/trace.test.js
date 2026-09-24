'use strict';
/** openvibe-shared/trace: a request's W3C trace rides on the fetch() calls made while serving it, only inside the network. */
const assert = require('assert');
const http = require('http');
const trace = require('../trace');

(async () => {
    const seen = [];
    const srv = await new Promise((r) => { const s = http.createServer((req, res) => { seen.push({ tp: req.headers.traceparent || null, rid: req.headers['x-openvibe-request-id'] || null }); res.end('ok'); }).listen(0, '127.0.0.1', () => r(s)); });
    const url = `http://127.0.0.1:${srv.address().port}/x`;
    const used = [];
    const mw = trace.install({ use: (fn) => used.push(fn) });
    assert.strictEqual(used.length, 1, 'install() mounts the middleware');
    const TRACE = 'a'.repeat(32);

    // Inside a request: loopback calls carry the request's trace id with a fresh span.
    await new Promise((resolve, reject) => mw({ ov: { traceId: TRACE, requestId: 'req_1' }, headers: {} }, {}, () => {
        (async () => {
            assert.deepStrictEqual(trace.current(), { traceId: TRACE, requestId: 'req_1' });
            await (await fetch(url)).text();
            await (await fetch(url, { headers: { traceparent: `00-${'b'.repeat(32)}-${'c'.repeat(16)}-01` } })).text();
            await new Promise((r) => setTimeout(r, 5));
            await (await fetch(url)).text();   // still inside after an await and a timer
        })().then(resolve, reject);
    }));
    assert.match(seen[0].tp, new RegExp(`^00-${TRACE}-[0-9a-f]{16}-01$`));
    assert.strictEqual(seen[0].rid, 'req_1');
    assert.strictEqual(seen[1].tp, `00-${'b'.repeat(32)}-${'c'.repeat(16)}-01`, 'a caller\'s own traceparent is kept');
    assert.match(seen[2].tp, new RegExp(`^00-${TRACE}-`));
    assert.notStrictEqual(seen[0].tp, seen[2].tp, 'each call is its own span');

    // Outside a request nothing is added.
    await (await fetch(url)).text();
    assert.strictEqual(seen[3].tp, null);

    // Without req.ov the incoming traceparent is used, and a malformed one starts a new trace.
    await new Promise((resolve) => mw({ headers: { traceparent: `00-${'d'.repeat(32)}-${'e'.repeat(16)}-01` } }, {}, () => { assert.strictEqual(trace.current().traceId, 'd'.repeat(32)); resolve(); }));
    await new Promise((resolve) => mw({ headers: { traceparent: 'garbage' } }, {}, () => { assert.match(trace.current().traceId, /^[0-9a-f]{32}$/); resolve(); }));

    // Only calls inside the network are traced: a trace id never goes to a provider or a user's URL.
    for (const u of ['http://127.0.0.1:4000/x', 'http://localhost:3000', 'https://openvibe.live/api', 'https://billing.openvibe.network/x', 'https://openre.stream/', 'http://[::1]:9/']) assert.strictEqual(trace.insideNetwork(u), true, u);
    for (const u of ['https://api.stripe.com/v1', 'https://example.org', 'https://openvibe.live.evil.com/', 'https://notopenvibe.live/', 'not a url']) assert.strictEqual(trace.insideNetwork(u), false, u);
    assert.deepStrictEqual(trace.outboundHeaders(null), {});
    trace.install({ use() {} });
    assert.strictEqual(globalThis.fetch[Symbol.for('openvibe.trace.fetch')], true, 'fetch is wrapped once');
    srv.close();
    console.log('trace: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
