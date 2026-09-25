'use strict';
// scripts/pin-drift.js (WS-C task 5): unpublished pins and pins more than one minor (or a major) behind fail.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { judge, main, releaseDates } = require('../scripts/pin-drift');

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
