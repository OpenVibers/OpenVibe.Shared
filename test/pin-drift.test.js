'use strict';
// scripts/pin-drift.js (WS-C task 5): unpublished pins and pins more than one minor (or a major) behind fail.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { judge, main, releaseDates, sharedCopies } = require('../scripts/pin-drift');

const tags = ['v0.40.0', 'v0.41.0', 'v0.41.1', 'v0.42.0'];
assert.strictEqual(judge([0, 42, 0], tags).ok, true);
assert.strictEqual(judge([0, 41, 1], tags).ok, true, 'one minor behind is allowed');
assert.match(judge([0, 40, 0], tags).reason, /2 minors behind v0\.42\.0/, 'without dates every release counts as old');
const DAY = 86400000, now = Date.parse('2026-10-20T00:00:00Z');
const dates = releaseDates('## 0.42.0 — 2026-10-15\n...\n## 0.41.1 (2026-09-30)\n## [0.41.0] - 2026-09-20\n');
assert.strictEqual(dates.get('0.42.0'), Date.parse('2026-10-15T00:00:00Z')); assert.strictEqual(dates.get('0.41.0'), Date.parse('2026-09-20T00:00:00Z'));
assert.strictEqual(judge([0, 40, 0], tags, { dates, now }).ok, true, 'v0.42.0 is 5 days old: within the grace');
assert.strictEqual(judge([0, 40, 0], tags, { dates, now: now + 10 * DAY }).ok, false, 'v0.42.0 is 15 days old: drifted');
assert.match(judge([0, 42, 1], tags).reason, /not a published tag/);
assert.match(judge([1, 12, 0], ['v1.12.0', 'v2.0.0']).reason, /major behind/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-drift-'));
const url = (repo, v) => `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/${v}`;
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.39.0'), 'openvibe-sdk': url('OpenVibe.SDK', 'v0.9.1'), express: '^4.0.0' },
    peerDependencies: { 'openvibe-shared': '>=1.5.0' },
}));
const out = main(dir, { tagsOf: (repo) => (repo === 'OpenVibe.Contracts' ? tags : ['v0.9.0', 'v0.9.1']), datesOf: () => new Map() });
assert.deepStrictEqual(out.map((r) => [r.name, r.ok]), [['openvibe-contracts', false], ['openvibe-sdk', true]], 'ranges are not pins; other packages are ignored');
fs.rmSync(dir, { recursive: true, force: true });
console.log('pin-drift: all checks passed');

// One copy of openvibe-shared per package root (WS-C task 8): npm nesting and pnpm's store, symlinks resolved.
{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-one-shared-'));
    const put = (rel, version) => { fs.mkdirSync(path.join(root, rel), { recursive: true }); fs.writeFileSync(path.join(root, rel, 'package.json'), JSON.stringify({ name: path.basename(rel), version })); };
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    put('node_modules/openvibe-shared', '1.13.0');
    put('node_modules/openvibe-publishing', '0.4.0');
    let r = sharedCopies(root);
    assert.deepStrictEqual(r.map((x) => [x.ok, x.copies.length]), [[true, 1]], 'one hoisted copy');
    put('node_modules/openvibe-publishing/node_modules/openvibe-shared', '1.12.0');
    r = sharedCopies(root);
    assert.strictEqual(r[0].ok, false, 'a nested second copy fails');
    assert.deepStrictEqual(r[0].copies.map((c) => c.version).sort(), ['1.12.0', '1.13.0']);
    fs.rmSync(root, { recursive: true, force: true });

    // pnpm: the store holds the package once; node_modules/openvibe-shared and a dependant's link point at it.
    const pn = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-one-shared-pnpm-'));
    fs.writeFileSync(path.join(pn, 'package.json'), '{}');
    const store = path.join(pn, 'node_modules/.pnpm/openvibe-shared@1.13.0/node_modules/openvibe-shared');
    fs.mkdirSync(store, { recursive: true });
    fs.writeFileSync(path.join(store, 'package.json'), JSON.stringify({ name: 'openvibe-shared', version: '1.13.0' }));
    fs.symlinkSync(store, path.join(pn, 'node_modules/openvibe-shared'), 'dir');
    const pubNm = path.join(pn, 'node_modules/.pnpm/openvibe-publishing@0.4.0/node_modules');
    fs.mkdirSync(path.join(pubNm, 'openvibe-publishing'), { recursive: true });
    fs.symlinkSync(store, path.join(pubNm, 'openvibe-shared'), 'dir');
    assert.deepStrictEqual(sharedCopies(pn).map((x) => [x.ok, x.copies.length]), [[true, 1]], 'links to one store entry are one copy');
    fs.rmSync(pn, { recursive: true, force: true });
}
console.log('pin-drift: one copy of openvibe-shared checked');
