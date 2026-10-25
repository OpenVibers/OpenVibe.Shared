'use strict';
// On a phone a tap leaves :hover on whatever it touched, so the launcher showed two lit rows: the site you are on and
// the last one your finger crossed (the owner, 2026-10-25, on openre.stream). The launcher's and the drawer's hover
// backgrounds apply only where a pointer really hovers; the site you are on (is-here, active) and keyboard focus
// stay lit everywhere. On phones a launcher row's description is one line, so the list is short and scannable.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const hoverBlocks = [...src.matchAll(/@media \(hover: hover\) \{([^\n]*)\}/g)].map((m) => m[1]).join('\n');
const outside = src.replace(/@media \(hover: hover\) \{[^\n]*\}/g, '');

assert.ok(/\.ovnav-launcher :is\(\.ovl-app, \.ovl-fam\):hover/.test(hoverBlocks), 'launcher rows light on hover only where hover exists');
assert.ok(/\.ovnav-drawer a:hover/.test(hoverBlocks), 'drawer links too');
assert.ok(!/\.ovl-(app|fam):hover|:is\(\.ovl-app, \.ovl-fam\):hover/.test(outside), 'no launcher hover rule outside (hover: hover)');
assert.ok(!/\.ovnav-drawer a:hover/.test(outside), 'no drawer hover rule outside (hover: hover)');
assert.ok(/\.ovnav-launcher \.ovl-app\.is-here \{[^}]*background/.test(outside) && /\.ovnav-launcher a:focus-visible \{[^}]*background/.test(outside), 'the site you are on and keyboard focus are lit on every device');
assert.ok(/@media \(max-width: 480px\) \{[^\n]*\.ovnav-launcher \.ovl-app small \{ -webkit-line-clamp: 1; \}/.test(src), 'one-line descriptions on phones');
console.log('navbar-touch-hover: ok');
