'use strict';
// scripts/pin-bump.js (plan T1): which package.json files pin a library below a release, the pin URL it writes, the
// arguments it takes, and that STATUS.json / README follow the new pins through scripts/docs-status.js.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { stalePins, staleSecurityPins, updateSecurityPins, updateVersionLines, pinUrl, parseArgs, parseOverBudget, nextHalf, raiseBudgetText, findBudgetFile, raiseBudgets, SERVICE, shipOrder, shipCommand } = require('../scripts/pin-bump');

const url = (repo, v) => `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/${v}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-bump-'));
const write = (f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };
write('package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.110.0'), 'openvibe-sdk': url('OpenVibe.SDK', 'v0.26.0') } });
write('apps/a/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.112.0') } });
write('apps/b/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.90.0') }, peerDependencies: { 'openvibe-shared': '>=2.0.0' } });
write('node_modules/x/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.1.0') } });
write('STATUS.json', { repository: 'OpenVibers/Example', contracts: 'openvibe-contracts v0.110.0', sdk: 'openvibe-sdk v0.26.0', updated: '2026-01-01' });
write('README.md', '- `openvibe-contracts` v0.110.0, `openvibe-sdk` v0.26.0\n\nThe manifest was first released in openvibe-contracts v0.8.0.\n');
const oldSecurity = 'b'.repeat(40);
const targetSecurity = 'c'.repeat(40);
write('.github/workflows/ci.yml', [
    'jobs:',
    '  test:',
    `    uses: OpenVibers/OpenVibe.Shared/.github/workflows/test.yml@${'a'.repeat(40)}`,
    '  security:',
    `    uses: OpenVibers/OpenVibe.Shared/.github/workflows/security.yml@${oldSecurity}`,
].join('\n') + '\n');
cp.execFileSync('git', ['init', '-q', dir]);
cp.execFileSync('git', ['-C', dir, 'add', 'package.json', 'apps', 'STATUS.json', 'README.md', '.github']);

// Only tracked package.json files count, and only pins below the tag; a current pin and a range are left alone.
const stale = stalePins(dir, 'openvibe-contracts', 'v0.112.0').map((s) => s.file).sort();
assert.deepStrictEqual(stale, ['apps/b/package.json', 'package.json'], 'apps/a is current; node_modules is not tracked');
assert.deepStrictEqual(stalePins(dir, 'openvibe-contracts', 'v0.112.0').find((x) => x.file === 'apps/b/package.json').from, ['v0.90.0']);
assert.deepStrictEqual(stalePins(dir, 'openvibe-sdk', 'v0.26.0'), [], 'already at the tag');
assert.deepStrictEqual(stalePins(dir, 'openvibe-shared', 'v2.13.0'), [], 'a peer range is not a pin');

// The reusable security workflow is pinned by commit: a stale pin is found and moved, a current one is left alone,
// and another Shared workflow's pin is not this bot's business.
assert.deepStrictEqual(staleSecurityPins(dir, targetSecurity), [{ file: '.github/workflows/ci.yml', from: [oldSecurity] }]);
assert.deepStrictEqual(staleSecurityPins(dir, oldSecurity), [], 'already at the target');
assert.deepStrictEqual(updateSecurityPins(dir, targetSecurity), ['.github/workflows/ci.yml']);
const ci = fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8');
assert.ok(ci.includes(`security.yml@${targetSecurity}`), 'the security pin moved');
assert.ok(ci.includes(`test.yml@${'a'.repeat(40)}`), 'the test workflow pin stays as it was');

// STATUS.json follows the pins once package.json moves.
const pkg = path.join(dir, 'package.json');
fs.writeFileSync(pkg, fs.readFileSync(pkg, 'utf8').replace(url('OpenVibe.Contracts', 'v0.110.0'), pinUrl('openvibe-contracts', 'v0.112.0')));
assert.deepStrictEqual(updateVersionLines(dir, 'openvibe-contracts', ['v0.110.0'], 'v0.112.0'), ['STATUS.json', 'README.md']);
const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
assert.ok(readme.includes('`openvibe-contracts` v0.112.0, `openvibe-sdk` v0.26.0'), 'the pinned version in prose follows; the other library stays');
assert.ok(readme.includes('first released in openvibe-contracts v0.8.0'), 'a historical version is not a pin and stays');
const status = JSON.parse(fs.readFileSync(path.join(dir, 'STATUS.json'), 'utf8'));
assert.match(status.contracts, /v0\.112\.0/);
assert.match(status.sdk, /v0\.26\.0/, 'the other library is untouched');

assert.strictEqual(pinUrl('openvibe-sdk', 'v0.35.0'), url('OpenVibe.SDK', 'v0.35.0'));
assert.deepStrictEqual(parseArgs(['openvibe-shared', '2.13.0', '--repos', 'A, B', '--apply']), { library: 'openvibe-shared', tag: 'v2.13.0', repos: ['A', 'B'], apply: true, ship: false, workdir: null });
assert.strictEqual(parseArgs(['openvibe-shared', 'v2.13.0', '--ship']).ship, true);
assert.strictEqual(parseArgs(['openvibe-shared', 'v2.13.0', '--ship']).apply, false, '--ship is a dry run without --apply');
assert.throws(() => parseArgs(['left-pad', 'v1.0.0']), /library must be one of/);
assert.throws(() => parseArgs(['openvibe-sdk', 'latest']), /tag must look like/);

// The budget raise: "over budget" lines parse, the measured value rounds up to the next 0.5, and only
// the named keys move, each with a dated note naming the release.
assert.deepStrictEqual(parseOverBudget('https://x/: html 86.5 KB\n  over budget: jsRawKB 392.5 > 376.7\n  over budget: jsFiles 6 > 5\n'), [
    { name: 'jsRawKB', value: 392.5, budget: 376.7 },
    { name: 'jsFiles', value: 6, budget: 5 },
]);
assert.deepStrictEqual(parseOverBudget('perf budget: all checks passed\n'), []);
assert.deepStrictEqual([nextHalf(85.2), nextHalf(85.5), nextHalf(85), nextHalf(6), nextHalf(392.5)], [85.5, 85.5, 85, 6, 392.5]);

const budgetSrc = [
    'const BUDGETS = {',
    '    jsFiles: 5,   // 5 (theme-loader, web-runtime, navbar, footer, boost)',
    '    jsRawKB: 376.7, // 376.7: measured 368.7 with openvibe-shared 4.163.0',
    '    jsBrotliKB: 89.8, // 89.8: measured 89.7 with openvibe-shared 4.186.0',
    '};',
    "console.log('the server on port ' + PORT);",
].join('\n');
{
    const { text, raised } = raiseBudgetText(budgetSrc,
        [{ name: 'jsRawKB', value: 392.5, budget: 376.7 }, { name: 'jsFiles', value: 6, budget: 5 }],
        { library: 'openvibe-shared', tag: 'v4.190.0', date: '2026-11-10' });
    assert.deepStrictEqual(raised, [
        { name: 'jsRawKB', old: '376.7', next: '392.5', measured: '392.5' },
        { name: 'jsFiles', old: '5', next: '6', measured: '6' },
    ]);
    assert.ok(text.includes('jsRawKB: 392.5, // 392.5 openvibe-shared v4.190.0 (2026-11-10: measured 392.5, raised by pin-bump from 376.7); 376.7: measured 368.7'), 'the note names the release and keeps the history');
    assert.ok(text.includes('jsFiles: 6, // 6 openvibe-shared v4.190.0 (2026-11-10: measured 6, raised by pin-bump from 5); 5 (theme-loader'), 'a file count stays whole');
    assert.ok(text.includes('    jsBrotliKB: 89.8, // 89.8: measured 89.7 with openvibe-shared 4.186.0'), 'other keys stay');
    assert.ok(text.includes("console.log('the server on port ' + PORT);"), 'the logic stays');
}
{
    // Never lowered, never churned, unknown keys left alone.
    const { text, raised } = raiseBudgetText(budgetSrc,
        [{ name: 'jsRawKB', value: 370, budget: 376.7 }, { name: 'nope', value: 9, budget: 1 }],
        { library: 'openvibe-shared', tag: 'v4.190.0', date: '2026-11-10' });
    assert.deepStrictEqual([raised, text === budgetSrc], [[], true]);
}

// End to end on a fixture repository: the bump's measurement raises the budgets, a green run raises
// nothing, and anything unprovable is skipped with a reason (the install and the run are faked;
// the file rewrite is real).
const bdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-bump-budget-'));
const bwrite = (f, v) => { fs.mkdirSync(path.dirname(path.join(bdir, f)), { recursive: true }); fs.writeFileSync(path.join(bdir, f), v); };
bwrite('package.json', JSON.stringify({ name: 'fixture', dependencies: { 'openvibe-shared': url('OpenVibe.Shared', 'v4.190.0') } }));
bwrite('test/perf-budget.test.js', budgetSrc);
bwrite('apps/gateway/package.json', JSON.stringify({ name: 'gateway' }));
bwrite('apps/gateway/test/perf-budget.test.js', budgetSrc);
assert.deepStrictEqual(findBudgetFile(bdir), { file: 'test/perf-budget.test.js', pkgDir: '.' });
bwrite('scripts/perf/check-budgets.js', budgetSrc);
assert.deepStrictEqual(findBudgetFile(bdir), { file: 'scripts/perf/check-budgets.js', pkgDir: '.' }, "Live's wrapper defers to the script holding BUDGETS");
fs.rmSync(path.join(bdir, 'scripts'), { recursive: true, force: true });
fs.rmSync(path.join(bdir, 'test'), { recursive: true, force: true });
assert.deepStrictEqual(findBudgetFile(bdir), { file: 'apps/gateway/test/perf-budget.test.js', pkgDir: 'apps/gateway' }, "the gateway budget installs in apps/gateway");
assert.strictEqual(findBudgetFile(dir), null, 'a repository without a budget test');
bwrite('test/perf-budget.test.js', budgetSrc);
{
    const calls = [];
    const io = {
        install: (cwd) => { calls.push(['install', cwd]); return { ok: true }; },
        run: (cwd, rel) => {
            calls.push(['run', cwd, rel]);
            return calls.filter((c) => c[0] === 'run').length === 1
                ? { code: 1, output: '  over budget: jsBrotliKB 93.7 > 89.8\n' }
                : { code: 0, output: 'perf budget: all checks passed\n' };
        },
    };
    const r = raiseBudgets(bdir, { library: 'openvibe-shared', tag: 'v4.190.0', date: '2026-11-10', io });
    assert.deepStrictEqual(r.raised, [{ name: 'jsBrotliKB', old: '89.8', next: '94', measured: '93.7' }]);
    assert.strictEqual(r.file, 'test/perf-budget.test.js');
    assert.ok(fs.readFileSync(path.join(bdir, 'test/perf-budget.test.js'), 'utf8').includes('jsBrotliKB: 94, // 94 openvibe-shared v4.190.0 (2026-11-10: measured 93.7, raised by pin-bump from 89.8)'), 'the file on disk moved');
    assert.deepStrictEqual(calls.filter((c) => c[0] === 'run').length, 2, 'the raise is verified by a second run');
    assert.deepStrictEqual(calls[0], ['install', bdir], 'the install runs in the package directory');
}
{
    const green = { install: () => ({ ok: true }), run: () => ({ code: 0, output: 'perf budget: all checks passed\n' }) };
    assert.deepStrictEqual(raiseBudgets(bdir, { library: 'openvibe-shared', tag: 'v4.190.0', io: green }), { raised: [] });
    const failing = { install: () => ({ ok: true }), run: () => ({ code: 1, output: 'the server did not start\n' }) };
    assert.match(raiseBudgets(bdir, { library: 'openvibe-shared', tag: 'v4.190.0', io: failing }).skipped, /without an "over budget" line/);
    const forbidden = { install: () => ({ ok: true }), run: () => ({ code: 1, output: '  over budget: jsRawKB 1400 > 958.3\n✗ /js/chat.js is loaded by the home page\n' }) };
    assert.match(raiseBudgets(bdir, { library: 'openvibe-shared', tag: 'v4.190.0', io: forbidden }).skipped, /forbidden files/);
    const broken = { install: () => ({ ok: false, skipped: 'npm ci failed: EAI_AGAIN' }), run: () => { throw new Error('must not run'); } };
    assert.match(raiseBudgets(bdir, { library: 'openvibe-shared', tag: 'v4.190.0', io: broken }).skipped, /npm ci failed/);
}

// The ship table: services from the round's ship list, null for libraries and the serviceless, and
// Live and Media last.
assert.strictEqual(SERVICE['OpenVibe.Quest'], 'quest');
assert.strictEqual(SERVICE['OpenVibe.MediaHub'], 'media-hub');
assert.strictEqual(SERVICE['OpenVibe-Git'], 'git');
assert.strictEqual(SERVICE.OpenRestream, 'openre');
for (const lib of ['OpenVibe.Contracts', 'OpenVibe.SDK', 'OpenVibe.Publishing', 'OpenVibe.Shared']) assert.strictEqual(SERVICE[lib], null, `${lib} merges without a deploy`);
for (const repo of ['OpenVibe.Examples', 'OpenVibe.Extensions', 'OpenVibe.Link', 'AFResume', 'openvibe-agents']) assert.strictEqual(SERVICE[repo], null, `${repo} has no service`);
assert.ok(Object.values(SERVICE).every((s) => s === null || /^[a-z][a-z0-9-]*$/.test(s)), 'every service is an ovhost name or null');
assert.deepStrictEqual(
    shipOrder([{ repo: 'OpenVibe.Live', number: 1 }, { repo: 'OpenVibe.AI', number: 2 }, { repo: 'OpenVibe.Media', number: 3 }]).map((s) => s.repo),
    ['OpenVibe.AI', 'OpenVibe.Live', 'OpenVibe.Media']);
assert.deepStrictEqual(shipCommand('/tools', { repo: 'OpenVibe.Quest', number: 263 }), { run: ['/tools/merge-deploy.sh', 'OpenVibe.Quest#263:quest'], describe: "merge-deploy.sh 'OpenVibe.Quest#263:quest'" });
assert.deepStrictEqual(shipCommand('/tools', { repo: 'OpenVibe.Contracts', number: 7 }), { run: ['/tools/merge-after-ci.sh', 'OpenVibe.Contracts#7'], describe: "merge-after-ci.sh 'OpenVibe.Contracts#7'" });
assert.strictEqual(shipCommand('/tools', { repo: 'OpenVibe.New', number: 1 }).run, null, 'an unmapped repository is shipped by hand, never guessed');

fs.rmSync(bdir, { recursive: true, force: true });
fs.rmSync(dir, { recursive: true, force: true });
console.log('pin-bump: all checks passed');
