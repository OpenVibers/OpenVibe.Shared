'use strict';
// scripts/icon-audit.js (plan L32 I1): every icon name a page names has to resolve. The test proves both answers on a
// throwaway repository: an unknown Font Awesome name, a kit.icon the registry does not have and a NAV row with a bad
// name fail the run (exit 1), and the same page with real names passes. This is the step a site's CI can run from the
// installed package: npx ov-icon-audit --root .
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'icon-audit.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-audit-'));
const repo = path.join(dir, 'OpenVibe.Fixture');
fs.mkdirSync(path.join(repo, 'server'), { recursive: true });
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
const audit = () => {
    try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--repos', 'OpenVibe.Fixture'], { encoding: 'utf8' }) }; }
    catch (err) { return { status: err.status, out: String(err.stdout || '') + String(err.stderr || '') }; }
};

try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    const write = (f, body) => fs.writeFileSync(path.join(repo, f), body);
    write('server/nav.js', [
        "const kit = require('openvibe-shared/kit');",
        "kit.icon('compass');",
        "kit.icon('nope-not-a-glyph');",
        "const nav = [{ label: 'Deep dive', icon: 'not-a-glyph' }, { label: 'Home', icon: 'fa-house' }];",
        "const broken = '<i class=\"fa-solid fa-otter\"></i>';",
    ].join('\n'));
    git('add', '.');
    git('commit', '-q', '-m', 'broken icons');
    let r = audit();
    assert.strictEqual(r.status, 1, 'an unresolved name fails the audit');
    assert.match(r.out, /nope-not-a-glyph/, 'the kit.icon miss is named');
    assert.match(r.out, /otter/, 'the unknown Font Awesome name is named');
    assert.match(r.out, /not-a-glyph/, 'the NAV field name is named (the fixture loads no Font Awesome)');

    // The same page with names that resolve: the kit's, the glyph registry's, a brand and a site mark.
    write('server/nav.js', [
        "const kit = require('openvibe-shared/kit');",
        "kit.icon('compass');",
        "kit.icon('binoculars');",
        "const nav = [{ label: 'Deep dive', icon: 'compass' }, { label: 'Home', icon: 'fa-house' }];",
        "const fine = '<i class=\"fa-solid fa-eye\"></i><i class=\"fa-brands fa-github\"></i>';",
    ].join('\n'));
    git('add', '.');
    git('commit', '-q', '-m', 'fixed icons');
    r = audit();
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /every icon name resolves/);
    console.log('icon audit: fails on an unknown name, passes when every name resolves');
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}
