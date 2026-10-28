'use strict';
// navbar.js — the phone app bar (appBar): a site's main places as a bottom tab bar, built from its own links or a list,
// with More for the rest, the open page marked, and nothing at all unless the site asks for it.
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');
const APPBAR_PATH = path.join(__dirname, '..', 'appbar.js');

function stubElement(tag) {
    const el = {
        tag, style: { setProperty() {} }, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [], removed: false,
        classes: new Set(),
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); return c; }, prepend(c) { this.children.unshift(c); }, remove() { this.removed = true; }, addEventListener() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
    };
    el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle() {}, contains: (c) => el.classes.has(c) };
    return el;
}

function load(pathname = '/', { preload = true } = {}) {
    global.location = { hostname: 'openvibe.chat', href: `https://openvibe.chat${pathname}`, pathname, protocol: 'https:', origin: 'https://openvibe.chat' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const body = stubElement('body');
    const html = stubElement('html');
    global.document = {
        cookie: '', head: stubElement('head'), body, documentElement: html, title: 'T',
        getElementById: () => null, createElement: (tag) => stubElement(tag),
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete globalThis.OpenVibeAppBar;
    delete require.cache[require.resolve(APPBAR_PATH)];
    if (preload) require(APPBAR_PATH);   // what the page has once navbar.js has fetched appbar.js
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), body, html, head: global.document.head };
}
const barOf = (body) => body.children.filter((c) => c.className === 'ovnav-appbar' && !c.removed).pop() || null;
const LINKS = [
    { label: 'Vibe', href: '/vibe', icon: 'fa-wand-magic-sparkles' },
    { label: 'Global chat', href: '/', icon: 'fa-comments' },
    { label: 'Rooms', href: '/rooms', icon: 'fa-people-group' },
    { label: 'Servers', href: '/servers', icon: 'fa-server' },
    { label: 'Messages', href: '/messages', icon: 'fa-comment-dots', dot: true },
    { label: 'Settings', href: '/settings', icon: 'fa-gear' },
];

{   // Not asked for: no bar, no class, and appbar.js is never fetched.
    const { navbar, body, html, head } = load('/rooms', { preload: false });
    navbar.init({ service: 'chat', links: LINKS });
    assert.strictEqual(barOf(body), null);
    assert.ok(!html.classList.contains('ov-has-appbar'));
    assert.ok(!head.children.some((c) => c.tag === 'script' && /appbar\.js/.test(c.src || '')), 'nothing fetched');
}
{   // Asked for: navbar.js fetches appbar.js (once) and draws the bar when it arrives.
    const { navbar, head } = load('/rooms', { preload: false });
    navbar.init({ service: 'chat', links: LINKS, appBar: true });
    navbar.setActive('rooms');
    const scripts = head.children.filter((c) => c.tag === 'script' && /appbar\.js$/.test(c.src || ''));
    assert.strictEqual(scripts.length, 1, 'fetched once');
    assert.strictEqual(typeof scripts[0].onload, 'function');
}
{   // appBar: true → the first four links with icons and More (six links); the open page marked, under its path too.
    const { navbar, body, html } = load('/rooms/night-owls');
    navbar.init({ service: 'chat', links: LINKS, appBar: true });
    const bar = barOf(body);
    assert.ok(bar, 'the bar is in the page');
    assert.strictEqual(bar.attrs['aria-label'], 'App');
    assert.ok(html.classList.contains('ov-has-appbar'), 'pages keep their bottom');
    const items = bar.innerHTML.match(/<a href="[^"]*"/g);
    assert.deepStrictEqual(items, ['<a href="/vibe"', '<a href="/"', '<a href="/rooms"', '<a href="/servers"']);
    assert.ok(bar.innerHTML.includes('data-ab-more') && bar.innerHTML.includes('>More<'), 'More for the rest');
    assert.ok(/<a href="\/rooms" class="ovnav-ab is-here" aria-current="page">/.test(bar.innerHTML), 'a page under /rooms marks Rooms');
    assert.ok(!/<a href="\/" class="ovnav-ab is-here"/.test(bar.innerHTML), 'the home link is not open on /rooms/…');
}
{   // On the front page, home is the open one; five links with icons fit without More.
    const { navbar, body } = load('/');
    navbar.init({ service: 'chat', links: LINKS.slice(0, 5), appBar: true });
    const bar = barOf(body);
    assert.ok(/<a href="\/" class="ovnav-ab is-here" aria-current="page">/.test(bar.innerHTML));
    assert.ok(!bar.innerHTML.includes('data-ab-more'), 'five fit');
    assert.ok(bar.innerHTML.includes('ovnav-ab-dot'), 'a link\'s dot shows on its tab');
}
{   // A list of its own, labels escaped, at most five; setAppBar(false) takes it away.
    const { navbar, body, html } = load('/deals');
    navbar.init({ service: 'deals', links: [], appBar: [
        { label: 'Home', href: '/', icon: 'fa-house' }, { label: 'Deals <b>', href: '/deals', icon: 'fa-tag' },
        { label: 'Search', href: '/search', icon: 'fa-magnifying-glass' }, { label: 'Saved', href: '/saved', icon: 'fa-heart' },
        { label: 'You', href: '/me', icon: 'fa-user' }, { label: 'Sixth', href: '/six', icon: 'fa-star' },
    ] });
    const bar = barOf(body);
    assert.strictEqual(bar.innerHTML.match(/<a href=/g).length, 5, 'five at most');
    assert.ok(bar.innerHTML.includes('Deals &lt;b&gt;') && !bar.innerHTML.includes('<b>'), 'labels are escaped');
    assert.ok(/<a href="\/deals" class="ovnav-ab is-here"/.test(bar.innerHTML));
    navbar.setAppBar(false);
    assert.strictEqual(barOf(body), null, 'gone');
    assert.ok(!html.classList.contains('ov-has-appbar'));
}
{   // Fewer than two places is no bar; links without icons do not make tabs (More holds them).
    const { navbar, body } = load('/');
    navbar.init({ service: 'x', links: [{ label: 'A', href: '/a' }, { label: 'B', href: '/b', icon: 'fa-star' }], appBar: true });
    assert.strictEqual(barOf(body), null, 'one tab is no tab bar');
}
console.log('navbar app bar: opt-in, from links or a list, More, the open page, escaping, removal ok');
