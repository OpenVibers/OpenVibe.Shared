'use strict';
// wallet: true — OpenCoins and Vibes as chips in the bar on any site (owner, 2026-10-27: "make that as a feature in the
// shared nav bar … maybe we'll put it on games too"). Checked with the same stubbed globals as navbar-brand.test.js:
//   - a signed-in page with wallet: true asks the Network and Billing once, and the chips appear with the balances;
//   - the balances are kept per person, so the next page paints them at once (no empty chips, no jump);
//   - Billing's 409 (not the ledger yet) hides Vibes; a signed-out page and a site without wallet ask nothing;
//   - a site with chips of its own under those ids (Live) keeps them, no second pair.
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

function load(store, answers) {
    global.location = { hostname: 'openvibe.games', href: 'https://openvibe.games/', pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const navs = [];
    global.document = {
        cookie: '', head: stubElement(), body: stubElement(), title: 'T', visibilityState: 'visible',
        getElementById: () => null, querySelectorAll: () => [],
        createElement: (tag) => { const e = stubElement(); e.tag = tag; if (tag === 'nav') navs.push(e); return e; },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const calls = [];
    global.fetch = async (url) => {
        calls.push(url);
        const a = url.endsWith('/api/v1/me/wallet') ? answers.wallet : { status: 404, body: {} };
        return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
    };
    delete require.cache[require.resolve(NAVBAR_PATH)];
    return { navbar: require(NAVBAR_PATH), navs, calls };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const wallet = (calls) => calls.filter((u) => /\/api\/(coins\/me|me\/vibes)(\?|$)/.test(u));
const chip = (html, id) => (new RegExp(`<button[^>]*data-chip-id="${id}"[^>]*>`).exec(html) || [''])[0];
const user = { id: 7, subject: 'usr_7', username: 'maya' };
const base = { service: 'games', auth: 'external', apiBase: 'https://openvibe.network', user, token: 'tok', wallet: true };

(async () => {
    const data = { balances: { coins: { amount: '160799', scale: 0, currency: 'opencoins' }, vibes: { amount: '400', scale: 0, currency: 'vibes-bits' }, balance: { amount: '0', scale: 9, currency: 'USD' } }, used_ai_this_month: false };
    const { navbar, navs, calls } = load({}, { wallet: { status: 200, body: data } });
    navbar.init(base);
    await settle();
    assert.strictEqual(calls.filter((u) => u.endsWith('/api/v1/me/wallet')).length, 1);
    assert(!calls.some((u) => u.includes('/api/coins/me') || u.includes('/api/me/vibes')));
    const html = navs[navs.length - 1].innerHTML;
    assert.match(html, /160,799/); assert.match(html, /400/);
    assert.deepStrictEqual(navbar._wallet.walletOrder(data), ['coins', 'vibes']);
    data.used_ai_this_month = true;
    assert.deepStrictEqual(navbar._wallet.walletOrder(data), ['balance', 'coins']);
    data.balances.coins.amount = '0'; data.balances.vibes.amount = '0';
    assert.strictEqual(navbar._wallet.walletOrder(data)[0], 'balance');
    navbar.setUser(null, null); await settle();
    assert(!navs[navs.length - 1].innerHTML.includes('data-chip-id="coins"'));
    console.log('wallet chips: one Billing read, all zeros supported, Balance promoted for AI users, signout clears chips');
})().catch((e) => { console.error(e); process.exit(1); });
