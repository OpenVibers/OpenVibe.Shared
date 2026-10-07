'use strict';
// scripts/pin-bump.js (plan T1): which package.json files pin a library below a release, the pin URL it writes, the
// arguments it takes, and that STATUS.json / README follow the new pins through scripts/docs-status.js.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { stalePins, updateVersionLines, pinUrl, parseArgs } = require('../scripts/pin-bump');

const url = (repo, v) => `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/${v}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-bump-'));
const write = (f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };
write('package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.110.0'), 'openvibe-sdk': url('OpenVibe.SDK', 'v0.26.0') } });
write('apps/a/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.112.0') } });
write('apps/b/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.90.0') }, peerDependencies: { 'openvibe-shared': '>=2.0.0' } });
write('node_modules/x/package.json', { dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.1.0') } });
write('STATUS.json', { repository: 'OpenVibers/Example', contracts: 'openvibe-contracts v0.110.0', sdk: 'openvibe-sdk v0.26.0', updated: '2026-01-01' });
cp.execFileSync('git', ['init', '-q', dir]);
cp.execFileSync('git', ['-C', dir, 'add', 'package.json', 'apps', 'STATUS.json']);

// Only tracked package.json files count, and only pins below the tag; a current pin and a range are left alone.
const stale = stalePins(dir, 'openvibe-contracts', 'v0.112.0').map((s) => s.file).sort();
assert.deepStrictEqual(stale, ['apps/b/package.json', 'package.json'], 'apps/a is current; node_modules is not tracked');
assert.deepStrictEqual(stalePins(dir, 'openvibe-contracts', 'v0.112.0').find((x) => x.file === 'apps/b/package.json').from, ['v0.90.0']);
assert.deepStrictEqual(stalePins(dir, 'openvibe-sdk', 'v0.26.0'), [], 'already at the tag');
assert.deepStrictEqual(stalePins(dir, 'openvibe-shared', 'v2.13.0'), [], 'a peer range is not a pin');

// STATUS.json follows the pins once package.json moves.
const pkg = path.join(dir, 'package.json');
fs.writeFileSync(pkg, fs.readFileSync(pkg, 'utf8').replace(url('OpenVibe.Contracts', 'v0.110.0'), pinUrl('openvibe-contracts', 'v0.112.0')));
assert.deepStrictEqual(updateVersionLines(dir), ['STATUS.json']);
const status = JSON.parse(fs.readFileSync(path.join(dir, 'STATUS.json'), 'utf8'));
assert.match(status.contracts, /v0\.112\.0/);
assert.match(status.sdk, /v0\.26\.0/, 'the other library is untouched');

assert.strictEqual(pinUrl('openvibe-sdk', 'v0.35.0'), url('OpenVibe.SDK', 'v0.35.0'));
assert.deepStrictEqual(parseArgs(['openvibe-shared', '2.13.0', '--repos', 'A, B', '--apply']), { library: 'openvibe-shared', tag: 'v2.13.0', repos: ['A', 'B'], apply: true, workdir: null });
assert.throws(() => parseArgs(['left-pad', 'v1.0.0']), /library must be one of/);
assert.throws(() => parseArgs(['openvibe-sdk', 'latest']), /tag must look like/);

fs.rmSync(dir, { recursive: true, force: true });
console.log('pin-bump: all checks passed');
