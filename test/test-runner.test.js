'use strict';
// test-runner.js: each file in its own process; a file that prints `<label>: skipped (<why>)` and exits 0 is
// skipped (○), never counted as passed (roadmap WS-Q task 7); only a run with nothing skipped says N/N passed;
// failures exit 1, and --strict makes skips fail too.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, skipsIn, resolveParallel } = require('../test-runner');

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-test-runner-'));
    const write = (name, body) => fs.writeFileSync(path.join(dir, name), body);
    write('a-pass.test.js', "console.log('a: all checks passed');\n");
    write('b-skip.test.js', "console.log('transcript via AI: skipped (no ffmpeg/ffprobe)'); process.exit(0);\n");
    write('c-partial.test.js', "console.log('check B: skipped (no local model)'); console.log('check B: skipped (no local model)'); console.log('c: all checks passed');\n");
    write('d-fail.test.js', "console.log('[DB] noise');\nconsole.log('d: skipped (never read on a failure)');\nthrow new Error('boom');\n");
    write('e-mention.test.js', "console.log('[Jobs] run skipped: overlapping'); console.log('e: all checks passed');\n");
    write('not-a-test.js', 'process.exit(1);\n');
    const lines = [];
    const log = (l) => lines.push(String(l));

    let r = await run({ dir, argv: [], log, hide: /^\[DB\] / });
    assert.deepStrictEqual(r.results.map((x) => [x.file, x.state]), [['a-pass.test.js', 'pass'], ['b-skip.test.js', 'skip'], ['c-partial.test.js', 'skip'], ['d-fail.test.js', 'fail'], ['e-mention.test.js', 'pass']]);
    assert.deepStrictEqual([r.passed, r.skipped, r.failed, r.exitCode], [2, 2, 1, 1]);
    assert.deepStrictEqual(r.results[2].skips, ['check B: skipped (no local model)'], 'repeats once');
    assert.match(r.summary, /^2\/5 test files passed, 2 skipped \(b-skip\.test\.js: transcript via AI: skipped \(no ffmpeg\/ffprobe\) \| c-partial/);
    assert.ok(lines.some((l) => l.startsWith('○ b-skip.test.js')), 'skips are marked ○');
    assert.ok(lines.some((l) => l.startsWith('✗ d-fail.test.js')));
    assert.ok(!lines.join('\n').includes('[DB] noise'), 'hidden lines stay out of a failure');
    assert.ok(lines.join('\n').includes('boom'));

    // Only the passing files: N/N, exit 0.
    lines.length = 0;
    r = await run({ dir, argv: ['a-pass', 'e-mention'], log });
    assert.deepStrictEqual([r.summary, r.exitCode], ['2/2 test files passed', 0]);

    // Skips alone exit 0 (yellow), and not with --strict.
    r = await run({ dir, argv: ['b-skip', 'a-pass'], log });
    assert.deepStrictEqual([r.passed, r.skipped, r.exitCode], [1, 1, 0]);
    assert.match(r.summary, /^1\/2 test files passed, 1 skipped/);
    r = await run({ dir, argv: ['b-skip', 'a-pass', '--strict'], log });
    assert.strictEqual(r.exitCode, 1);
    assert.match(r.summary, /strict: skips fail the run$/);

    // parallel: 'auto' resolves by CPU to a number >= 1 and still runs every matched file; pins and the default hold.
    const cpus = os.cpus().length;
    assert.strictEqual(resolveParallel('auto'), Math.max(1, Math.min(8, cpus - 1)));
    assert.strictEqual(resolveParallel(undefined), Math.max(1, Math.min(4, cpus - 1)));
    assert.strictEqual(resolveParallel(1), 1);
    assert.strictEqual(resolveParallel(3), 3);
    assert.strictEqual(resolveParallel('nonsense'), Math.max(1, Math.min(4, cpus - 1)));
    r = await run({ dir, argv: ['a-pass', 'e-mention'], log, parallel: 'auto' });
    assert.ok(Number.isInteger(r.parallel) && r.parallel >= 1);
    assert.deepStrictEqual([r.results.length, r.summary, r.exitCode], [2, '2/2 test files passed', 0]);
    r = await run({ dir, argv: ['a-pass', 'e-mention'], log, parallel: 1 });
    assert.deepStrictEqual([r.parallel, r.results.length], [1, 2]);

    r = await run({ dir, argv: ['nothing-matches'], log });
    assert.strictEqual(r.exitCode, 1);
    // --allow-empty (the pin-only CI subset): no match is a pass, not a failure.
    r = await run({ dir, argv: ['nothing-matches', '--allow-empty'], log });
    assert.deepStrictEqual([r.summary, r.exitCode], ['no test files matched (allowed)', 0]);
    process.env.OV_TEST_ALLOW_EMPTY = '1';
    try {
        r = await run({ dir, argv: ['nothing-matches'], log });
        assert.strictEqual(r.exitCode, 0);
    } finally { delete process.env.OV_TEST_ALLOW_EMPTY; }
    assert.deepStrictEqual(skipsIn('x\n  ACK test: skipped (ffmpeg not installed)  \nrollback with newer writes: skipped (no git history)\nOK B: skipped — old style'),
        ['ACK test: skipped (ffmpeg not installed)', 'rollback with newer writes: skipped (no git history)']);
    // retry: a file that matches and fails is run once more. One that passes the second time counts as passed and is
    // named; one that fails twice is a failure; a file that does not match is not tried again.
    const flag = path.join(dir, 'ran-once');
    write('f-slow-chrome.test.js', `const fs = require('fs'); if (!fs.existsSync(${JSON.stringify(flag)})) { fs.writeFileSync(${JSON.stringify(flag)}, '1'); throw new Error('too slow the first time'); } console.log('f: all checks passed');\n`);
    write('g-broken-chrome.test.js', "throw new Error('wrong both times');\n");
    lines.length = 0;
    r = await run({ dir, argv: ['f-slow', 'g-broken', 'd-fail', 'a-pass'], log, retry: /-chrome\.test\.js$/ });
    assert.deepStrictEqual(r.results.map((x) => [x.file, x.state, Boolean(x.retried)]), [['a-pass.test.js', 'pass', false], ['d-fail.test.js', 'fail', false], ['f-slow-chrome.test.js', 'pass', true], ['g-broken-chrome.test.js', 'fail', true]]);
    assert.deepStrictEqual([r.passed, r.failed, r.exitCode, r.secondTry], [2, 2, 1, ['f-slow-chrome.test.js']]);
    assert.match(r.summary, /^2\/4 test files passed; passed on a second try: f-slow-chrome\.test\.js$/, 'the summary names what needed a second try');
    assert.ok(lines.some((l) => l.startsWith('↻ f-slow-chrome.test.js')) && lines.some((l) => l.startsWith('✓ f-slow-chrome.test.js')), 'the first failure is said, then the pass');
    assert.strictEqual(lines.filter((l) => l.startsWith('↻ d-fail')).length, 0, 'a file that does not match is not run again');
    fs.rmSync(flag, { force: true });
    r = await run({ dir, argv: ['f-slow'], log });
    assert.deepStrictEqual([r.failed, r.exitCode], [1, 1], 'without retry, the first failure stands');
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('test-runner: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
