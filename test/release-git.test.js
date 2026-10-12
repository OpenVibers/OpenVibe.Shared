'use strict';
// release.js reads the release's commit and its time from git in the release's own checkout, reached the way ovhost's
// release layout reaches it (a `current` symlink), with the directory named safe for those reads: a release owned by
// the deploying user is otherwise refused by git ("dubious ownership") and released_at fell back to the boot time.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createRelease } = require('../release');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-release-git-'));
try {
    const rel = path.join(tmp, 'releases', 'abc');
    fs.mkdirSync(rel, { recursive: true });
    const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com', GIT_AUTHOR_DATE: '2026-10-01T12:00:00Z', GIT_COMMITTER_DATE: '2026-10-01T12:00:00Z' };
    execFileSync('git', ['init', '-q'], { cwd: rel, env });
    fs.writeFileSync(path.join(rel, 'package.json'), '{"name":"x","version":"1.0.0"}\n');
    execFileSync('git', ['add', '.'], { cwd: rel, env });
    execFileSync('git', ['commit', '-q', '-m', 'release'], { cwd: rel, env });
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: rel }).toString().trim();
    const current = path.join(tmp, 'current');
    fs.symlinkSync(rel, current);

    const m = createRelease({ service: 'probe', root: current, env: {}, schema: null }).manifest();
    assert.strictEqual(m.release, sha, 'the commit, through the symlink');
    assert.strictEqual(m.released_at, '2026-10-01T12:00:00.000Z', "the commit's time, not the boot time");
    assert.notStrictEqual(m.released_at, m.booted_at);

    const src = fs.readFileSync(path.join(__dirname, '..', 'release.js'), 'utf8');
    assert.match(src, /'-c', `safe\.directory=\$\{real\}`/, 'git is told the release directory is safe to read');
    console.log('release-git: ok');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
