'use strict';
// No browser script here uses a name that nothing declares (11-28, Live's real-user errors: ov-home.js's Actor card
// threw "base is not defined" before it drew, since 4.242.0; dock.js's Chats error path called chatFoot, gone since
// 4.200.0). Every root script that loads no Node built-in is parsed, scopes are followed (params, var/let/const,
// functions, classes, catch), and a name declared nowhere up the scopes and not one of the browser's own globals
// (test/fixtures/browser-globals.json) is a failure.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const GLOBALS = new Set(require('./fixtures/browser-globals.json').names.concat(['undefined', 'NaN', 'Infinity', 'globalThis', 'module', 'exports', 'require', 'process', 'Buffer', '__dirname', '__filename', 'global', 'define']));
const NAME = '*';
const want = (name) => !GLOBALS.has(name);
const NODE = /require\(['"](fs|path|http|https|crypto|url|os|zlib|child_process|net|dns|stream|util|events|node:)/;

function declaredIn(pattern, out) {
    if (!pattern) return;
    switch (pattern.type) {
        case 'Identifier': out.add(pattern.name); break;
        case 'ObjectPattern': pattern.properties.forEach((p) => declaredIn(p.type === 'RestElement' ? p.argument : p.value, out)); break;
        case 'ArrayPattern': pattern.elements.forEach((e) => declaredIn(e, out)); break;
        case 'AssignmentPattern': declaredIn(pattern.left, out); break;
        case 'RestElement': declaredIn(pattern.argument, out); break;
        default: break;
    }
}
// Hoisting: collect every name a function (or the program) declares anywhere in its body, not inside nested functions.
function hoisted(body, out, blockOnlyTop) {
    const visit = (n, top) => {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'FunctionDeclaration') { if (n.id) out.add(n.id.name); return; }
        if (/Function/.test(n.type) || n.type === 'ClassExpression') return;
        if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => declaredIn(d.id, out));
        if (n.type === 'ClassDeclaration' && n.id) out.add(n.id.name);
        if (n.type === 'ImportDeclaration') n.specifiers.forEach((s) => out.add(s.local.name));
        for (const k of Object.keys(n)) {
            if (k === 'type' || k === 'start' || k === 'end') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach((c) => visit(c, false)); else if (v && typeof v.type === 'string') visit(v, false);
        }
    };
    (Array.isArray(body) ? body : [body]).forEach((n) => visit(n, true));
    return out;
}
function check(file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }); } catch (e) { return [`${file}: parse error ${e.message}`]; }
    const hits = [];
    const walk = (n, scopes, parent, key) => {
        if (!n || typeof n.type !== 'string') return;
        let inner = scopes;
        if (/Function/.test(n.type)) {
            const s = new Set();
            if (n.id && n.type !== 'FunctionDeclaration') s.add(n.id.name);
            n.params.forEach((p) => declaredIn(p, s));
            if (n.body && n.body.type === 'BlockStatement') hoisted(n.body.body, s);
            s.add('arguments');
            inner = scopes.concat([s]);
        } else if (n.type === 'CatchClause' && n.param) {
            const s = new Set(); declaredIn(n.param, s); inner = scopes.concat([s]);
        } else if (n.type === 'ClassExpression' && n.id) {
            inner = scopes.concat([new Set([n.id.name])]);
        }
        if (n.type === 'Identifier' && want(n.name)) {
            const isProp = parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand) || (parent.type === 'MethodDefinition' && key === 'key') || (parent.type === 'PropertyDefinition' && key === 'key'));
            const isLabel = parent && /Label|Break|Continue/.test(parent.type);
            if (!isProp && !isLabel && !inner.some((s) => s.has(n.name))) {
                const line = src.slice(0, n.start).split('\n').length;
                hits.push(`${file}:${line}: ${n.name}: ${src.split('\n')[line - 1].trim().slice(0, 120)}`);
            }
        }
        for (const k of Object.keys(n)) {
            if (k === 'type' || k === 'start' || k === 'end') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach((c) => walk(c, inner, n, k)); else if (v && typeof v.type === 'string') walk(v, inner, n, k);
        }
    };
    const top = hoisted(ast.body, new Set());
    walk(ast, [top], null, null);
    return hits;
}
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && !NODE.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
assert.ok(files.length > 100, `the browser scripts are found (${files.length})`);
const found = [...new Set(files.flatMap(check))];
assert.deepStrictEqual(found, [], `names nothing declares:\n${found.join('\n')}`);
console.log(`undeclared-names: ${files.length} browser scripts use no undeclared name`);
