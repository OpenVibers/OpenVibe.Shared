'use strict';
// Your things on every site (4.130.0; the owner, 2026-11-07: "make sure DMs are accessible across all sites … same with
// open coins and vibes … visible everywhere"). With nothing said about them:
//   - a signed-in page shows the balances and a Messages button, and asks Chat for the unread count;
//   - wallet: false / messages: false turn them off; a signed-out page shows and asks nothing;
//   - a site with its own messages keeps its own count (no request to Chat).
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement() {
    return {
        style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener(type, fn) { (this.listeners ||= {})[type] = fn; },
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
}

function load(answers) {
    delete global.OpenVibeDock;
    global.location = { hostname: 'openvibe.games', href: 'https://openvibe.games/', pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const navs = [];
    const badge = Object.assign(stubElement(), { parentElement: stubElement() });
    const messageButton = stubElement();
    global.document = {
        cookie: '', head: stubElement(), body: stubElement(), title: 'T', visibilityState: 'visible',
        getElementById: () => null, querySelectorAll: () => [],
        querySelector: (sel) => (sel === '#openvibe-messages-btn b' ? badge : null),
        createElement: (tag) => { const e = stubElement(); e.tag = tag; if (tag === 'nav') { e.querySelector = (sel) => sel === '#openvibe-messages-btn' ? messageButton : stubElement(); navs.push(e); } return e; },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const calls = [];
    global.fetch = async (url) => {
        calls.push(url);
        const a = url === '/auth/navbar-token' ? answers.sessionToken
            : url === '/auth/me' ? answers.session
            : /\/api\/dm\/unread$/.test(url) ? answers.unread
            : /\/api\/coins\/me(\?|$)/.test(url) ? answers.coins
                : { status: 404, body: {} };
        return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
    };
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), navs, calls, badge, messageButton };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const user = { id: 7, subject: 'usr_7', username: 'maya' };
const base = { service: 'games', auth: 'external', apiBase: 'https://openvibe.network', user, token: 'tok' };
const answers = { coins: { status: 200, body: { balance: 1200, vibes: 300 } }, unread: { status: 200, body: { unread: 3 } } };
const asked = (calls, re) => calls.filter((u) => re.test(u));

(async () => {
    // Nothing said: the balances and Messages, and one question to Chat for the unread count.
    let { navbar, navs, calls, badge, messageButton } = load(answers);
    navbar.init(base);
    const dockOpens = [];
    global.OpenVibeDock = { mount() {}, open(options) { dockOpens.push(options); } };
    let prevented = false;
    messageButton.listeners.click({ preventDefault() { prevented = true; }, metaKey: false, ctrlKey: false, shiftKey: false });
    assert.strictEqual(prevented, true, 'signed-in Messages stays on this page');
    assert.deepStrictEqual(dockOpens, [{ tab: 'chats' }], 'the default action opens the Dock Chats tab');
    let bar = navs[navs.length - 1].innerHTML;
    assert.match(bar, /id="openvibe-messages-btn"/, 'Messages is in the bar');
    assert.match(bar, /href="https:\/\/openvibe\.chat\/messages"/, 'and is a real link (a site without the Dock follows it)');
    assert.match(bar, /data-chip-id="coins"/, 'the OpenCoins chip');
    assert.match(bar, /data-chip-id="vibes"/, 'the Vibes chip');
    await settle();
    assert.deepStrictEqual(asked(calls, /\/api\/dm\/unread$/), ['https://openvibe.chat/api/dm/unread'], 'Chat is asked for the count');
    assert.strictEqual(asked(calls, /\/api\/coins\/me/).length, 1, 'and the Network for the balances');
    assert.strictEqual(badge.textContent, '3', 'the count shows on the button');
    navbar.init(base);
    await settle();
    assert.strictEqual(asked(calls, /\/api\/dm\/unread$/).length, 1, 'at most once a minute');

    // A site with an HTTP-only session can hand its verified token back from /auth/me.
    ({ navbar, navs, calls, messageButton } = load({ ...answers, session: { status: 200, body: { user, token: 'session-token' } } }));
    navbar.init({ service: 'actor', sessionUrl: '/auth/me', notifications: false, wallet: false });
    await settle();
    assert.strictEqual(navbar.session.token, 'session-token', 'the navbar receives the site session token');
    const fromSession = [];
    global.OpenVibeDock = { mount() {}, open(options) { fromSession.push(options); } };
    messageButton.listeners.click({ preventDefault() {}, metaKey: false, ctrlKey: false, shiftKey: false });
    assert.deepStrictEqual(fromSession, [{ tab: 'chats' }], 'the site session opens Chats in place');

    ({ navbar, calls } = load({ ...answers, session: { status: 200, body: { user } }, sessionToken: { status: 200, body: { token: 'short-access-token' } } }));
    navbar.init({ service: 'actor', sessionUrl: '/auth/me', tokenUrl: '/auth/navbar-token', notifications: false, wallet: false });
    await settle();
    assert.strictEqual(navbar.session.token, 'short-access-token', 'HTTP-only sessions use the same-origin token route');
    assert.ok(calls.includes('/auth/navbar-token'), 'the token route is requested after the session identifies the person');

    // The button can be pressed while the signed-in page is still resolving its HTTP-only session.
    ({ navbar, messageButton } = load({ ...answers, session: { status: 200, body: { user } }, sessionToken: { status: 200, body: { token: 'late-token' } } }));
    navbar.init({ service: 'actor', user, token: null, sessionUrl: '/auth/me', tokenUrl: '/auth/navbar-token', notifications: false, wallet: false });
    const afterWait = [];
    global.OpenVibeDock = { mount() {}, open(options) { afterWait.push(options); } };
    messageButton.listeners.click({ preventDefault() {}, metaKey: false, ctrlKey: false, shiftKey: false });
    await settle();
    assert.deepStrictEqual(afterWait, [{ tab: 'chats' }], 'a click during session loading opens Chats when the token arrives');

    // A site that says no.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, wallet: false, messages: false });
    await settle();
    bar = navs[navs.length - 1].innerHTML;
    assert.doesNotMatch(bar, /openvibe-messages-btn|data-chip-id="coins"/);
    assert.strictEqual(asked(calls, /\/api\/(dm\/unread|coins\/me)/).length, 0);

    // Signed out: nothing shown, nothing asked.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, user: null, token: null });
    await settle();
    assert.doesNotMatch(navs.map((n) => n.innerHTML).join(''), /openvibe-messages-btn|data-chip-id="coins"/);
    assert.strictEqual(asked(calls, /\/api\/(dm\/unread|coins\/me)/).length, 0);

    // A site with its own Messages (Live, Chat) keeps its own count: Chat is not asked by the navbar.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, messages: { href: '/messages' } });
    await settle();
    assert.match(navs[navs.length - 1].innerHTML, /href="\/messages"/);
    assert.strictEqual(asked(calls, /\/api\/dm\/unread$/).length, 0);

    // Chat away: the button stays, without a number.
    ({ navbar, navs, calls, badge } = load({ ...answers, unread: { status: 503, body: {} } }));
    navbar.init(base);
    await settle();
    assert.match(navs[navs.length - 1].innerHTML, /id="openvibe-messages-btn"/);
    assert.strictEqual(badge.textContent, '');
    console.log('navbar-yours-everywhere: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
