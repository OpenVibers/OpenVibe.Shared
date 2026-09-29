'use strict';
// openvibe-shared/indexnow: one POST per publish, batched, host-filtered, never fatal.
const assert = require('assert');
const { createIndexNow, KEY_RE } = require('../indexnow');

// A fake fetch that records what was posted and answers with `status`.
function recorder(status = 200) {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { status }; };
    return { calls, fetch: fetchImpl };
}

(async () => {
    // The key rule: 8-128 hex or alphanumeric, and nothing else.
    assert.ok(KEY_RE.test('a1b2c3d4') && KEY_RE.test('9f8e7d6c5b4a3928') && KEY_RE.test('k'.repeat(128)));
    assert.ok(!KEY_RE.test('short') && !KEY_RE.test('has-a-dash') && !KEY_RE.test('k'.repeat(129)));
    assert.throws(() => createIndexNow({ host: 'openvibe.wiki', key: 'short' }), /8–128/);
    assert.throws(() => createIndexNow({ host: 'openvibe.wiki', key: 'not hex!' }), /8–128/);

    // No key: nothing is ever sent, and the caller is told why.
    const off = recorder();
    const none = createIndexNow({ host: 'openvibe.wiki', key: '', fetch: off.fetch });
    assert.strictEqual(none.enabled, false);
    assert.deepStrictEqual(await none.ping(['https://openvibe.wiki/a']), { sent: 0, status: 0, skipped: 'no key' });
    assert.strictEqual(off.calls.length, 0, 'no request without a key');
    assert.strictEqual(none.pingSoon(['https://openvibe.wiki/a']), 0);

    // The batch: one POST, host/key/keyLocation, deduped, https-only, this host only.
    const r1 = recorder();
    const inw = createIndexNow({ host: 'https://openvibe.wiki/', key: 'a1b2c3d4', fetch: r1.fetch });
    const out = await inw.ping([
        'https://openvibe.wiki/wiki/Mars',
        'https://openvibe.wiki/wiki/Mars',          // duplicate
        'https://openvibe.wiki/a', 'https://openvibe.wiki/a/', // distinct URLs, both kept
        'http://openvibe.wiki/insecure',            // not https
        'https://other.example/x',                  // another host's key
        '/wiki/Mars',                               // relative, no host
        'not a url',
    ]);
    assert.strictEqual(r1.calls.length, 1, 'exactly one request');
    assert.strictEqual(r1.calls[0].url, 'https://api.indexnow.org/indexnow');
    assert.strictEqual(r1.calls[0].init.method, 'POST');
    assert.match(r1.calls[0].init.headers['Content-Type'], /application\/json/);
    assert.deepStrictEqual(r1.calls[0].body, {
        host: 'openvibe.wiki',
        key: 'a1b2c3d4',
        keyLocation: 'https://openvibe.wiki/a1b2c3d4.txt',
        urlList: ['https://openvibe.wiki/wiki/Mars', 'https://openvibe.wiki/a', 'https://openvibe.wiki/a/'],
    });
    assert.deepStrictEqual(out, { sent: 3, status: 200 });
    assert.deepStrictEqual(await inw.ping([]), { sent: 0, status: 0, skipped: 'nothing to send' });
    assert.deepStrictEqual(await inw.ping(['https://elsewhere.example/a']), { sent: 0, status: 0, skipped: 'nothing to send' });

    // keyLocation and endpoint are overridable (self-hosted engines, tests).
    const r2 = recorder(202);
    const custom = createIndexNow({ host: 'openvibe.wiki', key: 'a1b2c3d4', keyLocation: 'https://cdn.example/k.txt', endpoint: 'https://engine.example/api', fetch: r2.fetch });
    assert.deepStrictEqual(await custom.ping(['https://openvibe.wiki/a']), { sent: 1, status: 202 }, '202 is an accepted answer');
    assert.strictEqual(r2.calls[0].url, 'https://engine.example/api');
    assert.strictEqual(r2.calls[0].body.keyLocation, 'https://cdn.example/k.txt');

    // A failed POST is logged once and never thrown; a rejected status reports sent 0.
    const logs = [];
    const r3 = recorder(422);
    const bad = createIndexNow({ host: 'openvibe.wiki', key: 'a1b2c3d4', fetch: r3.fetch, log: (m) => logs.push(m) });
    assert.deepStrictEqual(await bad.ping(['https://openvibe.wiki/a']), { sent: 0, status: 422 });
    assert.deepStrictEqual(await bad.ping(['https://openvibe.wiki/b']), { sent: 0, status: 422 });
    assert.strictEqual(logs.length, 2, 'one line per failed attempt, nothing else');
    assert.match(logs[0], /status 422/);

    const boom = createIndexNow({ host: 'openvibe.wiki', key: 'a1b2c3d4', fetch: async () => { throw new Error('network down'); }, log: (m) => logs.push(m) });
    assert.deepStrictEqual(await boom.ping(['https://openvibe.wiki/a']), { sent: 0, status: 0 }, 'a dead network is not an exception');
    assert.match(logs[2], /network down/);

    // pingSoon debounces: everything published in the window is one batch, sent once.
    const r4 = recorder();
    const soon = createIndexNow({ host: 'openvibe.wiki', key: 'a1b2c3d4', fetch: r4.fetch });
    assert.strictEqual(soon.pingSoon(['https://openvibe.wiki/one']), 1);
    soon.pingSoon(['https://openvibe.wiki/two', 'https://openvibe.wiki/one']);
    assert.strictEqual(r4.calls.length, 0, 'nothing is sent synchronously');
    assert.deepStrictEqual(await soon.flush(), { sent: 2, status: 200 });
    assert.deepStrictEqual(r4.calls[0].body.urlList, ['https://openvibe.wiki/one', 'https://openvibe.wiki/two']);
    assert.strictEqual(r4.calls.length, 1, 'one batch');
    assert.deepStrictEqual(await soon.flush(), { sent: 0, status: 0, skipped: 'empty' }, 'the timer is cleared');
    soon.pingSoon(['https://openvibe.wiki/three']);
    await new Promise((res) => setTimeout(res, 40)); // the debounce timer is unref'd, so it cannot keep us alive

    // The key file: GET /<key>.txt serves the key, anything else falls through.
    const headers = {};
    let body = null;
    const res = { setHeader: (k, v) => { headers[k] = v; }, end: (b) => { body = b; }, statusCode: 200 };
    inw.keyFile({ url: '/a1b2c3d4.txt' }, res);
    assert.strictEqual(body, 'a1b2c3d4');
    assert.match(headers['Content-Type'], /text\/plain/);
    assert.strictEqual(headers['Cache-Control'], 'public, max-age=3600');
    let fell = false;
    inw.keyFile({ url: '/wiki/Mars' }, { setHeader() {}, end() {} }, () => { fell = true; });
    assert.ok(fell, 'a different path is not the key file');
    console.log('indexnow: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
