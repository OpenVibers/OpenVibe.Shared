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
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const analytics = require('openvibe-shared/analytics');
const { sqlTime } = require('openvibe-shared/analytics/tracker');
const EVENT_V1 = require('openvibe-shared/analytics/event.v1.json');

const { AnalyticsTracker, privacy, event } = analytics;

let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log('  ✓', name); }
    catch (e) { failures++; console.log('  ✗', name, '\n     ', e.stack); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-shared-analytics-'));
const newDb = (name) => { const db = new Database(path.join(tmp, name)); db.pragma('journal_mode = WAL'); return db; };
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const SUBJECT = 'usr_01J8ZQ4K7M2N3P4Q5R6S7T8V9W';
// Network's route shapes, given as options (they were hard-coded in its server/analytics/network.js).
const NETWORK = { paramPrefixes: ['avatar', 'anon', 'projects'], pathRules: [[/\/by-username\/[^/?#]+/gi, '/by-username/:username']] };

/** Every value in every table, for "is this anywhere in the file" checks. */
function dumpAll(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").pluck().all();
    return tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n');
}

async function serve(app, fn) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    try { return await fn(`http://127.0.0.1:${server.address().port}`); }
    finally { await new Promise((r) => server.close(r)); }
}
const settle = () => new Promise((r) => setTimeout(r, 50));

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

    // ── A tracked request ────────────────────────────────────
    await check('a tracked request stores no IP, user id, city, raw UA, raw referer or query', async () => {
        const db = newDb('track.db');
        let clock = Date.parse('2026-09-23T10:15:00Z');
        const tracker = new AnalyticsTracker(db, 'live', { timers: false, now: () => clock });
        const app = express();
        app.set('trust proxy', true);
        app.use(tracker.middleware());
        app.use((req, res, next) => { if (req.headers.authorization) req.user = { id: 42, sub: SUBJECT, username: 'alex' }; next(); });
        const router = express.Router();
        router.get('/things/:thingId', (req, res) => res.json({ ok: true }));
        app.use('/api', router);
        app.get('*', (req, res) => res.send('<html></html>'));
        const hdr = (extra) => ({ 'user-agent': CHROME, 'x-forwarded-for': '203.0.113.77', referer: 'https://www.google.com/search?q=secret-query', 'cf-ipcountry': 'NL', 'cf-ipcity': 'Amsterdam', ...extra });
        await serve(app, async (base) => {
            await (await fetch(`${base}/api/things/98765?token=supersecret`, { headers: hdr({ authorization: 'Bearer x' }) })).text();
            await (await fetch(`${base}/@alex/main?stream=12`, { headers: hdr() })).text();
            await (await fetch(`${base}/vod/424242`, { headers: hdr({ 'user-agent': FIREFOX, 'x-forwarded-for': '198.51.100.9' }) })).text();
            await settle();
        });
        tracker.flush();

        const rows = db.prepare('SELECT * FROM analytics_events ORDER BY id').all();
        assert.strictEqual(rows.length, 3);
        for (const r of rows) {
            assert.strictEqual(r.ip, null);
            assert.strictEqual(r.user_id, null);
            assert.strictEqual(r.city, null);
            assert.ok(!/[?#]/.test(r.path), r.path);
            assert.strictEqual(r.referer, 'https://www.google.com');
            assert.ok(/^[0-9a-f]{16}$/.test(r.session_id), r.session_id);
            assert.strictEqual(r.country, 'NL');
            assert.deepStrictEqual(event.checkRow(r), [], JSON.stringify(r));
        }
        assert.deepStrictEqual(rows.map((r) => r.path), ['/api/things/:thingId', '/@:user/:param', '/vod/:param']);
        assert.deepStrictEqual(rows.map((r) => r.user_agent), ['chrome/windows/desktop', 'chrome/windows/desktop', 'firefox/linux/desktop']);
        assert.deepStrictEqual(rows.map((r) => r.authenticated), [1, 0, 0]);
        assert.deepStrictEqual(rows.map((r) => r.event_type), ['api_call', 'pageview', 'pageview']);
        assert.strictEqual(rows[0].session_id, rows[1].session_id, 'same visitor, same session');
        assert.notStrictEqual(rows[0].session_id, rows[2].session_id);

        const everything = dumpAll(db);
        for (const needle of ['203.0.113.77', '198.51.100.9', '127.0.0.1', SUBJECT, 'Amsterdam', 'supersecret', 'secret-query', '98765', '424242', 'Mozilla/5.0', '"alex"']) {
            assert.ok(!everything.includes(needle), `found ${needle} in analytics.db`);
        }
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_rate_tracking').pluck().get(), 0);
        assert.ok(!db.prepare("SELECT name FROM sqlite_master WHERE name IN ('idx_analytics_events_ip', 'idx_analytics_events_user')").get());

        // Rollups: two distinct (ip, ua) visitors, one of them signed in.
        tracker.aggregate();
        const hourly = db.prepare("SELECT * FROM analytics_hourly WHERE hour = '2026-09-23 10:00:00'").get();
        assert.strictEqual(hourly.pageviews, 2);
        assert.strictEqual(hourly.api_calls, 1);
        assert.strictEqual(hourly.unique_visitors, 2);
        assert.strictEqual(hourly.unique_users, 1);
        const daily = db.prepare("SELECT * FROM analytics_daily WHERE date = '2026-09-23'").get();
        assert.strictEqual(daily.unique_visitors, 2);
        assert.strictEqual(daily.unique_users, 1);
        assert.strictEqual(daily.new_users, null);
        assert.ok(JSON.parse(daily.top_paths).every((p) => !/\d{3,}/.test(p.path)));
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_visitor_days').pluck().get(), 2);
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_day_salts').pluck().get(), 1);

        // Next day: the finished day is rolled up for the last time, then its hashes and salt go.
        clock = Date.parse('2026-09-24T00:20:00Z');
        tracker.aggregate();
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_visitor_days').pluck().get(), 0);
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_day_salts').pluck().get(), 0);
        assert.strictEqual(db.prepare("SELECT unique_visitors FROM analytics_daily WHERE date = '2026-09-23'").pluck().get(), 2, 'uniques survive the hashes');
        clock = Date.parse('2026-09-24T01:20:00Z');
        tracker.aggregate();
        assert.strictEqual(db.prepare("SELECT unique_visitors FROM analytics_daily WHERE date = '2026-09-23'").pluck().get(), 2, 'a recompute never lowers uniques');

        // The same visitor gets a new session id (and hash) on a new day.
        assert.strictEqual(tracker.record({ headers: { 'user-agent': CHROME }, ip: '203.0.113.77', method: 'GET' }, { statusCode: 200 }, '/', 3), true);
        tracker.flush();
        const last = db.prepare('SELECT session_id FROM analytics_events ORDER BY id DESC LIMIT 1').pluck().get();
        assert.notStrictEqual(last, rows[0].session_id);

        // Dashboards keep the pre-ADR shapes.
        const st = tracker.getStats({ days: 30 });
        for (const k of ['summary', 'realtime', 'daily', 'hourly', 'topPages', 'authBreakdown', 'visitorTypes', 'authTrend']) assert.ok(k in st, k);
        assert.ok(tracker.getStats({ hours: 6 }).timeBuckets);
        const bots = tracker.getBotAnalysis(30);
        for (const k of ['topBotIPs', 'botTrend', 'botTypes', 'suspiciousIPs']) assert.ok(Array.isArray(bots[k]), k);
        assert.ok(tracker.getOverview(30).services.length >= 1);
        tracker.destroy();
        db.close();
    });

    await check('Sec-GPC: 1 and DNT: 1 requests leave nothing: no row, hash, session or rate counter', async () => {
        const db = newDb('optout.db');
        const clock = Date.parse('2026-09-23T10:15:00Z');
        const tracker = new AnalyticsTracker(db, 'live', { timers: false, now: () => clock });
        const app = express();
        app.set('trust proxy', true);
        app.use(tracker.middleware());
        app.get('*', (req, res) => res.send('ok'));
        const hdr = (extra) => ({ 'user-agent': CHROME, 'x-forwarded-for': '203.0.113.5', 'cf-ipcountry': 'FR', ...extra });
        await serve(app, async (base) => {
            await (await fetch(`${base}/@gpc-user`, { headers: hdr({ 'sec-gpc': '1' }) })).text();
            await (await fetch(`${base}/@dnt-user`, { headers: hdr({ dnt: '1' }) })).text();
            for (let i = 0; i < 70; i++) await (await fetch(`${base}/flood`, { headers: hdr({ 'sec-gpc': '1', 'x-forwarded-for': '203.0.113.6' }) })).text();
            await (await fetch(`${base}/counted`, { headers: hdr({ dnt: '0', 'sec-gpc': '0' }) })).text();
            await settle();
        });
        tracker.flush();
        tracker.aggregate();
        const rows = db.prepare('SELECT * FROM analytics_events').all();
        assert.deepStrictEqual(rows.map((r) => r.path), ['/counted'], 'only the request without an opt-out is recorded');
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_visitor_days').pluck().get(), 1);
        assert.strictEqual(tracker._sessions.size, 1, 'no session for an opted-out visitor');
        assert.ok(!tracker._rates.has('203.0.113.6'), 'no rate counter for an opted-out client');
        const hourly = db.prepare('SELECT pageviews, unique_visitors FROM analytics_hourly').get();
        assert.deepStrictEqual({ ...hourly }, { pageviews: 1, unique_visitors: 1 });
        // Direct calls honour it too.
        assert.strictEqual(tracker.record({ headers: { 'user-agent': CHROME, dnt: '1' }, ip: '192.0.2.9', method: 'GET' }, { statusCode: 200 }, '/x', 1), false);
        assert.strictEqual(tracker.trackEvent('share_clicked', { headers: { 'sec-gpc': '1' }, path: '/@bob' }), false);
        assert.strictEqual(tracker.trackEvent('share_clicked', { headers: { 'user-agent': CHROME }, path: '/@bob' }), true);
        tracker.flush();
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_events').pluck().get(), 2);
        const all = dumpAll(db);
        for (const needle of ['gpc-user', 'dnt-user', 'flood', '203.0.113.', '192.0.2.9']) assert.ok(!all.includes(needle), needle);
        tracker.destroy();
        db.close();
    });

    await check('Network options on the tracker: unmatched paths use its rules', async () => {
        const db = newDb('network.db');
        const tracker = new AnalyticsTracker(db, 'openvibe-network', { timers: false, ...NETWORK });
        const app = express();
        app.use(tracker.middleware());
        app.get('/avatar/:username', (req, res) => res.send('img'));
        app.use('/internal', (req, res) => res.status(403).end()); // refused before routing
        app.use('/api/auth/anon', (req, res) => res.status(404).end());
        await serve(app, async (base) => {
            for (const p of ['/avatar/alexsecretname?s=96', '/internal/users/by-username/carolsecretname', '/api/auth/anon/0123456789abcdefanon']) {
                await (await fetch(base + p, { headers: { 'user-agent': CHROME } })).arrayBuffer();
            }
            await settle();
        });
        tracker.flush();
        assert.deepStrictEqual(db.prepare('SELECT path FROM analytics_events ORDER BY id').pluck().all(),
            ['/avatar/:username', '/internal/users/:param/:username', '/api/auth/anon/:param']);
        const all = dumpAll(db);
        for (const needle of ['alexsecretname', 'carolsecretname', '0123456789abcdefanon']) assert.ok(!all.includes(needle), needle);
        tracker.destroy();
        db.close();
    });

    await check('rate check keeps IPs in memory only and still flags floods; custom events are reduced', () => {
        const db = newDb('rate.db');
        const clock = Date.parse('2026-09-23T12:00:30Z');
        const tracker = new AnalyticsTracker(db, 'live', { timers: false, now: () => clock });
        for (let i = 0; i < 70; i++) tracker.record({ headers: { 'user-agent': CHROME }, ip: '192.0.2.1', method: 'GET' }, { statusCode: 200 }, '/api/x', 1);
        tracker.flush();
        assert.ok(db.prepare("SELECT COUNT(*) FROM analytics_events WHERE bot_type = 'rate_limit'").pluck().get() >= 10);
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_rate_tracking').pluck().get(), 0);
        assert.ok(!dumpAll(db).includes('192.0.2.1'));
        tracker.trackEvent('custom', {
            ip: '192.0.2.2', user_id: 7, city: 'Paris', path: '/@bob?x=1', referer: 'https://a.example/x?y=1', user_agent: CHROME,
            session_id: 'user-7', method: 'post', status_code: 999, response_time_ms: -4, browser: 'MyBrowser 1.0', bot_type: 'Weird Type',
        });
        tracker.flush();
        const e = db.prepare("SELECT * FROM analytics_events WHERE event_type = 'custom'").get();
        assert.strictEqual(e.path, '/@:user');
        assert.strictEqual(e.referer, 'https://a.example');
        assert.strictEqual(e.session_id, null);
        assert.strictEqual(e.user_agent, 'chrome/windows/desktop');
        assert.strictEqual(e.method, 'POST');
        assert.strictEqual(e.status_code, null);
        assert.strictEqual(e.response_time_ms, null);
        assert.strictEqual(e.browser, 'chrome');
        assert.strictEqual(e.bot_type, null);
        assert.deepStrictEqual(event.checkRow(e), []);
        assert.ok(!dumpAll(db).includes('Paris') && !dumpAll(db).includes('192.0.2.2'));
        assert.throws(() => tracker.trackEvent('has spaces'), TypeError);
        assert.throws(() => tracker.trackEvent('x'.repeat(65)), TypeError);
        for (const r of db.prepare('SELECT * FROM analytics_events').all()) assert.deepStrictEqual(event.checkRow(r), []);
        tracker.destroy();
        db.close();
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

    await check('the pre-ADR export names are still there (1.x), backed by the ADR-021 code', () => {
        const root = require('openvibe-shared');
        assert.strictEqual(root.AnalyticsTracker, AnalyticsTracker);
        assert.strictEqual(root.classifyRequest, privacy.classifyRequest);
        assert.strictEqual(root.parseUserAgent, privacy.parseUserAgent);
        assert.strictEqual(root.BOT_USER_AGENTS, privacy.BOT_USER_AGENTS);
        assert.strictEqual(root.ANALYTICS_SCHEMA, analytics.schema.ANALYTICS_SCHEMA);
        assert.strictEqual(root.SUSPICIOUS_PATTERNS.highRequestRate, privacy.HIGH_REQUEST_RATE);
        assert.ok(Object.isFrozen(root.SUSPICIOUS_PATTERNS));
        assert.deepStrictEqual(privacy.classifyRequest({ headers: { 'user-agent': 'curl/8.5.0' } }).botType, 'known_crawler');
        // The old constructor call (db, service) still works; the prune timer is on by default.
        const db = newDb('compat.db');
        const t = new AnalyticsTracker(db, 'live');
        assert.ok(t.pruneJob && typeof t.pruneJob.run === 'function');
        t.destroy();
        assert.strictEqual(t.pruneJob, null);
        const off = new AnalyticsTracker(db, 'live', { retention: false });
        assert.strictEqual(off.pruneJob, null);
        off.destroy();
        db.close();
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
    console.log('\nanalytics privacy: all passed');
})();
