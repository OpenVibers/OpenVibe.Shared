'use strict';
// The scripts every repository's CI runs piped from this repository's main (`curl …/scripts/<file> | node -`): none may
// require a file beside it, because piped there is no "beside" (4.288.0's pin-drift.js and docs-status.js required
// ./pins and every CI that ran them failed, 2026-11-16/17). Each one, piped, must run; each inline pin reader must read
// as openvibe-shared/pins does.
//   node test/piped-scripts.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pins = require('../scripts/pins');

const PIPED = ['pin-drift.js', 'docs-status.js', 'floating-promises.js'];
const root = path.join(__dirname, '..');
for (const file of PIPED) {
    const src = fs.readFileSync(path.join(root, 'scripts', file), 'utf8');
    const local = [...src.matchAll(/require\((['"])(\.{1,2}\/[^'"]+)\1\)/g)].map((m) => m[2]);
    assert.deepStrictEqual(local, [], `${file} requires nothing beside it (${local.join(', ')})`);
    const re = /const PIN_RE = (\/.*\/i);/.exec(src);
    if (re) assert.strictEqual(re[1], String(pins.PIN), `${file} reads pins as openvibe-shared/pins does`);
}
// Piped, from another directory, the way CI runs them (stdin is the script; the repository is the argument).
const run = (file, args) => execFileSync(process.execPath, ['-', ...args], { input: fs.readFileSync(path.join(root, 'scripts', file)), cwd: require('os').tmpdir(), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
// Offline (the forge's test sandbox, OV_SANDBOX_OFFLINE=1) pin-drift loads and then cannot read GitHub's tags: still piped.
{
    let pd;
    try { pd = run('pin-drift.js', [root]); } catch (err) {
        if (process.env.OV_SANDBOX_OFFLINE !== '1') throw err;
        pd = String(err.stdout || '') + String(err.stderr || '');
        assert.doesNotMatch(pd, /Cannot find module/, 'pin-drift.js loads piped');
        assert.match(pd, /pin-drift: could not read tags/);
        pd = 'pin-drift: 0 pin(s) (offline)';
    }
    assert.match(pd, /pin-drift: \d+ pin\(s\)/, 'pin-drift.js runs piped');
}
let out = '';
try { out = run('docs-status.js', [root, '--check']); } catch (err) { out = String(err.stdout || '') + String(err.stderr || ''); }
assert.ok(!/Cannot find module/.test(out), `docs-status.js runs piped (${out.slice(0, 300)})`);
console.log(`piped-scripts: ${PIPED.join(', ')} require nothing beside them and run piped`);
