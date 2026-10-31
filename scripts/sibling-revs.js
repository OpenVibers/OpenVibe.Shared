#!/usr/bin/env node
'use strict';
// Writes navbar.js's SIBLING_REV: the content hash (openvibe-shared/assets hashAsset) of each file the navbar loads from
// beside itself, so a release gives each a new URL (?v=) that sites serve as immutable, and nobody is left on a copy an
// edge cached before the deploy (the Pair's first hour, 2026-10-31). Re-run after any of them changes:
// node scripts/sibling-revs.js (test/sibling-revs.test.js checks the constant is current).
const fs = require('fs');
const path = require('path');
const { hashAsset } = require('../assets');

const ROOT = path.join(__dirname, '..');
const FILES = ['ov-mark.js', 'ov-glyphs.js', 'ov-brand.woff2'];
const revs = () => Object.fromEntries(FILES.map((f) => [f, hashAsset(fs.readFileSync(path.join(ROOT, f)))]));
const line = (r) => `    const SIBLING_REV = { ${FILES.map((f) => `'${f}': '${r[f]}'`).join(', ')} };`;

if (require.main === module) {
    const p = path.join(ROOT, 'navbar.js');
    const src = fs.readFileSync(p, 'utf8');
    const next = src.replace(/^ {4}const SIBLING_REV = \{[^\n]*\};$/m, line(revs()));
    if (next === src && !src.includes(line(revs()))) throw new Error('navbar.js has no SIBLING_REV line to update');
    fs.writeFileSync(p, next);
    console.log(line(revs()).trim());
}
module.exports = { FILES, revs, line };
