#!/usr/bin/env node
'use strict';
/**
 * Pin bump (plan T1: "a bot bumps pins on each Contracts release"): after a library release, open one pull request
 * per OpenVibers repository whose package.json files pin that library below the new tag. Each PR moves every pin of
 * the library in the repository to the tag, refreshes the lockfile that goes with it (npm or pnpm), updates the
 * version the repository's STATUS.json and README.md name for the library, and moves the repository's
 * security.yml@<sha> pin of the reusable security workflow to the newest OpenVibe.Shared commit that changed
 * .github/workflows (also opened alone, on a ci-shared-workflows-<sha> branch, when only that pin is stale).
 * Nothing is tested here: each PR's CI runs
 * the full suite and pin drift (scripts/pin-drift.js), and the PR is merged only when it is green.
 *
 *   node scripts/pin-bump.js <library> <tag> [--repos A,B] [--apply] [--workdir DIR]
 *     library   openvibe-contracts | openvibe-shared | openvibe-sdk | openvibe-publishing
 *     tag       the published release, e.g. v0.112.0 (must exist in the library's repository)
 *     --repos   only these repositories (names under OpenVibers/), default every repository of the organisation
 *     --apply   push the branches and open the PRs (default: a dry run that prints what each PR would change)
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
    const out = { library: argv[0], tag: argv[1], repos: null, apply: false, workdir: null };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--apply') out.apply = true;
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
    const summary = [];
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
            const title = stale.length
                ? `${library} ${tag} (was ${from.join(', ')})`
                : `CI: pin the OpenVibe.Shared security workflow at ${sharedSha.slice(0, 12)}`;
            if (!opts.apply) { summary.push(`${repo}: would open "${title}" changing ${[...changed].join(', ')}`); continue; }
            run('git', ['-C', dir, 'checkout', '-q', '-b', target]);
            run('git', ['-C', dir, 'add', '--', ...changed]);
            run('git', ['-C', dir, ...AUTHOR, 'commit', '-q', '-m', `${title}\n\nOpened by scripts/pin-bump.js in OpenVibers/OpenVibe.Shared after the ${tag} release.`]);
            run('git', ['-C', dir, 'push', '-q', 'origin', target]);
            const body = [
                ...(stale.length ? [`Moves every \`${library}\` pin in this repository to ${tag} (from ${from.join(', ')}), refreshes the lockfile and the`, 'version lines in STATUS.json / README.md.'] : []),
                ...(staleSecurity.length ? [`Moves the OpenVibe.Shared security workflow pin to ${sharedSha}, the newest Shared main commit that changed \`.github/workflows\`.`] : []),
                'CI runs the full suite and pin drift; merge when it is green.',
                '', 'Files: ' + [...changed].map((f) => `\`${f}\``).join(', '),
                '', `Opened by \`scripts/pin-bump.js\` (OpenVibers/OpenVibe.Shared) after the ${LIBS[library]} ${tag} release.`,
            ].join('\n');
            const url = run('gh', ['pr', 'create', '-R', `${ORG}/${repo}`, '--head', target, '--title', title, '--body', body]);
            summary.push(`${repo}: ${url}`);
        } catch (err) {
            failed++;
            summary.push(`${repo}: FAILED ${String(err.stderr || err.message).split('\n').filter(Boolean).slice(-1)[0] || err.message}`);
        }
    }
    if (!opts.workdir) fs.rmSync(work, { recursive: true, force: true });
    console.log(`pin-bump ${library} ${tag}${opts.apply ? '' : ' (dry run)'}`);
    for (const line of summary) console.log(`  ${line}`);
    process.exitCode = failed ? 1 : 0;
}

if (require.main === module) {
    try { main(); } catch (err) { console.error(`pin-bump: ${err.message}`); process.exitCode = 1; }
}

module.exports = { stalePins, staleSecurityPins, updateSecurityPins, updateVersionLines, pinUrl, parseArgs };
