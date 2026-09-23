'use strict';
// release.js (GET /release.json) and release-watch.js (prompt, and reload only when safe).
const assert = require('assert'); const vm = require('vm'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { createRelease } = require('../release');

(async () => {
    // Server side: manifest from env (no git), metaTag, handler headers.
    const r = createRelease({ service: 'community', root: os.tmpdir(), env: { RELEASE_COMMIT: 'ABCDEF1234567890', RELEASE_AT: '2026-09-23T01:00:00Z' }, minClientRelease: 'nope' });
    const m = r.manifest();
    assert.strictEqual(m.release, 'abcdef123456');
    assert.strictEqual(m.released_at, '2026-09-23T01:00:00.000Z');
    assert.strictEqual(m.min_client_release, null, 'a malformed MIN_CLIENT_RELEASE is ignored');
    assert.strictEqual(m.mixed_version_window_hours, 24);
    assert.match(r.metaTag(), /^<meta name="ov-release" content="abcdef123456" data-released-at="2026-09-23T01:00:00.000Z" data-url="\/release.json">$/);
    const headers = {}; let body = '';
    r.handler({}, { setHeader: (k, v) => { headers[k] = v; }, end: (b) => { body = b; } });
    assert.strictEqual(headers['Cache-Control'], 'no-cache, max-age=0');
    assert.deepStrictEqual(JSON.parse(body), JSON.parse(JSON.stringify(m)));
    assert.throws(() => createRelease({ service: 'Bad Name' }));
    const fromGit = createRelease({ service: 'shared', root: path.join(__dirname, '..'), env: {} });
    assert.match(fromGit.release, /^[0-9a-f]{7,12}$/);

    // Browser side, in a vm with a fake DOM and clock.
    function page({ serverRelease, releasedAt, min = null, active = null, protectedFn = null, hidden = false }) {
        const listeners = {}; const docListeners = {};
        let reloads = 0; const toasts = [];
        const ctx = {
            console, Date, JSON, Promise,
            setInterval: () => 1, clearInterval: () => {},
            location: { reload: () => { reloads++; } },
            addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
            OpenVibeUI: { toast: (msg, o) => toasts.push({ msg, o }) },
            fetch: async () => ({ ok: true, json: async () => ({ release: serverRelease, released_at: releasedAt, min_client_release: min, mixed_version_window_hours: 24 }) }),
            document: {
                hidden,
                activeElement: active,
                querySelector: (sel) => (sel.startsWith('meta') ? { content: 'aaaaaaa', getAttribute: () => '/release.json' } : null),
                addEventListener: (t, f) => { docListeners[t] = f; },
            },
        };
        if (protectedFn) ctx.OVProtected = protectedFn;
        ctx.window = ctx; ctx.globalThis = ctx;
        vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'release-watch.js'), 'utf8'), ctx);
        return { ctx, toasts, reloads: () => reloads, docListeners };
    }
    const fresh = new Date(Date.now() - 3600e3).toISOString();
    const stale = new Date(Date.now() - 30 * 3600e3).toISOString();

    let p = page({ serverRelease: 'aaaaaaa', releasedAt: fresh });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.toasts.length, 0, 'same release: nothing');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: fresh, hidden: true });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.toasts.length, 1, 'newer release: one prompt');
    assert.strictEqual(p.toasts[0].o.ttl, 0, 'the prompt stays until dismissed');
    assert.strictEqual(p.reloads(), 0, 'inside the window: never an automatic reload');
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.toasts.length, 1, 'prompted once');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: stale, hidden: true });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.reloads(), 1, 'outside the window and hidden: reloads');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: fresh, min: 'bbbbbbb', hidden: true });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.reloads(), 1, 'server requires the new release: reloads when safe');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: stale, hidden: true, active: { tagName: 'TEXTAREA' } });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.reloads(), 0, 'never while a text field has focus');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: stale, hidden: true, protectedFn: () => true });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.reloads(), 0, 'never during a protected session (upload, call, broadcast)');

    p = page({ serverRelease: 'bbbbbbb', releasedAt: stale, hidden: false });
    await p.ctx.OVRelease.check();
    assert.strictEqual(p.reloads(), 0, 'a visible tab someone just used is not reloaded');

    // Without a meta tag the first /release.json read is the baseline; a later release prompts.
    {
        let served = 'ccccccc';
        const listeners = {}; const toasts = [];
        const ctx = {
            console, Date, JSON, Promise, setInterval: () => 1, clearInterval: () => {},
            location: { reload: () => {} }, addEventListener: (t, f) => { listeners[t] = f; },
            OpenVibeUI: { toast: (msg, o) => toasts.push({ msg, o }) },
            fetch: async () => ({ ok: true, json: async () => ({ release: served, released_at: fresh, min_client_release: null, mixed_version_window_hours: 24 }) }),
            document: { hidden: true, activeElement: null, querySelector: () => null, addEventListener: () => {} },
        };
        ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'release-watch.js'), 'utf8'), ctx);
        await new Promise((r) => setImmediate(r));
        assert.strictEqual(ctx.OVRelease.current, 'ccccccc', 'baseline learned from /release.json');
        await ctx.OVRelease.check();
        assert.strictEqual(toasts.length, 0);
        served = 'ddddddd';
        await ctx.OVRelease.check();
        assert.strictEqual(toasts.length, 1, 'a later release prompts');
    }
    {
        let calls = 0;
        const ctx = {
            console, Date, JSON, Promise, setInterval: () => 1, clearInterval: () => {}, location: { reload: () => {} }, addEventListener: () => {},
            fetch: async () => { calls++; return { ok: false, json: async () => null }; },
            document: { hidden: true, activeElement: null, querySelector: () => null, addEventListener: () => {} },
        };
        ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'release-watch.js'), 'utf8'), ctx);
        await new Promise((r) => setImmediate(r));
        assert.strictEqual(calls, 1, 'a site without /release.json is asked once, then left alone');
    }

    console.log('release: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
