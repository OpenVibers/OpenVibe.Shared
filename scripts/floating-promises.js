#!/usr/bin/env node
'use strict';
/**
 * Floating promises (plan T0, the PostgreSQL move's main bug class): an async call whose result
 * nobody awaits, so its failure is an unhandled rejection and a transaction commits without it.
 *
 *   node scripts/floating-promises.js <repo dir> [--json]
 *   curl -fsSL https://raw.githubusercontent.com/OpenVibers/OpenVibe.Shared/main/scripts/floating-promises.js \
 *     | node - "$GITHUB_WORKSPACE"          # CI installs acorn first: npm i --no-save acorn@8 acorn-walk@8
 *
 * Parses every .js/.mjs/.cjs under server/, apps/<app>/server/, scripts/, lib/ and src/ (node_modules,
 * dist, public/, vendor/ and test fixtures are skipped) with acorn + acorn-walk and reports an
 * ExpressionStatement whose expression is a call that is not awaited, returned, assigned, `void`-ed or
 * chained with .then(/.catch(/.finally(, when the callee is
 *
 *   a) a function declared async in the same file (declarations, `const f = async …`, class/object
 *      methods, `module.exports.f = async …`), called by that name or as this.f(/obj.f(; or
 *   b) a known async API: <anything>.tx(, .transaction( with an async callback, db.run/get/all/exec/query,
 *      tx.run/get/all/exec, .enqueue(, pool.query(, client.query(, fetch(, .close() on db/pool/client/
 *      server/store, fs.promises.*, fsp.*.
 *
 * Only statements inside a function count; a top-level fire-and-forget in a script may exit with the
 * process, so those are reported only in server code. An opt-out is a comment on the same line or the
 * line above — `// floating-ok: <reason>` — and a reason is required.
 *
 * Exit 0 = none, 1 = at least one floating promise.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['server', 'scripts', 'lib', 'src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'public', 'vendor', '.git', 'fixtures', '__fixtures__', 'test', 'tests', '__tests__', 'testdata', 'spec']);
const EXTS = new Set(['.js', '.mjs', '.cjs']);
const OPT_OUT = /\/\/\s*floating-ok:\s*\S/;
const DB_METHODS = new Set(['run', 'get', 'all', 'exec', 'query']);
const CLOSE_OBJECTS = new Set(['db', 'pool', 'client', 'store']);

/** Require a parser from the current working directory or from this script's own tree. */
function load(name) {
    const { createRequire } = require('module');
    const tried = [];
    try { return require(name); } catch (err) { tried.push(err.message); }
    for (const base of [process.cwd(), __dirname]) {
        try { return createRequire(path.join(base, '__floating__.js'))(name); } catch (err) { tried.push(err.message); }
    }
    throw new Error(`cannot load ${name} (install it: npm i --no-save acorn@8 acorn-walk@8): ${tried.join('; ')}`);
}

const isAsyncFn = (n) => !!n && (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') && n.async === true;

/** The property name of a MemberExpression (identifier or string literal), else null. */
function memberProp(node) {
    if (!node || node.type !== 'MemberExpression') return null;
    if (!node.computed && node.property.type === 'Identifier') return node.property.name;
    if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;
    return null;
}

function keyName(key, computed) {
    if (!key) return null;
    if (!computed && key.type === 'Identifier') return key.name;
    if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
    return null;
}

/** Every name bound to an async function anywhere in this file. */
function asyncNames(ast, walk) {
    const names = new Set();
    walk.simple(ast, {
        FunctionDeclaration(n) { if (n.async && n.id) names.add(n.id.name); },
        VariableDeclarator(n) { if (n.id.type === 'Identifier' && isAsyncFn(n.init)) names.add(n.id.name); },
        AssignmentExpression(n) { if (isAsyncFn(n.right)) { const p = memberProp(n.left); if (p) names.add(p); } },
        Property(n) { if (isAsyncFn(n.value)) { const k = keyName(n.key, n.computed); if (k) names.add(k); } },
        MethodDefinition(n) { if (n.value && n.value.async) { const k = keyName(n.key, n.computed); if (k) names.add(k); } },
        PropertyDefinition(n) { if (isAsyncFn(n.value)) { const k = keyName(n.key, n.computed); if (k) names.add(k); } },
    });
    return names;
}

// A bare call to an async function of this file, or this.f() where f is an async method of this file. (obj.f() is not
// matched: without types a method name shared with some async function elsewhere in the file, console.log beside a
// local `const log = async`, is noise.)
function ruleA(callee, asyncNamesSet) {
    if (callee.type === 'Identifier') return asyncNamesSet.has(callee.name);
    if (callee.type === 'MemberExpression' && callee.object.type === 'ThisExpression') { const p = memberProp(callee); return !!p && asyncNamesSet.has(p); }
    return false;
}

// Database handles and outboxes return promises.
function ruleB(callee, args) {
    if (callee.type === 'Identifier') return callee.name === 'fetch';
    if (callee.type !== 'MemberExpression') return false;
    const obj = callee.object;
    const objName = obj.type === 'Identifier' ? obj.name : null;
    const prop = memberProp(callee);
    if (objName === 'fsp') return true;                                                                 // fsp.*
    if (obj.type === 'MemberExpression' && obj.object.type === 'Identifier' && obj.object.name === 'fs' && memberProp(obj) === 'promises') return true; // fs.promises.*
    if (prop === 'tx') return true;                                                                      // <anything>.tx(
    if (prop === 'transaction' && args.some(isAsyncFn)) return true;                                     // .transaction(async …)
    if ((objName === 'db' || objName === 'tx') && DB_METHODS.has(prop)) return true;                     // db.run/get/all/exec/query, tx.run/get/all/exec
    if (objName === 'pool' && prop === 'query') return true;
    if (objName === 'client' && prop === 'query') return true;
    if (prop === 'enqueue') return true;                                                      // outbox enqueue
    if (prop === 'close' && CLOSE_OBJECTS.has(objName)) return true;                                       // .close() on db/pool/client/server/store
    return false;
}

const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';

function parse(source, ext, acorn) {
    const opts = { ecmaVersion: 'latest', allowHashBang: true, allowReturnOutsideFunction: true, locations: true };
    const order = ext === '.mjs' ? ['module', 'script'] : ['script', 'module'];
    let last;
    for (const sourceType of order) {
        try { return acorn.parse(source, { ...opts, sourceType }); } catch (err) { last = err; }
    }
    throw last;
}

function walkTree(dir) {
    const files = [];
    const visit = (abs) => {
        let entries;
        try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) visit(path.join(abs, e.name)); }
            else if (e.isFile() && EXTS.has(path.extname(e.name))) files.push(path.join(abs, e.name));
        }
    };
    for (const root of ROOTS) { const abs = path.join(dir, root); if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) visit(abs); }
    const apps = path.join(dir, 'apps');
    if (fs.existsSync(apps)) {
        for (const app of fs.readdirSync(apps).sort()) {
            const abs = path.join(apps, app, 'server');
            if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) visit(abs);
        }
    }
    return files;
}

const isServerPath = (rel) => { const s = rel.split(path.sep); return s[0] === 'server' || (s[0] === 'apps' && s[2] === 'server'); };

/** Scan a repository directory. → { findings, allowed, files, errors } */
function scan(dir = '.') {
    const acorn = load('acorn');
    const walk = load('acorn-walk');
    const findings = [];
    const errors = [];
    let allowed = 0;
    const files = walkTree(dir);
    for (const file of files) {
        const rel = path.relative(dir, file) || file;
        let source;
        try { source = fs.readFileSync(file, 'utf8'); } catch (err) { errors.push({ file: rel, error: err.message }); continue; }
        let ast;
        try { ast = parse(source, path.extname(file), acorn); } catch (err) { errors.push({ file: rel, error: err.message }); continue; }
        const lines = source.split('\n');
        const names = asyncNames(ast, walk);
        const server = isServerPath(rel);
        walk.fullAncestor(ast, (node, state, ancestors) => {
            if (node.type !== 'ExpressionStatement') return;
            let expr = node.expression;
            if (expr.type === 'ChainExpression') expr = expr.expression;
            if (expr.type !== 'CallExpression') return;
            const callee = expr.callee;
            const prop = memberProp(callee);
            if (prop === 'then' || prop === 'catch' || prop === 'finally') return;          // rejection is handled
            let rule = null;
            if (ruleA(callee, names)) rule = 'a';
            else if (ruleB(callee, expr.arguments)) rule = 'b';
            if (!rule) return;
            const inside = ancestors.some((a) => a !== node && isFn(a));
            if (!inside && !server) return;                                                 // top-level script: allowed to exit with the process
            const line = node.loc.start.line;
            if (OPT_OUT.test(lines[line - 1] || '') || OPT_OUT.test(lines[line - 2] || '')) { allowed++; return; }
            findings.push({ file: rel, line, column: node.loc.start.column + 1, callee: source.slice(callee.start, callee.end), rule });
        }, walk.base);
    }
    return { findings, allowed, files: files.length, errors };
}

function main(dir = '.', { json = false } = {}) {
    const { findings, allowed, errors } = scan(dir);
    if (json) {
        console.log(JSON.stringify(findings, null, 2));
    } else {
        for (const f of findings) console.log(`${f.file}:${f.line}  ${f.callee}  (rule ${f.rule})`);
        console.log(`floating promises: ${findings.length} found, ${allowed} allowed`);
        for (const e of errors) console.error(`floating-promises: could not parse ${e.file}: ${e.error}`);
    }
    return findings.length ? 1 : 0;
}

module.exports = { scan, main, walkTree, asyncNames, ruleA, ruleB, memberProp, isServerPath, OPT_OUT };

if (require.main === module || !module.parent) {
    const argv = process.argv.slice(2);
    const json = argv.includes('--json');
    const dir = argv.find((a) => !a.startsWith('-')) || '.';
    let code;
    try { code = main(dir, { json }); } catch (err) { console.error(`floating-promises: ${err.message}`); process.exit(2); }
    process.exit(code);
}
