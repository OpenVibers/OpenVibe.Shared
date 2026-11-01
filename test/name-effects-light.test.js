'use strict';
// Name effects on light themes (4.88.0): each effect was drawn on a dark page, and on white some were unreadable
// (Neon and Glitch's #00ff88 at 1.3:1, Ice at 1.6:1, Divine's white). Each has a light-theme variant of the same hue.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'items.css'), 'utf8');
const effects = [...new Set([...css.matchAll(/^\.name-fx-([a-z]+) \{/gm)].map((m) => m[1]))];
assert.ok(effects.length >= 15, `the effects (${effects.length})`);
effects.forEach((fx) => {
    assert.match(css, new RegExp(`html\\[data-theme-mode="light"\\] \\.name-fx-${fx}[ ,{]`), `${fx} has a light-theme variant`);
});
// The colour-animated ones animate their light colours, so the dark keyframes cannot bring the bright colour back.
['Fire', 'Ice', 'Neon'].forEach((k) => assert.match(css, new RegExp(`@keyframes nameFx${k}Light \\{`), `${k} has light keyframes`));
// Reduced motion still stops them all.
assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ov-fx\[class\*="name-fx-"\], \.ov-hat \{ animation: none !important; \}/);
console.log('name effects light: all checks passed');
