'use strict';
// kit.mark's letters are white on hsl(hue S L). Every hue (a name's hash picks it) must keep them at WCAG AA, 4.5:1.
// At 38% lightness greens and yellows were 3.5-4.2:1 (axe on Community, Report, Tours, Shoes and Bot, 2026-11-01).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
const m = /\.ovk-mark \{[^}]*background: hsl\(var\(--ovk-hue, \d+\) (\d+)% (\d+)%\); color: #fff;/.exec(css);
assert.ok(m, '.ovk-mark is white on hsl(hue S% L%)');
const S = Number(m[1]) / 100, L = Number(m[2]) / 100;

function hsl(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), k = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r + k, g + k, b + k];
}
const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
let worst = { ratio: Infinity, hue: -1 };
Array.from({ length: 360 }, (_, h) => h).forEach((h) => {
    const ratio = 1.05 / (lum(hsl(h, S, L)) + 0.05);
    if (ratio < worst.ratio) worst = { ratio, hue: h };
});
assert.ok(worst.ratio >= 4.5, `white on hue ${worst.hue} is ${worst.ratio.toFixed(2)}:1`);
console.log(`kit mark contrast: all checks passed (worst ${worst.ratio.toFixed(2)}:1 at hue ${worst.hue})`);
