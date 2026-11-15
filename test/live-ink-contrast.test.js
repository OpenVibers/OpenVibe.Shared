'use strict';
// White text on the live red (the browser check, 11-15: the feed's LIVE chip on Community at 3.8:1): every badge, count
// and chip that puts white text on --live / --live-red uses the red a fifth darker, about 5.4:1 for #ef4444. A ratchet:
// a new white-on-live-red rule fails here.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = fs.readdirSync(root).filter((f) => /\.(js|css)$/.test(f));
const bare = /background:\s?var\(--live(?:-red)?,\s?#[0-9a-fA-F]{6}\);[^}]{0,60}?color:\s?#fff/;
const offenders = files.filter((f) => bare.test(fs.readFileSync(path.join(root, f), 'utf8')));
assert.deepStrictEqual(offenders, [], 'white text sits on the plain live red here: use color-mix(in srgb, var(--live-red, #ef4444), #000 20%)');
// The arithmetic: #ef4444 a fifth toward black (sRGB mix), against white.
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
for (const hex of ['#ef4444', '#e5484d', '#e11d48']) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * 0.8);
    const r = 1.05 / (lum(c) + 0.05);
    assert.ok(r >= 4.5, `${hex} darkened reads at ${r.toFixed(2)}:1`);
}
console.log('live-ink-contrast: white text on the live red reads at 4.5:1 or more everywhere');
