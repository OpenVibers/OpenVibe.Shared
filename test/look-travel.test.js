'use strict';
// One look, everywhere (4.64.0, plan L42). Each OpenVibe domain keeps its own copy of the look, so:
// - every copy is dated, and the newest wins between this browser and the account (an account without dates still
//   wins, unless a change made here in the last minute may not have reached it);
// - a click on a link to another OpenVibe site carries the look (?ov_look=: what is painted, the display settings and
//   the theme, each dated); the next site adopts it when newer, before its first paint, and takes it out of the
//   address; it is read only after an OpenVibe page, and only colours pass;
// - Calm no longer hides the mark's O (the Pair's ring shares the old comet's class).
// theme-loader.js runs here in a small fake browser.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');
const NOW = new Date(2026, 10, 5, 12).getTime();   // 5 November: no season

function load({ store = new Map(), href = 'https://openvibe.live/', referrer = '', active = null, now = NOW, cookie = 'ov_sso_hint=account' } = {}) {
    class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
    const attrs = new Map(); const props = new Map(); const puts = []; const docListeners = {}; const replaced = [];
    const html = {
        style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k), getPropertyValue: (k) => props.get(k) || '' },
        setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k),
        attrs, props,
    };
    const u = new URL(href);
    const sandbox = {
        Date: FixedDate, JSON, Object, String, Number, Math, Array, Promise, Error, URL, URLSearchParams,
        atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        document: { documentElement: html, readyState: 'complete', cookie, head: null, querySelector: () => null, getElementById: () => null, referrer, visibilityState: 'visible',
            addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); } },
        setTimeout: () => 0, clearTimeout() {},
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
        location: { hostname: u.hostname, protocol: u.protocol, href: u.href, search: u.search, pathname: u.pathname, hash: u.hash },
        history: { state: null, replaceState: (_s, _t, url) => replaced.push(url) },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        fetch: (url, o) => {
            if (o && o.method === 'PUT') { puts.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }); }
            return Promise.resolve(active ? { ok: true, json: () => Promise.resolve(active) } : { ok: false, json: () => Promise.resolve(null) });
        },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener() {}, dispatchEvent() {},
    };
    sandbox.window = sandbox; sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    const click = (linkHref) => {
        const a = { href: linkHref, hasAttribute: () => false, closest: () => a };
        (docListeners.pointerdown || []).forEach((fn) => fn({ target: a }));
        return a.href;
    };
    return { L: sandbox.OpenVibeThemeLoader, html, puts, store, replaced, click };
}
const settle = () => new Promise((r) => setImmediate(r));
const display = (store) => JSON.parse(store.get('ov_display') || 'null');

(async () => {
    // ── Calm no longer hides the O ──
    assert.ok(!SRC.includes('.ov-mark .o,') && !/data-ov-motion=reduced\] \.ov-mark \.o\{display:none/.test(SRC), 'Calm keeps the mark whole');

    // ── A change made here is dated, and the date goes to the account ──
    let p = load();
    p.L.display.set({ seasonal: 'off' });
    assert.strictEqual(display(p.store).seasonal, 'off');
    assert.strictEqual(display(p.store).at, NOW, 'dated now');

    // ── A theme saved here carries its date too (4.67.0): the account keeps the newest ──
    p = load();
    p.L.save('nord');
    const themePut = p.puts.find((x) => /\/api\/themes\/me$/.test(x.url));
    assert.ok(themePut && themePut.body.theme_id === 'nord' && themePut.body.at === NOW, 'the theme\'s PUT is dated');

    // ── The account's answer: newest wins ──
    const older = new Map([['ov_display', JSON.stringify({ seasonal: 'off', at: NOW - 5000 })]]);
    p = load({ store: older, active: { theme_id: 'vibe', display: { seasonal: 'on' }, display_at: NOW - 60000 } });
    await settle(); await settle();
    assert.strictEqual(display(p.store).seasonal, 'off', 'an older account copy does not undo a newer change here');
    assert.ok(p.puts.some((x) => /me\/display$/.test(x.url) && x.body.seasonal === 'off' && x.body.at === NOW - 5000), 'and the account catches up, with this copy\'s date');

    const newer = new Map([['ov_display', JSON.stringify({ seasonal: 'on', at: NOW - 600000 })]]);
    p = load({ store: newer, active: { theme_id: 'vibe', display: { seasonal: 'off' }, display_at: NOW - 1000 } });
    await settle(); await settle();
    assert.strictEqual(display(p.store).seasonal, 'off', 'a newer account copy wins');
    assert.strictEqual(display(p.store).at, NOW - 1000, 'and keeps its date');

    const undated = new Map([['ov_display', JSON.stringify({ seasonal: 'on', at: NOW - 600000 })]]);
    p = load({ store: undated, active: { theme_id: 'vibe', display: { seasonal: 'off' } } });
    await settle(); await settle();
    assert.strictEqual(display(p.store).seasonal, 'off', 'an account without dates still wins over an old copy');
    const fresh = new Map([['ov_display', JSON.stringify({ seasonal: 'on', at: NOW - 10000 })]]);
    p = load({ store: fresh, active: { theme_id: 'vibe', display: { seasonal: 'off' } } });
    await settle(); await settle();
    assert.strictEqual(display(p.store).seasonal, 'on', '…but not over a change made here in the last minute');

    // ── The look travels with a link to another OpenVibe site, and only there ──
    const home = new Map([['ov_display', JSON.stringify({ seasonal: 'off', motion: 'reduced', at: NOW - 2000 })], ['ov_theme', JSON.stringify({ id: 'nord', variables: { '--bg-primary': '#2e3440' }, at: NOW - 3000 })]]);
    p = load({ store: home, href: 'https://openvibe.network/themes' });
    const out = p.click('https://openvibe.live/@goosely?tab=clips#top');
    const ou = new URL(out);
    assert.ok(ou.searchParams.get('ov_look'), 'the link to Live carries the look');
    assert.strictEqual(ou.searchParams.get('tab'), 'clips', 'its own query is kept');
    assert.strictEqual(ou.hash, '#top', 'and its anchor');
    assert.strictEqual(p.click('https://openvibe.network/my'), 'https://openvibe.network/my', 'a link on the same site is untouched');
    assert.strictEqual(p.click('https://example.com/'), 'https://example.com/', 'a link off the network is untouched');
    const token = ou.searchParams.get('ov_look');
    const rec = JSON.parse(Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary'));
    assert.deepStrictEqual([rec.v, rec.d.seasonal, rec.d.motion, rec.da, rec.t, rec.ta], [1, 'off', 'reduced', NOW - 2000, 'nord', NOW - 3000]);
    assert.ok(Array.isArray(rec.p.k) && rec.p.k.length > 20, 'with what is painted');

    // Live, with an old copy of its own: it adopts the newer look before first paint, and the address is clean again.
    const liveOld = new Map([['ov_display', JSON.stringify({ seasonal: 'on', at: NOW - 86400000 })]]);
    p = load({ store: liveOld, href: out, referrer: 'https://openvibe.network/themes' });
    assert.strictEqual(display(p.store).seasonal, 'off', 'seasonal off arrived');
    assert.strictEqual(display(p.store).motion, 'reduced', 'Calm arrived');
    assert.strictEqual(p.html.attrs.get('data-ov-motion'), 'reduced', 'painted before anything else');
    assert.strictEqual(JSON.parse(p.store.get('ov_theme')).id, 'nord', 'the theme arrived');
    assert.strictEqual(p.html.attrs.get('data-theme'), 'nord');
    assert.deepStrictEqual(p.replaced, ['/@goosely?tab=clips#top'], 'ov_look leaves the address');

    // A newer copy here is not overwritten by an older look arriving.
    const liveNew = new Map([['ov_display', JSON.stringify({ seasonal: 'on', at: NOW - 100 })]]);
    p = load({ store: liveNew, href: out, referrer: 'https://openvibe.network/' });
    assert.strictEqual(display(p.store).seasonal, 'on', 'the newer copy stays');

    // Not from an OpenVibe page: ignored (a link someone sends cannot set your look), and still taken out of the address.
    p = load({ store: new Map(), href: out, referrer: 'https://evil.example/' });
    assert.strictEqual(p.store.get('ov_display'), undefined);
    assert.strictEqual(p.replaced.length, 1);

    // Only colours pass: a crafted custom theme with a url() is dropped value by value.
    const crafted = { v: 1, d: {}, da: 0, t: 'mine', c: 1, ta: NOW - 10, p: { k: ['url(https://evil.example/x.png)', '#101828', '#172238', '#131c2e', '#1c2a44', '#0d1424', '#e6edf7', '#96a7c2', '#8192ac', '#3b82f6', '#60a5fa', '#1d4ed8', 'expression(alert(1))'] } };
    const evil = `https://openvibe.live/?ov_look=${Buffer.from(JSON.stringify(crafted), 'binary').toString('base64')}`;
    p = load({ store: new Map(), href: evil, referrer: 'https://openvibe.network/' });
    const vars = JSON.parse(p.store.get('ov_theme')).variables;
    assert.ok(!Object.values(vars).some((v) => /url|expression/.test(v)), 'no url() or expression() in a stored theme');
    assert.strictEqual(vars['--bg-secondary'], '#101828', 'the colours pass');

    console.log('look travel: Calm keeps the O; dated copies, newest wins both ways; the look rides OpenVibe links, adopted before first paint when newer, only from OpenVibe pages, only colours');
})().catch((e) => { console.error(e); process.exit(1); });
