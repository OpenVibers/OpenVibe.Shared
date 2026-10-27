'use strict';
// scripts/docs-status.js (plan D41): STATUS.json's tracked fields and the README versions block must
// name the openvibe-* releases package.json pins. --check reports drift and exits 1.
const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inspect, pinsIn, pinsFor, statusValue, versionsBlock, applyBlock, update } = require('../scripts/docs-status');

const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'docs-status.js');
const url = (repo, v) => `https://codeload.github.com/OpenVibers/${repo}/tar.gz/refs/tags/${v}`;
const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `docs-status-${tag}-`));
const write = (dir, name, text) => fs.writeFileSync(path.join(dir, name), text);
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');

// pinsIn reads only codeload tag pins, and only the four shared libraries; ranges and other names are skipped.
assert.deepStrictEqual(pinsIn({
    dependencies: { 'openvibe-shared': url('OpenVibe.Shared', 'v2.8.0'), express: '^4.0.0' },
    devDependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.61.0') },
    peerDependencies: { 'openvibe-publishing': '>=1.5.0' },
}), { 'openvibe-shared': '2.8.0', 'openvibe-contracts': '0.61.0' }, 'a range is not a pin');

// Prose after a version survives a rewrite.
assert.strictEqual(statusValue('openvibe-contracts v0.60.0 (devDependency: the release manifest contract)', 'openvibe-contracts', '0.61.0'),
    'openvibe-contracts v0.61.0 (devDependency: the release manifest contract)');
assert.strictEqual(statusValue(undefined, 'openvibe-sdk', '0.20.4'), 'openvibe-sdk v0.20.4');

// The block is delimited, lists every pinned library and appends when the markers are absent.
assert.strictEqual(versionsBlock({ 'openvibe-contracts': '0.61.0', 'openvibe-sdk': '0.20.4' }),
    '<!-- versions:start -->\n- openvibe-contracts: v0.61.0\n- openvibe-sdk: v0.20.4\n<!-- versions:end -->');
assert.match(applyBlock('# x\n', { 'openvibe-contracts': '0.61.0' }), /# x\n\n<!-- versions:start -->\n- openvibe-contracts: v0\.61\.0\n<!-- versions:end -->\n$/,
    'missing markers are appended');
assert.strictEqual(applyBlock('a\n\n<!-- versions:start -->\n- openvibe-sdk: v0.1.0\n<!-- versions:end -->\n', {}), 'a\n', 'no pin removes the block');

// The repository's own pins pass --check, and the two documents describe them.
{
    const r = inspect(root);
    // The expectation comes from package.json itself, so a pin bump (scripts/pin-bump.js) needs no test edit.
    assert.deepStrictEqual(r.pins, pinsIn(JSON.parse(read(root, 'package.json'))));
    assert.deepStrictEqual(Object.keys(r.pins).sort(), ['openvibe-contracts', 'openvibe-sdk']);
    assert.deepStrictEqual(r.findings.filter((f) => !f.ok), [], 'the checked-in STATUS.json and README block are current');
    const cli = cp.spawnSync(process.execPath, [script, root, '--check'], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 0, cli.stdout + cli.stderr);
}

// A stale STATUS.contracts field exits 1 and names the field.
{
    const dir = tmp('stale');
    write(dir, 'package.json', JSON.stringify({ dependencies: {
        'openvibe-contracts': url('OpenVibe.Contracts', 'v0.99.0'),
        'openvibe-sdk': url('OpenVibe.SDK', 'v0.20.4'),
    } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/X', stage: 'alpha', contracts: 'openvibe-contracts v0.80.0', features: ['keep'] }));
    write(dir, 'README.md', `# X\n\n${versionsBlock({ 'openvibe-contracts': '0.99.0', 'openvibe-sdk': '0.20.4' })}\n`);
    const cli = cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 1, 'drift exits 1');
    assert.match(cli.stdout, /STATUS\.json contracts: .*v0\.99\.0.*v0\.80\.0/, 'names the field and both versions');
    // rewriting fixes it and preserves untouched keys
    assert.deepStrictEqual(update(dir, { today: '2026-10-04' }), ['STATUS.json']);
    const status = JSON.parse(read(dir, 'STATUS.json'));
    assert.strictEqual(status.contracts, 'openvibe-contracts v0.99.0');
    assert.strictEqual(status.sdk, 'openvibe-sdk v0.20.4');
    assert.deepStrictEqual(status.features, ['keep']);
    assert.strictEqual(status.updated, '2026-10-04');
    assert.strictEqual(cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' }).status, 0);
    fs.rmSync(dir, { recursive: true, force: true });
}

// A rerun with no pin change rewrites nothing, `updated` included.
{
    const dir = tmp('rerun');
    const pins = { 'openvibe-contracts': '0.61.0', 'openvibe-sdk': '0.20.4' };
    write(dir, 'package.json', JSON.stringify({ dependencies: {
        'openvibe-contracts': url('OpenVibe.Contracts', 'v0.61.0'),
        'openvibe-sdk': url('OpenVibe.SDK', 'v0.20.4'),
    } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/W', contracts: 'openvibe-contracts v0.61.0', sdk: 'openvibe-sdk v0.20.4', updated: '2026-10-01' }, null, 2) + '\n');
    write(dir, 'README.md', `# W\n\n${versionsBlock(pins)}\n`);
    assert.deepStrictEqual(update(dir, { today: '2026-10-04' }), [], 'a later day with no pin change rewrites nothing');
    assert.strictEqual(JSON.parse(read(dir, 'STATUS.json')).updated, '2026-10-01', 'the old `updated` is kept');
    fs.rmSync(dir, { recursive: true, force: true });
}

// Missing README markers are appended following the pins.
{
    const dir = tmp('append');
    write(dir, 'package.json', JSON.stringify({ devDependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.61.0') } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/Y', deployed: false }));
    write(dir, 'README.md', '# Y\n\nA site.\n');
    const changed = update(dir, { today: '2026-10-04' });
    assert.deepStrictEqual(changed.sort(), ['README.md', 'STATUS.json']);
    assert.match(read(dir, 'README.md'), /A site\.\n\n<!-- versions:start -->\n- openvibe-contracts: v0\.61\.0\n<!-- versions:end -->\n/);
    assert.strictEqual(JSON.parse(read(dir, 'STATUS.json')).deployed, false, 'untouched keys are preserved');
    assert.strictEqual(cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' }).status, 0);
    fs.rmSync(dir, { recursive: true, force: true });
}

// A README with no versions markers fails --check and names the file.
{
    const dir = tmp('readme-missing');
    write(dir, 'package.json', JSON.stringify({ devDependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.61.0') } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/M', contracts: 'openvibe-contracts v0.61.0' }));
    write(dir, 'README.md', '# M\n\nNo versions block here.\n');
    const cli = cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 1, 'a missing README block exits 1');
    assert.match(cli.stdout, /^FAIL README\.md versions: is missing the/m, 'names the missing README block');
    fs.rmSync(dir, { recursive: true, force: true });
}

// A README block naming an old version fails --check and names the file.
{
    const dir = tmp('readme-stale');
    write(dir, 'package.json', JSON.stringify({ devDependencies: { 'openvibe-contracts': url('OpenVibe.Contracts', 'v0.61.0') } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/M', contracts: 'openvibe-contracts v0.61.0' }));
    write(dir, 'README.md', `# M\n\n${versionsBlock({ 'openvibe-contracts': '0.60.0' })}\n`);
    const cli = cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 1, 'a stale README block exits 1');
    assert.match(cli.stdout, /^FAIL README\.md versions: block is stale for openvibe-contracts/m, 'names the stale README block');
    fs.rmSync(dir, { recursive: true, force: true });
}

// A repository that pins nothing omits the block and does not throw.
{
    const dir = tmp('nopin');
    write(dir, 'package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/Z' }));
    write(dir, 'README.md', `# Z\n\n<!-- versions:start -->\n- openvibe-sdk: v0.1.0\n<!-- versions:end -->\n`);
    assert.deepStrictEqual(pinsFor(dir), {});
    assert.deepStrictEqual(inspect(dir).findings, []);
    assert.ok(update(dir, { today: '2026-10-04' }).includes('README.md'), 'the leftover block is removed');
    assert.strictEqual(read(dir, 'README.md'), '# Z\n');
    const cli = cp.spawnSync(process.execPath, [script, dir, '--check'], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 0, cli.stdout + cli.stderr);
    fs.rmSync(dir, { recursive: true, force: true });
}
// A `packages` list follows the pins too (Wiki's STATUS.json lists them there as well as in the fields).
{
    const dir = tmp('packages');
    write(dir, 'package.json', JSON.stringify({ dependencies: {
        'openvibe-shared': url('OpenVibe.Shared', 'v2.17.0'),
        'openvibe-publishing': url('OpenVibe.Publishing', 'v1.3.0'),
    } }));
    write(dir, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/W', shared: 'openvibe-shared v2.15.0', packages: ['openvibe-publishing v1.2.0', 'openvibe-shared v2.15.0', 'openvibe-sdk v0.37.0 (not pinned here)', 'something else'] }));
    assert.deepStrictEqual(update(dir, { today: '2026-10-09' }), ['STATUS.json']);
    const status = JSON.parse(read(dir, 'STATUS.json'));
    assert.strictEqual(status.shared, 'openvibe-shared v2.17.0');
    assert.deepStrictEqual(status.packages, ['openvibe-publishing v1.3.0', 'openvibe-shared v2.17.0', 'openvibe-sdk v0.37.0 (not pinned here)', 'something else'], 'pinned entries follow, the rest stay');
    assert.deepStrictEqual(update(dir, { today: '2026-10-10' }), [], 'a rerun writes nothing');
    fs.rmSync(dir, { recursive: true, force: true });
}

// A workspace root that pins nothing itself: its packages' pins are the repository's (Games' apps/server, Tools'
// apps/*, Examples' examples/*), and one STATUS field may name several libraries (2026-10-27: three repositories kept
// naming openvibe-contracts v0.214.0 after the v0.214.1 pin round because the root read as "pins nothing").
{
    const pkg = (deps) => JSON.stringify({ name: 'x', private: true, dependencies: deps });
    // npm workspaces (Examples): examples/* packages; the newest pin of a library wins.
    const npmRoot = tmp('ws-npm');
    write(npmRoot, 'package.json', JSON.stringify({ name: 'root', private: true, workspaces: ['examples/*'] }));
    for (const [name, v] of [['a', 'v0.214.1'], ['b', 'v0.214.0']]) {
        fs.mkdirSync(path.join(npmRoot, 'examples', name), { recursive: true });
        write(path.join(npmRoot, 'examples', name), 'package.json', pkg({ 'openvibe-contracts': url('OpenVibe.Contracts', v) }));
    }
    assert.deepStrictEqual(pinsFor(npmRoot), { 'openvibe-contracts': '0.214.1' });
    // pnpm (Games): pnpm-workspace.yaml; a composite `contracts` field names every library and the sdk/shared fields
    // are not demanded beside it; update moves each named version and keeps the prose.
    const pnpmRoot = tmp('ws-pnpm');
    write(pnpmRoot, 'package.json', JSON.stringify({ name: 'games', private: true }));
    write(pnpmRoot, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    fs.mkdirSync(path.join(pnpmRoot, 'apps', 'server'), { recursive: true });
    write(path.join(pnpmRoot, 'apps', 'server'), 'package.json', pkg({
        'openvibe-contracts': url('OpenVibe.Contracts', 'v0.214.1'), 'openvibe-sdk': url('OpenVibe.SDK', 'v0.65.0'), 'openvibe-shared': url('OpenVibe.Shared', 'v4.15.2'),
    }));
    write(pnpmRoot, 'STATUS.json', JSON.stringify({ repository: 'OpenVibers/OpenVibe.Games',
        contracts: 'openvibe-contracts v0.214.0, openvibe-sdk v0.62.0, openvibe-shared v4.9.0 (apps/server/package.json)', updated: '2026-10-01' }, null, 2) + '\n');
    const before = inspect(pnpmRoot).findings.filter((f) => !f.ok).map((f) => f.reason);
    assert.ok(before.some((r) => /contracts says v0\.214\.0/.test(r)) && before.some((r) => /names v0\.62\.0/.test(r)) && before.some((r) => /names v4\.9\.0/.test(r)), before.join(' | '));
    assert.ok(!before.some((r) => /has no (sdk|shared) version/.test(r)), 'a library named in the contracts field is not missing its own field');
    update(pnpmRoot, { today: '2026-10-27' });
    const st = JSON.parse(read(pnpmRoot, 'STATUS.json'));
    assert.strictEqual(st.contracts, 'openvibe-contracts v0.214.1, openvibe-sdk v0.65.0, openvibe-shared v4.15.2 (apps/server/package.json)');
    assert.ok(!('sdk' in st) && !('shared' in st), 'no duplicate fields added');
    assert.strictEqual(st.updated, '2026-10-27');
    assert.deepStrictEqual(inspect(pnpmRoot).findings.filter((f) => !f.ok), []);
    // No declared workspaces (Tools): the conventional apps/* folders.
    const appsRoot = tmp('ws-apps');
    write(appsRoot, 'package.json', JSON.stringify({ name: 'tools', private: true }));
    fs.mkdirSync(path.join(appsRoot, 'apps', 'gateway'), { recursive: true });
    write(path.join(appsRoot, 'apps', 'gateway'), 'package.json', pkg({ 'openvibe-shared': url('OpenVibe.Shared', 'v4.15.2') }));
    assert.deepStrictEqual(pinsFor(appsRoot), { 'openvibe-shared': '4.15.2' });
    // The root's own pins still win over its packages'.
    write(appsRoot, 'package.json', JSON.stringify({ name: 'tools', private: true, dependencies: { 'openvibe-shared': url('OpenVibe.Shared', 'v4.15.1') } }));
    assert.deepStrictEqual(pinsFor(appsRoot), { 'openvibe-shared': '4.15.1' });
    for (const d of [npmRoot, pnpmRoot, appsRoot]) fs.rmSync(d, { recursive: true, force: true });
}
console.log('docs-status: all checks passed');
