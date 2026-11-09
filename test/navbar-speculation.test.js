'use strict';
// navbar.js — the rules it hands the browser (speculation rules: a same-site page is prefetched and prerendered, another
// OpenVibe site is prefetched) and the worker it registers when a site asks for it (sw: true).
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

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

function load({ serviceWorker = null } = {}) {
    global.location = { hostname: 'openvibe.chat', href: 'https://openvibe.chat/', pathname: '/', protocol: 'https:', origin: 'https://openvibe.chat' };
    const listeners = {};
    global.window = { location: global.location, isSecureContext: true, addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); } };
    const nav = serviceWorker ? { serviceWorker } : undefined;
    try { Object.defineProperty(global, 'navigator', { value: nav || { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const body = stubElement('body');
    const head = stubElement('head');
    global.document = {
        cookie: '', head, body, documentElement: stubElement('html'), title: 'T', readyState: 'complete',
        getElementById: () => null, createElement: (tag) => stubElement(tag),
        querySelector: () => null, querySelectorAll: () => [],
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.HTMLScriptElement = { supports: () => true };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), head, listeners };
}

const rulesOf = (head) => {
    const script = head.children.filter((c) => c.tag === 'script' && c.type === 'speculationrules').pop();
    return script ? JSON.parse(script.textContent) : null;
};

{   // The rules the browser gets: a same-site page is prefetched and prerendered, another OpenVibe site is prefetched.
    const { navbar, head } = load();
    navbar.init({ service: 'chat', links: [{ label: 'Vibe', href: '/vibe' }] });
    const rules = rulesOf(head);
    assert.ok(rules, 'the rules are in the page');
    assert.ok(Array.isArray(rules.prefetch) && rules.prefetch.length >= 2, 'a prefetch rule');
    assert.strictEqual(rules.prefetch[0].where.and[0].href_matches, '/*', 'the same-site rule');
    assert.strictEqual(rules.prefetch[0].eagerness, 'moderate');
    assert.strictEqual(rules.prefetch[1].where.selector_matches, '[data-ov-net-link]', 'another OpenVibe site');
    assert.ok(Array.isArray(rules.prerender) && rules.prerender.length === 1, 'the page is prerendered too');
    assert.strictEqual(rules.prerender[0].where.and[0].href_matches, '/*');
    // The sign-in, the API and the downloads are never fetched ahead of the click.
    const excluded = rules.prefetch[0].where.and[1].not.href_matches;
    for (const p of ['/auth/*', '/api/*', '/logout*', '/*.zip']) assert.ok(excluded.includes(p), p + ' is left alone');
}

{   // A site that draws its own pages says no to the prerender.
    const { navbar, head } = load();
    navbar.init({ service: 'chat', prerender: false, links: [{ label: 'Vibe', href: '/vibe' }] });
    const rules = rulesOf(head);
    assert.ok(rules && !rules.prerender, 'no prerender');
    assert.ok(rules && rules.prefetch.length >= 2, 'the prefetch stays');
}

{   // The worker: only when a site asks for it.
    const calls = [];
    const { navbar } = load({ serviceWorker: { register: (url, opts) => { calls.push([url, opts]); return Promise.resolve(); } } });
    navbar.init({ service: 'chat', sw: true, links: [{ label: 'Vibe', href: '/vibe' }] });
    assert.strictEqual(calls.length, 1, 'the worker was registered');
    assert.deepStrictEqual(calls[0], ['/openvibe-sw.js', { scope: '/' }]);

    const calls2 = [];
    const again = load({ serviceWorker: { register: (url, opts) => { calls2.push([url, opts]); return Promise.resolve(); } } });
    again.navbar.init({ service: 'chat', sw: { path: '/my-sw.js', scope: '/app/' }, links: [{ label: 'Vibe', href: '/vibe' }] });
    assert.deepStrictEqual(calls2[0], ['/my-sw.js', { scope: '/app/' }], 'a site can point the worker elsewhere');
}

{   // No opt-in, no worker.
    const calls = [];
    const { navbar } = load({ serviceWorker: { register: (url, opts) => { calls.push([url, opts]); return Promise.resolve(); } } });
    navbar.init({ service: 'chat', links: [{ label: 'Vibe', href: '/vibe' }] });
    assert.strictEqual(calls.length, 0, 'a site that did not ask for it gets no worker');

    const calls2 = [];
    const off = load({ serviceWorker: { register: (url, opts) => { calls2.push([url, opts]); return Promise.resolve(); } } });
    off.navbar.init({ service: 'chat', sw: false, links: [{ label: 'Vibe', href: '/vibe' }] });
    assert.strictEqual(calls2.length, 0, 'sw: false is no worker');
}

console.log('navbar-speculation: ok');
