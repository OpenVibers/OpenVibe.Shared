#!/usr/bin/env node
'use strict';
// Writes the kit's copy of the glyphs it does not draw itself into kit.js (plan L32 I1): kit.icon(name) has to draw
// every glyph NAME, and kit.js is a plain browser script (no require), so the drawings glyphs.js adds travel with it.
// The block between the generated markers is replaced; everything else in kit.js is left alone. Re-run after a glyph
// is added or redrawn (test/glyphs.test.js checks the block is current):
//
//   node scripts/build-kit-glyphs.js
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');

const FILE = path.join(__dirname, '..', 'kit.js');
const START = '    // <generated:kit-glyphs>';
const END = '    // </generated:kit-glyphs>';
const QUOTE = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function body() {
    // DRAWN is every drawing glyphs.js adds beside the kit's own, in registry order. A drawing identical to the kit's
    // is not repeated; one that differs (eye-off) travels too, so kit.icon draws exactly what glyphs.path returns.
    const own = require('../kit').KIT_PATHS;
    const rows = glyphs.DRAWN.map((name) => [name, glyphs.path(name)]).filter(([name, d]) => d && own[name] !== d);
    return [
        '    const MORE = Object.freeze({',
        ...rows.map(([name, d]) => `        ${/^[a-z]+$/.test(name) ? name : QUOTE(name)}: ${QUOTE(d)},`),
        '    });',
    ].join('\n');
}

function build(src = fs.readFileSync(FILE, 'utf8')) {
    const at = src.indexOf(START);
    const end = src.indexOf(END);
    if (at < 0 || end < 0 || end < at) throw new Error('kit.js: the generated glyph markers were not found');
    return `${src.slice(0, at + START.length)}\n${body()}\n${src.slice(end)}`;
}

if (require.main === module) {
    const before = fs.readFileSync(FILE, 'utf8');
    const after = build(before);
    if (after === before) console.log(`kit glyphs: current (${glyphs.DRAWN.length} glyphs from glyphs.js)`);
    else { fs.writeFileSync(FILE, after); console.log(`kit glyphs: wrote ${glyphs.DRAWN.length} drawings into kit.js`); }
}

module.exports = { build, body, START, END };
