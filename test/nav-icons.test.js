'use strict';
// navbar.js ships only the glyphs it draws itself; the rest of the Font Awesome set is nav-icons.js,
// fetched after first paint. Covers: the size budget, the generated block being in sync, every
// built-in icon drawn inline with no fetch, lazy slots sized then filled, the Font Awesome fallback
// when nav-icons.js cannot load, and where nav-icons.js is fetched from.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { brotli } = require('../scripts/size-report');

const ROOT = path.join(__dirname, '..');
const NAVBAR_PATH = path.join(ROOT, 'navbar.js');
const ICONS = require('../nav-icons');
const NAVBAR_BROTLI_BUDGET = 29 * 1024;   // measured 27.6 KB on 2026-09-22 (39.0 KB with every glyph inline)

// ── size budget and generated block ──────────────────────────
{
    const size = brotli(fs.readFileSync(NAVBAR_PATH));
    assert.ok(size <= NAVBAR_BROTLI_BUDGET, `navbar.js is ${(size / 1024).toFixed(1)} KB brotli, budget ${NAVBAR_BROTLI_BUDGET / 1024} KB — keep glyphs in nav-icons.js`);
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-navbar-icons.js'), '--check'], { stdio: 'pipe' });
}

function stubElement(tag) {
    const el = {
        tag, style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
    return el;
}

/** Fresh navbar.js with stubbed globals. `slots` are what document.querySelectorAll('svg[data-ovnav-ic]') finds. */
function load(opts = {}) {
    const hostname = opts.hostname || 'openvibe.live';
    global.location = { hostname, href: `https://${hostname}/`, pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const created = [];
    const slots = opts.slots || [];
    global.document = {
        cookie: '', head: stubElement('head'), body: stubElement('body'), title: 'T',
        currentScript: opts.src ? { src: opts.src } : null,
        getElementById: () => null, createElement: (tag) => { const e = stubElement(tag); created.push(e); return e; },
        querySelectorAll: (sel) => (sel === 'svg[data-ovnav-ic]' ? slots.filter(s => s.attrs['data-ovnav-ic']) : []),
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete global.OpenVibeNavIcons;
    if (opts.preloaded) global.OpenVibeNavIcons = ICONS;
    delete require.cache[require.resolve(NAVBAR_PATH)];
    const navbar = require(NAVBAR_PATH);
    return { navbar, created, loaders: () => created.filter(e => e.tag === 'script' && e.id === 'ov-nav-icons-loader') };
}
const glyph = (name) => `<svg class="ovnav-ic" viewBox="0 0 ${ICONS[name][0]} 512" style="width:${(ICONS[name][0] / 512).toFixed(3)}em" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ICONS[name][1]}"/></svg>`;
const html = (created) => created.map(e => e.innerHTML).join('\n');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const admin = { id: 1, username: 'alex', display_name: 'Alex', role: 'admin' };

(async () => {
    // ── the default navbar draws every one of its own icons inline, with no fetch ──
    const own = [...new Set([...fs.readFileSync(NAVBAR_PATH, 'utf8').matchAll(/navIcon\('(fa-[a-z0-9-]+)'\)/g)].map(m => m[1]))];
    assert.ok(own.length >= 10, 'found the navbar\'s own icons');
    {
        const { navbar, created, loaders } = load();
        navbar.init({ service: 'network', user: admin, token: 't' });
        const out = html(created);
        for (const name of own) {
            if (name === 'fa-coins') continue;   // wallet chip, drawn when the menu first opens (below)
            assert.ok(out.includes(glyph(name)), `${name} drawn inline by the default navbar`);
        }
        assert.ok(!/data-ovnav-ic|fa-solid/.test(out), 'no lazy slot or icon-font fallback in the default navbar');
        await wait(350);
        assert.strictEqual(loaders().length, 0, 'the default navbar never fetches nav-icons.js');
    }

    // ── every glyph in the set is available: built in, or lazy with the same width ──
    {
        const src = fs.readFileSync(NAVBAR_PATH, 'utf8');
        const lazy = {};
        const block = src.slice(src.indexOf('const NAV_ICONS_LAZY = {'), src.indexOf('const NAV_ICONS_REV'));
        for (const m of block.matchAll(/(\d+): '([^']+)'/g)) m[2].split(' ').forEach(n => { lazy[n] = Number(m[1]); });
        for (const [name, [w]] of Object.entries(ICONS)) {
            if (own.includes(name)) assert.ok(src.includes(`'${name}': [${w}, '${ICONS[name][1]}']`), `${name} built in, same path as nav-icons.js`);
            else assert.strictEqual(lazy[name], w, `${name} listed as lazy with its width`);
        }
        const rev = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'nav-icons.js'))).digest('hex').slice(0, 12);
        assert.ok(src.includes(`const NAV_ICONS_REV = '${rev}';`), 'NAV_ICONS_REV is the content hash of nav-icons.js');
    }

    // ── a site's lazy icon: sized slot → fetched after paint → filled in ──
    {
        const slot = stubElement('svg');
        const { navbar, created, loaders } = load({ src: 'https://openvibe.live/shared/navbar.js?v=abc123', slots: [slot] });
        navbar.init({ service: 'live', user: admin, token: 't', links: [{ id: 'home', label: 'Home', href: '/', icon: 'fa-house' }, { id: 'x', label: 'X', href: '/x', icon: 'fa-not-a-glyph' }] });
        const out = html(created);
        const w = ICONS['fa-house'][0];
        assert.ok(out.includes(`<svg class="ovnav-ic" viewBox="0 0 ${w} 512" style="width:${(w / 512).toFixed(3)}em" aria-hidden="true" focusable="false" data-ovnav-ic="fa-house" data-ovnav-cls="fa-house"></svg>`), 'lazy glyph renders as an empty slot of its exact size');
        assert.ok(out.includes('<i class="fa-solid fa-not-a-glyph"></i>'), 'names outside the set keep the icon-font fallback');
        assert.strictEqual(loaders().length, 0, 'nothing fetched before first paint');
        await wait(350);
        assert.strictEqual(loaders().length, 1, 'nav-icons.js requested once');
        const sc = loaders()[0];
        const rev = /NAV_ICONS_REV = '([0-9a-f]{12})'/.exec(fs.readFileSync(NAVBAR_PATH, 'utf8'))[1];
        assert.strictEqual(sc.src, `https://openvibe.live/shared/nav-icons.js?v=${rev}`, 'fetched next to navbar.js, content-hashed');
        assert.strictEqual(sc.async, true);
        Object.assign(slot.attrs, { 'data-ovnav-ic': 'fa-house', 'data-ovnav-cls': 'fa-house' });
        global.OpenVibeNavIcons = ICONS;   // what nav-icons.js does when it runs
        sc.onload();
        assert.strictEqual(slot.innerHTML, `<path fill="currentColor" d="${ICONS['fa-house'][1]}"/>`, 'slot filled with the glyph');
        assert.strictEqual(slot.attrs['data-ovnav-ic'], undefined);
        created.length = 0;
        navbar.setLinks([{ id: 'home', label: 'Home', href: '/', icon: 'fa-house' }]);
        assert.ok(html(created).includes(glyph('fa-house')), 'after loading, the glyph renders inline');
    }

    // ── nav-icons.js cannot load: lazy icons fall back to the page's Font Awesome ──
    {
        const slot = stubElement('svg');
        Object.assign(slot.attrs, { 'data-ovnav-ic': 'fa-video', 'data-ovnav-cls': 'fa-video extra' });
        const { navbar, created, loaders } = load({ slots: [slot] });
        navbar.init({ service: 'live', links: [{ label: 'VODs', href: '/vods', icon: 'fa-video' }] });
        await wait(350);
        assert.strictEqual(loaders()[0].src.split('?')[0], 'https://openvibe.network/shared/nav-icons.js', 'no navbar.js script URL: the network copy');
        loaders()[0].onerror();
        assert.strictEqual(slot.outerHTML, '<i class="fa-solid fa-video extra"></i>', 'slot replaced by the icon-font fallback');
        created.length = 0;
        navbar.setLinks([{ label: 'VODs', href: '/vods', icon: 'fa-video' }]);
        assert.ok(html(created).includes('<i class="fa-solid fa-video"></i>') && !html(created).includes('data-ovnav-ic'), 'later renders use the fallback directly');
    }

    // ── a page that loaded nav-icons.js itself gets every glyph from the first frame ──
    {
        const { navbar, created, loaders } = load({ preloaded: true });
        navbar.init({ service: 'live', links: [{ label: 'Chat', href: '/chat', icon: 'fa-comments' }] });
        assert.ok(html(created).includes(glyph('fa-comments')), 'preloaded set used synchronously');
        await wait(350);
        assert.strictEqual(loaders().length, 0, 'no fetch when the set is already on the page');
    }

    // ── iconsUrl override ──
    {
        const { navbar, loaders } = load({ src: 'https://cdn.example/x/bundle.js' });
        navbar.init({ service: 'live', iconsUrl: '/assets/nav-icons.js', links: [{ label: 'Chat', href: '/chat', icon: 'fa-comments' }] });
        await wait(350);
        assert.strictEqual(loaders()[0].src, '/assets/nav-icons.js');
    }

    console.log('nav-icons: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
