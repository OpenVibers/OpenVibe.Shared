'use strict';
// ready.js: required vs optional checks, status/latency/checked_at on every check, timeouts,
// cached checks keep the time they really ran, failure reasons never leak secrets, and skipped checks
// never make a service green (roadmap WS-Q task 7).
const assert = require('assert');
const { createReadiness, safeReason, skip } = require('../ready');

(async () => {
    assert.throws(() => createReadiness({}), /service/);
    assert.throws(() => createReadiness({ service: 's', checks: [{ name: 'Bad Name', check: () => true }] }), /bad check name/);
    assert.throws(() => createReadiness({ service: 's', checks: [{ name: 'db', check: () => true }, { name: 'db', check: () => true }] }), /duplicate/);

    let dbUp = true; let mediaUp = true; let remoteCalls = 0;
    const ready = createReadiness({
        service: 'community',
        release: 'abc1234',
        checks: [
            { name: 'db', required: true, check: () => { if (!dbUp) throw new Error('SQLITE_CANTOPEN: unable to open database file'); return true; } },
            { name: 'network_jwks', required: true, check: () => ({ ok: true, detail: { kid: 'ov-network-1' } }) },
            { name: 'media', required: false, check: () => (mediaUp ? true : 'Media answered 502') },
            { name: 'remote_tier', required: false, cacheMs: 60000, check: async () => { remoteCalls++; return { ok: false, error: 'GET https://user:pw@b2.example/bucket?X-Amz-Signature=abc failed' }; } },
            { name: 'slow', required: false, timeoutMs: 30, check: () => new Promise((resolve) => setTimeout(resolve, 500)) },
        ],
        details: () => ({ queue: 3, ready: 'ignored: never overrides a computed field' }),
    });

    let body = await ready.run();
    assert.strictEqual(body.ready, true, 'optional failures keep the service ready');
    assert.strictEqual(body.status, 'degraded');
    assert.deepStrictEqual(body.failed, []);
    assert.deepStrictEqual(body.degraded, ['remote_tier', 'slow']);
    assert.strictEqual(body.service, 'community');
    assert.strictEqual(body.release, 'abc1234');
    assert.strictEqual(body.queue, 3);
    for (const [name, c] of Object.entries(body.checks)) {
        assert.ok(['ok', 'fail'].includes(c.status), name);
        assert.strictEqual(typeof c.latency_ms, 'number', `${name} latency`);
        assert.ok(!Number.isNaN(Date.parse(c.checked_at)), `${name} checked_at`);
        assert.strictEqual(typeof c.required, 'boolean');
    }
    assert.deepStrictEqual(body.checks.network_jwks.detail, { kid: 'ov-network-1' });
    assert.strictEqual(body.checks.slow.error, 'timeout');
    const leaked = body.checks.remote_tier.error;
    assert.ok(!/pw@|Signature=abc|\?/.test(leaked), `no credentials or query in reasons: ${leaked}`);
    assert.ok(leaked.includes('https://b2.example/bucket'));

    // Cached optional check: not re-run, and still reports when it actually ran.
    const firstAt = body.checks.remote_tier.checked_at;
    await new Promise((r) => setTimeout(r, 5));
    body = await ready.run();
    assert.strictEqual(remoteCalls, 1);
    assert.strictEqual(body.checks.remote_tier.checked_at, firstAt);

    // All healthy apart from the cached remote tier.
    mediaUp = false;
    body = await ready.run();
    assert.ok(body.degraded.includes('media'));
    assert.strictEqual(body.checks.media.error, 'Media answered 502');

    // A required failure is not ready, with the reason.
    dbUp = false;
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    await ready.handler({}, res);
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    body = JSON.parse(res.body);
    assert.strictEqual(body.ready, false);
    assert.strictEqual(body.status, 'not_ready');
    assert.deepStrictEqual(body.failed, ['db']);
    assert.match(body.checks.db.error, /SQLITE_CANTOPEN/);

    dbUp = true; mediaUp = true;
    const ok = createReadiness({ service: 'x', checks: [{ name: 'db', check: () => 1 }, { name: 'falsey', required: false, check: () => false }] });
    const res2 = { setHeader() {}, end(b) { this.body = b; } };
    await ok.handler({}, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(JSON.parse(res2.body).checks.falsey.error, 'check returned false');

    // No fake green: nothing checked is not green.
    const none = await createReadiness({ service: 'x' }).run();
    assert.strictEqual(none.ready, true);
    assert.strictEqual(none.status, 'degraded', 'no check ran: not green');
    assert.deepStrictEqual(none.skipped, []);

    // Skipped checks: status skipped with the reason, never ok; an optional one leaves a verified service green,
    // a required one is yellow, and a service whose every check was skipped is yellow.
    const withSkips = createReadiness({ service: 'x', checks: [
        { name: 'db', check: () => true },
        { name: 'discord_bot', required: false, check: () => skip('not configured') },
        { name: 'legacy', required: false, check: () => ({ skipped: true }) },
    ] });
    body = await withSkips.run();
    assert.strictEqual(body.status, 'ready', 'optional skips do not turn a verified service yellow');
    assert.deepStrictEqual(body.skipped, ['discord_bot', 'legacy']);
    assert.deepStrictEqual(body.degraded, []);
    assert.deepStrictEqual([body.checks.discord_bot.status, body.checks.discord_bot.reason], ['skipped', 'not configured']);
    assert.strictEqual(body.checks.legacy.reason, 'not checked');
    assert.ok(!('error' in body.checks.discord_bot));
    const reqSkip = createReadiness({ service: 'x', checks: [
        { name: 'db', check: () => true },
        { name: 'storage', check: () => skip('bucket not configured', { bucket: null }) },
    ] });
    body = await reqSkip.run();
    assert.strictEqual(body.ready, true, 'a skip is not a failure');
    assert.strictEqual(body.status, 'degraded', 'a skipped required check is yellow');
    assert.deepStrictEqual(body.degraded, ['storage']);
    assert.deepStrictEqual(body.checks.storage.detail, { bucket: null });
    body = await createReadiness({ service: 'x', checks: [{ name: 'a', required: false, check: () => skip('off') }] }).run();
    assert.strictEqual(body.status, 'degraded', 'every check skipped: not green');
    assert.deepStrictEqual(skip(), { skipped: 'not checked' });

    assert.strictEqual(safeReason(Object.assign(new Error('x'), { name: 'AbortError' })), 'timeout');
    assert.strictEqual(safeReason('bad token=abc123&x=1'), 'bad token=…&x=1');
    console.log('ready: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
