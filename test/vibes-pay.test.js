'use strict';
// vibes-pay.js in a linkedom page: the auto-bound button is styled and labelled "Pay with Vibes";
// the sheet opens in a popup on a computer and as a full page on a phone; the promise resolves only
// from an openvibe.network postMessage ({ type: 'ov-vibes-pay', status }), and a closed popup says so.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'vibes-pay.js'), 'utf8');

function page({ phone = false, url = 'https://openvibe.network/pay/vch_01TEST' } = {}) {
    const { window, document } = parseHTML(`<!doctype html><html><head></head><body>
<button id="buy" data-ov-vibes-pay="${url}">Buy</button>
<a id="plain" href="${url}">Pay</a></body></html>`);
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    const out = { opened: [], assigned: [], listeners: {}, events: [] };
    const popup = { closed: false, focus() { out.focused = true; } };
    const ctx = {
        document, URL, Promise, Object, Array, String, Number, Math, Boolean, TypeError, Error, JSON, Set, Map,
        console: { error: (...a) => out.events.push(['error', a.join(' ')]) },
        location: { assign: (u) => out.assigned.push(u), href: 'https://shop.example/' },
        matchMedia: () => ({ matches: phone }),
        open: (u, name, features) => { out.opened.push({ url: u, name, features }); return popup; },
        addEventListener: (type, fn) => { (out.listeners[type] ||= []).push(fn); },
        setInterval: (fn, ms) => { const id = setInterval(fn, ms); id.unref(); return id; },
        clearInterval: (id) => clearInterval(id),
        innerWidth: 1280, innerHeight: 800, screenX: 10, screenY: 20, outerWidth: 1280, outerHeight: 900,
        Event: window.Event, CustomEvent: window.CustomEvent || class { constructor(t, i = {}) { this.type = t; this.detail = i.detail; this.bubbles = !!i.bubbles; } },
    };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx, { filename: 'vibes-pay.js' });
    const open = (fn) => new Promise((resolve) => { const t = setTimeout(() => resolve('timeout'), 1500); fn((v) => { clearTimeout(t); resolve(v); }); });
    const message = (data, origin = 'https://openvibe.network', source = popup) => {
        for (const fn of out.listeners.message || []) fn({ data, origin, source });
    };
    return { ctx, document, window, out, popup, open, message };
}

(async () => {
    {
        const p = page();
        const v = p.ctx.OpenVibe.vibes;
        assert.strictEqual(typeof v.pay, 'function');
        assert.strictEqual(v.ORIGIN, 'https://openvibe.network');

        // The auto-bound button: styled, labelled, a non-submitting button, one bind only.
        const btn = p.document.getElementById('buy');
        assert.strictEqual(btn.textContent, 'Pay with Vibes');
        assert.ok(btn.classList.contains('ov-vibes-pay'));
        assert.strictEqual(btn.getAttribute('type'), 'button');
        assert.ok(p.document.getElementById('ov-vibes-pay-style'), 'the style is injected once');
        assert.strictEqual(v.bind(p.document), 0, 'binding twice is a no-op');
        assert.strictEqual(p.document.getElementById('plain').classList.contains('ov-vibes-pay'), false, 'only data-ov-vibes-pay binds');

        // Clicking it opens the popup; a message from openvibe.network resolves it and re-enables the button.
        const result = await p.open((done) => {
            btn.click();
            setImmediate(() => {
                assert.strictEqual(p.out.opened.length, 1);
                assert.strictEqual(p.out.opened[0].url, 'https://openvibe.network/pay/vch_01TEST');
                assert.strictEqual(p.out.opened[0].name, 'ov-vibes-pay');
                assert.match(p.out.opened[0].features, /width=/);
                assert.strictEqual(btn.disabled, true);
                p.message({ type: 'ov-vibes-pay', status: 'paid', charge_id: 'vch_01TEST' });
                setImmediate(() => { done(p.out.events.slice()); });
            });
        });
        assert.deepStrictEqual(result, [], 'no page errors');
        assert.strictEqual(btn.disabled, false, 'the button is usable again');
        assert.strictEqual(p.out.events.find((e) => e[0] === 'error'), undefined);
    }

    {
        // pay() itself: origin-checked, type-checked, and it ignores anything else before the valid message.
        const p = page();
        const v = p.ctx.OpenVibe.vibes;
        const promise = v.pay('https://openvibe.network/pay/vch_02TEST');
        assert.strictEqual(p.out.opened[0].name, 'ov-vibes-pay');
        p.message({ type: 'ov-vibes-pay', status: 'paid' }, 'https://evil.example');
        p.message({ type: 'something-else', status: 'paid' });
        p.message({ type: 'ov-vibes-pay' });
        p.message({ type: 'ov-vibes-pay', status: 'paid', charge_id: 'vch_02TEST' });
        const out = await promise;
        assert.deepStrictEqual(JSON.parse(JSON.stringify(out)), { status: 'paid', pay_url: 'https://openvibe.network/pay/vch_02TEST', charge_id: 'vch_02TEST' });
        assert.throws(() => v.pay('https://evil.example/pay/vch_1'), /openvibe\.network/);
        assert.throws(() => v.pay('http://openvibe.network/pay/vch_1'), /openvibe\.network/);
        assert.throws(() => v.pay('not a url'), /pay/);
        assert.throws(() => v.pay('https://openvibe.network/wallet'), /pay/);
    }

    {
        // A phone gets the full page (a new tab), not the popup; a closed popup resolves { status: 'closed' }.
        const p = page({ phone: true });
        const v = p.ctx.OpenVibe.vibes;
        const promise = v.pay('/pay/vch_03TEST');
        assert.deepStrictEqual(p.out.opened[0], { url: 'https://openvibe.network/pay/vch_03TEST', name: '_blank', features: undefined });
        p.popup.closed = true;
        await new Promise((r) => setTimeout(r, 800));
        const closed = await promise;
        assert.deepStrictEqual(JSON.parse(JSON.stringify(closed)), { status: 'closed', pay_url: 'https://openvibe.network/pay/vch_03TEST' });
    }

    {
        // A blocked popup falls back to the full page (no throw, no unhandled rejection).
        const p = page();
        p.out.opened.length = 0;
        p.ctx.open = () => null;
        const promise = p.ctx.OpenVibe.vibes.pay('https://openvibe.network/pay/vch_04TEST');
        assert.deepStrictEqual(p.out.assigned, ['https://openvibe.network/pay/vch_04TEST']);
        assert.ok(promise instanceof Promise);
    }

    console.log('vibes-pay: ok');
})().catch((err) => { console.error(err); process.exit(1); });
