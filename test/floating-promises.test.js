'use strict';
// scripts/floating-promises.js (plan T0): each rule fires, each exemption holds, and the opt-out needs
// a reason. Fixtures are tiny source strings written to a temp repository tree.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The check itself is run by its own CI step, which installs acorn first; `npm test` here may run
// before that, so this file skips (○, not green) when the parsers are absent.
try { require.resolve('acorn'); require.resolve('acorn-walk'); } catch {
    console.log('floating-promises: skipped (acorn not installed; the check step installs it with npm i --no-save acorn@8 acorn-walk@8)');
    process.exit(0);
}
const { scan, main, OPT_OUT } = require('../scripts/floating-promises');

let tmp = [];
function fixture(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'floating-'));
    tmp.push(dir);
    for (const [rel, src] of Object.entries(files)) {
        const p = path.join(dir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, src);
    }
    return dir;
}
const lines = (res) => res.findings.map((f) => `${f.file}:${f.line}`);
const callees = (res) => res.findings.map((f) => f.callee).sort();

try {
    // Rule a: async declared in the same file — by name and this.f(; obj.f( is NOT matched (a shared method name is noise
    // without types). Exemptions hold.
    {
        const dir = fixture({ 'server/a.js': [
            'async function save() { return 1; }',
            'module.exports.push = async function () {};',
            'async function handler() {',
            '  save();                  // rule a',
            '  this.save();             // rule a',
            '  obj.save();              // not matched: obj is not this',
            '  module.exports.push();   // not matched: a member of another object',
            '  await save();',
            '  void save();',
            '  return save();',
            '  const p = save();',
            '  save().catch(() => {});',
            '  save().then(() => {});',
            '  save().finally(() => {});',
            '}',
        ].join('\n') + '\n' });
        const res = scan(dir);
        assert.deepStrictEqual(lines(res), ['server/a.js:4', 'server/a.js:5'], 'awaited/returned/void-ed/assigned/chained calls are exempt');
        assert.ok(res.findings.every((f) => f.rule === 'a'), 'all rule a');
        assert.deepStrictEqual(callees(res), ['save', 'this.save']);
    }

    // A better-sqlite3 service: its db calls are synchronous, so db.run() never floats there (fetch still does).
    {
        const src = ['async function handler() {', '  db.run("x");', '  fetch("u");', '}'].join('\n') + '\n';
        const sync = fixture({ 'package.json': JSON.stringify({ dependencies: { 'better-sqlite3': '^11' } }), 'server/s.js': src });
        assert.deepStrictEqual(callees(scan(sync)), ['fetch'], 'db.run is synchronous with better-sqlite3');
        const pg = fixture({ 'package.json': JSON.stringify({ dependencies: { pg: '^8' } }), 'server/s.js': src });
        assert.deepStrictEqual(callees(scan(pg)), ['db.run', 'fetch'], 'db.run is a promise without better-sqlite3');
    }

    // Rule b: every known async API.
    {
        const dir = fixture({ 'apps/api/server/b.js': [
            'async function handler() {',
            "  fetch('/x');",
            "  db.query('SELECT 1');",
            "  db.run('INSERT');",
            "  tx.exec('x');",
            "  tx.run('x');",
            "  pool.query('x');",
            "  client.query('x');",
            '  db.close();',
            '  pool.close();',
            '  store.close();',
            '  queue.enqueue(job);',
            '  repo.tx(async (t) => { await t.run("x"); });',
            '  knex.transaction(async (trx) => { await trx.run("x"); });',
            "  fs.promises.readFile('x');",
            "  fsp.writeFile('y', 'z');",
            "  fetch('/x').catch(() => {});",      // exempt
            '  knex.transaction((trx) => trx.run("x"));', // sync callback: not reported
            '}',
        ].join('\n') + '\n' });
        const res = scan(dir);
        assert.strictEqual(res.findings.length, 15, `15 rule-b findings, got ${lines(res).join(' ')}`);
        assert.ok(res.findings.every((f) => f.rule === 'b'), 'all rule b');
        for (const c of ['fetch', 'db.query', 'db.run', 'tx.exec', 'tx.run', 'pool.query', 'client.query', 'db.close', 'pool.close', 'store.close', 'queue.enqueue', 'repo.tx', 'knex.transaction', 'fs.promises.readFile', 'fsp.writeFile']) {
            assert.ok(callees(res).includes(c), `${c} reported`);
        }
    }

    // Opt-out: a reason on the same line or the line above counts; a bare comment is still reported.
    {
        const dir = fixture({ 'lib/a.js': [
            'async function f() {}',
            'function g() {',
            '  f(); // floating-ok: the process may exit',
            '  // floating-ok:',
            '  f();',
            '  // floating-ok: no reason above is fine too',
            '  f();',
            '  f(); // floating-ok',
            '}',
        ].join('\n') + '\n' });
        const res = scan(dir);
        assert.strictEqual(res.allowed, 2, 'two reasoned opt-outs');
        assert.deepStrictEqual(lines(res), ['lib/a.js:5', 'lib/a.js:8'], 'a comment without a reason is still a finding');
        assert.ok(OPT_OUT.test('// floating-ok: because'), 'reason required: present');
        assert.ok(!OPT_OUT.test('// floating-ok:'), 'reason required: absent');
        assert.ok(!OPT_OUT.test('// floating-ok'), 'reason required: no colon');
    }

    // A sync function named like an async one in another file is not reported.
    {
        const dir = fixture({
            'server/def.js': 'async function save() {}\n',
            'server/use.js': 'function save() {}\nfunction h() { save(); }\n',
        });
        assert.strictEqual(scan(dir).findings.length, 0, 'same-file resolution only');
    }

    // Top-level: allowed in scripts (the process may exit), reported in server code.
    {
        const dir = fixture({
            'scripts/top.js': 'async function go() {}\ngo();\n',
            'server/top.js': 'async function go() {}\ngo();\n',
        });
        assert.deepStrictEqual(lines(scan(dir)), ['server/top.js:2'], 'top-level only in server code');
    }

    // main(): the summary line and exit status.
    {
        const dir = fixture({ 'server/x.js': 'async function f() {}\nf();\n' });
        const logs = [];
        const orig = console.log;
        console.log = (...a) => logs.push(a.join(' '));
        const code = main(dir);
        console.log = orig;
        assert.strictEqual(code, 1, 'exit 1 when a floating promise is found');
        assert.match(logs.join('\n'), /server\/x\.js:2/, 'prints file:line');
        assert.match(logs.join('\n'), /^floating promises: 1 found, 0 allowed$/m, 'summary line');
    }

    assert.strictEqual(main(fixture({ 'server/clean.js': 'async function f() {}\nasync function h() { await f(); }\n' })), 0, 'clean tree exits 0');
    console.log('floating-promises: all checks passed');
} finally {
    for (const dir of tmp) fs.rmSync(dir, { recursive: true, force: true });
}
