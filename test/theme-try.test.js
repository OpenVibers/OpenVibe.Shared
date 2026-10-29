'use strict';
// Trying a theme on a page (theme-loader.js ?ov-try=, 4.41.0): a catalog theme paints without being saved, follows the
// tab (sessionStorage), is not undone by the account's sync or the device's light/dark, Stop goes back to the account's
// theme, and only a catalog name is ever read from the URL. theme-loader.js runs in a small fake browser, as in
// theme-pairs.test.js. (The bar's Use it and Stop buttons were checked in a real browser for the 4.41.0 PR.)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BUILTIN_THEMES } = require('../builtin-themes');

const by = Object.fromEntries(BUILTIN_THEMES.map((t) => [t.id, t]));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');

function load(search, { store = new Map(), session = new Map(), dark = true } = {}) {
    const fixed = new Date(2026, 10, 20, 12).getTime();   // out of season
    class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
    const attrs = new Map(); const props = new Map(); const puts = []; const replaced = [];
    const html = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) }, setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k), props };
    const sandbox = {
        Date: FixedDate, JSON, Object, String, Number, Math, Array, Promise, Error, URL, URLSearchParams, setTimeout() {}, clearTimeout() {},
        document: { documentElement: html, readyState: 'complete', cookie: '', head: null, body: null, querySelector: () => null, getElementById: () => null, referrer: '', visibilityState: 'visible', addEventListener() {} },
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
        sessionStorage: { getItem: (k) => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)), removeItem: (k) => session.delete(k) },
        location: { hostname: 'openvibe.live', protocol: 'https:', search, href: `https://openvibe.live/${search}` },
        history: { state: null, replaceState: (s, t, u) => replaced.push(u) },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        matchMedia: (q) => ({ matches: /dark/.test(q) ? dark : false, addEventListener() {} }),
        fetch: (url, o) => { if (o && o.method === 'PUT') puts.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: false, json: () => Promise.resolve(null) }); },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener() {}, dispatchEvent() {},
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    return { L: sandbox.OpenVibeThemeLoader, html, puts, store, session, replaced };
}
const picked = (id) => new Map([['ov_theme', JSON.stringify({ id, variables: by[id].variables })]]);
const painted = (p) => p.html.getAttribute('data-theme');

// 1. ?ov-try=<builtin> paints it at once, saves nothing, and is remembered for the tab.
let p = load('?ov-try=neon-tokyo', { store: picked('forest') });
assert.strictEqual(painted(p), 'neon-tokyo');
assert.strictEqual(p.html.getAttribute('data-ov-trying'), 'neon-tokyo');
assert.strictEqual(p.html.props.get('--accent'), by['neon-tokyo'].variables['--accent']);
assert.strictEqual(p.L.try.current(), 'neon-tokyo');
assert.strictEqual(p.session.get('ov_try'), 'neon-tokyo', 'kept for the tab');
assert.strictEqual(JSON.parse(p.store.get('ov_theme')).id, 'forest', 'the account\'s theme is untouched');
assert.strictEqual(p.puts.length, 0, 'nothing is saved');

// 2. The next page of the site (no ?ov-try) still wears it; a repaint (the sync, the device) does not undo it.
p = load('', { store: picked('forest'), session: new Map([['ov_try', 'neon-tokyo']]) });
assert.strictEqual(painted(p), 'neon-tokyo', 'it follows the tab around the site');
p.L.scheme.set('light');
assert.strictEqual(painted(p), 'neon-tokyo', 'a repaint while trying paints the tried theme');

// 3. Stop goes back to the account's theme and forgets the try; ?ov-try=off does too.
p.L.try.stop();
assert.strictEqual(p.L.try.current(), null);
assert.strictEqual(p.session.has('ov_try'), false);
assert.strictEqual(p.html.getAttribute('data-ov-trying'), null);
assert.notStrictEqual(painted(p), 'neon-tokyo', 'back to the account\'s theme');
p = load('?ov-try=off', { store: picked('forest'), session: new Map([['ov_try', 'neon-tokyo']]) });
assert.strictEqual(painted(p), 'forest');
assert.strictEqual(p.session.has('ov_try'), false);

// 4. Only a catalog name: anything else in the URL is ignored, and nothing from it reaches the page's styles.
for (const bad of ['?ov-try=Neon%20Tokyo', '?ov-try=x%22%3E%3Cscript%3E', '?ov-try=--bg-primary:red', '?ov-try=' + 'a'.repeat(80), '?ov-try=-lead']) {
    p = load(bad, { store: picked('forest') });
    assert.strictEqual(painted(p), 'forest', bad);
    assert.strictEqual(p.L.try.current(), null, bad);
    assert.strictEqual(p.session.has('ov_try'), false, bad);
}
// An unknown name (not built in) asks the catalog; when the catalog says no, the page keeps the account's theme.
p = load('?ov-try=not-a-theme', { store: picked('forest') });
assert.strictEqual(painted(p), 'forest');

// 5. try.start() from a page (Design's "Try it here" button) works like the URL.
p = load('', { store: picked('forest') });
p.L.try.start('daylight');
assert.strictEqual(painted(p), 'daylight');
assert.strictEqual(p.session.get('ov_try'), 'daylight');
p.L.try.start('<b>');
assert.strictEqual(painted(p), 'daylight', 'a bad name changes nothing');

console.log('theme try: paints without saving, follows the tab, survives repaints, Stop restores, only catalog names');
