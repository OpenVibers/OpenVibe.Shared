'use strict';
// navbar.js — brand resolution from the hostname, compact/short form, overrides and the
// modular menu/links API (plain node with the same stubbed globals as navbar-auth.test.js).
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement() {
    const el = {
        style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
    return el;
}

function load(hostname, opts = {}) {
    global.location = { hostname, href: `https://${hostname}/`, pathname: opts.pathname || '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* read-only in some runtimes */ }
    const created = [];
    global.document = {
        cookie: opts.cookie || '', head: stubElement(), body: stubElement(), title: 'T',
        getElementById: () => null, createElement: (tag) => { const e = stubElement(); e.tag = tag; created.push(e); return e; },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete require.cache[require.resolve(NAVBAR_PATH)];
    const navbar = require(NAVBAR_PATH);
    return { navbar, created };
}

// ── hostname → segments ──────────────────────────────────────
{
    const { navbar } = load('pastes.openvibe.tools');
    navbar.init({ service: 'paste', user: { id: 1, username: 'x' } });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'Pastes.OpenVibe.Tools');
    assert.strictEqual(b.short, 'Pastes');
    assert.strictEqual(b.tld, 'tools');
    assert.strictEqual(b.variant, 'tools');
}
{
    const { navbar } = load('json.openvibe.tools');
    navbar.init({ service: 'dev' });
    assert.strictEqual(navbar.brand().name, 'JSON.OpenVibe.Tools', 'known acronyms keep their casing');
}
{
    const { navbar } = load('mergepdf.openvibe.tools');
    navbar.init({ service: 'docs' });
    assert.strictEqual(navbar.brand().name, 'MergePDF.OpenVibe.Tools');
}
{
    const { navbar } = load('openvibe.space');
    navbar.init({ service: 'space' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.Space');
    const { navbar: ai } = load('ai.openvibe.services');
    ai.init({ service: 'ai' });
    assert.strictEqual(ai.brand().name, 'AI.OpenVibe.Services');
    const { navbar: off } = load('localhost');
    off.init({ service: 'space' });
    assert.strictEqual(off.brand().name, 'OpenVibe.Space', 'off the network the space service keeps its brand');
}
{
    const { navbar } = load('openvibe.live');
    navbar.init({ service: 'live' });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'OpenVibe.Live');
    assert.strictEqual(b.short, 'OpenVibe.Live', 'no subdomain: nothing to shorten to');
    assert.strictEqual(b.variant, 'live');
}
{
    const { navbar } = load('www.openvibe.community');
    navbar.init({ service: 'community' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.Community', 'www is not a subdomain brand');
}
{
    const { navbar } = load('play.openvibe.games');
    navbar.init({ service: 'games' });
    assert.strictEqual(navbar.brand().name, 'Play.OpenVibe.Games');
}
{
    const { navbar } = load('ingest.openre.stream');
    navbar.init({ service: 'live' });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'Ingest.OpenRe.Stream');
    assert.strictEqual(b.variant, 'stream');
}
{
    const { navbar } = load('openvibe.vip');
    navbar.init({ service: 'network' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.VIP');
}
// ── off-network hosts fall back to the service id ────────────
{
    const { navbar } = load('localhost');
    navbar.init({ service: 'net' });
    assert.strictEqual(navbar.brand().name, 'Net.OpenVibe.Tools');
    const { navbar: n2 } = load('localhost');
    n2.init({ service: 'live' });
    assert.strictEqual(n2.brand().name, 'OpenVibe.Live');
}
// ── overrides ────────────────────────────────────────────────
{
    const { navbar } = load('openvibe.tools');
    navbar.init({ service: 'tools', brandName: 'Paste.OpenVibe' });
    assert.strictEqual(navbar.brand().name, 'Pastes.OpenVibe.Tools', 'legacy brandName steers the subdomain segment (paste → Pastes, the host name)');
    const { navbar: n2 } = load('openvibe.tools');
    n2.init({ service: 'tools', brand: { sub: 'logo', tag: 'beta' } });
    assert.strictEqual(n2.brand().name, 'Logo.OpenVibe.Tools');
    assert.strictEqual(n2.brand().tag, 'beta');
    const { navbar: n3 } = load('openvibe.tools');
    n3.init({ service: 'tools', brand: { name: 'Custom Name', variant: 'games' } });
    assert.strictEqual(n3.brand().name, 'Custom Name');
    assert.strictEqual(n3.brand().variant, 'games');
}
// ── ov-mark.js is loaded once: not when the page already carries its own (async) tag ────
{
    const { navbar, created } = load('openvibe.coupons');
    navbar.init({ service: 'coupons', user: null });
    assert.strictEqual(created.filter((e) => e.tag === 'script' && e.id === 'ov-mark-loader').length, 1, 'no tag on the page: the navbar loads the mark');
    const second = load('openvibe.coupons');
    global.document.querySelector = (sel) => (sel === 'script[src*="/ov-mark.js"]' ? { src: '/shared/ov-mark.js?v=1' } : null);
    second.navbar.init({ service: 'coupons', user: null });
    assert.strictEqual(second.created.filter((e) => e.tag === 'script' && e.id === 'ov-mark-loader').length, 0, 'the page\'s own tag: no second copy');
}
// ── a re-render removes the previous render's document listener (it kept the removed bar alive) ────
{
    const { navbar } = load('openvibe.space');
    const docListeners = [];
    global.document.addEventListener = (type, fn, opts) => docListeners.push({ type, opts });
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    const first = docListeners.filter((l) => l.type === 'click');
    assert.ok(first.length >= 1 && first.every((l) => l.opts && l.opts.signal), 'the outside-click listener carries an abort signal');
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    assert.ok(first.every((l) => l.opts.signal.aborted), 'the next render removed it');
    const latest = docListeners.filter((l) => l.type === 'click').slice(first.length);
    assert.ok(latest.length >= 1 && latest.every((l) => !l.opts.signal.aborted), 'the new render has its own, live');
}
// ── rendered markup carries the segments, compact attr and the variant ────
{
    const { navbar, created } = load('pastes.openvibe.tools', { pathname: '/mine' });
    navbar.init({ service: 'paste', user: { id: 1, username: 'x' }, links: [{ label: 'Mine', href: '/mine' }, { label: 'New', href: '/new', icon: 'fa-plus' }], menu: { after: [{ id: 'mp', label: 'My pastes', href: '/my', icon: 'fa-paste' }] }, compact: 'always' });
    const nav = created.find(e => e.tag === 'nav');
    assert.ok(nav, 'nav element created');
    assert.strictEqual(nav.getAttribute('data-compact'), 'always');
    assert.ok(nav.innerHTML.includes('class="b-sub">Pastes<') && nav.innerHTML.includes('class="b-tld">Tools<'), 'segments rendered');
    assert.ok(nav.innerHTML.includes('data-variant="tools"'), 'ov-mark variant');
    assert.ok(/href="\/mine" class="ovnav-link active"/.test(nav.innerHTML), 'current path marked active');
    assert.ok(/class="ovnav-burger"/.test(nav.innerHTML) && /class="ovnav-drawer"/.test(nav.innerHTML), 'links get a mobile drawer');
    assert.ok(/<span class="icon"><svg class="ovnav-ic"/.test(nav.innerHTML), 'link icon rendered inline (no icon font needed)');
    assert.ok(!/fa-solid fa-plus/.test(nav.innerHTML), 'known icons do not depend on Font Awesome');
    const dd = created.find(e => e.tag === 'div' && /openvibe-navbar-dropdown-menu/.test(e.innerHTML));
    assert.ok(dd && dd.innerHTML.includes('data-menu-id="mp"') && dd.innerHTML.includes('My pastes'), 'custom dropdown row rendered');
    assert.ok(dd.innerHTML.includes('/my#history'), 'History link present');
    const id = navbar.addMenuItem({ label: 'Runtime row', href: '/r', position: 'before' });
    assert.ok(id, 'addMenuItem returns an id');
}
console.log('navbar brand: all checks passed');
