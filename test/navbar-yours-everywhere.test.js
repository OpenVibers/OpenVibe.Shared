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
    // The bell takes the count of new messages (4.187.0: there is no Messages button).
    const bell = [];
    global.OpenVibeNotifications = { setMessages: (n) => bell.push(n), unread: () => 0, setBellAction() {} };
    global.document = {
        cookie: '', head: stubElement(), body: stubElement(), title: 'T', visibilityState: 'visible',
        getElementById: () => null, querySelectorAll: () => [],
        querySelector: () => null,
        createElement: (tag) => { const e = stubElement(); e.tag = tag; if (tag === 'nav') { e.querySelector = () => stubElement(); navs.push(e); } return e; },
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
            : /\/api\/frame\/wallet\/api\/v1\/me\/wallet$|\/api\/coins\/me(\?|$)/.test(url) ? answers.coins
                : { status: 404, body: {} };
        return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
    };
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), navs, calls, bell };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const user = { id: 7, subject: 'usr_7', username: 'maya' };
const base = { service: 'games', auth: 'external', apiBase: 'https://openvibe.network', user, token: 'tok' };
const answers = { coins: { status: 200, body: { balances: { coins: { amount: '1200', scale: 0, currency: 'opencoins' }, vibes: { amount: '300', scale: 0, currency: 'vibes-bits' }, balance: { amount: '0', scale: 9, currency: 'USD' } }, used_ai_this_month: false } }, unread: { status: 200, body: { unread: 3 } } };
const asked = (calls, re) => calls.filter((u) => re.test(u));

(async () => {
    // Nothing said: the balances, and one question to Chat for the unread count, which goes to the bell.
    let { navbar, navs, calls, bell } = load(answers);
    navbar.init(base);
    let bar = navs[navs.length - 1].innerHTML;
    assert.doesNotMatch(bar, /openvibe-messages-btn|ovnav-msgs/, 'no Messages button in the bar: the bell counts them');
    assert.ok(bar.indexOf('id="openvibe-bell-mount"') < bar.indexOf('id="openvibe-avatar-btn"'), 'the bell, then the person: the picture is the last thing in the bar');
    assert.match(bar, /data-chip-id="coins"/, 'the OpenCoins chip');
    await settle();
    assert.match(navs[navs.length - 1].innerHTML, /data-chip-id="vibes"/, 'the Vibes chip, once the wallet says there are Vibes (4.189.0: only the balances a person has)');
    assert.deepStrictEqual(asked(calls, /\/api\/dm\/unread$/), ['https://openvibe.chat/api/dm/unread'], 'Chat is asked for the count');
    assert.strictEqual(asked(calls, /\/api\/frame\/wallet\/api\/v1\/me\/wallet$/).length, 1, 'and the Network (its wallet relay) for the balances');
    assert.deepStrictEqual(bell, [3], 'the count goes to the bell');
    navbar.init(base);
    await settle();
    assert.strictEqual(asked(calls, /\/api\/dm\/unread$/).length, 1, 'at most once a minute');

    // A site with an HTTP-only session can hand its verified token back from /auth/me.
    ({ navbar, navs, calls } = load({ ...answers, session: { status: 200, body: { user, token: 'session-token' } } }));
    navbar.init({ service: 'actor', sessionUrl: '/auth/me', notifications: false, wallet: false });
    await settle();
    assert.strictEqual(navbar.session.token, 'session-token', 'the navbar receives the site session token');

    ({ navbar, calls } = load({ ...answers, session: { status: 200, body: { user } }, sessionToken: { status: 200, body: { token: 'short-access-token' } } }));
    navbar.init({ service: 'actor', sessionUrl: '/auth/me', tokenUrl: '/auth/navbar-token', notifications: false, wallet: false });
    await settle();
    assert.strictEqual(navbar.session.token, 'short-access-token', 'HTTP-only sessions use the same-origin token route');
    assert.ok(calls.includes('/auth/navbar-token'), 'the token route is requested after the session identifies the person');

    // A site that says no.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, wallet: false, messages: false });
    await settle();
    bar = navs[navs.length - 1].innerHTML;
    assert.doesNotMatch(bar, /openvibe-messages-btn|data-chip-id="coins"/);
    assert.strictEqual(asked(calls, /\/api\/(dm\/unread|coins\/me|frame\/wallet)/).length, 0);

    // Signed out: nothing shown, nothing asked.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, user: null, token: null });
    await settle();
    assert.doesNotMatch(navs.map((n) => n.innerHTML).join(''), /openvibe-messages-btn|data-chip-id="coins"/);
    assert.strictEqual(asked(calls, /\/api\/(dm\/unread|coins\/me|frame\/wallet)/).length, 0);

    // A site with its own Messages (Live, Chat) hands its own count to setMessages: Chat is not asked by the navbar.
    ({ navbar, navs, calls } = load(answers));
    navbar.init({ ...base, messages: { href: '/messages' } });
    await settle();
    assert.strictEqual(asked(calls, /\/api\/dm\/unread$/).length, 0);

    // Chat away: nothing is counted, and nothing breaks.
    ({ navbar, navs, calls, bell } = load({ ...answers, unread: { status: 503, body: {} } }));
    navbar.init(base);
    await settle();
    assert.deepStrictEqual(bell, []);
    // A site's own count reaches the bell the same way.
    navbar.setMessages(5);
    assert.deepStrictEqual(bell, [5]);
    console.log('navbar-yours-everywhere: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
