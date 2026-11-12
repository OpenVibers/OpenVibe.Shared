'use strict';
// The Dock's Vibe tab draws the network's glyphs, not marks of its own (Shared 4.220.0; the owner, 11-12: "actually has
// icons for everything using OpenVibe.design"): every mark in its set is the registry's drawing of the same name, so a
// glyph redrawn on openvibe.design/icons is redrawn here when the file is rebuilt, and this test says which is stale.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const glyphs = require('../glyphs');

const src = fs.readFileSync(path.join(__dirname, '..', 'dock-vibe.js'), 'utf8');
// A document just real enough for the file to define itself.
const sandbox = { document: { createElement: () => ({}), currentScript: null, getElementById: () => null }, console };
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'dock-vibe.js' });
const set = sandbox.OpenVibeDockVibe && sandbox.OpenVibeDockVibe.GLYPHS;
assert.ok(set && typeof set === 'object', 'dock-vibe.js exposes its marks as OpenVibeDockVibe.GLYPHS');
const names = Object.keys(set);
assert.ok(names.length >= 12, `the panel's marks (${names.length})`);
names.forEach((name) => {
    assert.ok(glyphs.path(name), `${name} is a glyph in the registry (openvibe-shared/glyphs)`);
    assert.strictEqual(set[name], glyphs.path(name), `${name} is drawn as the registry draws it`);
});
// Every V.<name> the file uses is in the set (a typo would draw nothing).
const used = [...new Set([...src.matchAll(/\bV\.([a-z]+)\b/g)].map((m) => m[1]))];
used.forEach((name) => assert.ok(names.includes(name), `V.${name} is in the set`));
// Each starter's mark too.
const starters = [...src.matchAll(/\['([a-z]+)', '[^']+'\]/g)].map((m) => m[1]);
assert.ok(starters.length >= 4, 'the starters');
starters.forEach((name) => assert.ok(names.includes(name), `the starter mark ${name} is in the set`));
console.log(`dock-vibe-glyphs: ${names.length} marks, all the registry's; ${used.length} used, ${starters.length} starters`);
