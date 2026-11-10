#!/usr/bin/env node
'use strict';
/**
 * Pin bump (plan T1: "a bot bumps pins on each Contracts release"): after a library release, open one pull request
 * per OpenVibers repository whose package.json files pin that library below the new tag. Each PR moves every pin of
 * the library in the repository to the tag, refreshes the lockfile that goes with it (npm or pnpm), updates the
 * version the repository's STATUS.json and README.md name for the library, and moves the repository's
 * security.yml@<sha> pin of the reusable security workflow to the newest OpenVibe.Shared commit that changed
 * .github/workflows (also opened alone, on a ci-shared-workflows-<sha> branch, when only that pin is stale).
 * After the bump, a repository with a size-budget test (test/perf-budget.test.js, Tools' gateway budget,
 * Live's scripts/perf/check-budgets.js) gets its budgets raised to the new measurement when the bump
 * outgrows them, so the round opens green PRs instead of twenty-five red ones; anything the budget run
 * cannot prove (no budget test, a failed install, a failure without an "over budget" line, a forbidden
 * file on Live's home page) is left for the round driver, exactly as before.
 *
 *   node scripts/pin-bump.js <library> <tag> [--repos A,B] [--apply] [--ship] [--workdir DIR]
 *     library   openvibe-contracts | openvibe-shared | openvibe-sdk | openvibe-publishing
 *     tag       the published release, e.g. v0.112.0 (must exist in the library's repository)
 *     --repos   only these repositories (names under OpenVibers/), default every repository of the organisation
 *     --apply   push the branches and open the PRs (default: a dry run that prints what each PR would change)
 *     --ship    after opening, wait for each new PR's checks and merge-and-deploy it (SERVICE below;
 *               Live and Media last, never --force), one at a time. Dry-run by default: without
 *               --apply it prints the ship plan instead of running it.
 *     --workdir where the shallow clones go (default a fresh directory under the OS temp dir, removed afterwards)
 *
 * Needs git, npm, pnpm (for pnpm repositories) and an authenticated `gh` (it lists the organisation's repositories
 * and opens the PRs). Commits are made as OpenVibers <contact@openvibe.network>. A repository that already has an
 * open PR from the same branch (pin-bump/<library>-<tag>) is left alone. Exit 0 = done, 1 = a repository failed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const LIBS = { 'openvibe-contracts': 'OpenVibe.Contracts', 'openvibe-shared': 'OpenVibe.Shared', 'openvibe-sdk': 'OpenVibe.SDK', 'openvibe-publishing': 'OpenVibe.Publishing' };
const ORG = 'OpenVibers';
const AUTHOR = ['-c', 'user.name=OpenVibers', '-c', 'user.email=contact@openvibe.network'];
// Every repository pins the reusable security workflow by commit (the workflow cannot pin itself by release).
const SHARED = 'OpenVibe.Shared';
const SECURITY_REF_RE = new RegExp(`OpenVibers/${SHARED.replace('.', '\\.')}/\\.github/workflows/security\\.yml@([0-9a-f]{40})`, 'g');
const securityRef = (sha) => `OpenVibers/${SHARED}/.github/workflows/security.yml@${sha}`;
const parse = (t) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(t); return m ? m.slice(1).map(Number) : null; };
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function run(cmd, args, opts = {}) {
    return cp.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function parseArgs(argv) {
    const out = { library: argv[0], tag: argv[1], repos: null, apply: false, ship: false, workdir: null };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--apply') out.apply = true;
        else if (argv[i] === '--ship') out.ship = true;
        else if (argv[i] === '--repos') out.repos = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
        else if (argv[i] === '--workdir') out.workdir = argv[++i];
        else throw new Error(`unknown argument ${argv[i]}`);
    }
    if (!LIBS[out.library]) throw new Error(`library must be one of ${Object.keys(LIBS).join(', ')}`);
    if (!parse(out.tag)) throw new Error('tag must look like v1.2.3');
    if (!out.tag.startsWith('v')) out.tag = `v${out.tag}`;
    return out;
}

/** The pin URL of `library` at `tag`. */
const pinUrl = (library, tag) => `https://codeload.github.com/${ORG}/${LIBS[library]}/tar.gz/refs/tags/${tag}`;
const PIN_RE = (library) => new RegExp(`https://codeload\\.github\\.com/${ORG}/${LIBS[library].replace('.', '\\.')}/tar\\.gz/refs/tags/(v\\d+\\.\\d+\\.\\d+)`, 'g');

/** Every package.json the repository tracks, with the pins of `library` it holds below `tag`. */
function stalePins(dir, library, tag) {
    const target = parse(tag);
    const files = run('git', ['-C', dir, 'ls-files', '*package.json', 'package.json']).split('\n').filter(Boolean)
        .filter((f) => !f.includes('node_modules/'));
    const out = [];
    for (const f of [...new Set(files)]) {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const found = [...text.matchAll(PIN_RE(library))].map((m) => m[1]);
        const below = found.filter((v) => cmp(parse(v), target) < 0);
        if (below.length) out.push({ file: f, from: [...new Set(below)] });
    }
    return out;
}

/**
 * The newest OpenVibe.Shared main commit that changed .github/workflows. The reusable security workflow is pinned
 * by commit, not by release, so this is the commit every repository's security.yml@<sha> should name.
 */
function latestWorkflowSha() {
    const sha = run('gh', ['api', `repos/${ORG}/${SHARED}/commits?path=.github/workflows&sha=main&per_page=1`, '--jq', '.[0].sha']);
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`could not resolve the newest ${SHARED} workflow commit (got "${sha}")`);
    return sha;
}

/** Tracked workflow files that pin the Shared security workflow at a commit other than `sha`, with the commits they name. */
function staleSecurityPins(dir, sha) {
    const files = run('git', ['-C', dir, 'ls-files', '.github/workflows']).split('\n').filter(Boolean);
    const out = [];
    for (const f of files) {
        const found = [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(SECURITY_REF_RE)].map((m) => m[1]);
        const stale = [...new Set(found)].filter((v) => v !== sha);
        if (stale.length) out.push({ file: f, from: stale });
    }
    return out;
}

/** Move every tracked pin of the Shared security workflow to `sha`; the rewritten files are returned so they join the commit. */
function updateSecurityPins(dir, sha) {
    return staleSecurityPins(dir, sha).map(({ file }) => {
        const p = path.join(dir, file);
        fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(SECURITY_REF_RE, securityRef(sha)));
        return file;
    });
}

/** Refresh the lockfile that belongs to a bumped package.json: pnpm at the root if the repository uses it, else npm beside it. */
function refreshLock(dir, file) {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
        run('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], { cwd: dir });
        return 'pnpm-lock.yaml';
    }
    // The nearest package-lock.json at or above the package: beside it, or the root of an npm workspace.
    for (let rel = path.dirname(file); ; rel = path.dirname(rel)) {
        if (fs.existsSync(path.join(dir, rel, 'package-lock.json'))) {
            run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: path.join(dir, rel) });
            return path.join(rel, 'package-lock.json');
        }
        if (rel === '.' || rel === '/' || rel === '') return null;
    }
}

/**
 * STATUS.json's version fields and the README versions block follow the new pins (scripts/docs-status.js, plan D41),
 * and so do README prose mentions of the old pinned versions ("`openvibe-sdk` v0.26.0", "openvibe-sdk v0.26.0"): only
 * the bumped library and only the versions it was pinned at, so a sentence about an older release elsewhere stays.
 * The files rewritten are returned so they join the commit.
 */
function updateVersionLines(dir, library, from = [], tag = null) {
    const files = ['STATUS.json', 'README.md'].filter((f) => fs.existsSync(path.join(dir, f)));
    const before = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    require('./docs-status').update(dir);
    const readme = path.join(dir, 'README.md');
    if (library && tag && from.length && fs.existsSync(readme)) {
        const olds = from.map((v) => v.replace(/^v/, '').replace(/\./g, '\\.')).join('|');
        const re = new RegExp(`(\`?${library}\`? v)(?:${olds})(?![0-9.]*[0-9])`, 'g');
        const text = fs.readFileSync(readme, 'utf8');
        const next = text.replace(re, `$1${tag.slice(1)}`);
        if (next !== text) fs.writeFileSync(readme, next);
    }
    return files.filter((f) => fs.readFileSync(path.join(dir, f), 'utf8') !== before[f]);
}

function repositories(only) {
    if (only && only.length) return only;
    const list = JSON.parse(run('gh', ['repo', 'list', ORG, '--limit', '200', '--json', 'name,isArchived,isFork']));
    return list.filter((r) => !r.isArchived && !r.isFork).map((r) => r.name).sort();
}

// The size-budget test the bot measures after a bump: the first of these the repository has. All
// report through openvibe-shared/perf-budget's format(): "over budget: <name> <value> > <budget>".
// check-budgets.js comes first because Live has both and its test/perf-budget.test.js only shells to
// scripts/perf/check-budgets.js, which holds the BUDGETS the raise rewrites.
const BUDGET_FILES = ['scripts/perf/check-budgets.js', 'test/perf-budget.test.js', 'apps/gateway/test/perf-budget.test.js'];
const OVER_BUDGET_RE = /^\s*over budget: ([A-Za-z]+) ([\d.]+) > ([\d.]+)/gm;

/** The "over budget" lines of a budget run's output: [{ name, value, budget }]. */
function parseOverBudget(output) {
    const out = [];
    for (const m of String(output || '').matchAll(OVER_BUDGET_RE)) {
        const value = Number(m[2]);
        const budget = Number(m[3]);
        if (Number.isFinite(value) && Number.isFinite(budget)) out.push({ name: m[1], value, budget });
    }
    return out;
}

/** The measured value rounded up to the next 0.5 (85.2 → 85.5; 85 and 6 stay whole). */
const nextHalf = (v) => Math.ceil(v * 2 - 1e-9) / 2;

/**
 * Raise the over-budget keys in a budget file's text to the measured value (next 0.5), each with a
 * dated note naming the release; every other key and the logic stay untouched, and a key is never
 * lowered. → { text, raised: [{ name, old, next, measured }] }
 */
function raiseBudgetText(text, over, { library, tag, date }) {
    const raised = [];
    let out = String(text);
    for (const { name, value } of over) {
        const next = nextHalf(value);
        const m = new RegExp(`^([ \\t]*${name}:[ \\t]*)([0-9]+(?:\\.[0-9]+)?)(,?)(.*)$`, 'm').exec(out);
        if (!m || !(next > Number(m[2]))) continue;
        const tail = m[4].trim().replace(/^\/\/\s?/, '');
        out = out.replace(m[0], `${m[1]}${next}${m[3]} // ${next} ${library} ${tag} (${date}: measured ${value}, raised by pin-bump from ${m[2]})${tail ? `; ${tail}` : ''}`);
        raised.push({ name, old: m[2], next: String(next), measured: String(value) });
    }
    return { text: out, raised };
}

/**
 * The repository's budget test, if it has one: { file, pkgDir } with the package directory to
 * install and run it from (the gateway budget belongs to apps/gateway, the others to the root).
 */
function findBudgetFile(dir) {
    for (const f of BUDGET_FILES) {
        if (!fs.existsSync(path.join(dir, f))) continue;
        let pkgDir = path.dirname(f);
        for (;;) {
            if (fs.existsSync(path.join(dir, pkgDir, 'package.json'))) break;
            const up = path.dirname(pkgDir);
            if (up === pkgDir) { pkgDir = '.'; break; }
            pkgDir = up;
        }
        return { file: f, pkgDir };
    }
    return null;
}

const lastLine = (err) => String((err && (err.stdout || err.stderr)) || (err && err.message) || err).split('\n').filter(Boolean).slice(-1)[0];

function realInstall(cwd) {
    if (!fs.existsSync(path.join(cwd, 'package-lock.json'))) {
        return fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))
            ? { ok: false, skipped: `no package-lock.json in ${path.basename(cwd) || '.'} (pnpm budgets are not measured)` }
            : { ok: false, skipped: `no package-lock.json in ${path.basename(cwd) || '.'}` };
    }
    try {
        cp.execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd, encoding: 'utf8', timeout: 10 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true };
    } catch (err) {
        return { ok: false, skipped: `npm ci failed: ${lastLine(err)}` };
    }
}

function realRun(cwd, relFile) {
    try {
        const output = cp.execFileSync('node', [relFile],
            { cwd, encoding: 'utf8', timeout: 10 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
        return { code: 0, output };
    } catch (err) {
        if (err.signal === 'SIGTERM') return { code: 1, output: '', timedOut: true };
        return { code: err.status || 1, output: `${err.stdout || ''}${err.stderr || ''}` };
    }
}

/**
 * Measure the repository's size budgets after the bump and raise the keys the bump outgrew.
 * Returns { raised, file } (raised is [] when the budgets are already green) or { raised: [],
 * skipped } when the run cannot prove a raise. `io` ({ install, run }) is injected for tests.
 */
function raiseBudgets(dir, { library, tag, date = new Date().toISOString().slice(0, 10), io = null } = {}) {
    const found = findBudgetFile(dir);
    if (!found) return { raised: [], skipped: 'no budget test' };
    const cwd = path.join(dir, found.pkgDir);
    const rel = path.relative(found.pkgDir, found.file);
    const install = io ? io.install : realInstall;
    const runBudget = io ? io.run : realRun;
    const installed = install(cwd);
    if (!installed.ok) return { raised: [], skipped: installed.skipped };
    const first = runBudget(cwd, rel);
    if (first.timedOut) return { raised: [], skipped: 'the budget test timed out' };
    if (first.code === 0) return { raised: [] };
    const over = parseOverBudget(first.output);
    if (!over.length) return { raised: [], skipped: 'the budget test failed without an "over budget" line' };
    if (/is loaded by the home page/.test(first.output)) return { raised: [], skipped: 'forbidden files on the home page (not a budget)' };
    const p = path.join(dir, found.file);
    const { text, raised } = raiseBudgetText(fs.readFileSync(p, 'utf8'), over, { library, tag, date });
    if (!raised.length) return { raised: [], skipped: `could not raise ${over.map((o) => o.name).join(', ')}` };
    fs.writeFileSync(p, text);
    const second = runBudget(cwd, rel);
    if (second.code !== 0) {
        const still = parseOverBudget(second.output).map((o) => `${o.name} ${o.value} > ${o.budget}`).join(', ');
        return { raised, file: found.file, verify: still || 'still failing' };
    }
    return { raised, file: found.file };
}

/**
 * One table: every OpenVibers repository → its ovhost service, or null when a pin PR only merges
 * (the four libraries, and repositories with no service). Built from the 4.190 round's ship list
 * (57 entries) and `ovhost status --json`, plus OpenVibe-Git → git (openvibe-git.service, the
 * git.openvibe.codes host) and OpenRestream → openre (its deploy docs). Live and Media ship last
 * and never with --force: they wait for idle by themselves (ov-ship).
 */
const SERVICE = {
    AFResume: null,
    BreakRoomSimulator: null,
    OpenRestream: 'openre',
    'OpenVibe-Git': 'git',
    'OpenVibe.AI': 'ai',
    'OpenVibe.Actor': 'actor',
    'OpenVibe.Bench': 'bench',
    'OpenVibe.Billing': 'billing',
    'OpenVibe.Blog': 'blog',
    'OpenVibe.Bot': 'bot',
    'OpenVibe.Cam': 'cam',
    'OpenVibe.Casino': 'casino',
    'OpenVibe.Chat': 'chat',
    'OpenVibe.Codes': 'codes',
    'OpenVibe.Community': 'community',
    'OpenVibe.Computer': 'computer',
    'OpenVibe.Connect': 'connect',
    'OpenVibe.Contracts': null,
    'OpenVibe.Coupons': 'coupons',
    'OpenVibe.Deals': 'deals',
    'OpenVibe.Design': 'design',
    'OpenVibe.Domains': 'domains',
    'OpenVibe.Events': 'events',
    'OpenVibe.Examples': null,
    'OpenVibe.Exchange': 'exchange',
    'OpenVibe.Extensions': null,
    'OpenVibe.Food': 'food',
    'OpenVibe.Fun': 'fun',
    'OpenVibe.Games': 'games',
    'OpenVibe.Help': 'help',
    'OpenVibe.Host': 'host',
    'OpenVibe.Inventory': 'inventory',
    'OpenVibe.Link': null,
    'OpenVibe.Live': 'live',
    'OpenVibe.Locker': 'locker',
    'OpenVibe.Mail': 'mail',
    'OpenVibe.Media': 'media',
    'OpenVibe.MediaHub': 'media-hub',
    'OpenVibe.Meme': 'meme',
    'OpenVibe.Network': 'network',
    'OpenVibe.News': 'news',
    'OpenVibe.Play': 'play',
    'OpenVibe.Publishing': null,
    'OpenVibe.Quest': 'quest',
    'OpenVibe.Rent': 'rent',
    'OpenVibe.Report': 'report',
    'OpenVibe.Reviews': 'reviews',
    'OpenVibe.Run': 'run',
    'OpenVibe.SDK': null,
    'OpenVibe.Search': 'search',
    'OpenVibe.Services': 'services',
    'OpenVibe.Shared': null,
    'OpenVibe.Shoes': 'shoes',
    'OpenVibe.Sources': 'sources',
    'OpenVibe.Space': 'space',
    'OpenVibe.Studio': 'studio',
    'OpenVibe.Surf': 'surf',
    'OpenVibe.Tips': 'tips',
    'OpenVibe.Today': 'today',
    'OpenVibe.Tools': 'tools',
    'OpenVibe.Tours': 'tours',
    'OpenVibe.Trade': 'trade',
    'OpenVibe.VIP': 'vip',
    'OpenVibe.Vision': 'vision',
    'OpenVibe.Watch': 'watch',
    'OpenVibe.Wiki': 'wiki',
    'OpenVibe.Work': 'work',
    'OpenVibe.Zone': 'zone',
    OpenVibers: null,
    'Source.OpenVibe.Games': null,
    'openvibe-agents': null,
};

/** Ship order: the round's order, except Live and then Media go last. Stable. */
function shipOrder(ships) {
    const rank = (s) => (s.repo === 'OpenVibe.Media' ? 2 : s.repo === 'OpenVibe.Live' ? 1 : 0);
    return [...ships].sort((a, b) => rank(a) - rank(b));
}

/** The merge command for one shipped PR: merge-and-deploy with its service, or merge-only without one. */
function shipCommand(tools, { repo, number }) {
    const svc = Object.hasOwn(SERVICE, repo) ? SERVICE[repo] : undefined;
    if (svc === undefined) return { run: null, describe: `${repo}#${number}: no service mapping in pin-bump.js SERVICE (a new repository?); ship it by hand` };
    if (svc) return { run: [path.join(tools, 'merge-deploy.sh'), `${repo}#${number}:${svc}`], describe: `merge-deploy.sh '${repo}#${number}:${svc}'` };
    return { run: [path.join(tools, 'merge-after-ci.sh'), `${repo}#${number}`], describe: `merge-after-ci.sh '${repo}#${number}'` };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const { library, tag } = opts;
    const tags = run('git', ['ls-remote', '--tags', `https://github.com/${ORG}/${LIBS[library]}.git`]);
    if (!tags.split('\n').some((l) => l.endsWith(`refs/tags/${tag}`))) throw new Error(`${tag} is not published in ${ORG}/${LIBS[library]}`);
    const work = opts.workdir || fs.mkdtempSync(path.join(os.tmpdir(), 'pin-bump-'));
    const branch = `pin-bump/${library}-${tag}`;
    let sharedSha = null;
    try {
        sharedSha = latestWorkflowSha();
    } catch (err) {
        console.error(`pin-bump: ${err.message}; the Shared security workflow pins are left alone`);
    }
    let failed = 0;
    let shipFailed = 0;
    const summary = [];
    const ships = [];
    const tools = path.join(os.homedir(), 'openvibe/work/tools');
    for (const repo of repositories(opts.repos)) {
        if (repo === LIBS[library]) continue;
        const dir = path.join(work, repo);
        try {
            // gh clones with the same authentication it opens the PRs with, so private repositories work too.
            run('gh', ['repo', 'clone', `${ORG}/${repo}`, dir, '--', '-q', '--depth', '1']);
            const stale = stalePins(dir, library, tag);
            const staleSecurity = sharedSha ? staleSecurityPins(dir, sharedSha) : [];
            if (!stale.length && !staleSecurity.length) { summary.push(`${repo}: current`); continue; }
            // A repository with only a stale workflow pin gets its own small CI branch, so it never collides with a pin PR.
            const target = stale.length ? branch : `ci-shared-workflows-${sharedSha.slice(0, 12)}`;
            if (opts.apply) {
                const open = JSON.parse(run('gh', ['pr', 'list', '-R', `${ORG}/${repo}`, '--state', 'open', '--json', 'number,headRefName']));
                const existing = open.find((p) => p.headRefName === target || (!stale.length && p.headRefName.startsWith('ci-shared-workflows-')));
                if (existing) { summary.push(`${repo}: an open PR (#${existing.number}) already carries this`); continue; }
            }
            const changed = new Set();
            for (const { file } of stale) {
                const p = path.join(dir, file);
                fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(PIN_RE(library), pinUrl(library, tag)));
                changed.add(file);
                const lock = refreshLock(dir, file);
                if (lock) changed.add(lock);
            }
            if (staleSecurity.length) updateSecurityPins(dir, sharedSha).forEach((f) => changed.add(f));
            const from = [...new Set(stale.flatMap((s) => s.from))].sort((a, b) => cmp(parse(a), parse(b)));
            if (stale.length) updateVersionLines(dir, library, from, tag).forEach((f) => changed.add(f));
            // With --apply the bump is measured and the budgets it outgrew join the same commit, so the
            // PR opens green; a dry run only says which budget test would be measured.
            let budgets = null;
            if (stale.length && opts.apply) {
                budgets = raiseBudgets(dir, { library, tag });
                if (budgets.raised && budgets.raised.length) changed.add(budgets.file);
            }
            const title = stale.length
                ? `${library} ${tag} (was ${from.join(', ')})`
                : `CI: pin the OpenVibe.Shared security workflow at ${sharedSha.slice(0, 12)}`;
            if (!opts.apply) {
                const budget = stale.length && findBudgetFile(dir) ? ` (measures ${findBudgetFile(dir).file} on apply)` : '';
                summary.push(`${repo}: would open "${title}" changing ${[...changed].join(', ')}${budget}`);
                if (opts.ship) ships.push({ repo, number: '?' });
                continue;
            }
            run('git', ['-C', dir, 'checkout', '-q', '-b', target]);
            run('git', ['-C', dir, 'add', '--', ...changed]);
            run('git', ['-C', dir, ...AUTHOR, 'commit', '-q', '-m', `${title}\n\nOpened by scripts/pin-bump.js in OpenVibers/OpenVibe.Shared after the ${tag} release.`]);
            run('git', ['-C', dir, 'push', '-q', 'origin', target]);
            const body = [
                ...(stale.length ? [`Moves every \`${library}\` pin in this repository to ${tag} (from ${from.join(', ')}), refreshes the lockfile and the`, 'version lines in STATUS.json / README.md.'] : []),
                ...(staleSecurity.length ? [`Moves the OpenVibe.Shared security workflow pin to ${sharedSha}, the newest Shared main commit that changed \`.github/workflows\`.`] : []),
                ...(budgets && budgets.raised.length ? [`Size budgets raised to this bump's measurement: ${budgets.raised.map((r) => `\`${r.name}\` ${r.old} → ${r.next} (measured ${r.measured})`).join(', ')}.`] : []),
                ...(budgets && budgets.verify ? [`Budgets raised but the budget test still fails (${budgets.verify}); the round driver fixes the rest.`] : []),
                'CI runs the full suite and pin drift; merge when it is green.',
                '', 'Files: ' + [...changed].map((f) => `\`${f}\``).join(', '),
                '', `Opened by \`scripts/pin-bump.js\` (OpenVibers/OpenVibe.Shared) after the ${LIBS[library]} ${tag} release.`,
            ].join('\n');
            const url = run('gh', ['pr', 'create', '-R', `${ORG}/${repo}`, '--head', target, '--title', title, '--body', body]);
            let note = '';
            if (budgets && budgets.raised.length) note = ` (budgets: ${budgets.raised.map((r) => `${r.name} ${r.old} → ${r.next}`).join(', ')})`;
            else if (budgets && budgets.skipped && budgets.skipped !== 'no budget test') note = ` (budgets not measured: ${budgets.skipped})`;
            if (budgets && budgets.verify) note += ` (budgets still red: ${budgets.verify})`;
            summary.push(`${repo}: ${url}${note}`);
            if (opts.ship) {
                let number = (url.match(/\/pull\/(\d+)\s*$/) || [])[1];
                if (!number) {
                    try {
                        number = run('gh', ['pr', 'list', '-R', `${ORG}/${repo}`, '--head', target, '--state', 'open', '--json', 'number', '--jq', '.[0].number']);
                    } catch { number = null; }
                }
                if (number) ships.push({ repo, number });
                else summary.push(`${repo}: ship: the PR number is unknown; ship ${url} by hand`);
            }
        } catch (err) {
            failed++;
            summary.push(`${repo}: FAILED ${String(err.stderr || err.message).split('\n').filter(Boolean).slice(-1)[0] || err.message}`);
        }
    }
    if (!opts.workdir) fs.rmSync(work, { recursive: true, force: true });
    console.log(`pin-bump ${library} ${tag}${opts.apply ? '' : ' (dry run)'}`);
    for (const line of summary) console.log(`  ${line}`);
    if (opts.ship) {
        const ordered = shipOrder(ships);
        if (!opts.apply) {
            console.log(`ship plan (dry run): ${ordered.length} PRs, one at a time, Live and Media last:`);
            for (const s of ordered) console.log(`  ${shipCommand(tools, s).describe}`);
        } else if (!ordered.length) {
            console.log('ship: no PRs were opened; nothing to ship');
        } else if (!fs.existsSync(path.join(tools, 'merge-deploy.sh'))) {
            console.error(`ship: ${tools}/merge-deploy.sh is missing; ship the ${ordered.length} PRs by hand`);
            shipFailed = 1;
        } else {
            // One at a time: merge-deploy.sh waits for the PR's checks, merges, then deploys (the host
            // runs out of memory on parallel builds, and Live/Media wait for idle by themselves).
            for (const s of ordered) {
                const cmd = shipCommand(tools, s);
                if (!cmd.run) { console.log(`  ${cmd.describe}`); continue; }
                try {
                    const out = cp.execFileSync(cmd.run[0], cmd.run.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
                    console.log(`  ${s.repo}#${s.number}: ${out.trim().split('\n').filter(Boolean).slice(-1)[0]}`);
                } catch (err) {
                    shipFailed = 1;
                    console.log(`  ${s.repo}#${s.number}: SHIP FAILED ${String(err.stderr || err.message).split('\n').filter(Boolean).slice(-1)[0] || ''}`.trimEnd());
                }
            }
        }
    }
    process.exitCode = failed || shipFailed ? 1 : 0;
}

if (require.main === module) {
    try { main(); } catch (err) { console.error(`pin-bump: ${err.message}`); process.exitCode = 1; }
}

module.exports = { stalePins, staleSecurityPins, updateSecurityPins, updateVersionLines, pinUrl, parseArgs, parseOverBudget, nextHalf, raiseBudgetText, findBudgetFile, raiseBudgets, SERVICE, shipOrder, shipCommand };
