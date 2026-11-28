'use strict';
// 4.341.0: the navbar's frameBase defaults to null, and a null skipped catchUp's default, so "null/wallet/changes" was
// asked of the page's own site (Live, Restream, Network: ~40 404s a day, /@name/null/wallet/changes on a channel). The
// purse uses only an absolute address, else the Network's frame; the navbar passes the default too.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'purse.js'), 'utf8');
const NAV = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');

(async () => {
    const asked = [];
    const win = {
        document: { getElementById: () => null, createElement: () => ({ setAttribute() {}, append() {}, style: {} }), head: { append() {} }, querySelector: () => null },
        sessionStorage: { getItem: () => null, setItem() {} },
        fetch: async (url) => { asked.push(String(url)); return { ok: false, json: async () => ({}) }; },
        setTimeout, clearTimeout,
    };
    vm.runInNewContext(SRC, { window: win, setTimeout, clearTimeout, console });
    const purse = win.OpenVibePurse;
    assert.ok(purse && typeof purse.catchUp === 'function', 'the purse loads');
    const bases = [null, undefined, '', 'null', '/api/frame'];
    await bases.reduce((chain, frameBase) => chain.then(async () => {
        asked.length = 0;
        await purse.catchUp({ frameBase, user: `u-${String(frameBase)}` });
        assert.deepStrictEqual(asked, ['https://openvibe.network/api/frame/wallet/changes'], `frameBase ${JSON.stringify(frameBase)}: the Network's frame, never the page's own site`);
    }), Promise.resolve());
    asked.length = 0;
    await purse.catchUp({ frameBase: 'https://openre.stream/api/frame/', user: 'u-own' });
    assert.deepStrictEqual(asked, ['https://openre.stream/api/frame/wallet/changes'], 'a site\'s own absolute frame is used');
    assert.ok(NAV.includes("({ frameBase: _config.frameBase || 'https://openvibe.network/api/frame', token, user: u.subject || u.id,"), 'the navbar passes the default, like its other wallet calls');
    console.log('purse-null-base: a null or relative frame base asks the Network, never "null/wallet/changes" on the page\'s own site');
})().catch((e) => { console.error(e); process.exit(1); });
