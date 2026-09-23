'use strict';
/**
 * The analytics-prune command (ADR-021): raw-event retention and the one-time scrub of pre-ADR rows,
 * for one or more analytics databases. A service keeps a thin scripts/analytics-prune.js that passes
 * its better-sqlite3 and its defaults:
 *
 *   const Database = require('better-sqlite3');
 *   const cli = require('openvibe-shared/analytics/prune-cli');
 *   const main = (argv, log) => cli.main(argv, { Database, log, defaultDb: process.env.ANALYTICS_DB || 'data/analytics.db' });
 *   if (require.main === module) cli.run(main);
 *   module.exports = { main };
 *
 * Options given by the service (second argument of main):
 *   Database        better-sqlite3's constructor (required; this package has no native dependency)
 *   log             line logger (default console.log)
 *   defaultDb       the database when no --db is given: a path, or (args, env) => path
 *   targets         (args) => [{ name, file }]: the databases when no --db is given (several apps)
 *   options         extra repeatable value flags, { '--app': 'apps' } -> args.apps = [...]
 *   paramPrefixes   the service's extra parameter words   } as for the tracker, so legacy rows are
 *   pathRules       the service's [RegExp, replacement]   } templated like new ones
 *   backupMode      file mode of a backup (default 0o600: a pre-scrub backup holds the old IPs)
 *   usage           the help text (default: USAGE below)
 *   root            base for relative --db / --backup paths (default process.cwd())
 *   env             environment (default process.env)
 *
 * Exit codes: 0 done (or dry run), 1 a check failed (backup unreadable, rollup totals changed),
 * 2 refused (bad arguments, no backup choice, existing backup target, missing database).
 */

const fs = require('fs');
const path = require('path');
const retention = require('./retention');

const USAGE = `Raw analytics retention and one-time scrub (ADR-021).

  analytics-prune                              dry run: counts only, changes nothing
  analytics-prune --scrub                      dry run including what the scrub would rewrite
  analytics-prune --apply --backup <path>      online backup, then prune
  analytics-prune --apply --scrub --backup <path>
  analytics-prune --apply --no-backup          prune without a backup (explicit)

Options:
  --db <file>      an analytics database (repeatable; default: the service's own)
  --days <n>       keep raw events newer than n days, 1..30 (default 30)
  --scrub          after pruning, rewrite the remaining rows: ip/user_id/city -> NULL, path -> route
                   template, referer -> origin, user_agent -> class, legacy session ids -> NULL; same
                   path/referer reduction in the rollups' top lists (their counts are untouched)
  --backup <path>  one database: a new file; several: a directory, each backup <name>.analytics.db
                   in it (sqlite online backup, owner-only, verified with quick_check and a row count)
  --no-backup      explicitly skip the backup
  --no-vacuum      skip the VACUUM that follows an --apply (VACUUM rewrites the file so pruned and
                   scrubbed values do not survive in free pages; it needs ~2x the database size free
                   and holds the database's write lock while it runs)
  --batch <n>      rows per write batch (default 5000)

--apply refuses to run without --backup or --no-backup. Rollup totals are compared before and after
every database; any difference exits 1. Prune and scrub are safe while the service is up (short
batches; the tracker retries a busy flush).`;

function parseArgs(argv, extra = {}) {
    const a = {
        apply: false, scrub: false, vacuum: true, backup: null, noBackup: false,
        days: retention.MAX_DAYS, batch: retention.DEFAULT_BATCH, dbs: [], db: null,
    };
    for (const key of Object.values(extra)) a[key] = [];
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const val = () => { if (i + 1 >= argv.length) throw new Error(`${k} needs a value`); return argv[++i]; };
        if (k === '--apply') a.apply = true;
        else if (k === '--scrub') a.scrub = true;
        else if (k === '--no-vacuum') a.vacuum = false;
        else if (k === '--no-backup') a.noBackup = true;
        else if (k === '--backup') a.backup = val();
        else if (k === '--days') a.days = Number(val());
        else if (k === '--batch') a.batch = Number(val());
        else if (k === '--db') a.dbs.push(val());
        else if (Object.prototype.hasOwnProperty.call(extra, k)) a[extra[k]].push(val());
        else if (k === '-h' || k === '--help') a.help = true;
        else throw new Error(`unknown option ${k}`);
    }
    a.db = a.dbs[0] || null;
    retention.checkDays(a.days);
    if (!Number.isInteger(a.batch) || a.batch < 1 || a.batch > 100000) throw new Error('--batch must be 1..100000');
    if (a.backup && a.noBackup) throw new Error('--backup and --no-backup are exclusive');
    return a;
}

/** [{ name, file }] for explicit --db paths: apps/<app>/data/analytics.db -> "<app>", else the file's base name. */
function namedTargets(files, root = process.cwd()) {
    const seen = new Map();
    return files.map((f) => {
        const file = path.resolve(root, f);
        let name = path.basename(path.dirname(file)) === 'data'
            ? path.basename(path.dirname(path.dirname(file)))
            : path.basename(file, path.extname(file));
        const n = (seen.get(name) || 0) + 1;
        seen.set(name, n);
        if (n > 1) name = `${name}-${n}`;
        return { name, file };
    });
}

function resolveTargets(args, opts) {
    const root = opts.root || process.cwd();
    if (args.dbs.length) return namedTargets(args.dbs, root);
    if (opts.targets) return opts.targets(args);
    const d = typeof opts.defaultDb === 'function' ? opts.defaultDb(args, opts.env || process.env) : opts.defaultDb;
    if (!d) return [];
    return namedTargets([d], root);
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
function fileBytes(f) { try { return fs.statSync(f).size; } catch { return 0; } }
function freeBytes(dir) { try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch { return null; } }
const sameTotals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function backupTo(Database, db, target, need, mode, expectRows, log) {
    if (fs.existsSync(target)) { log(`error: backup target ${target} already exists; choose a new path`); return 2; }
    const free = freeBytes(path.dirname(target));
    if (free != null && free < need * 1.1) { log(`error: ${mb(free)} free at ${path.dirname(target)}, the backup needs about ${mb(need)}`); return 2; }
    // The backup may hold pre-ADR rows (IPs, user ids): owner-only from the first byte.
    const umask = process.umask(0o077);
    try { await db.backup(target); } finally { process.umask(umask); }
    fs.chmodSync(target, mode);
    const b = new Database(target, { readonly: true });
    try {
        const ok = b.pragma('quick_check', { simple: true });
        const n = b.prepare("SELECT COUNT(*) FROM sqlite_master WHERE name = 'analytics_events'").pluck().get()
            ? b.prepare('SELECT COUNT(*) FROM analytics_events').pluck().get() : 0;
        if (ok !== 'ok' || n < expectRows) { log(`error: backup check failed (quick_check=${ok}, rows=${n})`); return 1; }
    } finally { b.close(); }
    log(`backup     ${target} (${mb(fileBytes(target))}, mode ${(mode & 0o777).toString(8).padStart(4, '0')}, quick_check ok)`);
    return 0;
}

async function runOne(t, args, backupTarget, opts, log) {
    const { Database } = opts;
    const pathOpts = { paramPrefixes: opts.paramPrefixes, pathRules: opts.pathRules };
    if (!fs.existsSync(t.file)) { log(`error: ${t.file} does not exist`); return 2; }
    const db = new Database(t.file, args.apply ? { fileMustExist: true } : { readonly: true, fileMustExist: true });
    try {
        db.pragma('busy_timeout = 5000');
        const walBytes = fileBytes(t.file + '-wal');
        const before = retention.inspect(db, { days: args.days, ...pathOpts });
        log(`\n[${t.name}] ${t.file}`);
        log(`size       ${mb(before.bytes)} (+ ${mb(walBytes)} WAL); a backup needs about ${mb(before.bytes + walBytes)}; VACUUM about ${mb(2 * before.bytes)} more`);
        log(`raw events ${before.events} (oldest ${before.oldest || '-'}, newest ${before.newest || '-'})`);
        log(`prune      ${before.older} rows created before ${before.cutoff} UTC (${args.days} days); ${before.remaining} stay`);
        if (before.toScrub) {
            const s = before.toScrub;
            log(`scrub      of the rows that stay: ${s.personal} with ip/user_id/city, ${s.paths} paths to template, ${s.referers} referers to origin, ${s.user_agents} user agents to class, ${s.sessions} legacy session ids${args.scrub ? '' : '  (needs --scrub)'}`);
        }
        log(`rate rows  ${before.rateRows || 0} (IP counters; the tracker keeps them in memory now)`);
        for (const [k, v] of Object.entries(before.rollups)) log(`rollups    ${k}: ${v.rows} rows, ${v.pageviews} pageviews, ${v.api_calls} api calls (kept)`);
        if (!args.apply) return 0;

        if (backupTarget) {
            const code = await backupTo(Database, db, backupTarget, before.bytes + walBytes, opts.backupMode, before.events, log);
            if (code) return code;
        }

        db.pragma('secure_delete = ON');
        const totalsBefore = retention.rollupTotals(db);
        const pruned = await retention.pruneRawEvents(db, { days: args.days, batchSize: args.batch });
        log(`pruned     ${pruned.deleted} rows in ${pruned.batches} batches`);
        if (args.scrub) {
            const s = await retention.scrubEvents(db, { batchSize: args.batch, ...pathOpts });
            const r = retention.scrubRollups(db, pathOpts);
            log(`scrubbed   ${s.rows} raw rows in ${s.batches} batches; rollup top lists rewritten in ${r.hourly} hourly and ${r.daily} daily rows`);
        }
        const totalsAfter = retention.rollupTotals(db);
        if (!sameTotals(totalsBefore, totalsAfter)) {
            log(`error: rollup totals changed!\n before ${JSON.stringify(totalsBefore)}\n after  ${JSON.stringify(totalsAfter)}`);
            return 1;
        }
        log('rollups    totals unchanged');
        if (args.vacuum && (pruned.deleted || args.scrub)) {
            db.pragma('wal_checkpoint(TRUNCATE)');
            db.exec('VACUUM');
            db.pragma('wal_checkpoint(TRUNCATE)');
            log(`vacuumed   ${mb(fileBytes(t.file))}`);
        }
        const after = retention.inspect(db, { days: args.days, ...pathOpts });
        log(`now        ${after.events} raw events, ${after.older} older than ${args.days} days${after.toScrub ? `, ${after.toScrub.personal} with ip/user_id/city` : ''}`);
        return 0;
    } finally {
        db.close();
    }
}

/** Run the command. Resolves the exit code; never calls process.exit. */
async function main(argv, opts = {}) {
    const log = opts.log || console.log;
    if (typeof opts.Database !== 'function') throw new TypeError('prune-cli: pass { Database } (better-sqlite3)');
    const o = { backupMode: 0o600, ...opts };
    let args;
    try { args = parseArgs(argv, o.options || {}); } catch (e) { log(`error: ${e.message}`); return 2; }
    if (args.help) { log(o.usage || USAGE); return 0; }
    const list = resolveTargets(args, o);
    if (!list.length) { log('no analytics databases found (use --db)'); return 2; }
    if (args.apply && !args.backup && !args.noBackup) {
        log('refusing --apply without a backup: pass --backup <new file or directory> (sqlite online backup) or --no-backup');
        return 2;
    }
    let backupFor = () => null;
    if (args.apply && args.backup) {
        const target = path.resolve(o.root || process.cwd(), args.backup);
        if (list.length === 1) {
            backupFor = () => target;
        } else {
            if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) { log(`error: ${target} is a file; several databases need a directory`); return 2; }
            const clash = list.map((t) => path.join(target, `${t.name}.analytics.db`)).filter((f) => fs.existsSync(f));
            if (clash.length) { log(`error: backup targets already exist: ${clash.join(', ')}`); return 2; }
            fs.mkdirSync(target, { recursive: true, mode: 0o700 });
            backupFor = (t) => path.join(target, `${t.name}.analytics.db`);
        }
    }
    let worst = 0;
    for (const t of list) {
        const code = await runOne(t, args, backupFor(t), o, log);
        worst = Math.max(worst, code);
        if (code) { if (list.length > 1) log(`[${t.name}] stopped (exit ${code}); later databases not touched`); break; }
    }
    if (!args.apply && worst === 0) log('\ndry run: nothing changed. Re-run with --apply --backup <file|dir> (or --no-backup).');
    return worst;
}

/** For a service's script: `if (require.main === module) run(main)` — exits with main's code. */
function run(mainFn, argv = process.argv.slice(2)) {
    return Promise.resolve()
        .then(() => mainFn(argv))
        .then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}

module.exports = { USAGE, main, run, parseArgs, namedTargets, resolveTargets };
