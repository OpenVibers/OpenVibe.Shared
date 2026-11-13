'use strict';
// §Z.2 (11-13), the owner: navigation "user aware and session aware and … aware of rank … user can through API and SDK
// read it". One viewer model in the navbar, OpenVibeNavbar.viewer() and OV.viewer():
//   - a guest, a member, a streamer, a mod, an admin and the owner each read as themselves (rank, staff, owner);
//   - it is written on <html data-ov-viewer data-ov-rank>, and `openvibe-viewer` fires only when it changes;
//   - the visit's start is kept per tab (sessionStorage), so its minutes count the visit, not the page;
//   - the device part reads the media queries (a phone is narrow and coarse) and the motion setting.
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement() {
    return {
        style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
}

function load({ media = {}, visit = null } = {}) {
    global.location = { hostname: 'openvibe.games', href: 'https://openvibe.games/', pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const html = stubElement();
    html.style = { setProperty() {}, removeProperty() {} };
    global.document = {
        cookie: '', head: stubElement(), body: stubElement(), documentElement: html, title: 'T', visibilityState: 'visible',
        getElementById: () => null, querySelectorAll: () => [],
        createElement: () => stubElement(), addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const session = visit ? { 'ov.visit.t0': String(visit) } : {};
    global.sessionStorage = { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem() {} };
    global.matchMedia = (q) => ({ matches: !!media[q] });
    const events = [];
    global.dispatchEvent = (e) => { events.push(e); return true; };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete global.OV;
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), html, events, session };
}
const base = { service: 'games', auth: 'external', apiBase: 'https://openvibe.network', token: 'tok', wallet: false };

// A guest.
{
    const { navbar, html, events } = load();
    navbar.init(base);
    const v = navbar.viewer();
    assert.strictEqual(v.signedIn, false);
    assert.strictEqual(v.rank, 'guest');
    assert.strictEqual(v.staff, false);
    assert.strictEqual(v.owner, false);
    assert.strictEqual(v.id, null);
    assert.strictEqual(html.getAttribute('data-ov-viewer'), 'guest');
    assert.strictEqual(html.getAttribute('data-ov-rank'), 'guest');
    assert.strictEqual(events.filter((e) => e.type === 'openvibe-viewer').length, 1, 'one event for the first look');
}

// Every rank reads as itself; the owner is staff whatever their role says; an unknown role is a member.
const RANKS = [
    ['user', {}, 'member', 'member', false, false],
    ['streamer', {}, 'streamer', 'member', false, false],
    ['global_mod', {}, 'mod', 'staff', true, false],
    ['admin', {}, 'admin', 'staff', true, false],
    ['user', { is_owner: true }, 'member', 'owner', true, true],
    ['something_new', {}, 'member', 'member', false, false],
];
RANKS.forEach(([role, caps, rank, tag, staff, owner]) => {
    const { navbar, html } = load();
    navbar.init({ ...base, user: { id: 7, username: 'maya', role, capabilities: caps } });
    const v = navbar.viewer();
    assert.deepStrictEqual([v.signedIn, v.rank, v.staff, v.owner, v.username], [true, rank, staff, owner, 'maya'], `${role} ${JSON.stringify(caps)}`);
    assert.strictEqual(html.getAttribute('data-ov-viewer'), tag, role);
    assert.strictEqual(html.getAttribute('data-ov-rank'), rank, role);
});

// The event fires when the viewer changes (a sign-in, a sign-out), never on a re-render of the same one.
{
    const { navbar, events } = load();
    navbar.init(base);
    navbar.setUser({ id: 7, username: 'maya', role: 'user' });
    navbar.setUser({ id: 7, username: 'maya', role: 'user' });
    navbar.setUser(null);
    const seen = events.filter((e) => e.type === 'openvibe-viewer').map((e) => e.detail.rank);
    assert.deepStrictEqual(seen, ['guest', 'member', 'guest']);
}

// The visit counts from the tab's first page, and the device reads the media queries and the motion setting.
{
    const started = Date.now() - 12.5 * 60000;
    const { navbar, html, session } = load({ visit: started, media: { '(max-width: 640px)': true, '(pointer: coarse)': true, '(prefers-reduced-motion: reduce)': true } });
    navbar.init(base);
    const v = navbar.viewer();
    assert.strictEqual(v.visit.minutes, 12);
    assert.strictEqual(v.visit.startedAt, new Date(started).toISOString());
    assert.strictEqual(session['ov.visit.t0'], String(started), 'a later page keeps the visit\'s start');
    assert.deepStrictEqual(v.device, { phone: true, touch: true, installed: false, motion: 'reduced' });
    html.setAttribute('data-ov-motion', 'off');
    assert.strictEqual(navbar.viewer().device.motion, 'off', 'the person\'s own Off wins over the system');
}

// A first page starts the visit.
{
    const { navbar, session } = load();
    navbar.init(base);
    assert.ok(Number(session['ov.visit.t0']) > Date.now() - 5000);
    assert.strictEqual(navbar.viewer().visit.minutes, 0);
}

console.log('viewer-model: ok');
