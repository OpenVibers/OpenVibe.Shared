'use strict';
// Motion (4.183.0; the owner, 2026-11-10: "it should still have full motion but actually just reduce it instead of
// getting rid of it"). The loader turns four choices and the device's own setting into one signal on <html>:
//   auto → nothing, or reduced when the device asks for less;  full → full, even when the device asks;
//   reduced (Calm) → reduced: every effect still plays, smaller and slower;  off → off, the only one that stops motion.
// Rules this file holds: nothing but Off carries a rule that stops motion, Calm slows endless loops instead of ending
// them, and no stylesheet or script in the package stops an effect because the device asked for less.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'theme-loader.js'), 'utf8');

function boot({ motion, deviceAsks = false } = {}) {
    const attrs = new Map(), styles = [], media = [];
    const html = { style: { setProperty() {}, removeProperty() {} }, setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k), classList: { add() {}, remove() {} } };
    const head = { appendChild: (el) => { styles.push(el); return el; } };
    const store = motion ? { ov_display: JSON.stringify({ motion }) } : {};
    const mq = { matches: deviceAsks, addEventListener(_t, fn) { media.push(fn); } };
    const sandbox = {
        document: { documentElement: html, head, readyState: 'complete', cookie: '', querySelector: () => null, querySelectorAll: () => [], getElementById: (id) => styles.find((s) => s.id === id) || null,
            createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }), addEventListener() {}, getAnimations: () => [] },
        localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
        location: { hostname: 'openvibe.live', protocol: 'https:', search: '', href: 'https://openvibe.live/' }, getComputedStyle: () => ({ getPropertyValue: () => '' }),
        matchMedia: (q) => (/reduced-motion/.test(q) ? mq : { matches: false, addEventListener() {} }),
        fetch: () => Promise.resolve({ ok: false }), CustomEvent: class {}, addEventListener() {}, dispatchEvent() {}, setTimeout() {}, clearTimeout() {}, URL, JSON, Object, String, Number, Math, Array, Promise, Error, Date, WeakSet,
    };
    sandbox.window = sandbox;
    vm.runInNewContext(SRC, sandbox);
    const L = sandbox.OpenVibeThemeLoader;
    return { L, attr: () => html.getAttribute('data-ov-motion'), css: () => (styles.find((s) => s.id === 'ov-display-css') || {}).textContent || '', mq, media };
}

// ── four choices, one signal ──
let t = boot();
assert.deepStrictEqual(Array.from(t.L.display.options.motion), ['auto', 'full', 'reduced', 'off'], 'Automatic, Full, Calm, Off');
assert.strictEqual(t.attr(), null, 'automatic on a device that asks nothing: full motion, no attribute');
assert.strictEqual(t.L.display.motion(), 'full');
assert.strictEqual(t.L.display.move(), 1);

t = boot({ deviceAsks: true });
assert.strictEqual(t.attr(), 'reduced', 'automatic follows the device: it asks for less, the page is calm');
assert.strictEqual(t.L.display.motion(), 'calm');
assert.strictEqual(t.L.display.move(), 0.35, 'calm moves a third as far; it does not stand still');

t = boot({ motion: 'full', deviceAsks: true });
assert.strictEqual(t.attr(), 'full', 'Full is the person\'s own choice and outranks the device');
assert.strictEqual(t.L.display.move(), 1);

t = boot({ motion: 'reduced' });
assert.strictEqual(t.attr(), 'reduced', 'Calm');
assert.strictEqual(t.L.display.motion(), 'calm');

t = boot({ motion: 'off' });
assert.strictEqual(t.attr(), 'off', 'Off');
assert.strictEqual(t.L.display.move(), 0);

// The device changing its mind applies at once under Automatic, and never under a choice the person made.
t = boot();
t.mq.matches = true; t.media.forEach((fn) => fn());
assert.strictEqual(t.attr(), 'reduced', 'the device starts asking: calm at once');
t = boot({ motion: 'full' });
t.mq.matches = true; t.media.forEach((fn) => fn());
assert.strictEqual(t.attr(), 'full', 'a choice holds');

// ── the stylesheet: Calm stops nothing ──
const css = boot({ motion: 'reduced' }).css();
assert.ok(css.includes(':where(html){--ov-move:1}') && css.includes('html[data-ov-motion=reduced]{--ov-move:0.35;') && css.includes('html[data-ov-motion=off]{--ov-move:0}'), '--ov-move: 1, a third, none');
const calmRules = css.match(/html\[data-ov-motion=reduced\][^{]*\{[^}]*\}/g) || [];
assert.ok(calmRules.length && calmRules.every((r) => !/animation|transition/.test(r)), 'no rule gives Calm a shorter animation or transition');
assert.ok(/html\[data-ov-motion=off\] \*:not\(\[data-fx-demo\] \*\)[^{]*\{animation-duration:\.001ms!important/.test(css), 'Off is the one blanket rule, outside a demo scope');
assert.ok(/CALM_RATE = 0\.6/.test(SRC) && SRC.includes('t.iterations !== Infinity') && SRC.includes("addEventListener('animationstart'"), 'under Calm an endless loop is slowed as it starts; anything that ends plays as written');
assert.ok(SRC.includes("motionOf() === 'off') return;"), 'the theme crossfade is a colour fade: only Off skips it');

// ── a control nobody styled wears the theme (4.186.0) ──
assert.ok(/:where\(button,input:is\(\[type=submit\],\[type=button\],\[type=reset\]\)\):where\(:not\(\[class\]\)\)\{font-family:inherit;border:1px solid var\(--border-light,[^;]*;border-radius:10px;color:var\(--text-primary,inherit\);background:var\(--bg-hover,/.test(css), 'a bare button: the theme\'s face, at no specificity, readable even where no theme is set');
assert.ok(/:where\(input:not\(\[type=checkbox\][^)]*\),select,textarea\):where\(:not\(\[class\]\)\)\{font-family:inherit;border:1px solid/.test(css), 'a bare field, select or text box too');
const bare = css.match(/:where\((?:button|input)[^{]*\{[^}]*\}/g) || [];
assert.ok(bare.length >= 3 && bare.every((r) => /^:where\([^{]*:where\(:not\(\[class\]\)\)\{/.test(r) && !/padding|height|width|margin|display/.test(r)), 'only controls with no class, and nothing that moves a layout');

// ── the package: nothing stops an effect because the device asked for less ──
const STOPS = /(animation|transition)\s*:\s*none/;
const offenders = [];
for (const name of fs.readdirSync(ROOT)) {
    if (!/\.(js|css)$/.test(name)) continue;
    const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
    let i = 0;
    for (;;) {
        const at = text.indexOf('prefers-reduced-motion', i);
        if (at < 0) break;
        const open = text.indexOf('{', at), line = text.slice(at, text.indexOf('\n', at) < 0 ? text.length : text.indexOf('\n', at));
        // A media block that stops something (the fallbacks that set --ov-move are fine; so is asking the device in script).
        if (/^prefers-reduced-motion:\s*reduce\)\s*\{/.test(text.slice(at)) && open > 0 && STOPS.test(line)) offenders.push(`${name}: ${line.slice(0, 90)}`);
        i = at + 10;
    }
    const calm = text.match(/html\[data-ov-motion="?reduced"?\][^{};]*\{[^}]*\}/g) || [];
    for (const r of calm) if (STOPS.test(r)) offenders.push(`${name}: ${r.slice(0, 90)}`);
}
assert.deepStrictEqual(offenders, [], 'a rule that stops motion belongs to html[data-ov-motion=off]');

console.log('motion setting: automatic follows the device, Full outranks it, Calm moves a third as far and stops nothing, Off alone stops motion');
