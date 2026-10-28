'use strict';
// navbar.js 4.22.0 — a tidier bar (the owner, 2026-10-28: "reanalyze all the nav bars… redundant feeling options…
// not front-facing of what the important stuff is"): other sites are no longer repeated after this site's links (the
// launcher lists them all), and links marked more: true fold into one "More" dropdown (the phone drawer lists them).
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement(tag) {
    const el = {
        tag, style: { setProperty() {} }, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); return c; }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
    };
    el.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    return el;
}
function load() {
    global.location = { hostname: 'openvibe.food', href: 'https://openvibe.food/', pathname: '/', protocol: 'https:', origin: 'https://openvibe.food' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const body = stubElement('body');
    const created = [];
    global.document = { cookie: '', head: stubElement('head'), body, documentElement: stubElement('html'), title: 'T', getElementById: () => null,
        createElement: (tag) => { const e = stubElement(tag); created.push(e); return e; }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    // The Frame's site list (what the launcher and the old strip read), as Network's /api/chrome would give it.
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ nav: [{ id: 'live', name: 'Live', url: 'https://openvibe.live/', icon: 'live' }, { id: 'tools', name: 'Tools', url: 'https://openvibe.tools/', icon: 'tools' }], groups: [] }) });
    delete globalThis.OVFrame;
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), created };
}
const barHtml = (created) => (created.filter((e) => e.tag === 'nav' && /openvibe-navbar-links/.test(e.innerHTML)).pop() || { innerHTML: '' }).innerHTML;
const between = (html, a, b) => { const i = html.indexOf(a); const j = html.indexOf(b, i); return i < 0 ? '' : html.slice(i, j < 0 ? undefined : j); };

{
    const { navbar, created } = load();
    navbar.init({ service: 'food', user: null, links: [
        { label: 'Food near you', href: '/near', icon: 'fa-location-dot' },
        { label: 'Food boxes', href: '/boxes', icon: 'fa-utensils' },
        { label: 'Food list', href: '/foods', more: true },
        { label: 'What shipped', href: '/updates', more: true },
    ] });
    const bar = between(barHtml(created), 'openvibe-navbar-links', 'openvibe-navbar-spacer');
    assert.ok(bar.includes('>Food near you<') && bar.includes('>Food boxes<'), 'the main places are on the bar');
    assert.ok(/data-link-id="ovnav-more"[^>]*>(<[^>]+>)*More/.test(bar) || bar.includes('data-link-id="ovnav-more"'), 'one More');
    const more = between(bar, 'ovnav-dd-menu', '</div>');
    assert.ok(more.includes('>Food list<') && more.includes('>What shipped<'), 'secondary links are inside More');
    assert.ok(!/class="ovnav-net"/.test(bar), 'no other sites repeated on the bar');
    const drawer = between(barHtml(created), 'id="openvibe-drawer"', 'ovnav-drawer-net');
    assert.ok(drawer.includes('>Food list<') && drawer.includes('>What shipped<'), 'the drawer lists every link');
    assert.ok(!drawer.includes('ovnav-more'), 'and no More in the drawer');
}
{
    const { navbar, created } = load();
    navbar.init({ service: 'food', user: null, links: [{ label: 'Near', href: '/near' }] });
    assert.ok(!barHtml(created).includes('data-link-id="ovnav-more"'), 'no secondary links: no More');
}
console.log('navbar more: secondary links fold into More, other sites leave the bar ok');
