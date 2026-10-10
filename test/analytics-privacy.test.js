'use strict';
/**
 * ADR-021 analytics bounds (analytics/): what a tracked request may leave behind.
 *   - no IP, user id, city, raw user agent, raw referer or query string anywhere in the database;
 *     the session id is a rotating id, never the user id;
 *   - paths become route templates (the Express route when matched, else the normaliser), with a
 *     service's extra parameter words and path rules (Network's, as options);
 *   - unique visitors come from the day's salted hashes, which are deleted once the day is rolled up;
 *   - `Sec-GPC: 1` / `DNT: 1` requests are not recorded at all: no row, hash, session or counter;
 *   - every row the tracker writes is a valid analytics/event.v1 event; a pre-ADR row is not.
 *
 *   node test/analytics-privacy.test.js
 */
const assert = require('assert');
const analytics = require('openvibe-shared/analytics');
const { sqlTime } = require('../analytics/core');
const EVENT_V1 = require('openvibe-shared/analytics/event.v1.json');

const { privacy, event } = analytics;

let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log('  ✓', name); }
    catch (e) { failures++; console.log('  ✗', name, '\n     ', e.stack); }
}

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
// Network's route shapes, given as options (they were hard-coded in its server/analytics/network.js).
const NETWORK = { paramPrefixes: ['avatar', 'anon', 'projects'], pathRules: [[/\/by-username\/[^/?#]+/gi, '/by-username/:username']] };

(async () => {
    // ── Reducers ─────────────────────────────────────────────
    await check('normalisePath strips queries and replaces ids, slugs and usernames', () => {
        const n = privacy.normalisePath;
        const cases = {
            '/': '/',
            '': '/',
            '/vods': '/vods',
            '/vod/8a7c2f10-1b2c-4d5e-8f90-123456789abc?t=30': '/vod/:param',
            '/api/vods/123/comments?page=2&token=abc': '/api/vods/:id/comments',
            '/@JapaneseOldGuy': '/@:user',
            '/@alex/main-stage?stream=77': '/@:user/:param',
            '/p/k3yF00bar': '/p/:param',
            '/recap/some-words': '/recap/:param',
            '/u/alex/settings': '/u/:param/settings',
            '/api/users/alex': '/api/users/:param',
            '/watch/dQw4w9WgXcQ': '/watch/:param',
            '/files/3f786850e387550fdab836ed7e6dc881de23001b': '/files/:param',
            '/api/things/usr_01J8ZQ4K7M2N3P4Q5R6S7T8V9W': '/api/things/:id',
            '/x/01J8ZQ4K7M2N3P4Q5R6S7T8V9W': '/x/:id',
            '/verify/alex%40example.com': '/verify/:param',
            '/share/alex@example.com/x': '/share/:param/x',
            '/maps/@40.7128,-74.0060,12z': '/maps/@:user',
            '/dashboard/settings': '/dashboard/settings',
            '/wp-login.php': '/wp-login.php',
            '/stream-2024-09-23-highlights': '/:id',
            '/hello world': '/:id',
            'https://openvibe.live/@alex?x=1#y': '/@:user',
            '/one/two/three/four/five/six/seven/eight/nine': '/one/two/three/four/five/six/seven/eight/*',
            // Tools' shapes.
            '/api/info?url=https://youtube.com/watch?v=abc': '/api/info',
            '/api/jobs/01J8ZQ4K7M2N3P4Q5R6S7T8V9W/events': '/api/jobs/:param/events',
            '/recipe/chicken-tikka': '/recipe/:param',
            '/place/@52.37,4.89,14z': '/place/@:user',
        };
        for (const [raw, want] of Object.entries(cases)) assert.strictEqual(n(raw), want, raw);
        for (const t of ['/api/vods/:id/comments', '/@:user/:param', '/api/analytics/channel/:username', '/p/:id']) {
            assert.strictEqual(n(t), t);
            assert.strictEqual(n(n(t)), n(t));
        }
        assert.strictEqual(n('/dishes/tacos', { paramPrefixes: ['dishes'] }), '/dishes/:param');
    });

    await check('an over-long template drops whole segments, stays ≤ 200 chars and idempotent', () => {
        const long = '/' + Array.from({ length: 8 }, (_, i) => 'abcdefghijklmnopqrstuvwxyzabcd' + 'xy'[i % 2]).join('/');
        const t = privacy.normalisePath(long);
        assert.ok(t.length <= privacy.MAX_TEMPLATE_LENGTH, t.length);
        assert.ok(t.endsWith('/*'), t);
        assert.ok(t.split('/').slice(1, -1).every((s) => /^abcdefghijklmnopqrstuvwxyzabcd[xy]$/.test(s)), t);
        assert.strictEqual(privacy.normalisePath(t), t);
        assert.ok(new RegExp(EVENT_V1.properties.route.pattern, 'u').test(t));
    });

    await check('service options: Network paramPrefixes and pathRules become parameters', () => {
        const opts = privacy.pathOptions(NETWORK);
        const t = (p) => privacy.normalisePath(p, opts);
        const cases = {
            '/avatar/alex?s=96': '/avatar/:param',
            '/api/auth/anon/k3yF00barBaz?x=1': '/api/auth/anon/:param',
            '/internal/users/by-username/alex': '/internal/users/:param/:username',
            '/api/v1/projects/my-app/apps': '/api/v1/projects/:param/apps',
            '/oauth/authorize?client_id=live&state=abc': '/oauth/authorize',
            '/reset-password?token=abc': '/reset-password',
            '/api/admin/users/42/role': '/api/admin/users/:param/role',
        };
        for (const [raw, want] of Object.entries(cases)) assert.strictEqual(t(raw), want, raw);
        for (const want of Object.values(cases)) assert.strictEqual(t(want), want, `idempotent: ${want}`);
        // Without the rule the shared normaliser keeps the name; the defaults stay in the merged set.
        assert.strictEqual(privacy.normalisePath('/internal/users/by-username/alex'), '/internal/users/:param/alex');
        assert.ok(opts.paramPrefixes.has('vod') && opts.paramPrefixes.has('avatar'));
        assert.strictEqual(privacy.pathOptions({}), undefined);
        assert.throws(() => privacy.pathOptions({ pathRules: [['by-username', 'x']] }), /RegExp/);
    });

    await check('referer → origin, user agent → class, country → ISO code', () => {
        assert.strictEqual(privacy.refererOrigin('https://www.google.com/search?q=who+is+alex'), 'https://www.google.com');
        assert.strictEqual(privacy.refererOrigin('http://localhost:3000/@alex'), 'http://localhost:3000');
        assert.strictEqual(privacy.refererOrigin('android-app://com.foo/'), null);
        assert.strictEqual(privacy.refererOrigin('not a url'), null);
        assert.strictEqual(privacy.uaClass(CHROME), 'chrome/windows/desktop');
        assert.strictEqual(privacy.uaClass(FIREFOX), 'firefox/linux/desktop');
        assert.strictEqual(privacy.uaClass('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), 'bot:googlebot');
        assert.strictEqual(privacy.uaClass(''), 'none');
        assert.strictEqual(privacy.uaClass('chrome/windows/desktop'), 'chrome/windows/desktop');
        assert.strictEqual(privacy.uaClass('bot:googlebot'), 'bot:googlebot');
        assert.strictEqual(privacy.countryCode('de'), 'DE');
        assert.strictEqual(privacy.countryCode('Berlin'), null);
    });

    await check('optedOut: Sec-GPC: 1 or DNT: 1, nothing else', () => {
        assert.strictEqual(privacy.optedOut({ 'sec-gpc': '1' }), true);
        assert.strictEqual(privacy.optedOut({ dnt: '1' }), true);
        assert.strictEqual(privacy.optedOut({ dnt: ' 1 ' }), true);
        assert.strictEqual(privacy.optedOut({ 'sec-gpc': ['0', '1'] }), true);
        for (const h of [{}, { dnt: '0' }, { 'sec-gpc': '0' }, { dnt: 'yes' }, { 'sec-gpc': '' }, null, undefined]) {
            assert.strictEqual(privacy.optedOut(h), false, JSON.stringify(h));
        }
        assert.strictEqual(analytics.optedOut, privacy.optedOut);
    });

    // ── analytics/event.v1 ───────────────────────────────────
    await check('event.v1: the schema file is what the package exports, and a pre-ADR row fails it', () => {
        assert.strictEqual(event.EVENT_V1, EVENT_V1);
        assert.strictEqual(EVENT_V1.$id, 'https://openvibe.network/contracts/analytics/event.v1.json');
        assert.strictEqual(EVENT_V1.additionalProperties, false);
        for (const banned of ['ip', 'user_id', 'city', 'subject_id', 'user_agent', 'referer', 'url', 'region']) {
            assert.ok(!(banned in EVENT_V1.properties), `${banned} is not an event.v1 field`);
        }
        for (const f of ['event', 'service', 'route', 'session_id', 'country', 'ua_class', 'timestamp']) assert.ok(EVENT_V1.required.includes(f), f);
        const good = {
            event: 'pageview', service: 'live', route: '/@:user/:param', method: 'GET', status: 200, duration_ms: 12,
            session_id: '0123456789abcdef', country: 'NL', ua_class: 'chrome/windows/desktop', device: 'desktop', browser: 'chrome',
            os: 'windows', referer_origin: 'https://www.google.com', is_bot: false, bot_type: null, authenticated: true, timestamp: '2026-09-23T10:15:00Z',
        };
        assert.deepStrictEqual(event.validateEvent(good), []);
        const bad = (patch) => event.validateEvent({ ...good, ...patch });
        assert.deepStrictEqual(bad({ ip: '203.0.113.1' }), ['ip: not allowed']);
        assert.deepStrictEqual(bad({ user_id: 42 }), ['user_id: not allowed']);
        assert.ok(bad({ route: '/vod/12345?t=1' }).length);
        assert.ok(bad({ route: '/@alex smith' }).length);
        assert.ok(bad({ referer_origin: 'https://www.google.com/search?q=x' }).length);
        assert.ok(bad({ ua_class: CHROME }).length);
        assert.ok(bad({ session_id: '42' }).length);
        assert.ok(bad({ country: 'Amsterdam' }).length);
        assert.ok(bad({ timestamp: '2026-09-23 10:15:00' }).length);
        assert.ok(bad({ status: 99 }).length);
        const { session_id, ...noSession } = good; // eslint-disable-line no-unused-vars
        assert.deepStrictEqual(event.validateEvent(noSession), ['session_id: required']);

        const legacy = {
            service: 'live', event_type: 'pageview', path: '/@alex?x=1', method: 'GET', status_code: 200, response_time_ms: 5,
            user_id: 42, session_id: 'user-42', ip: '198.51.100.7', country: null, city: 'Lyon', user_agent: CHROME,
            referer: 'https://t.co/abc?x=1', is_bot: 0, bot_type: null, device_type: 'desktop', browser: 'chrome', os: 'windows',
            authenticated: 0, created_at: sqlTime(Date.parse('2026-09-23T10:15:00Z')),
        };
        const problems = event.checkRow(legacy).map((p) => p.split(':')[0]);
        for (const f of ['ip', 'user_id', 'city', 'route', 'session_id', 'ua_class', 'referer_origin']) assert.ok(problems.includes(f), `${f} flagged: ${problems}`);
        assert.strictEqual(event.toEvent(legacy).timestamp, '2026-09-23T10:15:00Z');
    });

    if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
    console.log('\nanalytics privacy: all passed');
})();
