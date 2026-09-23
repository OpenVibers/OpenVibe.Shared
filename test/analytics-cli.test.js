'use strict';
/**
 * The analytics-prune command (analytics/prune-cli.js), as Live, Tools and Network wire it:
 *   - a dry run (with and without --scrub) changes nothing;
 *   - --apply needs --backup <new file|dir> or --no-backup, refuses an existing target and days > 30;
 *   - the backup is verified and owner-only (it can hold pre-ADR IPs), then prune + scrub run and the
 *     rollup totals are unchanged;
 *   - several databases (Tools' apps) back up into a directory; a service's defaults, extra options and
 *     path options (Network) are honoured.
 *
 *   node test/analytics-cli.test.js
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { AnalyticsTracker, retention } = require('openvibe-shared/analytics');
const { sqlTime } = require('openvibe-shared/analytics/tracker');
const cli = require('openvibe-shared/analytics/prune-cli');

let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log('  ✓', name); }
    catch (e) { failures++; console.log('  ✗', name, '\n     ', e.stack); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-shared-cli-'));
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const NETWORK = { paramPrefixes: ['avatar', 'anon', 'projects'], pathRules: [[/\/by-username\/[^/?#]+/gi, '/by-username/:username']] };
const out = [];
const log = (l) => out.push(l);
const main = (argv, extra = {}) => cli.main(argv, { Database, log, ...extra });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function dumpAll(file) {
    const db = new Database(file, { readonly: true });
    try {
        return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").pluck().all()
            .map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n');
    } finally { db.close(); }
}

/** A legacy database: 10 rows past the cutoff, 3 inside it (edge rows 2 min clear of the CLI's own clock). */
function legacyDb(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT); INSERT INTO users VALUES (7, 'keepme');");
    new AnalyticsTracker(db, 'live', { timers: false }).destroy();
    const nowMs = Date.now() + 120000;
    const ins = db.prepare(`INSERT INTO analytics_events (service, event_type, path, method, status_code, user_id, session_id, ip, city, user_agent, referer, created_at)
        VALUES ('live', 'pageview', ?, 'GET', 200, ?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 0; i < 10; i++) ins.run(`/@old${i}?x=${i}`, 7, 'tokentail' + i, '198.51.100.' + i, 'Lyon', CHROME, 'https://t.co/x?y=1', sqlTime(nowMs - (40 + i) * 86400000));
    ins.run('/internal/users/by-username/keepme', null, null, '127.0.0.1', null, 'node', '', sqlTime(nowMs - 3 * 86400000));
    ins.run('/avatar/keepme?s=96', 9, 'abcdef0123456789', '198.51.100.52', 'Oslo', CHROME, 'https://www.reddit.com/r/a', sqlTime(nowMs - 2 * 86400000));
    ins.run('/vod/12345?t=9', null, null, '198.51.100.53', null, CHROME, '', sqlTime(nowMs - 1 * 86400000));
    db.prepare('INSERT INTO analytics_daily (service, date, pageviews, api_calls, unique_visitors, unique_users, new_users, top_paths, top_referers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('live', '2026-07-01', 100, 40, 30, 10, 2, JSON.stringify([{ path: '/@keepme', cnt: 3 }, { path: '/internal/users/by-username/keepme', cnt: 2 }]), JSON.stringify([{ referer: 'https://www.google.com/search?q=keepme', cnt: 4 }]));
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    return file;
}

(async () => {
    await check('argument parsing: defaults, repeatable --db, extra options, refusals', () => {
        const a = cli.parseArgs(['--db', 'a.db', '--db', 'b.db', '--app', 'yt', '--scrub'], { '--app': 'apps' });
        assert.deepStrictEqual([a.dbs, a.db, a.apps, a.scrub, a.apply, a.days, a.batch], [['a.db', 'b.db'], 'a.db', ['yt'], true, false, 30, 5000]);
        assert.throws(() => cli.parseArgs(['--days', '31']), /1 to 30/);
        assert.throws(() => cli.parseArgs(['--batch', '0']), /batch/);
        assert.throws(() => cli.parseArgs(['--backup', 'x', '--no-backup']), /exclusive/);
        assert.throws(() => cli.parseArgs(['--app', 'yt']), /unknown option --app/);
        assert.throws(() => cli.parseArgs(['--db']), /needs a value/);
        assert.deepStrictEqual(cli.namedTargets(['/srv/tools/apps/yt/data/analytics.db', '/x/analytics.db', '/y/analytics.db']).map((t) => t.name), ['yt', 'analytics', 'analytics-2']);
    });

    await check('dry run (with and without --scrub) changes nothing; the default database is the service\'s', async () => {
        const file = legacyDb(path.join(tmp, 'dry', 'analytics.db'));
        const before = { hash: sha(file), dump: dumpAll(file) };
        assert.strictEqual(await main([], { defaultDb: file }), 0);
        assert.strictEqual(await main(['--scrub', '--days', '7'], { defaultDb: (args, env) => env.TEST_ANALYTICS_DB, env: { TEST_ANALYTICS_DB: file } }), 0);
        assert.strictEqual(sha(file), before.hash);
        assert.strictEqual(dumpAll(file), before.dump);
        assert.ok(out.some((l) => /dry run: nothing changed/.test(l)));
        assert.ok(out.some((l) => /prune\s+10 rows/.test(l)), out.join('\n'));
        assert.strictEqual(await main([]), 2, 'no database at all');
        assert.strictEqual(await main(['--db', path.join(tmp, 'missing.db')]), 2);
        assert.strictEqual(await main(['--help'], { usage: 'custom usage' }), 0);
        assert.strictEqual(out[out.length - 1], 'custom usage');
        await assert.rejects(cli.main([], {}), /Database/);
    });

    await check('--apply refuses without a backup choice, an existing target, or days > 30', async () => {
        const file = legacyDb(path.join(tmp, 'refuse.db'));
        const before = dumpAll(file);
        assert.strictEqual(await main(['--db', file, '--apply']), 2);
        const existing = path.join(tmp, 'exists.bak');
        fs.writeFileSync(existing, 'x');
        assert.strictEqual(await main(['--db', file, '--apply', '--backup', existing]), 2);
        assert.strictEqual(await main(['--db', file, '--apply', '--no-backup', '--days', '31']), 2);
        assert.strictEqual(await main(['--db', file, '--apply', '--no-backup', '--backup', existing]), 2);
        assert.strictEqual(dumpAll(file), before);
        assert.strictEqual(fs.readFileSync(existing, 'utf8'), 'x');
    });

    await check('--apply --scrub --backup: owner-only verified backup, prune + scrub, rollups equal, other tables kept', async () => {
        const file = legacyDb(path.join(tmp, 'apply.db'));
        const src = new Database(file, { readonly: true });
        const totals = retention.rollupTotals(src);
        src.close();
        const bak = path.join(tmp, 'apply.backup.db');
        assert.strictEqual(await main(['--db', file, '--apply', '--scrub', '--backup', bak, '--batch', '2'], NETWORK), 0, out.join('\n'));
        assert.strictEqual(fs.statSync(bak).mode & 0o777, 0o600);
        const b = new Database(bak, { readonly: true });
        assert.strictEqual(b.prepare('SELECT COUNT(*) FROM analytics_events').pluck().get(), 13, 'backup has every row');
        b.close();
        const db = new Database(file, { readonly: true });
        assert.deepStrictEqual(db.prepare('SELECT path FROM analytics_events ORDER BY created_at').pluck().all(),
            ['/internal/users/:param/:username', '/avatar/:param', '/vod/:param']);
        assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_events WHERE ip IS NOT NULL OR user_id IS NOT NULL OR city IS NOT NULL').pluck().get(), 0);
        assert.deepStrictEqual(JSON.parse(db.prepare('SELECT top_paths FROM analytics_daily').pluck().get()),
            [{ path: '/@:user', cnt: 3 }, { path: '/internal/users/:param/:username', cnt: 2 }]);
        assert.deepStrictEqual(retention.rollupTotals(db), totals);
        assert.strictEqual(db.prepare('SELECT username FROM users WHERE id = 7').pluck().get(), 'keepme');
        db.close();
        assert.ok(out.some((l) => /mode 0600, quick_check ok/.test(l)));
        // Prune-only with an explicit --no-backup works too (nothing left to prune).
        assert.strictEqual(await main(['--db', file, '--apply', '--no-backup', '--no-vacuum']), 0);
    });

    await check('several databases (Tools apps): discovery hook, extra option, backups into a directory', async () => {
        const apps = path.join(tmp, 'apps');
        const yt = legacyDb(path.join(apps, 'yt', 'data', 'analytics.db'));
        const food = legacyDb(path.join(apps, 'food', 'data', 'analytics.db'));
        const tools = {
            options: { '--app': 'apps' },
            targets: (args) => (args.apps.length ? args.apps : ['food', 'yt']).map((name) => ({ name, file: path.join(apps, name, 'data', 'analytics.db') })),
        };
        const hashes = [sha(yt), sha(food)];
        assert.strictEqual(await main(['--scrub'], tools), 0);
        assert.strictEqual(await main(['--app', 'yt'], tools), 0);
        assert.deepStrictEqual([sha(yt), sha(food)], hashes, 'dry run changed a file');
        const bdir = path.join(tmp, 'backups');
        assert.strictEqual(await main(['--apply', '--scrub', '--backup', bdir], tools), 0, out.join('\n'));
        for (const [name, file] of [['yt', yt], ['food', food]]) {
            const bfile = path.join(bdir, `${name}.analytics.db`);
            assert.strictEqual(fs.statSync(bfile).mode & 0o777, 0o600);
            const b = new Database(bfile, { readonly: true });
            assert.strictEqual(b.prepare('SELECT COUNT(*) FROM analytics_events').pluck().get(), 13);
            b.close();
            const db = new Database(file, { readonly: true });
            assert.strictEqual(db.prepare('SELECT COUNT(*) FROM analytics_events').pluck().get(), 3);
            assert.strictEqual(db.prepare('SELECT SUM(pageviews) FROM analytics_daily').pluck().get(), 100);
            db.close();
        }
        assert.strictEqual(await main(['--apply', '--backup', bdir], tools), 2, 'existing backup targets are refused');
        const afile = path.join(tmp, 'a-file');
        fs.writeFileSync(afile, 'x');
        assert.strictEqual(await main(['--apply', '--backup', afile], tools), 2, 'several databases need a directory');
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
    console.log('\nanalytics prune CLI: all passed');
})();
