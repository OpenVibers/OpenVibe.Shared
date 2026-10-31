'use strict';
// navbar.js loads ov-mark.js, ov-glyphs.js and the brand face from beside itself by content hash (4.61.0): a release
// gives each a new URL, so no edge serves the copy it cached before the deploy (the old mark showed some minutes after
// 4.59.0). The constant must match the files: node scripts/sibling-revs.js rewrites it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { revs, line } = require('../scripts/sibling-revs');

const src = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
assert.ok(src.includes(line(revs())), 'SIBLING_REV is current: run node scripts/sibling-revs.js');
assert.ok(/const siblingV = \(name\) => `\$\{sibling\(name\)\}\$\{SIBLING_REV\[name\] \? `\?v=\$\{SIBLING_REV\[name\]\}` : ''\}`;/.test(src), 'siblingV adds the hash');
assert.ok(src.includes("sc.src = siblingV('ov-mark.js')") && src.includes("url(${siblingV('ov-brand.woff2')})") && src.includes("sc.src = siblingV('ov-glyphs.js')"), 'the mark, the face and the glyphs load by hash');
assert.ok(/_config\.glyphs !== false[^\n]*i\[class\*="fa-"\]/.test(src), 'the glyphs load where Font Awesome is used, unless a site says glyphs: false');
console.log('sibling revs: the navbar loads the mark, the glyphs and the brand face by content hash');
