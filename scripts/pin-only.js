#!/usr/bin/env node
'use strict';
/**
 * Pin-only detection: is a pull request's diff nothing but a library pin bump (and the version
 * lines and size budgets that follow it)? The reusable test workflow runs a short path (install,
 * the page/frame/size/browser subset, pin drift) when this says yes, and the full suite otherwise.
 *
 * Only these may change, and only in these ways:
 *   package.json (any depth)  every changed line is an openvibe-* dependency line naming a
 *                               codeload tag tarball (the pin this round moves)
 *   lockfiles                   every hunk touches an openvibe-* entry, and every changed line is an
 *                               openvibe-* line, a codeload URL, or a resolved/resolution/integrity/
 *                               version line (npm's version/resolved/integrity triple sits below the
 *                               entry's key line, so the key line is context, not part of the hunk)
 *   STATUS.json (root)          any change: metadata, never code
 *   README.md (root)            only version lines (an openvibe-* name and a version number) and the
 *                               versions-block markers
 *   perf-budget.test.js /       only budget numbers and their comments (a budget key with a colon, or
 *   check-budgets.js (any depth)  a comment line)
 * Anything else — code, tests, workflows (including a security.yml SHA move), CHANGELOG.md, a new,
 * deleted or renamed file, a mode-only change — is not pin-only. When in doubt this says no: no
 * means the full suite, which is always safe.
 *
 *   node scripts/pin-only.js --base <sha> [--head <rev>] [--dir <path>] [--context <n>]
 *   curl -fsSL https://raw.githubusercontent.com/OpenVibers/OpenVibe.Shared/main/scripts/pin-only.js | node - --base <sha>
 *
 * Prints `true` or `false` on stdout (the caller writes it to $GITHUB_OUTPUT) and the reason on
 * stderr. Exit 0 always: a detection failure must run the full suite, not fail the job.
 */
const cp = require('child_process');

const LIB_RE = /openvibe-(contracts|shared|sdk|publishing)/;
const PIN_URL_RE = /codeload\.github\.com\/OpenVibers\/OpenVibe\.(Contracts|Shared|SDK|Publishing)\/tar\.gz\/refs\/tags\/v\d+\.\d+\.\d+/;
const PKG_KEY_RE = /"openvibe-(contracts|shared|sdk|publishing)"\s*:\s*"/;
const LOCK_VALUE_RE = /^\s*"?(resolved|resolution|integrity|version)"?\s*:/;
const CODELOAD_RE = /codeload\.github\.com\/OpenVibers\/OpenVibe\./;
const VERSION_RE = /\d+\.\d+\.\d+/;
const BUDGET_KEY_RE = /(^|[^A-Za-z])(htmlRawKB|htmlBrotliKB|jsFiles|jsRawKB|jsBrotliKB|cssFiles|cssRawKB|cssBrotliKB|externalFiles|lcpMs|inpMs|cls)\s*:/;

function classify(file) {
    if (/(^|\/)package\.json$/.test(file)) return 'package';
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|npm-shrinkwrap\.json|yarn\.lock)$/.test(file)) return 'lock';
    if (file === 'STATUS.json') return 'status';
    if (file === 'README.md') return 'readme';
    if (/(^|\/)(perf-budget\.test\.js|check-budgets\.js)$/.test(file)) return 'budget';
    return 'other';
}

const pkgLine = (l) => LIB_RE.test(l) && PIN_URL_RE.test(l) && PKG_KEY_RE.test(l);
const lockLine = (l) => LIB_RE.test(l) || CODELOAD_RE.test(l) || LOCK_VALUE_RE.test(l);
const readmeLine = (l) => {
    const s = l.trim();
    if (s === '<!-- versions:start -->' || s === '<!-- versions:end -->') return true;
    return LIB_RE.test(s) && VERSION_RE.test(s);
};
const budgetLine = (l) => {
    const s = l.trim();
    if (s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')) return true;
    return BUDGET_KEY_RE.test(s);
};

/**
 * Parse unified diff text into [{ file, renamed, binary, added, deleted, hunks: [[{ type, text }]] }].
 * `type` is ' ' (context), '+' or '-'. File headers (---/+++), index lines and newline markers are
 * skipped; a hunk's context lines are kept because the lockfile rule reads them.
 */
function parseDiff(diffText) {
    const files = [];
    let cur = null;
    let hunk = null;
    const pushHunk = () => { if (cur && hunk) cur.hunks.push(hunk); hunk = null; };
    for (const raw of String(diffText || '').split('\n')) {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        let m = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
        if (m) {
            pushHunk();
            cur = { file: m[2], renamed: false, binary: false, added: false, deleted: false, hunks: [] };
            files.push(cur);
            hunk = null;
            continue;
        }
        if (!cur) continue;
        if (/^(rename from|rename to|similarity index)/.test(line)) { cur.renamed = true; continue; }
        if (/^new file mode/.test(line)) { cur.added = true; continue; }
        if (/^deleted file mode/.test(line)) { cur.deleted = true; continue; }
        if (/^Binary files /.test(line)) { cur.binary = true; continue; }
        if (/^@@ /.test(line)) { pushHunk(); hunk = []; continue; }
        if (/^(--- |\+\+\+ |index |\\ No newline)/.test(line)) continue;
        if (hunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
            hunk.push({ type: line[0], text: line.slice(1) });
        }
    }
    pushHunk();
    return files;
}

/** One file's verdict: { allowed, reason }. */
function decideFile(f) {
    if (f.renamed) return { allowed: false, reason: `${f.file}: renamed` };
    if (f.binary) return { allowed: false, reason: `${f.file}: binary change` };
    if (f.added || f.deleted) return { allowed: false, reason: `${f.file}: ${f.added ? 'added' : 'deleted'}` };
    const kind = classify(f.file);
    if (kind === 'other') return { allowed: false, reason: `${f.file}: not a pin file` };
    const changed = f.hunks.flat().filter((l) => l.type === '+' || l.type === '-');
    if (!changed.length) return { allowed: false, reason: `${f.file}: no content change (mode only?)` };
    if (kind === 'status') return { allowed: true, reason: '' };
    if (kind === 'package') {
        const bad = changed.find((l) => !pkgLine(l.text));
        return bad
            ? { allowed: false, reason: `${f.file}: not a pin line: ${bad.text.trim().slice(0, 100)}` }
            : { allowed: true, reason: '' };
    }
    if (kind === 'lock') {
        for (const h of f.hunks) {
            if (!h.some((l) => LIB_RE.test(l.text))) return { allowed: false, reason: `${f.file}: a hunk touches no openvibe-* entry` };
            const bad = h.find((l) => (l.type === '+' || l.type === '-') && !lockLine(l.text));
            if (bad) return { allowed: false, reason: `${f.file}: not a pin/integrity line: ${bad.text.trim().slice(0, 100)}` };
        }
        return { allowed: true, reason: '' };
    }
    if (kind === 'readme') {
        const bad = changed.find((l) => !readmeLine(l.text));
        return bad
            ? { allowed: false, reason: `${f.file}: not a version line: ${bad.text.trim().slice(0, 100)}` }
            : { allowed: true, reason: '' };
    }
    const bad = changed.find((l) => !budgetLine(l.text));
    return bad
        ? { allowed: false, reason: `${f.file}: not a budget number or comment: ${bad.text.trim().slice(0, 100)}` }
        : { allowed: true, reason: '' };
}

/** Whole-diff verdict: { pinOnly, reasons }. An empty diff is not pin-only (nothing to shortcut). */
function decide(diffText) {
    const files = parseDiff(diffText);
    if (!files.length) return { pinOnly: false, reasons: ['empty diff'] };
    const reasons = [];
    for (const f of files) {
        const v = decideFile(f);
        if (!v.allowed) reasons.push(v.reason);
    }
    return { pinOnly: reasons.length === 0, reasons };
}

function decideRange({ base, head = 'HEAD', dir = '.', context = 5 }) {
    const diff = cp.execFileSync('git', ['-C', dir, 'diff', '--no-color', '--no-ext-diff', `-U${context}`, base, head, '--'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return decide(diff);
}

function main(argv) {
    const opts = { head: 'HEAD', dir: '.', context: 5 };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--base') opts.base = argv[++i];
        else if (argv[i] === '--head') opts.head = argv[++i];
        else if (argv[i] === '--dir') opts.dir = argv[++i];
        else if (argv[i] === '--context') opts.context = Number(argv[++i]);
        else { console.error(`pin-only: unknown argument ${argv[i]}`); console.log('false'); return; }
    }
    if (!opts.base) { console.error('pin-only: --base <sha> required'); console.log('false'); return; }
    try {
        const v = decideRange(opts);
        for (const r of v.reasons) console.error(`pin-only: ${r}`);
        console.log(v.pinOnly ? 'true' : 'false');
    } catch (err) {
        console.error(`pin-only: could not diff (${err.message.split('\n')[0]}); running the full suite`);
        console.log('false');
    }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { parseDiff, decideFile, decide, decideRange, classify };
