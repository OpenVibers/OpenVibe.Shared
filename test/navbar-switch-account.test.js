'use strict';
// Switching accounts from any site's menu (owner, 2026-10-26: "the thing that lets you switch … between different
// accounts doesn't work"). On a product site the menu's accounts dispatched an event only openvibe.network's account
// switcher listened to, so a click did nothing; "Add another account" went to the Network and back to the page without
// ever signing this site in. Now:
//   - the menu lists the accounts this browser used here (the switcher's and the ones the navbar saw signed in, no
//     tokens), and each is a link: the Network makes it the active account (switch_to, login_hint) and comes back
//     through this site's own sign-in (its loginUrl, made absolute), which signs the site in as it;
//   - "Add another account" goes the same way (add_account), so the site ends up signed in as the new account;
//   - on openvibe.network's own pages, where the account switcher is loaded, accounts still switch in place;
//   - "Switch to Anonymous" shows only where something handles it, and names are escaped.
const assert = require('assert');
const path = require('path');

const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement(made) {
    const el = {
        style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, append() {}, prepend() {}, remove() {}, setAttribute() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
    if (made) made.push(el);
    return el;
}

function loadNavbar({ hostname, href, storage = {}, switcher = false }) {
    const made = [];
    global.location = { hostname, href, protocol: 'https:', origin: `https://${hostname}`, search: '' };
    global.window = { location: global.location };
    // The navbar's root is the global object (window in a browser).
    if (switcher) { global.window.OpenVibeAccountSwitcher = {}; global.OpenVibeAccountSwitcher = {}; } else delete global.OpenVibeAccountSwitcher;
    global.document = {
        cookie: '', head: stubElement(), body: stubElement(), getElementById: () => null, querySelector: () => null,
        createElement: () => stubElement(made), addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
    const store = { ...storage };
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete require.cache[require.resolve(NAVBAR_PATH)];
    const navbar = require(NAVBAR_PATH);
    return { navbar, made, store };
}

const ME = { id: 7, username: 'goosely', display_name: 'goosely', avatar_url: null, role: 'user' };
const ALT = { id: 8, username: 'alt', display_name: 'Alt <img src=x onerror=alert(1)>', avatar_url: null };
const unescape = (s) => s.replace(/&amp;/g, '&');
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => unescape(m[1]));

(async () => {
    // ── A product site: links through the Network and back through the site's own sign-in ──
    {
        const { navbar, made, store } = loadNavbar({
            hostname: 'openvibe.video', href: 'https://openvibe.video/v/12?t=30',
            storage: { openvibe_seen_accounts: JSON.stringify([ALT]) },
        });
        navbar.init({ service: 'video', apiBase: 'https://openvibe.network', user: ME, loginUrl: '/auth/login?next={url}' });
        await new Promise((r) => setImmediate(r));
        const menu = made.find((e) => e.className === 'openvibe-navbar-dropdown');
        assert.ok(menu, 'the account menu renders');
        const links = hrefs(menu.innerHTML);

        const sw = links.find((h) => h.includes('switch_to='));
        assert.ok(sw, 'the other account is a link');
        const su = new URL(sw);
        assert.strictEqual(su.origin + su.pathname, 'https://openvibe.network/login');
        assert.strictEqual(su.searchParams.get('switch_to'), '8');
        assert.strictEqual(su.searchParams.get('login_hint'), 'alt');
        const back = new URL(su.searchParams.get('return'));
        assert.strictEqual(back.origin + back.pathname, 'https://openvibe.video/auth/login', "it comes back through the site's sign-in");
        assert.strictEqual(back.searchParams.get('next'), 'https://openvibe.video/v/12?t=30', 'and then to this page');

        const add = new URL(links.find((h) => h.includes('add_account=')));
        assert.strictEqual(add.searchParams.get('add_account'), '1');
        assert.strictEqual(new URL(add.searchParams.get('return')).pathname, '/auth/login', 'a new account signs this site in too');

        assert.ok(!/data-account-id/.test(menu.innerHTML), 'no in-place switch items without the account switcher');
        assert.ok(!/Switch to Anonymous/.test(menu.innerHTML), 'nothing handles anonymous here');
        assert.ok(/<span>Alt &lt;img src=x onerror=alert\(1\)&gt;<\/span>/.test(menu.innerHTML), 'names are text, never markup');
        assert.ok(!links.some((h) => h.includes('switch_to=7')), 'the current account is not offered');

        const seen = JSON.parse(store.openvibe_seen_accounts);
        assert.deepStrictEqual(seen.map((a) => a.id), [7, 8], 'the account signed in here is remembered first');
        assert.ok(seen.every((a) => !('token' in a)), 'never a token');
    }

    // ── Many seen accounts: at most ten, and anonymous visitors are never remembered ──
    {
        const many = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, username: `u${i}` }));
        const { navbar, store } = loadNavbar({ hostname: 'openvibe.food', href: 'https://openvibe.food/', storage: { openvibe_seen_accounts: JSON.stringify(many) } });
        navbar.init({ service: 'food', apiBase: 'https://openvibe.network', user: ME, loginUrl: '/auth/login?next={path}' });
        await new Promise((r) => setImmediate(r));
        assert.strictEqual(JSON.parse(store.openvibe_seen_accounts).length, 10);
        const anon = loadNavbar({ hostname: 'openvibe.food', href: 'https://openvibe.food/' });
        anon.navbar.init({ service: 'food', apiBase: 'https://openvibe.network', user: { id: 'anon_3', is_anon: true, anon_number: 3 }, loginUrl: '/auth/login?next={path}' });
        await new Promise((r) => setImmediate(r));
        assert.strictEqual(anon.store.openvibe_seen_accounts, undefined);
    }

    // ── openvibe.network's own pages: the account switcher switches in place ──
    {
        const { navbar, made } = loadNavbar({
            hostname: 'openvibe.network', href: 'https://openvibe.network/my', switcher: true,
            storage: { openvibe_accounts: JSON.stringify([{ ...ALT, token: 't' }]) },
        });
        navbar.init({ service: 'network', apiBase: 'https://openvibe.network', user: ME });
        await new Promise((r) => setImmediate(r));
        const menu = made.find((e) => e.className === 'openvibe-navbar-dropdown');
        assert.ok(/data-account-id="8"/.test(menu.innerHTML), 'in place');
        assert.ok(/Switch to Anonymous/.test(menu.innerHTML));
        const add = new URL(hrefs(menu.innerHTML).find((h) => h.includes('add_account=')));
        assert.strictEqual(add.searchParams.get('return'), 'https://openvibe.network/my', 'on the Network the page itself is the sign-in');
    }

    console.log('navbar-switch-account: all tests passed');
    process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
