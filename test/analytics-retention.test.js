'use strict';
/**
 * ADR-021 retention (analytics/retention.js):
 *   - prune deletes strictly-older raw rows in bounded batches and never touches rollups;
 *   - schedulePrune (the tracker's timer, or a service's own job) prunes and reports;
 *   - scrub rewrites legacy rows and rollup top lists without changing any rollup counter, with a
 *     service's path options (Network's by-username rule), and touches no other table.
 *
 *   node test/analytics-retention.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { AnalyticsTracker, retention, event } = require('openvibe-shared/analytics');
const { sqlTime } = require('openvibe-shared/analytics/tracker');

let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log('  ✓', name); }
    catch (e) { failures++; console.log('  ✗', name, '\n     ', e.stack); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-shared-retention-'));
const newDb = (name) => { const db = new Database(path.join(tmp, name)); db.pragma('journal_mode = WAL'); return db; };
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const NETWORK = { paramPrefixes: ['avatar', 'anon', 'projects'], pathRules: [[/\/by-username\/[^/?#]+/gi, '/by-username/:username']] };

function dumpAll(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").pluck().all();
    return tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n');
}

/** Rows as the pre-ADR tracker wrote them, around a 30-day cutoff from nowMs. */
function seedLegacy(db, nowMs) {
    new AnalyticsTracker(db, 'live', { timers: false }).destroy(); // schema
    const ins = db.prepare(`INSERT INTO analytics_events (service, event_type, path, method, status_code, response_time_ms, user_id, session_id, ip, city, user_agent, referer, is_bot, created_at)
        VALUES ('live', 'pageview', ?, 'GET', 200, 5, ?, ?, ?, ?, ?, ?, 0, ?)`);
    const at = (days, s = 0) => sqlTime(nowMs - days * 86400000 + s * 1000);
    const cutoffMs = nowMs - 30 * 86400000;
    const rows = [];
    for (let i = 0; i < 10; i++) rows.push(['/@old' + i, 5, 'eyJhbGciOi.tokentail' + i, '198.51.100.' + i, 'Lyon', CHROME, 'https://t.co/abc?x=1', at(45 + i)]);
    rows.push(['/@edge-older', 5, null, '198.51.100.50', null, CHROME, '', sqlTime(cutoffMs - 1000)]);
    rows.push(['/@edge-exact', 5, null, '198.51.100.51', null, CHROME, '', sqlTime(cutoffMs)]);
    rows.push(['/@edge-newer', null, null, '198.51.100.52', null, FIREFOX, '', sqlTime(cutoffMs + 1000)]);
    rows.push(['/vod/12345?t=9', 9, 'abcdef0123456789', '198.51.100.53', 'Oslo', FIREFOX, 'https://www.reddit.com/r/x/comments/1', at(2)]);
    for (const r of rows) ins.run(...r);
    const hr = db.prepare('INSERT INTO analytics_hourly (service, hour, pageviews, api_calls, unique_visitors, unique_users, top_paths, top_referers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const dy = db.prepare('INSERT INTO analytics_daily (service, date, pageviews, api_calls, unique_visitors, unique_users, new_users, top_paths, top_referers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const tops = JSON.stringify([{ path: '/@alex', cnt: 3 }, { path: '/@bob', cnt: 2 }, { path: '/vods', cnt: 1 }]);
    const refs = JSON.stringify([{ referer: 'https://www.google.com/search?q=alex', cnt: 4 }, { referer: 'https://www.google.com/', cnt: 1 }]);
    hr.run('live', at(60).slice(0, 13) + ':00:00', 10, 4, 3, 1, tops, refs);
    dy.run('live', at(60).slice(0, 10), 100, 40, 30, 10, 2, tops, refs);
    dy.run('live', at(2).slice(0, 10), 50, 20, 15, 5, 1, tops, refs);
    db.prepare("INSERT INTO analytics_rate_tracking (ip, window_start, hit_count) VALUES ('198.51.100.99', 1, 1)").run();
}

(async () => {
    await check('prune: strictly older than the cutoff, bounded batches, rollups untouched', async () => {
        const db = newDb('prune.db');
        const nowMs = Date.parse('2026-09-23T12:00:00Z');
        seedLegacy(db, nowMs);
        const totals = retention.rollupTotals(db);
        const bounded = await retention.pruneRawEvents(db, { days: 30, batchSize: 3, maxBatches: 2, now: () => nowMs });
        assert.strictEqual(bounded.deleted, 6);
        assert.strictEqual(bounded.complete, false);
        const out = await retention.pruneRawEvents(db, { days: 30, batchSize: 3, now: () => nowMs });
        assert.strictEqual(out.deleted, 5);
        assert.strictEqual(out.cutoff, '2026-08-24 12:00:00');
        assert.deepStrictEqual(db.prepare('SELECT path FROM analytics_events ORDER BY created_at').pluck().all(), ['/@edge-exact', '/@edge-newer', '/vod/12345?t=9']);
        assert.deepStrictEqual(retention.rollupTotals(db), totals);
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_daily').pluck().get(), 2, 'old rollups stay');
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_rate_tracking').pluck().get(), 0);
        assert.strictEqual((await retention.pruneRawEvents(db, { days: 30, now: () => nowMs })).deleted, 0);
        assert.throws(() => retention.cutoffFor(31), /1 to 30/);
        assert.throws(() => retention.cutoffFor(0), /1 to 30/);
        db.close();
    });

    await check('schedulePrune: run() prunes and logs, overlapping runs are skipped, days > 30 refused', async () => {
        const db = newDb('job.db');
        const nowMs = Date.parse('2026-09-23T12:00:00Z');
        seedLegacy(db, nowMs);
        const totals = retention.rollupTotals(db);
        const logs = [];
        const job = retention.schedulePrune(db, { initialDelayMs: 1e9, intervalMs: 1e9, label: 'Analytics:test', log: (l) => logs.push(l), now: () => nowMs });
        try {
            const [a, b] = await Promise.all([job.run(), job.run()]);
            assert.strictEqual(a.deleted, 11);
            assert.strictEqual(b, null, 'overlap skipped');
            assert.ok(/^\[Analytics:test\] pruned 11 raw events older than 2026-08-24 12:00:00$/.test(logs[0]), logs.join('\n'));
        } finally { job.stop(); }
        assert.deepStrictEqual(retention.rollupTotals(db), totals);
        assert.throws(() => retention.schedulePrune(db, { days: 90 }), /1 to 30/);
        // The tracker's own timer is the same job.
        const t = new AnalyticsTracker(db, 'live', { retention: { initialDelayMs: 1e9, intervalMs: 1e9, log: () => {} }, now: () => nowMs });
        assert.strictEqual((await t.pruneJob.run()).deleted, 0);
        t.destroy();
        db.close();
    });

    await check('scrub: legacy rows and rollup top lists reduced, counters unchanged, rows now event.v1', async () => {
        const db = newDb('scrub.db');
        const nowMs = Date.parse('2026-09-23T12:00:00Z');
        seedLegacy(db, nowMs);
        await retention.pruneRawEvents(db, { days: 30, now: () => nowMs });
        const totals = retention.rollupTotals(db);
        const s = await retention.scrubEvents(db, { batchSize: 2 });
        assert.strictEqual(s.rows, 3);
        assert.deepStrictEqual(retention.scrubRollups(db), { hourly: 1, daily: 2 });
        assert.deepStrictEqual(retention.rollupTotals(db), totals);
        const rows = db.prepare('SELECT * FROM analytics_events ORDER BY created_at').all();
        assert.deepStrictEqual(rows.map((x) => x.path), ['/@:user', '/@:user', '/vod/:param']);
        assert.deepStrictEqual(rows.map((x) => x.authenticated), [1, 0, 1]);
        assert.deepStrictEqual(rows.map((x) => x.session_id), [null, null, 'abcdef0123456789']);
        assert.deepStrictEqual(rows.map((x) => x.referer), ['', '', 'https://www.reddit.com']);
        assert.deepStrictEqual(rows.map((x) => x.user_agent), ['chrome/windows/desktop', 'firefox/linux/desktop', 'firefox/linux/desktop']);
        for (const x of rows) assert.deepStrictEqual(event.checkRow(x), [], JSON.stringify(x));
        const daily = db.prepare('SELECT top_paths, top_referers FROM analytics_daily ORDER BY date LIMIT 1').get();
        assert.deepStrictEqual(JSON.parse(daily.top_paths), [{ path: '/@:user', cnt: 5 }, { path: '/vods', cnt: 1 }]);
        assert.deepStrictEqual(JSON.parse(daily.top_referers), [{ referer: 'https://www.google.com', cnt: 5 }]);
        const all = dumpAll(db);
        for (const needle of ['198.51.100.', 'Lyon', 'Oslo', 'eyJhbGciOi', 'q=alex', '@alex', '/vod/12345', 'Mozilla/5.0']) assert.ok(!all.includes(needle), needle);
        await retention.scrubEvents(db);
        assert.deepStrictEqual(retention.scrubRollups(db), { hourly: 0, daily: 0 }, 'idempotent');
        assert.deepStrictEqual(retention.rollupTotals(db), totals);
        db.close();
    });

    await check('scrub with Network path options; other tables in the same database untouched', async () => {
        const db = newDb('network-scrub.db');
        db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT); INSERT INTO users VALUES (7, 'keepme');");
        new AnalyticsTracker(db, 'openvibe-network', { timers: false }).destroy();
        const ins = db.prepare(`INSERT INTO analytics_events (service, event_type, path, user_id, ip, user_agent, created_at) VALUES ('openvibe-network', 'pageview', ?, 7, '127.0.0.1', 'node', ?)`);
        const now = sqlTime(Date.now());
        for (const p of ['/avatar/keepme?s=1', '/api/auth/anon/tok0X9zz99', '/internal/users/by-username/keepme']) ins.run(p, now);
        db.prepare("INSERT INTO analytics_daily (service, date, pageviews, top_paths) VALUES ('openvibe-network', '2026-07-01', 5, ?)")
            .run(JSON.stringify([{ path: '/internal/users/by-username/keepme', cnt: 2 }, { path: '/avatar/keepme', cnt: 3 }]));
        const before = retention.inspect(db, NETWORK);
        assert.strictEqual(before.toScrub.paths, 3);
        await retention.scrubEvents(db, NETWORK);
        retention.scrubRollups(db, NETWORK);
        assert.deepStrictEqual(db.prepare('SELECT path FROM analytics_events ORDER BY id').pluck().all(),
            ['/avatar/:param', '/api/auth/anon/:param', '/internal/users/:param/:username']);
        assert.deepStrictEqual(JSON.parse(db.prepare('SELECT top_paths FROM analytics_daily').pluck().get()),
            [{ path: '/avatar/:param', cnt: 3 }, { path: '/internal/users/:param/:username', cnt: 2 }]);
        assert.strictEqual(retention.inspect(db, NETWORK).toScrub.paths, 0);
        assert.strictEqual(db.prepare('SELECT username FROM users WHERE id = 7').pluck().get(), 'keepme');
        const analyticsOnly = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'analytics_%'").pluck().all()
            .map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n');
        for (const needle of ['keepme', 'X9zz99', '127.0.0.1']) assert.ok(!analyticsOnly.includes(needle), needle);
        db.close();
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
    console.log('\nanalytics retention: all passed');
})();
