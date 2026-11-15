'use strict';
/**
 * A box that scrolls sideways says what it does up and down (4.259.0; the owner, 11-15, on the composer's mic and +
 * cut off after a swipe: "update openvibe.design so this doesn't happen ever again").
 *
 * CSS turns `overflow-y: visible` into `auto` beside `overflow-x: auto | scroll`, so a row of buttons, chips or tabs
 * that scrolls sideways also scrolls up and down the moment anything in it is a pixel taller than the row (a focus
 * ring, a pressed button's scale, a hidden file input): a swipe then slides the buttons half out of view. Every rule in
 * the library that sets overflow-x to auto or scroll therefore sets overflow-y in the same rule: `hidden` for a row of
 * controls, `auto` for content a site may cap in height (code, tables). openvibe.design/rules carries the rule.
 *
 *   node test/scroll-axis.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'test', 'dist', 'vendor']);
const files = [];
(function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(js|css|mjs)$/.test(name) && st.size < 3e6) files.push(p);
    }
})(ROOT);

const bad = [];
let sideways = 0;
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rule = /([^{}]*)\{([^{}]*)\}/g;
    let m;
    while ((m = rule.exec(src))) {
        const body = m[2];
        if (!/overflow-x\s*:\s*(auto|scroll)/.test(body)) continue;
        sideways++;
        if (!/overflow-y\s*:\s*(hidden|clip|auto|scroll)/.test(body)) {
            bad.push(`${path.relative(ROOT, file)}: ${m[1].trim().split('\n').pop().slice(-70)} { … overflow-x without overflow-y }`);
        }
    }
}
assert.ok(sideways >= 40, `the scan sees the library's sideways scrollers (${sideways})`);
assert.deepStrictEqual(bad, [], `a sideways scroller must say overflow-y (hidden for a row of controls, auto for content):\n${bad.join('\n')}`);

// The composer's tools row, where the owner saw it: sideways only.
const composer = fs.readFileSync(path.join(ROOT, 'ov-composer.js'), 'utf8');
assert.match(composer, /\.ovc-v2 \.ovt-c-tools \{[^}]*overflow-x: auto; overflow-y: hidden;/, 'the mic and + row never scrolls up and down');

console.log(`scroll axis: ${sideways} sideways scrollers, each says what it does up and down`);
console.log('all passed');
