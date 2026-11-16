'use strict';
// Every product has its glyph (4.286.0; the owner, 11-16, openvibe.space's "Make a space" and "Browse spaces": "the icons
// still suck, or are way too tiny, or have that stupid looking border instead of a customized look"). A button or a
// heading that names a product (ov:space) draws that glyph plainly at its size, never the product's ringed mark shrunk
// into a badge.
const assert = require('assert');
const ovIcons = require('../ov-icons');
const glyphs = require('../glyphs');
const showcase = require('../showcase');

const products = typeof ovIcons.names === 'function' ? ovIcons.names() : ovIcons.names;
assert.ok(products.length > 50, 'the product marks are listed');
const without = products.filter((k) => !glyphs.forApp(k));
assert.deepStrictEqual(without, [], `products with no glyph: ${without.join(' ')}`);
for (const [k, g] of Object.entries(glyphs.APP_GLYPH)) assert.ok(glyphs.path(g), `APP_GLYPH.${k} names a glyph that exists (${g})`);
assert.strictEqual(glyphs.forApp('ov:space'), 'cubes');
assert.strictEqual(glyphs.forApp('calendar'), 'calendar', 'a glyph name is itself');
assert.strictEqual(glyphs.forApp('no-such-thing'), null);

// Space's hero, as Space draws it: the two buttons carry plain 20 px glyphs and no ring.
const html = showcase.hero({ title: 'Make a space.', actions: [
    { label: 'Make a space', href: '/spaces/new', primary: true, icon: 'ov:ai' },
    { label: 'Browse spaces', href: '/spaces', icon: 'ov:space' },
] });
const buttons = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
const two = buttons.filter((b) => /Make a space|Browse spaces/.test(b));
assert.strictEqual(two.length, 2, 'both buttons are drawn');
for (const b of two) {
    assert.ok(/class="sc-bi"/.test(b), `a plain button glyph: ${b.slice(0, 160)}`);
    assert.ok(!/sc-ovi/.test(b), 'no ringed product mark in a button');
    assert.ok(/width="20"/.test(b), 'at 20 px');
}
console.log('app-glyphs: every product has its glyph; hero buttons draw it plainly');
