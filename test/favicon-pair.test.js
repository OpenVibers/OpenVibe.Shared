'use strict';
// The tab icon theme-loader.js paints (syncBrowserUi, on every theme apply) is the Pair: app-icon.js's favicon() with
// the theme's ground for the tile. Until 4.111.1 it redrew the retired ring mark over every site's inline Pair favicon
// as soon as the page loaded. theme-loader.js runs in a small fake browser, as in display-comfort.test.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const APP_ICON = require('../app-icon');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');

function paint(site, vars = {}) {
    const attrs = new Map();
    const link = { type: '', href: 'data:image/svg+xml,inline', getAttribute: (k) => (k === 'data-ov-icon' ? site : null) };
    const meta = { setAttribute() {} };
    const html = { style: { setProperty() {}, removeProperty() {} }, setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k), classList: { add() {}, remove() {}, contains: () => false } };
    const sandbox = {
        JSON, Object, String, Number, Math, Array, Promise, Error, URL, URLSearchParams, Date, encodeURIComponent, setTimeout() {}, clearTimeout() {},
        document: {
            documentElement: html, readyState: 'complete', cookie: '', head: { appendChild() {} }, body: null,
            querySelector: (sel) => (sel.includes('data-ov-icon') ? link : sel.includes('theme-color') ? meta : null),
            getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {} }), addEventListener() {},
        },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        location: { hostname: `openvibe.${site}`, protocol: 'https:', search: '', href: `https://openvibe.${site}/` },
        history: { state: null, replaceState() {} },
        getComputedStyle: () => ({ getPropertyValue: (k) => vars[k] || '' }),
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener() {}, dispatchEvent() {},
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    assert.ok(link.href.startsWith('data:image/svg+xml,'), `${site}: the loader painted the tab icon`);
    return decodeURIComponent(link.href.slice('data:image/svg+xml,'.length));
}

// app-icon.js's favicon() with the theme's ground in place of its own tile gradient.
const expected = (site, bg) => APP_ICON.favicon({ site })
    .replace(/\n<radialGradient id="bg"[\s\S]*?<\/radialGradient>/, '')
    .replace('fill="url(#bg)"', `fill="${bg}"`);

// 1. Every site app-icon.js knows, and an unknown one (Network's), draw the same Pair as the build-time favicon.
for (const site of [...Object.keys(APP_ICON.SITES), 'chat']) {
    const got = paint(site, { '--bg-primary': '#0a0f1c' });
    const want = expected(APP_ICON.SITES[site] ? site : 'network', '#0a0f1c');
    assert.strictEqual(got, want, `${site}: the loader's tab icon is app-icon.js's favicon()`);
    assert.ok(!got.includes('M-9.5,-7 L0,10 L9.5,-7'), `${site}: not the retired ring mark`);
    assert.ok(got.includes('mask="url(#ovh)"'), `${site}: the Pair, with its mask gap`);
}

// 2. Live keeps its red record light and Games its yellow one; Tools has none.
assert.ok(paint('live').includes('fill="#ef4444"'), 'Live: the red light in the O');
assert.ok(paint('games').includes('fill="#facc15"'), 'Games: the yellow light');
assert.ok(!/<circle cx="30\.09" cy="50" r="5\.58"/.test(paint('tools')), 'Tools: no light');

// 3. The tile follows the theme's ground; the mark keeps its brand colours.
const light = paint('tools', { '--bg-primary': '#f8fafc', '--accent': '#0f766e' });
assert.ok(light.includes('rx="15" fill="#f8fafc"'), 'a light theme gets a light tile');
assert.ok(!light.includes('#0f766e'), 'the theme accent does not recolour the mark');

// 4. The generated block is current.
execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-theme-loader.js'), '--check'], { stdio: 'pipe' });

console.log('favicon pair: all checks passed');
