'use strict';
// data-theme carries the theme's own id (vibe, cloud, daylight …); whether it is light or dark is data-theme-mode
// (theme-loader.js applyVars). 11-18: 13 rules in 7 files tested data-theme="light", which no theme ever sets, so the
// menu's, the home's, the kit's and the run thread's light-theme colours never applied on any light theme. A selector on
// data-theme="light" or "dark" fails here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bad = [];
for (const name of fs.readdirSync(ROOT).filter((n) => /\.(js|css)$/.test(n)).sort()) {
    const src = fs.readFileSync(path.join(ROOT, name), 'utf8');
    src.split('\n').forEach((line, i) => { if (/\[data-theme=["'](light|dark)["']\]/.test(line)) bad.push(`${name}:${i + 1}`); });
}
assert.deepStrictEqual(bad, [], 'use [data-theme-mode="light"] / [data-theme-mode="dark"]: data-theme is the theme id');
console.log('theme-mode selectors: all checks passed');
