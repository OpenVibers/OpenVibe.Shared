'use strict';
// Light and dark halves (builtin-themes.js PAIRS, theme-loader.js Light, dark and Auto): every theme has a counterpart of
// the other mode, the loader's copy knows them, the Light / Dark switch saves the other half (the default's for a theme
// without one) and keeps the season, Auto paints the half the device asks for, and a season stands in for the default
// theme in either mode (Midnight Pumpkin in dark, Hayride in light). theme-loader.js runs in a small fake browser.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BUILTIN_THEMES, PAIRS, SEASONS } = require('../builtin-themes');

const by = Object.fromEntries(BUILTIN_THEMES.map((t) => [t.id, t]));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');

// 1. The catalog: every theme has a counterpart of the other mode, both ways; 25 of each.
for (const t of BUILTIN_THEMES) {
    const p = by[t.pair];
    assert.ok(p, `${t.id} has no light or dark half`);
    assert.notStrictEqual(p.mode, t.mode, `${t.id} and ${p.id} are both ${t.mode}`);
    assert.strictEqual(p.pair, t.id, `${t.id} ↔ ${p.id} is not mutual`);
}
assert.strictEqual(BUILTIN_THEMES.filter((t) => t.mode === 'light').length, BUILTIN_THEMES.filter((t) => t.mode !== 'light').length);
assert.strictEqual(PAIRS.length * 2, BUILTIN_THEMES.length);
assert.deepStrictEqual(SEASONS.map((s) => [s.id, s.theme, s.light]), [['halloween', 'halloween', 'hayride'], ['winter', 'frost', 'snowfall']]);
assert.strictEqual(by.halloween.name, 'Midnight Pumpkin');
assert.strictEqual(by.cloud.name, 'Vibe Light', 'the default has a light half by name');
assert.strictEqual(by.vibe.pair, 'cloud');

/** A page load on `day` with the device in dark (or light) mode. → { L, html, puts, store } */
function load(day, store = new Map(), { dark = true } = {}) {
    const [y, m, d] = day.split('-').map(Number);
    const fixed = new Date(y, m - 1, d, 12).getTime();
    class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
    const attrs = new Map(); const props = new Map(); const puts = [];
    const html = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) }, setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k), props };
    const sandbox = {
        Date: FixedDate, JSON, Object, String, Number, Math, Array, Promise, Error, URL, setTimeout() {}, clearTimeout() {},
        document: { documentElement: html, readyState: 'complete', cookie: '', head: null, querySelector: () => null, getElementById: () => null, referrer: '', visibilityState: 'visible', addEventListener() {} },
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
        location: { hostname: 'openvibe.live', protocol: 'https:' },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        matchMedia: (q) => ({ matches: /dark/.test(q) ? dark : false, addEventListener() {} }),
        fetch: (url, o) => { if (o && o.method === 'PUT') puts.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: false, json: () => Promise.resolve(null) }); },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener() {}, dispatchEvent() {},
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    return { L: sandbox.OpenVibeThemeLoader, html, puts, store };
}
const painted = (p) => p.html.getAttribute('data-theme');
const picked = (id) => new Map([['ov_theme', JSON.stringify({ id, variables: by[id].variables })]]);

// 2. The loader knows the halves.
let p = load('2026-11-05');
assert.strictEqual(p.L.pairOf('nord'), 'nord-light');
assert.strictEqual(p.L.modeOf('hayride'), 'light');
assert.strictEqual(p.L.scheme.get(), 'dark', 'Vibe out of season: dark');

// 3. Light / Dark: the other half is saved as the theme; Auto goes off.
p = load('2026-11-05', picked('nord'));
assert.strictEqual(p.L.scheme.set('light'), 'light');
assert.strictEqual(painted(p), 'nord-light');
assert.strictEqual(p.L.getCurrent(), 'nord-light', 'saved as the person\'s theme');
assert.strictEqual(p.L.scheme.get(), 'light');
p.L.scheme.set('dark');
assert.strictEqual(painted(p), 'nord');
p.L.scheme.set('dark');
assert.strictEqual(painted(p), 'nord', 'already dark: nothing changes');
// A community theme without a half gives way to the default's.
p = load('2026-11-05', new Map([['ov_theme', JSON.stringify({ id: 'my-own', variables: { ...by.vibe.variables, '--accent': '#ff00aa' } })]]));
p.L.scheme.set('light');
assert.strictEqual(painted(p), 'cloud');

// 4. In October the season stands in for the default in either mode, and the switch keeps it.
p = load('2026-10-25');
assert.strictEqual(painted(p), 'halloween', 'Midnight Pumpkin for the default in dark');
p.L.scheme.set('light');
assert.strictEqual(p.L.getCurrent(), 'cloud');
assert.strictEqual(painted(p), 'hayride', 'Hayride for the default in light');
assert.strictEqual(p.L.display.get().seasonal, 'on', 'switching modes is not turning the season off');
assert.strictEqual(p.html.getAttribute('data-ov-season'), 'halloween');
assert.strictEqual(painted(load('2026-12-10', picked('cloud'))), 'snowfall', 'December in light: Snowfall');

// 5. Auto paints the half the device asks for, and remembers the picked theme.
p = load('2026-11-05', picked('paper'), { dark: true });
p.L.scheme.set('auto');
assert.strictEqual(painted(p), 'hacker', 'Paper on a dark device: its dark half, Amber');
assert.strictEqual(p.L.getCurrent(), 'paper', 'the pick stays the person\'s');
assert.strictEqual(p.L.scheme.get(), 'auto');
const reload = load('2026-11-05', p.store, { dark: false });
assert.strictEqual(painted(reload), 'paper', 'the same person on a light device: Paper');
assert.strictEqual(painted(load('2026-10-25', p.store, { dark: false })), 'paper', 'a picked theme is not the default: no season');
const auto = new Map([['ov_display', JSON.stringify({ motion: 'auto', text: '100', seasonal: 'on', scheme: 'auto' })]]);
assert.strictEqual(painted(load('2026-10-25', auto, { dark: false })), 'hayride', 'the default under Auto in light, in October');
assert.strictEqual(painted(load('2026-10-25', new Map(auto), { dark: true })), 'halloween');
// Light / Dark from Auto turns Auto off.
p = load('2026-11-05', new Map(auto), { dark: true });
p.L.scheme.set('light');
assert.strictEqual(p.L.display.get().scheme, 'manual');
assert.strictEqual(painted(p), 'cloud');

console.log('theme pairs: all checks passed');
