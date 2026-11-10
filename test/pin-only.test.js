'use strict';
// scripts/pin-only.js: a pull request is pin-only when its diff touches nothing but an openvibe-* pin
// (package.json, lockfiles), STATUS.json, README version lines, and budget numbers with their comments.
// The three fixtures are real merged pin diffs (gh pr diff); the inline cases are the ways a code change
// must not be mistaken for one.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { decide } = require('../scripts/pin-only');

const fixture = (n) => fs.readFileSync(path.join(__dirname, 'fixtures/pin-only', n), 'utf8');

// The real diffs: a pure pin (Billing#252), a pin with a budget raise (Quest#263), and a pin that also
// changes a test's assertions (Quest#260, test/auth-ops.test.js).
assert.deepStrictEqual(decide(fixture('pure-pin.diff')).pinOnly, true, 'a pure pin is pin-only');
assert.deepStrictEqual(decide(fixture('pin-with-budget.diff')).pinOnly, true, 'a pin with a budget raise is pin-only');
{
    const v = decide(fixture('pin-with-code.diff'));
    assert.strictEqual(v.pinOnly, false, 'a pin that also changes a test is not pin-only');
    assert.ok(v.reasons.some((r) => r.includes('auth-ops')), `the reason names the code file: ${v.reasons}`);
}

const file = (p, body) => `diff --git a/${p} b/${p}\nindex 1111111..2222222 100644\n--- a/${p}\n+++ b/${p}\n${body}`;
const PKG_OLD = `    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.186.0",`;
const PKG_NEW = `    "openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.190.0",`;

// package.json: only openvibe-* pin lines.
assert.strictEqual(decide(file('package.json', `@@ -1,2 +1,2 @@\n     "a": "b",\n-${PKG_OLD}\n+${PKG_NEW}\n`)).pinOnly, true);
assert.strictEqual(decide(file('apps/gateway/package.json', `@@ -1,2 +1,2 @@\n     "a": "b",\n-${PKG_OLD}\n+${PKG_NEW}\n`)).pinOnly, true, 'nested package.json (Tools keeps one package per app)');
{
    const v = decide(file('package.json', `@@ -1,3 +1,3 @@\n-${PKG_OLD}\n+${PKG_NEW}\n-    "left-pad": "^1.3.0",\n+    "left-pad": "^1.4.0",\n`));
    assert.strictEqual(v.pinOnly, false, 'a second dependency moving with the pin is not pin-only');
}
{
    const v = decide(file('package.json', `@@ -1,2 +1,2 @@\n-    "test": "node test/run.js",\n+    "test": "node test/run.js --strict",\n`));
    assert.strictEqual(v.pinOnly, false, 'a scripts change is not pin-only');
}

// Lockfiles: openvibe-* lines and the version/resolved/integrity lines below them, in a hunk that touches
// an openvibe-* entry.
const lockHunk = `@@ -10,7 +10,7 @@\n     "node_modules/openvibe-shared": {\n-      "version": "4.186.0",\n-      "resolved": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.186.0",\n-      "integrity": "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",\n+      "version": "4.190.0",\n+      "resolved": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.190.0",\n+      "integrity": "sha512-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB==",\n       "license": "MIT",\n`;
assert.strictEqual(decide(file('package-lock.json', lockHunk)).pinOnly, true, "npm's version/resolved/integrity triple");
{
    const v = decide(file('package-lock.json', `@@ -50,5 +50,5 @@\n     "node_modules/lodash": {\n-      "version": "4.17.20",\n+      "version": "4.17.21",\n       "license": "MIT",\n`));
    assert.strictEqual(v.pinOnly, false, 'another package moving in the lockfile is not pin-only');
    assert.ok(v.reasons[0].includes('no openvibe-* entry'), `the reason says why: ${v.reasons}`);
}
{
    // The resolved URL of another package is the supply-chain shape: it must never ride a pin hunk.
    const v = decide(file('package-lock.json', lockHunk + `@@ -60,5 +60,5 @@\n     "node_modules/left-pad": {\n-      "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",\n+      "resolved": "https://evil.example.com/left-pad.tgz",\n       "license": "MIT",\n`));
    assert.strictEqual(v.pinOnly, false, 'a foreign resolved URL is not pin-only');
}
assert.strictEqual(decide(file('pnpm-lock.yaml', `@@ -8,5 +8,5 @@\n-  openvibe-shared@https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.186.0:\n+  openvibe-shared@https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.190.0:\n     resolution: {integrity: sha512-AAAA}\n-    version: 4.186.0\n+    version: 4.190.0\n`)).pinOnly, true, 'pnpm lock entry');

// STATUS.json is metadata: any change rides along.
assert.strictEqual(decide(file('STATUS.json', `@@ -1,3 +1,3 @@\n-  "shared": "openvibe-shared v4.186.0",\n+  "shared": "openvibe-shared v4.190.0",\n   "summary": "x"\n`)).pinOnly, true);

// README.md: only version lines.
assert.strictEqual(decide(file('README.md', `@@ -1,3 +1,3 @@\n - openvibe-contracts: v0.384.0\n-- openvibe-shared: v4.186.0\n+- openvibe-shared: v4.190.0\n <!-- versions:end -->\n`)).pinOnly, true, 'the versions block');
assert.strictEqual(decide(file('README.md', `@@ -1 +1 @@\n-The widget needs \`openvibe-sdk\` v0.26.0 or later.\n+The widget needs \`openvibe-sdk\` v0.27.0 or later.\n`)).pinOnly, true, 'a prose version mention');
{
    const v = decide(file('README.md', `@@ -1 +1 @@\n-Old install words.\n+New install words.\n`));
    assert.strictEqual(v.pinOnly, false, 'prose without a version is not pin-only');
}

// Budget files: budget numbers and their comments, nothing else.
assert.strictEqual(decide(file('test/perf-budget.test.js', `@@ -20,3 +20,3 @@\n-    jsBrotliKB: 89.8, // 89.8: measured 89.7 with openvibe-shared 4.186.0\n+    jsBrotliKB: 94, // 94: measured 93.7 with openvibe-shared 4.190.0\n     cssFiles: 4,\n`)).pinOnly, true);
assert.strictEqual(decide(file('scripts/perf/check-budgets.js', `@@ -20,3 +20,3 @@\n-    jsRawKB: 958.3, // with openvibe-shared 4.137.0\n+    jsRawKB: 960, // 960: measured 959.1 with openvibe-shared 4.190.0\n     jsFiles: 25,\n`)).pinOnly, true, "Live's budget script");
assert.strictEqual(decide(file('apps/gateway/test/perf-budget.test.js', `@@ -20,3 +20,3 @@\n-    jsBrotliKB: 80, // measured 79.4\n+    jsBrotliKB: 80.5, // 80.5: measured 80.1 with openvibe-shared 4.190.0\n`)).pinOnly, true, "Tools' gateway budget");
{
    const v = decide(file('test/perf-budget.test.js', `@@ -20,3 +20,3 @@\n-    jsBrotliKB: 89.8, // measured 89.7\n+    jsBrotliKB: 89.8, // measured 89.7\n+    const extra = 1;\n`));
    assert.strictEqual(v.pinOnly, false, 'a logic line in a budget file is not pin-only');
}
{
    const v = decide(file('scripts/perf/check-budgets.js', `@@ -40,3 +40,3 @@\n-const FORBIDDEN_ON_HOME = ['/js/chat.js'];\n+const FORBIDDEN_ON_HOME = [];\n`));
    assert.strictEqual(v.pinOnly, false, 'emptying the forbidden list is not pin-only');
}

// Everything else fails closed: workflows, changelogs, code, new/deleted/renamed files, empty diffs.
for (const [name, d] of [
    ['a security.yml SHA move', file('.github/workflows/ci.yml', `@@ -1,2 +1,2 @@\n-    uses: OpenVibers/OpenVibe.Shared/.github/workflows/security.yml@${'a'.repeat(40)}\n+    uses: OpenVibers/OpenVibe.Shared/.github/workflows/security.yml@${'b'.repeat(40)}\n`)],
    ['CHANGELOG.md', file('CHANGELOG.md', `@@ -1,2 +1,2 @@\n-## 1.0.0\n+## 1.0.1\n`)],
    ['server code', file('server/index.js', `@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n`)],
    ['a nested README', file('apps/a/README.md', `@@ -1 +1 @@\n-old\n+new\n`)],
    ['empty diff', ''],
]) {
    assert.strictEqual(decide(d).pinOnly, false, `${name} is not pin-only`);
}
assert.strictEqual(decide(`diff --git a/new.js b/new.js\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/new.js\n@@ -0,0 +1 @@\n+console.log(1);\n`).pinOnly, false, 'an added file is not pin-only');
assert.strictEqual(decide(`diff --git a/old.js b/old.js\ndeleted file mode 100644\nindex 1111111..0000000\n--- a/old.js\n+++ /dev/null\n@@ -1 +0,0 @@\n-console.log(1);\n`).pinOnly, false, 'a deleted file is not pin-only');

// End to end through git: a tiny repository, a pin-shaped commit, then a code commit.
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-only-'));
    const git = (args) => cp.execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    const run = (args) => cp.execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts/pin-only.js'), ...args], { encoding: 'utf8' }).trim();
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { 'openvibe-shared': `https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.186.0` } }, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'server.js'), 'console.log(1);\n');
    git(['init', '-q']);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.']);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base']);
    const base = git(['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(path.join(dir, 'package.json'), fs.readFileSync(path.join(dir, 'package.json'), 'utf8').replace('v4.186.0', 'v4.190.0'));
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'pin']);
    assert.strictEqual(run(['--base', base, '--dir', dir]), 'true', 'the CLI says true for a pin commit');
    fs.writeFileSync(path.join(dir, 'server.js'), 'console.log(2);\n');
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'code']);
    assert.strictEqual(run(['--base', base, '--dir', dir]), 'false', 'the CLI says false once code moves too');
    assert.strictEqual(run(['--dir', dir]), 'false', 'a missing --base fails closed to the full suite');
    fs.rmSync(dir, { recursive: true, force: true });
}

console.log('pin-only: all checks passed');
