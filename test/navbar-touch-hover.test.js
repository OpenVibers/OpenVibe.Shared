'use strict';
// On a phone a tap leaves :hover on whatever it touched, so the launcher showed two lit rows: the site you are on and
// the last one your finger crossed (the owner, 2026-10-25, on openre.stream). The OpenVibe menu's rows (search.js since
// 4.23.0) and the drawer's light on hover only where a pointer really hovers; the site you are on (is-here, active),
// the keyboard's row and focus stay lit everywhere. On phones a site's description is one line, so the list is short.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const hoverOnly = (src) => [...src.matchAll(/@media \(hover: hover\) \{([^\n]*)\}/g)].map((m) => m[1]).join('\n');
const outsideOf = (src) => src.replace(/@media \(hover: hover\) \{[^\n]*\}/g, '');
const nav = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const menu = fs.readFileSync(path.join(__dirname, '..', 'search.js'), 'utf8');

assert.ok(/\.ovs-item a:hover, \.ovs-chip:hover, \.ovs-tile:hover/.test(hoverOnly(menu)), 'menu rows, chips and tiles light on hover only where hover exists');
assert.ok(!/\.ovs-(item a|chip|tile|tab|x):hover/.test(outsideOf(menu)), 'no menu hover rule outside (hover: hover)');
assert.ok(/\.ovs-tile\.is-here \{[^}]*background/.test(outsideOf(menu)) && /\.ovs-opt\.is-active, \.ovs-opt:focus-visible \{[^}]*background/.test(outsideOf(menu)), 'the site you are on, the keyboard\'s row and focus are lit on every device');
assert.ok(/@media \(max-width: 640px\) \{[\s\S]*?\.ovs-tile small \{ -webkit-line-clamp: 1; \}/.test(menu), 'one-line descriptions on phones');
assert.ok(/\.ovnav-drawer a:hover/.test(hoverOnly(nav)), 'drawer links too');
assert.ok(!/\.ovnav-drawer a:hover/.test(outsideOf(nav)), 'no drawer hover rule outside (hover: hover)');
console.log('navbar-touch-hover: ok');
