'use strict';
// The account menu's balances: OpenCoins and Vibes from the Network in one request (it asks Billing; the owner: "make
// vibes cross site too like opencoins"), once when the menu first opens. A Network that gives no Vibes means no Vibes
// chip, never a shadow number, and Billing is never asked directly (no site's CSP allows it; the fallback went in 4.172.0).
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

    answer.coins = { status: 200, body: { balance: 1234, vibes: 5600 } };
    configure({ token: 'tok', apiBase: 'https://openvibe.network', menu: null });
    let d = dropdown();
    await loadWallet(d);
    assert.deepStrictEqual(calls.map((c) => c.url), ['https://openvibe.network/api/coins/me?with=vibes']);
    assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok');
    assert.strictEqual(d.els['#openvibe-wallet'].hidden, false);
    assert.match(d.els['#openvibe-wallet'].innerHTML, /1,234/);
    assert.strictEqual(d.els['#openvibe-vibes'].hidden, false);
    assert.match(d.els['#openvibe-vibes'].innerHTML, /5,600 <small>Vibes<\/small>/);
    assert.match(d.els['#openvibe-wallet'].innerHTML, /1,234 <small>OpenCoins<\/small>/, 'each balance says what it is');
    assert.match(d.els['#openvibe-vibes'].innerHTML, /href="https:\/\/openvibe\.live\/#vibes"/);

    await loadWallet(d);
    assert.strictEqual(calls.length, 1, 'once per page');

    // No Vibes from the Network (null, or an answer without them): OpenCoins show, Vibes do not, Billing is not asked.
    for (const body of [{ balance: 1234, vibes: null }, { balance: 1234 }]) {
        answer.coins = { status: 200, body };
        configure({ token: 'tok' });
        calls.length = 0;
        d = dropdown();
        await loadWallet(d);
        assert.strictEqual(d.els['#openvibe-wallet'].hidden, false);
        assert.strictEqual(d.els['#openvibe-vibes'].hidden, true, 'no shadow balance');
        assert.ok(!calls.some((c) => /billing\./.test(c.url)), 'Billing is never asked directly');
    }

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

    // A Network that answers both: one request.
    configure({ token: 'tok', menu: null, wallet: false, chips: [] });
    answer.coins = { status: 200, body: { balance: 1234, vibes: 77 } };
    calls.length = 0;
    d = dropdown();
    await loadWallet(d);
    assert.deepStrictEqual(calls.map((c) => c.url), ['https://openvibe.network/api/coins/me?with=vibes']);
    assert.match(d.els['#openvibe-vibes'].innerHTML, /77 <small>Vibes<\/small>/);
    console.log('navbar-wallet: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
