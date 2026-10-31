'use strict';
// The glyphs as fonts (4.62.0, plan L32 I5): built by scripts/build-glyph-fonts.py from glyphs.js. The fonts are
// current (the manifest names exactly what they were drawn from), every glyph has its own code point in the Private
// Use Area that never changes, the CSS names every glyph and every Font Awesome name, and sites serve the web font,
// both style sheets and the sprite.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');
const files = require('../files');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const cps = JSON.parse(read('glyph-codepoints.json')).glyphs;
const manifest = JSON.parse(read('glyph-fonts/manifest.json'));

// Every glyph has a code point; none is shared; all sit in the Private Use Area from U+E001.
for (const n of glyphs.NAMES) assert.ok(/^[0-9A-F]{4}$/.test(cps[n] || ''), `${n} has a code point`);
const values = Object.values(cps);
assert.strictEqual(new Set(values).size, values.length, 'no code point is given twice');
values.forEach((v) => assert.ok(parseInt(v, 16) >= 0xE001 && parseInt(v, 16) <= 0xF8FF, `U+${v} is in the Private Use Area`));

// The fonts were built from today's registry (run scripts/build-glyph-fonts.py after a glyph changes).
const source = JSON.stringify(glyphs.NAMES.map((n) => [n, glyphs.path(n), cps[n]]));
assert.strictEqual(manifest.source_sha256, crypto.createHash('sha256').update(source).digest('hex'), 'the fonts are current: run scripts/build-glyph-fonts.py');
assert.strictEqual(manifest.glyphs, glyphs.NAMES.length);
for (const [f, size] of Object.entries(manifest.files)) assert.strictEqual(read(f).length, size, `${f} is the file the build wrote`);
assert.strictEqual(read('ov-glyphs.woff2').subarray(0, 4).toString('latin1'), 'wOF2', 'a WOFF2 file');
assert.strictEqual(read('glyph-fonts/ov-glyphs.ttf').readUInt32BE(0), 0x00010000, 'a TrueType file');
assert.strictEqual(read('glyph-fonts/ov-glyphs.otf').subarray(0, 4).toString('latin1'), 'OTTO', 'an OpenType (CFF) file');

// The style sheets.
const font = read('ov-glyphs-font.css').toString();
assert.ok(font.includes("@font-face{font-family:'OV Glyphs';src:url(ov-glyphs.woff2) format('woff2')"));
for (const n of glyphs.NAMES) assert.ok(font.includes(`.ovi-${n}::before{content:"\\${cps[n].toLowerCase()}"}`), `.ovi-${n}`);
const fa = read('ov-glyphs-fa.css').toString();
for (const [name, g] of Object.entries(glyphs.FA)) assert.ok(fa.includes(`.fa-${name}::before{content:"\\${cps[g].toLowerCase()}"}`), `.fa-${name} → ${g}`);
assert.ok(!/fa-brands|\.fab\b/.test(fa), 'brand logos stay Font Awesome Brands');

// Sites serve them.
for (const f of ['ov-glyphs.woff2', 'ov-glyphs-font.css', 'ov-glyphs-fa.css', 'ov-glyphs.svg']) assert.ok(files.isBrowserFile(f), `/shared/${f}`);
assert.ok(files.FONTS.includes('ov-glyphs.woff2') && files.IMAGES.includes('ov-glyphs.svg'));

console.log(`glyph fonts: ${glyphs.NAMES.length} glyphs at U+${values.reduce((a, b) => (a < b ? a : b))}–U+${values.reduce((a, b) => (a > b ? a : b))}; WOFF2, TTF and OTF current; both style sheets; served`);
