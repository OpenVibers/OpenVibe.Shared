'use strict';
// scripts/fa-to-ov.js (4.231.0): a repository's Font Awesome markup becomes OpenVibe's own, and what it cannot decide
// is listed for a person, never guessed. Also glyphs.markup() and the ring icons' solids (no Font Awesome outline left).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { rewrite } = require('../scripts/fa-to-ov');
const glyphs = require('../glyphs');

const one = (s) => rewrite(s).text;

// Static markup, any attribute order, the attribute's own quote kept.
assert.strictEqual(one('<i class="fa-solid fa-eye"></i>'), '<i class="ovg-fill" data-ov-icon="eye"></i>');
assert.strictEqual(one('<i class="fa-regular fa-eye me-2" title="Watch"></i>'), '<i class="me-2" data-ov-icon="eye" title="Watch"></i>');
assert.strictEqual(one("html += '<span aria-hidden=\"true\" class=\"fa-solid fa-tower-broadcast\"></span>';"), "html += '<span aria-hidden=\"true\" class=\"ovg-fill\" data-ov-icon=\"live\"></span>';");
assert.strictEqual(one("el.innerHTML = \"<i class='fa-solid fa-xmark fa-fw'></i>\";"), "el.innerHTML = \"<i class='ovg-fill ovg-fw' data-ov-icon='close'></i>\";");
assert.strictEqual(one('<i class="fa-brands fa-github"></i>'), '<i data-ov-brand="github"></i>');
assert.strictEqual(one('<i class="fa-brands fa-x-twitter"></i>'), '<i data-ov-brand="x"></i>');
assert.strictEqual(one('<i class="fa-solid fa-spinner fa-spin"></i>'), '<i class="ovg-fill" data-ov-icon="busy"></i>');
assert.strictEqual(one('<i class="fa-solid fa-arrow-rotate-left"></i>'), '<i class="ovg-fill" data-ov-icon="undo"></i>', 'a name that drew nothing before 4.231.0');

// What it leaves for a person.
const kinds = (s) => rewrite(s).reports.map((r) => r.kind);
assert.deepStrictEqual(kinds('<i class="fa-solid fa-${name}"></i>'), ['dynamic']);
assert.deepStrictEqual(kinds('<i class="fa-solid fa-heart fa-beat"></i>'), ['manual']);
assert.deepStrictEqual(kinds('<i class="fa-solid fa-xyzzy"></i>'), ['unknown']);
assert.deepStrictEqual(kinds("btn.className = 'fa-solid fa-eye';"), ['js-class']);
assert.deepStrictEqual(kinds("links.push({ icon: 'fa-house', href: '/' });"), ['js-class']);
assert.strictEqual(rewrite('.card .fa-solid { color: red }\n.x { }', { css: true }).reports[0].kind, 'css');
assert.strictEqual(one('<i class="fa-solid fa-${name}"></i>'), '<i class="fa-solid fa-${name}"></i>', 'a dynamic class is left as it is');

// Twice changes nothing the second time; markup that is already OpenVibe's is left alone.
const once = one('<p><i class="fa-solid fa-gear"></i> Settings <span class="fa-regular fa-bell"></span></p>');
assert.strictEqual(one(once), once);
assert.ok(!/fa-/.test(once), once);
assert.strictEqual(one('<i class="note" data-ov-icon="eye"></i>'), '<i class="note" data-ov-icon="eye"></i>');
assert.strictEqual(one('<i class="italic">fa-solid is a word here</i>'), '<i class="italic">fa-solid is a word here</i>');

// glyphs.markup: OpenVibe's own markup for a server; nothing for a name the glyphs do not have.
assert.strictEqual(glyphs.markup('live'), '<i data-ov-icon="live" aria-hidden="true"></i>');
assert.strictEqual(glyphs.markup('live', { title: 'Live now', cls: 'ovg-lg' }), '<i data-ov-icon="live" class="ovg-lg" title="Live now"></i>');
assert.strictEqual(glyphs.markup('no-such-glyph'), '');

// No Font Awesome outline is left in what Shared ships: the ring icons' solids are glyph solids, the bar's set is the
// glyphs, and the generator that read Font Awesome's font is gone.
const ROOT = path.join(__dirname, '..');
const ovIcons = fs.readFileSync(path.join(ROOT, 'ov-icons.js'), 'utf8');
assert.ok(!/Font Awesome/i.test(ovIcons), 'ov-icons.js names no Font Awesome drawing');
assert.ok(!/scale\(0\.04688\)/.test(ovIcons), 'no 512-grid solid is scaled into the ring');
const navIcons = require('../nav-icons.js');
for (const [name, entry] of Object.entries(navIcons)) assert.strictEqual(entry[0], 0, `${name} is an OpenVibe glyph`);
assert.ok(!fs.existsSync(path.join(ROOT, 'scripts', 'build-nav-icons.py')), 'the generator that read fa-solid-900.woff2 is gone');
assert.ok(!/fontawesome|font-awesome/i.test(fs.readFileSync(path.join(ROOT, 'navbar.js'), 'utf8')), 'navbar.js loads nothing of Font Awesome');

console.log('fa-to-ov: static markup becomes data-ov-icon / data-ov-brand (quotes kept, twice is once); dynamic, manual, unknown, JS classes and CSS rules are listed; glyphs.markup; no Font Awesome outline left in ov-icons.js or the bar');
