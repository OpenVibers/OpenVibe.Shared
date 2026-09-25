'use strict';
// The navbar's Sign In button (navbar.js .openvibe-navbar-login) is --on-accent-strong on --accent-strong:
// that pair must read at 4.5:1 or better (WCAG AA, normal text) in every built-in theme. An axe survey
// found white on the accent (#3b82f6) at 3.67:1 on nine sites (roadmap WS-T task 3).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { BUILTIN_THEMES } = require('../builtin-themes');

const lum = (hex) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const css = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
assert.match(css, /\.openvibe-navbar-login \{[^}]*background: var\(--accent-strong, #1d4ed8\); color: var\(--on-accent-strong, #fff\)/, 'the button uses --accent-strong and --on-accent-strong');
const low = [];
for (const t of BUILTIN_THEMES) {
    const bg = t.variables['--accent-strong'], fg = t.variables['--on-accent-strong'];
    assert.ok(/^#[0-9a-f]{6}$/i.test(bg || '') && /^#[0-9a-f]{6}$/i.test(fg || ''), `${t.id} derives the pair`);
    const r = ratio(bg, fg);
    if (r < 4.5) low.push(`${t.id}: ${fg} on ${bg} = ${r.toFixed(2)}`);
}
assert.deepStrictEqual(low, [], 'every built-in theme reads at 4.5:1');
assert.ok(ratio('#1d4ed8', '#ffffff') >= 4.5, 'and the fallback');
console.log(`login contrast: ${BUILTIN_THEMES.length} themes at 4.5:1 or better`);
