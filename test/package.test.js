'use strict';
// Every subpath consumers use, and every module file, resolves through the package's own name
// (Node self-reference), so require('openvibe-shared/<x>') works the same once installed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const modules = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'))
    .concat(fs.readdirSync(path.join(ROOT, 'analytics')).filter((f) => f.endsWith('.js')).map((f) => `analytics/${f}`));
const targets = new Set(Object.values(pkg.exports).map((t) => t.replace(/^\.\//, '')));
for (const f of modules) assert.ok(targets.has(f), `${f} is exported`);
// Shared ADR 0001: the exports map is the public surface, one explicit entry per subpath, no patterns.
for (const sub of Object.keys(pkg.exports)) assert.ok(!sub.includes('*'), `${sub}: no wildcard subpaths`);
for (const [sub, target] of Object.entries(pkg.exports)) {
    assert.ok(fs.existsSync(path.join(ROOT, target)), `${sub} -> ${target} exists`);
    assert.strictEqual(require.resolve(sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`), path.join(ROOT, target), `${sub} resolves`);
}
// Subpaths in use across Network, Live, Media, Tools, Community and Sites (2026-09-22).
for (const sub of ['analytics', 'app-icon', 'auth-client', 'brand', 'chrome-ssr', 'footer', 'icons', 'legal', 'notifications', 'seo', 'theme-sync', 'url-resolver', 'package.json', 'navbar', 'files']) {
    assert.doesNotThrow(() => require.resolve(`openvibe-shared/${sub}`), `openvibe-shared/${sub}`);
}
// Server modules load in Node; the navbar module loads too (UMD, no DOM touched at require time).
for (const sub of ['analytics', 'app-icon', 'brand', 'chrome-ssr', 'footer', 'icons', 'legal', 'notifications', 'seo', 'url-resolver', 'files', 'nav-icons', 'metrics', 'ready', 'egress', 'trace']) require(`openvibe-shared/${sub}`);
// analytics is dependency-free: its parts require only Node built-ins and each other.
for (const f of fs.readdirSync(path.join(ROOT, 'analytics'))) {
    const src = fs.readFileSync(path.join(ROOT, 'analytics', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [, dep] of src.matchAll(/require\((['"])([^'"]+)\1\)/g).map((m) => [m[1], m[2]])) {
        assert.ok(dep.startsWith('.') || ['fs', 'path', 'crypto'].includes(dep), `analytics/${f} requires ${dep}`);
    }
}
assert.strictEqual(require('openvibe-shared/analytics/event.v1.json').$id, 'https://openvibe.network/contracts/analytics/event.v1.json');
assert.strictEqual(typeof require('openvibe-shared/navbar').init, 'function');
assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'semver version');
assert.ok(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').includes(`## ${pkg.version}`), 'CHANGELOG has an entry for this version');
console.log(`package: ${Object.keys(pkg.exports).length} exports resolve`);
