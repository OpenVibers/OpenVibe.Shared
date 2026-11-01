'use strict';
// Two colours that carried text below WCAG AA (axe on the homes, 2026-11-01):
// - a room's text colour (--room-strong) was its bare accent: 3.9-4.4:1 on the room's tinted chips (Bench, Exchange).
//   It now mixes a quarter of the theme's text in, which moves it toward contrast in either mode.
// - LIVE badges were white on the theme's live red: 3.8:1 on #ef4444. The fill is now that red at 80% over black.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const room = fs.readFileSync(path.join(__dirname, '..', 'room.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const strong = [...room.matchAll(/--room-strong: ([^;]+);/g)].map((m) => m[1]);
assert.strictEqual(strong.length, 3, 'the default room, a dark-mode room and a light-mode room');
strong.forEach((v) => assert.match(v, /^color-mix\(in srgb, var\(--(ovk-accent|room-dark|room-light)\) 75%, var\(--ovk-text\)\)$/, v));

const kit = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
assert.match(kit, /--ovk-live: color-mix\(in srgb, var\(--live-red, #ef4444\) 80%, #000\);/);
assert.match(kit, /\.ovk-badge--live \{ color: #fff; background: var\(--ovk-live\);/);
const showcase = fs.readFileSync(path.join(__dirname, '..', 'showcase.css'), 'utf8');
assert.match(showcase, /\.sc-badge\.sc-live\{background:color-mix\(in srgb,var\(--live-red,#ef4444\) 80%,#000\)\}/);

// The fill keeps white at 4.5:1 for the built-in themes' reds (Catppuccin's pastel pink aside).
const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const ratio = (hex, k) => {
    const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) * k);
    return 1.05 / (0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) + 0.05);
};
const themes = fs.readFileSync(path.join(__dirname, '..', 'builtin-themes.js'), 'utf8');
const reds = [...new Set([...themes.matchAll(/'--live-red': '(#[0-9a-f]{6})'/gi)].map((m) => m[1].toLowerCase()))];
assert.ok(reds.length >= 3, 'the themes set --live-red');
reds.filter((c) => c !== '#f38ba8').forEach((c) => assert.ok(ratio(c, 0.8) >= 4.5, `${c} at 80%: ${ratio(c, 0.8).toFixed(2)}:1`));
console.log('room text and live badge: all checks passed');
