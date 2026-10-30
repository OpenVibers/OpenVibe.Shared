'use strict';
// A touch hit area must stay on its own button (4.47.3). The 4.46.0 touch targets give the burger, the orb, Sign In and
// the mark an invisible ::after that reaches 44px to a finger, and set the button position: relative so the ::after
// sits on it. The burger's own rule ({ all: unset; … }) came later at the same specificity and reset its position to
// static, so its ::after was placed against the whole navbar: on a phone, a tap on the logo, the name or the orb opened
// the menu instead (openvibe.network, 2026-10-30). Every element that gets such a hit area keeps position: relative in
// its own all: unset rule.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
const hits = [...src.matchAll(/([.#][\w-]+(?:\s+[.#][\w-]+)*)::after \{ content: ''; position: absolute;/g)].map((m) => m[1].trim());
assert.ok(hits.length >= 4, `the touch hit areas are found (${hits.join(', ')})`);
for (const sel of hits) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const own = new RegExp(`(?:^|\\n)\\s*${esc} \\{ all: unset;[^}]*\\}`).exec(src);
    if (own) assert.ok(/position: relative/.test(own[0]), `${sel}: its all: unset rule keeps position: relative, or its hit area escapes it`);
}
const burger = /\.openvibe-navbar \.ovnav-burger \{ all: unset;[^}]*\}/.exec(src);
assert.ok(burger && /position: relative/.test(burger[0]), 'the burger keeps its own position');
console.log('navbar-hit-areas: all checks passed');
