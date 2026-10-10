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
