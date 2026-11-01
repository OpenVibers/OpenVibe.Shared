'use strict';
// Comfort settings (theme-loader.js display, 4.45.0): more contrast, a readable font, colour-blind-safe status colours
// and OLED black are display preferences like motion and text. Each sets one attribute on <html>, an unknown value is
// ignored, the defaults set none, and the account's settings (from /api/themes/me/active) are applied in place.
// theme-loader.js runs in a small fake browser, as in theme-try.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');

function load({ store = new Map(), active = null } = {}) {
    const attrs = new Map(); const props = new Map(); const puts = [];
    const html = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) }, setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k), attrs };
    let head = null;
    const sandbox = {
        JSON, Object, String, Number, Math, Array, Promise, Error, URL, URLSearchParams, Date, setTimeout() {}, clearTimeout() {},
        document: { documentElement: html, readyState: 'complete', cookie: '', get head() { return head; }, body: null, querySelector: () => null, getElementById: () => null, createElement: () => ({}), referrer: '', visibilityState: 'visible', addEventListener() {} },
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        location: { hostname: 'openvibe.live', protocol: 'https:', search: '', href: 'https://openvibe.live/' },
        history: { state: null, replaceState() {} },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        fetch: (url, o) => {
            if (o && o.method === 'PUT') { puts.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); }
            return Promise.resolve({ ok: !!active, json: () => Promise.resolve(active) });
        },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener() {}, dispatchEvent() {},
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    return { L: sandbox.OpenVibeThemeLoader, html, puts, store };
}

// 1. The defaults set no comfort attribute.
let p = load();
const d = p.L.display.get();
assert.deepStrictEqual({ contrast: d.contrast, font: d.font, colors: d.colors, oled: d.oled }, { contrast: 'normal', font: 'default', colors: 'default', oled: 'off' });
for (const a of ['data-ov-contrast', 'data-ov-font', 'data-ov-colors', 'data-ov-oled']) assert.strictEqual(p.html.getAttribute(a), null, `${a} is not set by default`);
assert.strictEqual(JSON.stringify(p.L.display.options.contrast), '["normal","more"]', 'the options are listed (another realm, so compared as JSON)');

// 2. Each setting sets its attribute, saves locally and, offline, does not need the account.
p.L.display.set({ contrast: 'more', font: 'readable', colors: 'cb-safe', oled: 'on' }, { local: true });
assert.strictEqual(p.html.getAttribute('data-ov-contrast'), 'more');
assert.strictEqual(p.html.getAttribute('data-ov-font'), 'readable');
assert.strictEqual(p.html.getAttribute('data-ov-colors'), 'cb-safe');
assert.strictEqual(p.html.getAttribute('data-ov-oled'), 'on');
assert.strictEqual(JSON.parse(p.store.get('ov_display')).font, 'readable', 'saved with the other display settings');

// 3. Back to the default removes the attribute; an unknown value is ignored.
p.L.display.set({ contrast: 'normal', font: 'comic-sans', oled: 'off' }, { local: true });
assert.strictEqual(p.html.getAttribute('data-ov-contrast'), null);
assert.strictEqual(p.html.getAttribute('data-ov-font'), 'readable', 'an unknown font is not a change');
assert.strictEqual(p.html.getAttribute('data-ov-oled'), null);

// 4. A saved setting paints on the next page before anything else loads.
p = load({ store: new Map([['ov_display', JSON.stringify({ contrast: 'more', colors: 'cb-safe' })]]) });
assert.strictEqual(p.html.getAttribute('data-ov-contrast'), 'more');
assert.strictEqual(p.html.getAttribute('data-ov-colors'), 'cb-safe');

// 5. The CSS: every rule is behind its attribute and wins over the theme's inline values.
const css = (SRC.match(/const COMFORT_CSS = ([\s\S]*?);\n/) || [])[1] || '';
assert.ok(/html\[data-ov-contrast=more\]\{--text-secondary:[^}]*!important/.test(css), 'contrast overrides the inline theme');
assert.ok(/html\[data-ov-oled=on\]\[data-theme-mode=dark\]\{--bg-primary:#000!important/.test(css), 'OLED black only on a dark theme');
assert.ok(/html\[data-ov-colors=cb-safe\]\[data-theme-mode=light\]/.test(css), 'colour-blind-safe colours have a light half');
assert.ok(!/url\(/.test(css), 'no font or image is fetched');

// 6. Icons (4.71.0, plan L56): auto by default (no attribute), line or solid as <html data-ov-icons>, kept like the rest;
//    the glyphs' CSS turns the attribute into the switch point every icon reads, and the navbar and bell follow it.
p = load();
assert.strictEqual(p.L.display.get().icons, 'auto');
assert.strictEqual(p.html.getAttribute('data-ov-icons'), null, 'auto paints nothing');
p.L.display.set({ icons: 'solid' }, { local: true });
assert.strictEqual(p.html.getAttribute('data-ov-icons'), 'solid');
p.L.display.set({ icons: 'outline' }, { local: true });
assert.strictEqual(p.html.getAttribute('data-ov-icons'), 'solid', 'an unknown value changes nothing');
p.L.display.set({ icons: 'auto' }, { local: true });
assert.strictEqual(p.html.getAttribute('data-ov-icons'), null);
p = load({ store: new Map([['ov_display', JSON.stringify({ icons: 'line' })]]) });
assert.strictEqual(p.html.getAttribute('data-ov-icons'), 'line', 'a saved preference paints on the next page');
assert.ok(/'data-ov-icons'\]/.test(SRC) || SRC.includes("'data-ov-oled', 'data-ov-icons']"), 'the preference travels with the look (PAINT_ATTRS)');
const glyphCss = require('fs').readFileSync(require('path').join(__dirname, '..', 'ov-glyphs.js'), 'utf8');
assert.ok(glyphCss.includes('html[data-ov-icons=solid]{--ovg-pref:99999px}html[data-ov-icons=line]{--ovg-pref:0px}'), 'the glyphs read the preference');
assert.ok(glyphCss.includes('var(--ovg-pref, var(--ovg-solid-below, 18.4px))'), 'the person\'s preference wins over an area\'s switch point');
const lookSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'ov-look.js'), 'utf8');
assert.ok(/data-look-icons/.test(lookSrc) && /L\.display\.set\(\{ icons:/.test(lookSrc), 'the Look panel offers Auto, Line and Solid');

console.log('display comfort: defaults, set, unknown values, saved paint, CSS behind attributes, icons');
