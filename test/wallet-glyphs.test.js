'use strict';
// The wallet sheet draws the network's glyphs, not marks of its own (Shared 4.221.0; the owner, 11-12: "nice looking
// icons"): every mark in its set is the registry's drawing of the same name, so a
// glyph redrawn on openvibe.design/icons is redrawn here when the file is rebuilt, and this test says which is stale.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const glyphs = require('../glyphs');

const src = fs.readFileSync(path.join(__dirname, '..', 'ov-wallet.js'), 'utf8');
// A document just real enough for the file to define itself.
const sandbox = { document: { createElement: () => ({}), currentScript: null, getElementById: () => null }, console };
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'ov-wallet.js' });
const set = sandbox.OpenVibeWallet && sandbox.OpenVibeWallet.GLYPHS;
assert.ok(set && typeof set === 'object', 'ov-wallet.js exposes its marks as OpenVibeWallet.GLYPHS');
const names = Object.keys(set);
assert.ok(names.length >= 7, `the sheet's marks (${names.length})`);
names.forEach((name) => {
    assert.ok(glyphs.path(name), `${name} is a glyph in the registry (openvibe-shared/glyphs)`);
    assert.strictEqual(set[name], glyphs.path(name), `${name} is drawn as the registry draws it`);
});
// Every mark the file draws (glyph('…'), empty('…'), a section's mark) is in the set (a typo would draw nothing).
const used = [...new Set([...src.matchAll(/\b(?:glyph|empty)\('([a-z]+)'/g), ...src.matchAll(/\bsection\('[^']*', '[^']*', '([a-z]+)'/g)].map((m) => m[1]))];
assert.ok(used.length >= 6, `the sheet's marks in use (${used.length})`);
used.forEach((name) => assert.ok(names.includes(name), `glyph('${name}') is in the set`));
console.log(`wallet-glyphs: ${names.length} marks, all the registry's; ${used.length} used`);
