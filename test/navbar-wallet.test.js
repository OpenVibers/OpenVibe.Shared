'use strict';
// The account menu's balances: OpenCoins from Network and Vibes from OpenVibe.Billing (the owner: "make vibes cross site
// too like opencoins"), one request each when the menu first opens. Billing answers 409 until it is the money ledger:
// then there is no Vibes chip at all, never a shadow number.
const assert = require('assert');
const path = require('path');

global.window = global;
global.location = { href: 'https://openvibe.wiki/', hostname: 'openvibe.wiki', protocol: 'https:' };
global.document = { readyState: 'complete', cookie: '', addEventListener() {}, querySelector() { return null; }, getElementById() { return null; } };
const navbar = require(path.join(__dirname, '..', 'navbar.js'));
const { loadWallet, configure } = navbar._wallet;

function dropdown() {
    const els = { '#openvibe-wallet': { hidden: true, innerHTML: '' }, '#openvibe-vibes': { hidden: true, innerHTML: '' } };
    return { els, querySelector: (sel) => els[sel] || null };
}

(async () => {
    const calls = [];
    const answer = { coins: { status: 200, body: { balance: 1234 } }, vibes: { status: 200, body: { credit: 5600, payable: 0 } } };
    global.fetch = async (url, init) => {
        calls.push({ url, init });
        const a = /\/api\/me\/vibes$/.test(url) ? answer.vibes : answer.coins;
        return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
    };

    configure({ token: 'tok', apiBase: 'https://openvibe.network', menu: null });
    let d = dropdown();
    await loadWallet(d);
    assert.deepStrictEqual(calls.map((c) => c.url), ['https://openvibe.network/api/coins/me', 'https://billing.openvibe.network/api/me/vibes']);
    assert.strictEqual(calls[1].init.headers.Authorization, 'Bearer tok');
    assert.strictEqual(calls[1].init.credentials, 'omit', 'no cookies to Billing');
    assert.strictEqual(d.els['#openvibe-wallet'].hidden, false);
    assert.match(d.els['#openvibe-wallet'].innerHTML, /1,234/);
    assert.strictEqual(d.els['#openvibe-vibes'].hidden, false);
    assert.match(d.els['#openvibe-vibes'].innerHTML, /5,600 Vibes/);
    assert.match(d.els['#openvibe-vibes'].innerHTML, /href="https:\/\/openvibe\.live\/#vibes"/);

    await loadWallet(d);
    assert.strictEqual(calls.length, 2, 'once per page');

    // Before the cutover Billing says 409: OpenCoins show, Vibes do not.
    answer.vibes = { status: 409, body: { code: 'billing.not_authoritative' } };
    configure({ token: 'tok' });
    d = dropdown();
    await loadWallet(d);
    assert.strictEqual(d.els['#openvibe-wallet'].hidden, false);
    assert.strictEqual(d.els['#openvibe-vibes'].hidden, true, 'no shadow balance');

    // A site with its own header chips (Live), a bar that shows the balances already, and a signed-out page ask nothing.
    calls.length = 0;
    configure({ token: 'tok', menu: { headerChips: [] } });
    await loadWallet(dropdown());
    configure({ token: 'tok', menu: null, wallet: true });
    await loadWallet(dropdown());
    configure({ token: 'tok', menu: null, wallet: false, chips: [{ id: 'coins', value: '1' }] });
    await loadWallet(dropdown());
    configure({ chips: [] });
    configure({ token: null, menu: null });
    await loadWallet(dropdown());
    assert.strictEqual(calls.length, 0);

    // billingBase points elsewhere (a test cell).
    configure({ token: 'tok', billingBase: 'https://billing.example.test' });
    calls.length = 0;
    await loadWallet(dropdown());
    assert.ok(calls.some((c) => c.url === 'https://billing.example.test/api/me/vibes'));
    console.log('navbar-wallet: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
