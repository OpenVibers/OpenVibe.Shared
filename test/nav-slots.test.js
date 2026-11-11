'use strict';
// nav-slots.js: a site's own buttons in the bar. 347 (the owner: "especially the left sidebar button … make it kind of
// match the right side"): the lead button has the menu button's size and corner, and draws its icon with the same
// stroke; a painted lead button sits first in the brand, before the one brand button.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const navbar = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const orb = navbar.match(/\.openvibe-navbar \.ovnav-orb \{ all: unset;[^}]*\}/);
assert.ok(orb, 'the menu button has its rule in navbar.js');
const px = (rule, prop) => { const m = rule.match(new RegExp(`(?:^|[;{ ])${prop}: (\\d+)px`)); return m ? Number(m[1]) : null; };

const styles = [];
const inserted = [];
const brand = { insertAdjacentHTML: (where, html) => inserted.push([where, html]) };
const nav = {
    querySelector: (s) => (s === '.openvibe-navbar-brand' ? brand : null),
    querySelectorAll: () => [],
    addEventListener: () => {},
};
const document = {
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild: (el) => styles.push(el) },
};
const sandbox = { document, console };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'nav-slots.js'), 'utf8'), sandbox);

sandbox.OpenVibeNavSlots.paint(nav, { icon: 'sidebar', label: 'Sidebar' }, new Map());
assert.equal(styles.length, 1, 'the slot styles go in once');
const css = styles[0].textContent;
const slot = css.match(/\.openvibe-navbar \.ovnav-slot \{ all: unset;[^}]*\}/)[0];
for (const prop of ['width', 'height', 'border-radius']) {
    assert.equal(px(slot, prop), px(orb[0], prop), `the lead button's ${prop} is the menu button's`);
}
assert.match(css, /\.ovnav-slot svg \{ width: 21px; height: 21px; \}/, 'the icon fills the button the way the menu glyph does');
assert.equal(inserted.length, 1);
assert.equal(inserted[0][0], 'afterbegin', 'the lead button comes first, before the brand button');
assert.match(inserted[0][1], /<button type="button" class="ovnav-slot ovnav-lead" id="ovnav-lead" aria-label="Sidebar"/);
assert.match(inserted[0][1], /stroke-width="2"/, 'the same stroke as the bar\'s other glyphs');
console.log('nav-slots: the lead button matches the menu button (size, corner, stroke) and comes first');
