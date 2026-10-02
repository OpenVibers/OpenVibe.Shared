'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/test-runner — the `npm test` runner every service uses (test/run.js), with no fake green
// (roadmap WS-Q task 7: "skipped counts as yellow; nothing may be marked green by being synthesised from
// skipped parts").
//
//   // test/run.js
//   require('openvibe-shared/test-runner').main({ dir: __dirname, timeoutMs: 120000, hide: /^\[DB\] / });
//
//   npm test                     # every *.test.js in dir, each in its own process, a few at a time
//   npm test -- quota cache      # only files whose name contains one of the words
//   npm test -- --strict         # a skip fails the run too (or OV_TEST_STRICT=1)
//
// A test that cannot run something (no ffmpeg, no Chrome, no git history) prints one line per thing it
// skipped, `<label>: skipped (<why>)`, and still exits 0. Such a file is listed with ○ and its reasons,
// and is NOT counted as passed: the summary reads `148/150 test files passed, 2 skipped (…)`. Only a run
// with nothing skipped prints `N/N test files passed`. Exit status: 1 when a file failed (or, strict, when
// one skipped), else 0.
// ═══════════════════════════════════════════════════════════════
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** `<label>: skipped (<why>)` on a line of its own (the convention OpenVibe.Host's acceptance runner reads too). */
const SKIP_RE = /^[ \t]*[\w .,'()/+#-]{1,120}: skipped \((.+)\)[ \t]*$/gm;

/** The reasons a test's output gives for what it skipped, in order, without repeats. */
function skipsIn(output) {
    const out = [];
    for (const m of String(output || '').matchAll(SKIP_RE)) {
        const line = m[0].trim();
        if (!out.includes(line)) out.push(line);
    }
    return out;
}

function runOne(file, { dir, cwd, env, timeoutMs, nodeArgs }) {
    return new Promise((resolve) => {
        const started = Date.now();
        const child = spawn(process.execPath, [...nodeArgs, path.join(dir, file)], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', (c) => { output += c; });
        child.stderr.on('data', (c) => { output += c; });
        const timer = setTimeout(() => { output += `\n[run] timed out after ${timeoutMs}ms`; child.kill('SIGKILL'); }, timeoutMs);
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            const ok = code === 0;
            const skips = ok ? skipsIn(output) : [];
            resolve({ file, ok, state: !ok ? 'fail' : skips.length ? 'skip' : 'pass', skips, code: code ?? signal, ms: Date.now() - started, output });
        });
    });
}

/**
 * Run the tests; resolves { results, passed, skipped, failed, strict, exitCode, summary } and prints as it goes.
 * opts: dir (required: the test directory), argv (default process.argv.slice(2)), cwd (default dir/..),
 * timeoutMs (60000), parallel (min(4, cpus-1)), env (added to process.env; NODE_ENV=test by default),
 * hide (a RegExp: output lines of a failed file left out, e.g. /^\[DB\] /), pad (file-name column, 44),
 * match (which files, default /\.test\.js$/), serial (files to run alone after parallel files),
 * nodeArgs ([]), log (console.log).
 */
async function run(opts = {}) {
    const dir = opts.dir;
    if (!dir) throw new TypeError('test-runner: dir required');
    const argv = opts.argv || process.argv.slice(2);
    const log = opts.log || console.log;
    const strict = argv.includes('--strict') || process.env.OV_TEST_STRICT === '1';
    const filters = argv.filter((a) => !a.startsWith('-'));
    const match = opts.match || /\.test\.js$/;
    const files = fs.readdirSync(dir).filter((f) => match.test(f))
        .filter((f) => !filters.length || filters.some((w) => f.includes(w))).sort();
    if (!files.length) {
        log('no test files matched');
        return { results: [], passed: 0, skipped: 0, failed: 0, strict, exitCode: 1, summary: 'no test files matched' };
    }
    const cfg = {
        dir, cwd: opts.cwd || path.join(dir, '..'), timeoutMs: opts.timeoutMs || 60000, nodeArgs: opts.nodeArgs || [],
        env: { ...process.env, NODE_ENV: 'test', ...(opts.env || {}) },
    };
    const parallel = Math.max(1, opts.parallel || Math.min(4, os.cpus().length - 1));
    const pad = opts.pad || 44;
    const queue = [], serial = [];
    for (const file of files) (opts.serial && opts.serial.test(file) ? serial : queue).push(file);
    const results = [];
    await Promise.all(Array.from({ length: parallel }, async () => {
        while (queue.length) {
            const r = await runOne(queue.shift(), cfg);
            results.push(r);
            const mark = r.state === 'pass' ? '✓' : r.state === 'skip' ? '○' : '✗';
            log(`${mark} ${r.file.padEnd(pad)} ${String(r.ms).padStart(6)}ms${r.state === 'skip' ? `  ${r.skips.join('; ')}` : ''}`);
        }
    }));
    for (const file of serial) {
        const r = await runOne(file, cfg);
        results.push(r);
        const mark = r.state === 'pass' ? '✓' : r.state === 'skip' ? '○' : '✗';
        log(`${mark} ${r.file.padEnd(pad)} ${String(r.ms).padStart(6)}ms${r.state === 'skip' ? `  ${r.skips.join('; ')}` : ''}`);
    }
    results.sort((a, b) => a.file.localeCompare(b.file));
    const failed = results.filter((r) => r.state === 'fail');
    const skipped = results.filter((r) => r.state === 'skip');
    for (const r of failed) {
        log(`\n── ${r.file} (exit ${r.code}) ──`);
        log(r.output.split('\n').filter((l) => !(opts.hide && opts.hide.test(l))).slice(-40).join('\n'));
    }
    const passed = results.length - failed.length - skipped.length;
    const summary = skipped.length
        ? `${passed}/${results.length} test files passed, ${skipped.length} skipped (${skipped.map((r) => `${r.file}: ${r.skips.join('; ')}`).join(' | ')})${strict ? ' — strict: skips fail the run' : ''}`
        : `${passed}/${results.length} test files passed`;
    log(`\n${summary}`);
    const exitCode = failed.length || (strict && skipped.length) ? 1 : 0;
    return { results, passed, skipped: skipped.length, failed: failed.length, strict, exitCode, summary };
}

/** run(), then exit with its status: what a test/run.js calls. */
function main(opts) {
    run(opts).then((r) => process.exit(r.exitCode), (err) => { console.error(err); process.exit(1); });
}

module.exports = { run, main, skipsIn, SKIP_RE };
