'use strict';
/**
 * countBotApiAtIngest: a bot API call is counted into analytics_bot_api_{hourly,daily} at flush and added to the
 * hour's and day's rollups instead of being written as a raw row. Page views by bots keep their raw row (the admin's
 * suspicious-session check reads raw rows); a tracked API call by a person is unchanged. The counters give the same
 * rollup numbers a raw-row rollup gives for the same input, and recomputing a closed day does not count them twice.
 * With the option off nothing changes.
 */
const assert = require('assert');
let createDb;
try { ({ createDb } = require('openvibe-sdk/db')); } catch { console.log('analytics-bot-ingest: skipped (openvibe-sdk not installed)'); process.exit(0); }
const { AnalyticsTrackerPg, analyticsSchema } = require('../analytics/pg');

const DAY = 86400000;
const T0 = Date.parse('2026-11-06T10:05:00Z');
const BOT_UA = 'curl/8.5.0';
const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const req = (path, ua, ip = '203.0.113.10') => ({ path, method: 'GET', ip, headers: { 'user-agent': ua }, user: null });
const res = (status = 200) => ({ statusCode: status });

(async () => {
    const db = createDb({ pglite: true, service: 'analytics-bot-ingest', log: { log() {}, warn() {}, error() {}, info() {} } });
    await db.query(analyticsSchema());
    let now = T0;
    const off = new AnalyticsTrackerPg(db, 'off', { timers: false, now: () => now });
    const on = new AnalyticsTrackerPg(db, 'on', { timers: false, now: () => now, countBotApiAtIngest: true });

    const input = [
        ['/api/v1/streams/abc/clips', BOT_UA, 200],
        ['/api/v1/streams/abc/clips', BOT_UA, 404],
        ['/api/v1/vods/xyz', BOT_UA, 500],
        ['/about', BOT_UA, 200],                                  // a bot page view keeps its raw row
        ['/api/v1/streams/abc', HUMAN_UA, 200],
    ];
    for (const [path, ua, status] of input) {
        assert.strictEqual(off.record(req(path, ua), res(status), path, 15), true);
        assert.strictEqual(on.record(req(path, ua), res(status), path, 15), true);
    }
    await off.flush(); await on.flush();

    const raw = async (service) => db.many('SELECT event_type, is_bot, bot_type FROM analytics_events WHERE service = $1 ORDER BY id', [service]);
    const offRaw = await raw('off');
    const onRaw = await raw('on');
    assert.strictEqual(offRaw.length, 5, 'option off: every request is a raw row');
    assert.deepStrictEqual(onRaw.map((r) => [r.event_type, r.is_bot]), [['pageview', 1], ['api_call', 0]], 'option on: the bot page view and the person\'s API call only');
    assert.strictEqual(Number(await db.value("SELECT COUNT(*) FROM analytics_events WHERE service = 'on' AND is_bot = 1 AND event_type = 'api_call'")), 0, 'no raw bot API row');
    assert.strictEqual(Number(await db.value("SELECT COUNT(*) FROM analytics_events WHERE service = 'off' AND is_bot = 1 AND event_type = 'api_call'")), 3);

    const counters = await db.many(`SELECT endpoint_group, status_class, bot_family, SUM(hits)::bigint AS hits
        FROM analytics_bot_api_hourly WHERE service = 'on' GROUP BY 1, 2, 3 ORDER BY 1, 2`);
    assert.deepStrictEqual(counters.map((r) => [r.endpoint_group, r.status_class, r.bot_family, Number(r.hits)]), [
        ['/api/v1/streams', '2xx', 'known_crawler', 1],
        ['/api/v1/streams', '4xx', 'known_crawler', 1],
        ['/api/v1/vods', '5xx', 'known_crawler', 1],
    ]);
    const dayCounters = await db.many(`SELECT status_class, SUM(hits)::bigint AS hits FROM analytics_bot_api_daily WHERE service = 'on' GROUP BY 1 ORDER BY 1`);
    assert.deepStrictEqual(dayCounters.map((r) => [r.status_class, Number(r.hits)]), [['2xx', 1], ['4xx', 1], ['5xx', 1]]);
    assert.strictEqual(Number(await db.value("SELECT COUNT(*) FROM analytics_bot_api_hourly WHERE service = 'off'")), 0, 'option off writes no counters');

    await off.aggregate(); await on.aggregate();
    const rollup = async (service, table, bucket, at) => db.maybe(`SELECT pageviews, api_calls, bot_hits, error_count, unique_visitors
        FROM ${table} WHERE service = $1 AND ${bucket} = $2`, [service, at]);
    const hourAt = '2026-11-06 10:00:00';
    const [offHour, onHour] = [await rollup('off', 'analytics_hourly', 'hour', hourAt), await rollup('on', 'analytics_hourly', 'hour', hourAt)];
    assert.deepStrictEqual([onHour.pageviews, onHour.api_calls, onHour.bot_hits, onHour.error_count].map(Number), [1, 4, 4, 2], 'hourly: counters give the raw rollup\'s numbers');
    assert.deepStrictEqual([offHour.pageviews, offHour.api_calls, offHour.bot_hits, offHour.error_count].map(Number), [1, 4, 4, 2]);
    assert.strictEqual(Number(onHour.unique_visitors), Number(offHour.unique_visitors), 'the visitor count is unchanged');
    const [offDay, onDay] = [await rollup('off', 'analytics_daily', 'date', '2026-11-06'), await rollup('on', 'analytics_daily', 'date', '2026-11-06')];
    assert.deepStrictEqual([onDay.pageviews, onDay.api_calls, onDay.bot_hits, onDay.error_count].map(Number), [1, 4, 4, 2], 'daily: the same');
    assert.deepStrictEqual([offDay.pageviews, offDay.api_calls, offDay.bot_hits, offDay.error_count].map(Number), [1, 4, 4, 2]);
    assert.strictEqual(Number(onDay.unique_visitors), Number(offDay.unique_visitors), 'the daily visitor count is unchanged');

    // The admin reads: the bot breakdown, status classes and a sub-day summary stay complete from the counters.
    const stats = await on.getStats({ hours: 6 });
    assert.deepStrictEqual(stats.botBreakdown.map((r) => [r.bot_type, Number(r.hits)]), [['known_crawler', 4]], '3 counted API calls + the raw bot page view');
    assert.deepStrictEqual(Object.fromEntries(stats.statusCodes.map((r) => [r.group_code, Number(r.cnt)])), { '2xx': 3, '4xx': 1, '5xx': 1 });
    const offStats = await off.getStats({ hours: 6 });
    for (const k of ['total_pageviews', 'total_api_calls', 'total_bot_hits', 'total_errors']) {
        assert.strictEqual(Number(stats.summary[k]), Number(offStats.summary[k]), `summary ${k} equals the raw-row summary`);
    }
    // getBotAnalysis is scoped to the database (one service per production database), not by service here.
    await db.query("DELETE FROM analytics_events WHERE service = 'off'");
    const bots = await on.getBotAnalysis(7);
    assert.deepStrictEqual(bots.botTypes.map((r) => [r.bot_type, Number(r.hits)]), [['known_crawler', 4]], 'raw page view + counted API calls');

    // Recomputing does not double count (the rollups are read from raw rows plus the ingest counters).
    await on.aggregate();
    const again = await rollup('on', 'analytics_daily', 'date', '2026-11-06');
    assert.deepStrictEqual([again.pageviews, again.api_calls, again.bot_hits, again.error_count].map(Number), [1, 4, 4, 2]);

    // A day with only counted bot API calls still gets an hourly and a daily rollup (there is no raw row to find it by).
    const only = new AnalyticsTrackerPg(db, 'only', { timers: false, now: () => now, countBotApiAtIngest: true });
    only.record(req('/api/v1/streams/abc', BOT_UA), res(200), '/api/v1/streams/abc', 10);
    await only.flush(); await only.aggregate();
    const onlyHour = await rollup('only', 'analytics_hourly', 'hour', hourAt);
    assert.deepStrictEqual([onlyHour.pageviews, onlyHour.api_calls, onlyHour.bot_hits].map(Number), [0, 1, 1]);

    // Day close: the next day's aggregation recomputes yesterday from raw rows plus counters, once.
    now = T0 + DAY;
    await on.aggregate();
    await on.aggregate();
    const closed = await rollup('on', 'analytics_daily', 'date', '2026-11-06');
    assert.deepStrictEqual([closed.pageviews, closed.api_calls, closed.bot_hits, closed.error_count].map(Number), [1, 4, 4, 2], 'no double count at day close');
    const countersAfter = await db.many(`SELECT status_class, SUM(hits)::bigint AS hits FROM analytics_bot_api_daily WHERE service = 'on' GROUP BY 1 ORDER BY 1`);
    assert.deepStrictEqual(countersAfter.map((r) => [r.status_class, Number(r.hits)]), [['2xx', 1], ['4xx', 1], ['5xx', 1]], 'counters are totals, not accumulated again');

    await off.destroy(); await on.destroy(); await only.destroy(); await db.close();
    console.log('analytics-bot-ingest: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
