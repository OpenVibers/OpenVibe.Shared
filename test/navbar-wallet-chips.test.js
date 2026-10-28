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
        const a = /\/api\/me\/vibes$/.test(url) ? answers.vibes : /\/api\/coins\/me(\?|$)/.test(url) ? answers.coins : { status: 404, body: {} };
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
    const store = {};
    const answers = { coins: { status: 200, body: { balance: 160774 } }, vibes: { status: 200, body: { credit: 2500 } } };

    // First visit: no balances known yet, so the chips wait (hidden), then appear with the numbers and fold on a phone.
    let { navbar, navs, calls } = load(store, answers);
    navbar.init(base);
    assert.match(chip(navs[0].innerHTML, 'coins'), /hidden/, 'nothing to show before the balances arrive');
    await settle();
    // An older Network answers the coins only: Vibes come from Billing itself (4.25.0 asks the Network for both first).
    assert.deepStrictEqual(wallet(calls).sort(), ['https://billing.openvibe.network/api/me/vibes', 'https://openvibe.network/api/coins/me?with=vibes']);
    const last = navs[navs.length - 1].innerHTML;
    assert.ok(navs.length >= 2, 'drawn again once the chips appeared');
    assert.doesNotMatch(chip(last, 'coins'), /hidden/);
    assert.match(last, /data-chip-id="coins"[^>]*>[\s\S]*?160,774/);
    assert.match(last, /data-chip-id="vibes"[^>]*>[\s\S]*?2,500/);
    assert.match(last, /id="openvibe-chips-all"/, 'one folded chip for phones');
    assert.match(last, /aria-label="Your balances: OpenCoins 160,774, Vibes 2,500"/);
    assert.deepStrictEqual(JSON.parse(store['ov-wallet:usr_7']), { coins: '160,774', vibes: '2,500' });

    // A Network that answers both (4.25.0): one request, Billing never asked (no site's connect-src allowed it).
    {
        const store2 = {};
        const both = { coins: { status: 200, body: { balance: 160774, vibes: 2500 } }, vibes: { status: 500, body: {} } };
        const r = load(store2, both);
        r.navbar.init(base);
        await settle();
        assert.deepStrictEqual(wallet(r.calls), ['https://openvibe.network/api/coins/me?with=vibes'], 'one request for both balances');
        assert.match(r.navs[r.navs.length - 1].innerHTML, /data-chip-id="vibes"[^>]*>[\s\S]*?2,500/);
    }
    ({ navbar, navs, calls } = load(store, answers));
    navbar.init(base);
    await settle();

    // Drawn again on the same page within a minute: no second request.
    const before = wallet(calls).length;
    navbar.init(base);
    await settle();
    assert.strictEqual(wallet(calls).length, before, 'at most once a minute');

    // Next page: the kept balances paint at once.
    ({ navbar, navs, calls } = load(store, answers));
    navbar.init(base);
    assert.doesNotMatch(chip(navs[0].innerHTML, 'coins'), /hidden/);
    assert.match(navs[0].innerHTML, /data-chip-id="coins"[^>]*>[\s\S]*?160,774/, 'painted from the kept balance');
    await settle();

    // Billing not the ledger yet (409): the Vibes chip goes away and is forgotten; OpenCoins stay.
    answers.vibes = { status: 409, body: { code: 'billing.not_authoritative' } };
    ({ navbar, navs, calls } = load(store, answers));
    navbar.init(base);
    await settle();
    const after409 = navs[navs.length - 1].innerHTML;
    assert.match(chip(after409, 'vibes'), /hidden/);
    assert.doesNotMatch(chip(after409, 'coins'), /hidden/);
    assert.doesNotMatch(after409, /id="openvibe-chips-all"/, 'one chip left: nothing to fold');
    assert.deepStrictEqual(JSON.parse(store['ov-wallet:usr_7']), { coins: '160,774' });

    // Signed out, or a site that did not ask: no chips, no requests.
    ({ navbar, navs, calls } = load({}, answers));
    navbar.init({ ...base, user: null, token: null });
    navbar.init({ ...base, wallet: false });
    await settle();
    assert.strictEqual(wallet(calls).length, 0);
    assert.doesNotMatch(navs.map((n) => n.innerHTML).join(''), /data-chip-id="coins"/);

    // Live sets its own coins and vibes chips: they stay, with no second pair.
    ({ navbar, navs, calls } = load({}, answers));
    navbar.init({ ...base, chips: [{ id: 'coins', icon: 'fa-coins', value: '9' }, { id: 'vibes', icon: 'fa-wallet', value: '1' }] });
    await settle();
    const live = navs[navs.length - 1].innerHTML;
    assert.strictEqual((live.match(/data-chip-id="coins"/g) || []).length, 1);
    assert.match(live, /data-chip-id="coins"[^>]*>[\s\S]*?>9</);
    console.log('navbar-wallet-chips: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
