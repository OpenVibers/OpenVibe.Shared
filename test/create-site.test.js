'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts', 'create-site.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-create-site-'));
const target = path.join(tmp, 'example-site');

function run(args) {
    return spawnSync(process.execPath, [script, ...args], { cwd: tmp, encoding: 'utf8' });
}

try {
    let result = run(['example-site', '--dir', target]);
    assert.equal(result.status, 0, result.stderr);
    for (const file of ['package.json', 'README.md', 'server/app.js', 'server/index.js', 'test/smoke.test.js']) {
        const content = fs.readFileSync(path.join(target, file), 'utf8');
        assert.ok(!content.includes('__NAME__'), `${file} has no placeholder`);
    }
    const pkg = require(path.join(target, 'package.json'));
    assert.equal(pkg.name, 'example-site');
    assert.equal(pkg.dependencies['openvibe-shared'], `https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v${require('../package.json').version}`);

    const marker = path.join(target, 'keep.txt');
    fs.writeFileSync(marker, 'unchanged');
    result = run(['example-site', '--dir', target]);
    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'unchanged');
    assert.match(result.stderr, /target is not empty/);

    for (const bad of ['X', 'a', '1site', 'site_name', `a${'b'.repeat(40)}`]) {
        result = run([bad, '--dir', path.join(tmp, `invalid-${bad}`)]);
        assert.equal(result.status, 1, `${bad} must be refused`);
        assert.ok(!fs.existsSync(path.join(tmp, `invalid-${bad}`)), 'invalid name wrote nothing');
    }

    fs.mkdirSync(path.join(target, 'node_modules'));
    fs.symlinkSync(root, path.join(target, 'node_modules', 'openvibe-shared'), 'dir');
    result = spawnSync(process.execPath, [path.join(target, 'test', 'smoke.test.js')], {
        cwd: target,
        encoding: 'utf8',
        env: { ...process.env, NODE_PATH: [path.join(root, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter) },
        timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /site smoke: all checks passed/);

    console.log('create-site: all checks passed');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
