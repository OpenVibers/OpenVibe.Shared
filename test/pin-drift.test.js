'use strict';
// scripts/pin-drift.js (WS-C task 5): unpublished pins and pins more than one minor (or a major) behind fail.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { judge, main } = require('../scripts/pin-drift');

const tags = ['v0.40.0', 'v0.41.0', 'v0.41.1', 'v0.42.0'];
assert.strictEqual(judge([0, 42, 0], tags).ok, true);
assert.strictEqual(judge([0, 41, 1], tags).ok, true, 'one minor behind is allowed');
assert.match(judge([0, 40, 0], tags).reason, /2 minors behind v0\.42\.0/);
assert.match(judge([0, 42, 1], tags).reason, /not a published tag/);
assert.match(judge([1, 12, 0], ['v1.12.0', 'v2.0.0']).reason, /major behind/);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-drift-'));
const url = (repo, v) => `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/${v}`;
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    dependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.39.0'), 'openvibe-sdk': url('OpenVibe.SDK', 'v0.9.1'), express: '^4.0.0' },
    peerDependencies: { 'openvibe-shared': '>=1.5.0' },
}));
const out = main(dir, { tagsOf: (repo) => (repo === 'OpenVibe.Contracts' ? tags : ['v0.9.0', 'v0.9.1']) });
assert.deepStrictEqual(out.map((r) => [r.name, r.ok]), [['openvibe-contracts', false], ['openvibe-sdk', true]], 'ranges are not pins; other packages are ignored');
fs.rmSync(dir, { recursive: true, force: true });
console.log('pin-drift: all checks passed');
