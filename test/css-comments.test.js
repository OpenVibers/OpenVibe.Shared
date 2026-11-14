'use strict';
// Every stylesheet's comments are closed (4.249.0). player.css carried an open "/* Phones (ask 288)" from 4.201.0 to
// 4.248.0: the browser read the rest of the file as a comment, so the phone rules never applied on any site and the
// fullscreen button ran off a phone's edge. Strings are skipped, so a content: '/*' is not a comment.
//   node test/css-comments.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.css')) files.push(p);
    }
})(ROOT);

/** The line an unclosed comment opens on, or 0 when every comment closes. */
function openComment(css) {
    let i = 0;
    let quote = '';
    while (i < css.length) {
        const c = css[i];
        if (quote) {
            if (c === '\\') { i += 2; continue; }
            if (c === quote) quote = '';
            i += 1;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; i += 1; continue; }
        if (c === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            if (end < 0) return css.slice(0, i).split('\n').length;
            i = end + 2;
            continue;
        }
        i += 1;
    }
    return 0;
}

assert.ok(files.length > 20, `found ${files.length} stylesheets`);
const bad = files.map((f) => [path.relative(ROOT, f), openComment(fs.readFileSync(f, 'utf8'))]).filter(([, line]) => line);
assert.deepStrictEqual(bad.map(([f, line]) => `${f}:${line}`), [], 'a comment opened here is never closed: the rest of the file is dead');
assert.strictEqual(openComment('a { b: c } /* open'), 1);
assert.strictEqual(openComment("a::after { content: '/*'; }"), 0);
console.log(`css-comments: ${files.length} stylesheets, every comment closed`);
