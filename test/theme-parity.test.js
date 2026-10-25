'use strict';
// The theme catalog and the browser loader's copy of it must agree, every theme must define a
// complete token set once defaults are merged, and the default is the blue Vibe.
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { BUILTIN_THEMES, DEFAULT_THEME, DEFAULT_VARS } = require('../builtin-themes');
const { CSS_VARIABLES } = (() => { try { return require('../theme-sync'); } catch { return { CSS_VARIABLES: null }; } })();

// 1. Loader copy is generated from the catalog and not stale.
execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-theme-loader.js'), '--check'], { stdio: 'pipe' });

// 2. Default and the three themes this round is about.
assert.strictEqual(DEFAULT_THEME.id, 'vibe');
const by = Object.fromEntries(BUILTIN_THEMES.map((t) => [t.id, t]));
assert.ok(by['violet-hour'], 'the original violet look is kept as Violet Hour');
assert.strictEqual(by['violet-hour'].variables['--accent'], '#8b5cf6');
assert.notStrictEqual(by.vibe.variables['--accent'], by.arctic.variables['--accent'], 'Vibe and Arctic are different blues');
assert.notStrictEqual(by.vibe.variables['--bg-primary'], by.arctic.variables['--bg-primary']);

// 3. Slugs unique, every theme complete after defaults.
const REQUIRED = CSS_VARIABLES || Object.keys(DEFAULT_VARS);
const seen = new Set();
for (const t of BUILTIN_THEMES) {
    assert.ok(!seen.has(t.id), `duplicate theme id ${t.id}`);
    seen.add(t.id);
    const merged = { ...DEFAULT_VARS, ...t.variables };
    for (const k of REQUIRED) assert.ok(merged[k], `${t.id} is missing ${k}`);
    for (const [k, v] of Object.entries(t.variables)) {
        assert.ok(k.startsWith('--'), `${t.id}: ${k} is not a CSS variable`);
        assert.ok(!/url\(|expression|javascript:|var\(/i.test(String(v)), `${t.id}: ${k} has a dangerous value`);
    }
}

// 4. Loader: full sets and stale-token clearing are present.
const loader = require('fs').readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');
// The loader writes rows of values against one list of names and expands them at load: run it and compare.
const vm = require('vm');
const sandbox = { document: { documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {} }, readyState: 'complete', cookie: '', head: null, querySelector: () => null, getElementById: () => null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { hostname: 'openvibe.live', protocol: 'https:' }, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    fetch: () => Promise.resolve({ ok: false }), CustomEvent: class {}, addEventListener() {}, dispatchEvent() {}, setTimeout() {}, URL, JSON, Object, String, Number, Math, Array, Promise, Error, Date };
sandbox.window = sandbox;
vm.runInNewContext(loader, sandbox);
const LT = sandbox.OpenVibeThemeLoader.THEMES;
assert.ok(LT['violet-hour'], 'loader knows Violet Hour');
for (const t of BUILTIN_THEMES) {
    const want = { ...DEFAULT_VARS, ...t.variables };
    for (const k of Object.keys(want)) assert.strictEqual(LT[t.id][k], String(want[k]), `loader's ${t.id} carries ${k} as the catalog has it`);
}
assert.ok(LT.arctic['--success'], 'loader entries carry the full token set');
assert.ok(loader.length < 60000, `theme-loader.js stays small for first paint (${loader.length} bytes)`);
assert.ok(loader.includes('KNOWN_PROPS'), 'loader clears tokens the new theme does not set');

// 5. Derived tokens: text on the accent always reads, on every theme.
const { contrast, hexToRgb } = require('../builtin-themes');
for (const t of BUILTIN_THEMES) {
    const v = t.variables;
    assert.ok(v['--on-accent'] && v['--accent-rgb'] && v['--accent-glow'] && v['--color-scheme'], `${t.id} lacks derived tokens`);
    assert.ok(contrast(hexToRgb(v['--on-accent']), hexToRgb(v['--accent'])) >= 3, `${t.id}: --on-accent does not read on --accent`);
    assert.strictEqual(v['--color-scheme'], t.mode === 'light' ? 'light' : 'dark');
}
// 6. Text reads at 4.5:1 (WCAG AA) on every surface: muted and secondary text in every theme, and in the light themes
//    the accents too, which sites use for links and eyebrows (axe failed 50-155 nodes per home in light themes before
//    2026-10-22). Dark themes keep their accents exactly as designed.
const { TEXT_TOKENS, SURFACES } = require('../builtin-themes');
for (const t of BUILTIN_THEMES) {
    const v = t.variables;
    const surfaces = SURFACES.map((k) => hexToRgb(v[k])).filter(Boolean);
    for (const k of TEXT_TOKENS[t.mode === 'light' ? 'light' : 'dark']) {
        if (!v[k]) continue;
        const worst = Math.min(...surfaces.map((b) => contrast(hexToRgb(v[k]), b)));
        assert.ok(worst >= 4.5, `${t.id}: ${k} ${v[k]} reads at ${worst.toFixed(2)}:1 on its darkest/lightest surface`);
    }
}
// 7. Each status colour has a -text twin that reads at 4.5:1 on every surface.
const { STATUS_TOKENS } = require('../builtin-themes');
for (const t of BUILTIN_THEMES) {
    // What a page carries: the default theme's values under the theme's own (theme-loader merges them that way).
    const v = { ...DEFAULT_VARS, ...t.variables };
    const surfaces = SURFACES.map((k) => hexToRgb(t.variables[k] || v[k])).filter(Boolean);
    for (const k of STATUS_TOKENS) {
        if (!v[k]) continue;
        assert.ok(v[`${k}-text`], `${t.id}: ${k} has no -text twin`);
        const worst = Math.min(...surfaces.map((b) => contrast(hexToRgb(v[`${k}-text`]), b)));
        assert.ok(worst >= 4.5, `${t.id}: ${k}-text ${v[`${k}-text`]} reads at ${worst.toFixed(2)}:1`);
    }
}
const snow = BUILTIN_THEMES.find((t) => t.id === 'snow');
assert.ok(snow && snow.variables['--success-text'] && snow.variables['--success-text'] !== DEFAULT_VARS['--success'], 'snow carries Vibe\'s green, too light for text there, so its twin is darker');
assert.strictEqual(BUILTIN_THEMES.find((t) => t.id === 'vibe').variables['--accent'], '#3b82f6', 'the default blue is untouched');

console.log('theme parity: all checks passed');
