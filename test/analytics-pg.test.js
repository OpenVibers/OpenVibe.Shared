'use strict';
/**
 * openvibe-shared/analytics/pg on PGlite: request rows reach the database only at flush; the day's salt is shared
 * across trackers (two processes count one visitor once); rollups and dashboards keep their response shapes;
 * opted-out requests record nothing; retention prunes old rows. No IP ever reaches the database.
 */
const assert = require('assert');
let createDb;
try { ({ createDb } = require('openvibe-sdk/db')); } catch { console.log('analytics-pg: skipped (openvibe-sdk not installed)'); process.exit(0); }
const { AnalyticsTrackerPg, analyticsSchema, pruneRawEventsPg } = require('../analytics/pg');

const T0 = Date.parse('2026-09-28T12:10:00Z');
const req = (path, ip, extra = {}) => ({ path, method: 'GET', ip, headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0 Safari/537.36', ...(extra.headers || {}) }, user: extra.user || null });
const res = (status = 200) => ({ statusCode: status });

(async () => {
    const db = createDb({ pglite: true, service: 'analytics-test', log: { log() {}, warn() {}, error() {}, info() {} } });
    await db.query(analyticsSchema());
    let now = T0;
    const a = new AnalyticsTrackerPg(db, 'network', { timers: false, now: () => now });
    const b = new AnalyticsTrackerPg(db, 'network', { timers: false, now: () => now });

    assert.strictEqual(a.record(req('/about', '203.0.113.7'), res(), '/about', 12), true);
    assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM analytics_events')), 0, 'nothing written before the flush');
    b.record(req('/about', '203.0.113.7'), res(), '/about', 20);                      // the same visitor, another process
    a.record(req('/api/v1/x', '198.51.100.2', { user: { id: 1 } }), res(500), '/api/v1/x', 40);
    assert.strictEqual(a.record(req('/about', '192.0.2.9', { headers: { dnt: '1' } }), res(), '/about', 5), false, 'DNT records nothing');
    await a.flush(); await b.flush();
    assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM analytics_events')), 3);
    assert.strictEqual(Number(await db.value("SELECT COUNT(*) FROM analytics_events WHERE ip IS NOT NULL OR user_id IS NOT NULL OR city IS NOT NULL")), 0, 'no personal columns');
    assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM analytics_visitor_days')), 2, 'one visitor across both processes, plus the signed-in one');
    assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM analytics_day_salts')), 1, 'one shared salt for the day');

    await a.aggregate();
    const h = await db.maybe("SELECT pageviews, api_calls, unique_visitors, unique_users, error_count FROM analytics_hourly WHERE service = 'network'");
    assert.deepStrictEqual([h.pageviews, h.api_calls, h.unique_visitors, h.unique_users, h.error_count].map(Number), [2, 1, 2, 1, 1]);

    const stats = await a.getStats({ hours: 6 });
    assert.strictEqual(Number(stats.summary.total_pageviews), 2);
    assert.ok(stats.timeBuckets.length >= 1 && /^2026-09-28 12:\d+$/.test(stats.timeBuckets[0].bucket), JSON.stringify(stats.timeBuckets[0]));
    assert.strictEqual(stats.responsePercentiles.max, 40);
    assert.ok(Array.isArray(stats.peakHours) && stats.peakHours[0].hour_of_day === 12);
    // The reads that share a scan (4.10.0) give each list its own numbers: a session that signs in counts once in the
    // session total and once on each side of the signed-in split; no session id counts no visitor; bots stay out.
    const ev = (path, type, session, auth, status, ms, extra = {}) => db.query(`INSERT INTO analytics_events (service, event_type, path, method,
            status_code, response_time_ms, session_id, authenticated, is_bot, bot_type, device_type, created_at) VALUES ('probe', $1, $2, 'GET', $3, $4, $5, $6, $7, $8, $9, '2026-09-28 11:30:00')`,
    [type, path, status, ms, session, auth, extra.bot ? 1 : 0, extra.botType || null, extra.device || 'desktop']);
    await ev('/a', 'pageview', 's1', 0, 200, 10);
    await ev('/a', 'pageview', 's1', 1, 200, 20);
    await ev('/a', 'pageview', 's2', 0, 404, 30);
    await ev('/api/x', 'api_call', 's2', 0, 500, 40, { device: 'mobile' });
    await ev('/api/x', 'api_call', 's3', 1, 200, 50);
    await ev('/api/x', 'api_call', null, 0, 200, null);
    await ev('/a', 'pageview', 'b1', 0, 200, 5, { bot: true, botType: 'googlebot' });
    await ev('/robots.txt', 'pageview', 'b2', 0, 301, 5, { bot: true });
    const p = await a.getStats({ days: 7, service: 'probe' });
    const byKey = (rows, k) => Object.fromEntries(rows.map((r) => [r[k], r]));
    assert.deepStrictEqual(p.topPages.map((r) => [r.path, r.hits, r.visitors]).sort(), [['/a', 3, 2], ['/api/x', 3, 2]]);
    assert.deepStrictEqual(Object.fromEntries(p.statusCodes.map((r) => [r.group_code, r.cnt])), { '2xx': 5, '3xx': 1, '4xx': 1, '5xx': 1 });
    assert.deepStrictEqual(p.botBreakdown.map((r) => [r.bot_type, r.hits]).sort(), [[null, 1], ['googlebot', 1]]);
    assert.deepStrictEqual(p.deviceBreakdown, [{ device_type: 'desktop', cnt: 5 }, { device_type: 'mobile', cnt: 1 }]);
    assert.deepStrictEqual(p.authBreakdown, { authenticated: 2, anonymous: 4, unique_authenticated_users: 2, total_sessions: 3 });
    assert.strictEqual(p.sessionCount, 3);
    assert.deepStrictEqual(p.bandwidth, { total_requests: 6, page_requests: 3, api_requests: 3, estimated_bytes: 156000 });
    assert.deepStrictEqual(p.topApiEndpoints, [{ path: '/api/x', method: 'GET', hits: 3, avg_ms: 45, errors: 1 }]);
    assert.deepStrictEqual(p.slowestEndpoints, [{ path: '/a', method: 'GET', hits: 3, avg_ms: 20, max_ms: 30 }], 'two timed calls are too few to rank');
    assert.deepStrictEqual(p.peakHours, [{ hour_of_day: 11, hits: 6, visitors: 3, avg_ms: 30 }]);
    assert.deepStrictEqual(byKey(p.authTrend, 'bucket')['2026-09-28'], { bucket: '2026-09-28', auth_visitors: 2, anon_visitors: 2, auth_hits: 2, anon_hits: 4 });
    await db.query("DELETE FROM analytics_events WHERE service = 'probe'");
    const overview = await a.getOverview(7);
    assert.ok(Array.isArray(overview.services));
    const bots = await a.getBotAnalysis(7);
    assert.ok(Array.isArray(bots.botTypes));

    // Next day: yesterday's hashes and salt go at aggregation; retention prunes raw rows past the window.
    now = T0 + 86400000;
    await a.aggregate();
    assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM analytics_visitor_days')), 0);
    now = T0 + 31 * 86400000;
    const r = await pruneRawEventsPg(db, { days: 30, now: () => now });
    assert.strictEqual(r.removed, 3);
    await a.destroy(); await b.destroy(); await db.close();
    console.log('analytics-pg: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
