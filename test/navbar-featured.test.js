'use strict';
// navbar.js 4.117.0 — a featured link: the piece a site is built around (the Link on the Network) draws as one
// quiet accent pill with its glyph on the bar, and leads the phone's menu. Deliberate, not loud: no animation.
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
    global.location = { hostname: 'openvibe.network', href: 'https://openvibe.network/', pathname: '/', protocol: 'https:', origin: 'https://openvibe.network' };
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
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ nav: [], groups: [] }) });
    delete globalThis.OVFrame;
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), created };
}
const barHtml = (created) => (created.filter((e) => e.tag === 'nav' && /openvibe-navbar-links/.test(e.innerHTML)).pop() || { innerHTML: '' }).innerHTML;
const between = (html, a, b) => { const i = html.indexOf(a); const j = html.indexOf(b, i); return i < 0 ? '' : html.slice(i, j < 0 ? undefined : j); };

{
    // The Link is the piece the Network is built around: it leads, and it is a pill with its glyph.
    const { navbar, created } = load();
    navbar.init({ service: 'network', user: null, links: [
        { label: 'Link', href: 'https://openvibe.link', icon: 'fa-house', featured: true },
        { label: 'My Account', href: '/my' },
        { label: 'Themes', href: '/themes' },
    ] });
    const bar = between(barHtml(created), 'openvibe-navbar-links', 'openvibe-navbar-spacer');
    assert.ok(bar.includes('ovnav-link--featured'), 'the featured link is drawn as the pill');
    assert.ok(/href="https:\/\/openvibe\.link"[^>]*class="ovnav-link ovnav-link--featured"/.test(bar), 'the pill links to Link');
    assert.ok(bar.includes('fa-house') || bar.includes('ovnav-ic'), 'the pill carries its glyph');
    // Deliberate, not loud: one accent, no animation on the pill.
    assert.ok(!/ovnav-link--featured[^}]*animation/.test(bar), 'the pill does not animate');
    const drawer = between(barHtml(created), 'id="openvibe-drawer"', 'ovnav-drawer-net');
    assert.ok(drawer.indexOf('>Link<') >= 0 && drawer.indexOf('>Link<') < drawer.indexOf('>My Account<'), 'on a phone the Link is the first entry of the menu');
    // 4.119.0: on a phone the links row folds away, so the featured link keeps an icon button on the bar itself.
    const right = between(barHtml(created), 'openvibe-navbar-right', 'openvibe-bell-mount');
    assert.ok(/<a class="ovnav-featured-phone" href="https:\/\/openvibe\.link" aria-label="Link"/.test(right), 'the phone bar has the Link button, named for readers');
    assert.strictEqual((barHtml(created).match(/ovnav-featured-phone"/g) || []).length, 1, 'one phone button');
}
{
    // Without the option, nothing changes: an ordinary link, in the order it was given.
    const { navbar, created } = load();
    navbar.init({ service: 'network', user: null, links: [
        { label: 'My Account', href: '/my' },
        { label: 'Link', href: 'https://openvibe.link', icon: 'fa-house' },
    ] });
    const bar = between(barHtml(created), 'openvibe-navbar-links', 'openvibe-navbar-spacer');
    assert.ok(!bar.includes('ovnav-link--featured'), 'a plain link is not a pill');
    const drawer = between(barHtml(created), 'id="openvibe-drawer"', 'ovnav-drawer-net');
    assert.ok(drawer.indexOf('>My Account<') < drawer.indexOf('>Link<'), 'and it keeps its place in the menu');
    assert.ok(!barHtml(created).includes('ovnav-featured-phone"'), 'no phone button without a featured link');
}
{
    // The stylesheet carries the pill: one hairline, one tint, the glyph, and nothing that moves.
    const src = require('fs').readFileSync(NAVBAR_PATH, 'utf8');
    assert.ok(src.includes('.openvibe-navbar-links a.ovnav-link--featured'), 'the pill has its own rule');
    assert.ok(/ovnav-link--featured \{[^}]*border-radius: 999px/.test(src), 'the pill is round');
    assert.ok(/ovnav-link--featured \{[^}]*transition: none/.test(src), 'and it does not animate');
}
console.log('navbar featured: one quiet accent pill, first in the phone menu ok');
