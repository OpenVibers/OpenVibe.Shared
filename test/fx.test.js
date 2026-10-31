'use strict';
// ov-fx.js (4.66.0, plan L45): the network's effects by data-fx. Each name wires its class or listener; a reveal hides
// only what is below the fold and shows it when it comes on screen; a number counts up and ends on its own text;
// under reduced motion or Calm nothing is hidden, nothing counts and no confetti falls; markup added later is wired;
// the navbar loads it only for a page that asks. linkedom with a fake IntersectionObserver and matchMedia.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-fx.js'), 'utf8');

function setup({ reduce = false, calm = false, html = '' } = {}) {
    const { window, document, MutationObserver } = parseHTML(`<!doctype html><html${calm ? ' data-ov-motion="reduced"' : ''}><head></head><body>${html}</body></html>`);
    const observed = [];
    class IO { constructor(cb) { this.cb = cb; } observe(el) { observed.push(el); } unobserve() {} fire(el) { this.cb([{ target: el, isIntersecting: true }]); } }
    let io = null;
    const frames = [];
    window.IntersectionObserver = class extends IO { constructor(cb) { super(cb); io = this; } };
    window.MutationObserver = MutationObserver;
    window.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduce : /hover/.test(q) });
    window.innerHeight = 800;
    window.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn) => { fn(); return 0; };
    window.performance = { now: () => 0 };
    for (const el of document.querySelectorAll('[data-top]')) el.getBoundingClientRect = () => ({ top: Number(el.getAttribute('data-top')), left: 0, width: 100, height: 40 });
    window.OVFx = undefined;   // linkedom windows share their expando properties
    new Function('window', SRC)(window);
    const run = (t) => { let n = 0; while (frames.length && n++ < 500) frames.shift()(t); };
    return { window, document, io: () => io, observed, run };
}

(async () => {
    // ── names wire their classes; the CSS carries the motion tokens and the reduced-motion guards ──
    {
        const t = setup({ html: '<a id="a" data-fx="glint lift press glow">x</a><span id="s" data-fx="shimmer"></span><b id="r" data-fx="ripple">r</b>' });
        const a = t.document.getElementById('a');
        assert.deepStrictEqual(['glint', 'lift', 'press', 'glow'].map((n) => a.classList.contains(`ovfx-${n}`)), [true, true, true, true]);
        assert.ok(t.document.getElementById('s').classList.contains('ovfx-shimmer') && t.document.getElementById('r').classList.contains('ovfx-ripple'));
        const css = t.document.getElementById('ov-fx-css').textContent;
        assert.match(css, /--ov-dur-1:\.12s;--ov-dur-2:\.2s;--ov-dur-3:\.32s;--ov-dur-4:\.52s/, 'the motion tokens');
        assert.match(css, /html\[data-ov-motion=reduced\]\{--ov-dur-1:0s/, 'Calm zeroes them');
        assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ovfx-glint::after\{display:none\}/);
        assert.ok(!/infinite/.test(css.replace(/\.ovfx-shimmer\{[^}]*\}/, '')), 'nothing loops but a placeholder\'s shimmer');
        assert.strictEqual(typeof t.window.OVFx.confetti, 'function');
        // A feel per look (4.67.0): quiet themes move calmly (no overshoot), neon ones snap; Calm still wins.
        assert.match(css, /html:is\(\[data-theme=paper\],[^)]*\)\{--ov-dur-1:\.15s;[^}]*--ov-ease-spring:var\(--ov-ease-out\)\}/, 'calm looks: slower, no overshoot');
        assert.match(css, /html:is\(\[data-theme=neon-tokyo\],[^)]*\)\{--ov-dur-1:\.09s;/, 'neon looks snap');
        assert.ok(css.indexOf('html[data-ov-motion=reduced]{--ov-dur-1:0s') > css.indexOf('html:is([data-theme=neon-tokyo]'), 'Calm comes last, so it wins over any feel');
    }

    // ── reveal: below the fold it waits for the screen; on screen it is never hidden ──
    {
        const t = setup({ html: '<ul id="low" data-fx="reveal" data-fx-stagger="40" data-top="1400"><li>a</li><li>b</li><li>c</li></ul><ul id="top" data-fx="reveal" data-top="100"><li>x</li></ul>' });
        const low = t.document.getElementById('low'), top = t.document.getElementById('top');
        assert.ok([...low.children].every((k) => k.classList.contains('ovfx-hide')), 'below the fold: hidden until seen');
        assert.strictEqual(low.children[2].style.getPropertyValue('--ovfx-d'), '80ms', 'staggered');
        assert.ok(![...top.children].some((k) => k.classList.contains('ovfx-hide')), 'on screen when wired: never hidden');
        assert.ok(t.observed.includes(low) && !t.observed.includes(top));
        t.io().fire(low);
        assert.ok([...low.children].every((k) => !k.classList.contains('ovfx-hide')), 'seen: shown');
    }

    // ── count: from 0 up to the number, ending on its own text ──
    {
        const t = setup({ html: '<b id="n" data-fx="count" data-top="1200">12,480 viewers</b><b id="m" data-fx="count" data-top="10">€3.50</b><b id="w" data-fx="count" data-top="1200">soon</b>' });
        const n = t.document.getElementById('n');
        t.io().fire(n);
        t.run(100);
        assert.notStrictEqual(n.textContent, '12,480 viewers', 'counting');
        assert.match(n.textContent, / viewers$/, 'keeps its words');
        t.run(5000);
        assert.strictEqual(n.textContent, '12,480 viewers', 'ends exactly on its own text');
        t.run(5000);
        assert.strictEqual(t.document.getElementById('m').textContent, '€3.50', 'decimals end exact too');
        assert.strictEqual(t.document.getElementById('w').textContent, 'soon', 'not a number: left alone');
    }

    // ── reduced motion and Calm: nothing hidden, nothing counted, no confetti ──
    for (const opts of [{ reduce: true }, { calm: true }]) {
        const t = setup({ ...opts, html: '<ul data-fx="reveal" data-top="1400"><li>a</li></ul><b id="n" data-fx="count" data-top="1400">900</b>' });
        assert.strictEqual(t.document.querySelectorAll('.ovfx-hide').length, 0, 'nothing hidden');
        assert.strictEqual(t.observed.length, 0, 'nothing waits to count');
        assert.strictEqual(t.document.getElementById('n').textContent, '900');
        assert.strictEqual(t.window.OVFx.confetti({ x: 1, y: 1 }), false, 'no confetti');
    }

    // ── markup added later is wired ──
    {
        const t = setup();
        const el = t.document.createElement('a'); el.setAttribute('data-fx', 'press'); t.document.body.appendChild(el);
        await new Promise((r) => setImmediate(r));
        t.window.OVFx.scan(t.document.body);
        assert.ok(el.classList.contains('ovfx-press'));
    }

    // ── the navbar loads it once the page settles, only when the page asks ──
    {
        const nav = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
        assert.match(nav, /function queueFx\(\)/);
        assert.match(nav, /!document\.querySelector\('\[data-fx\]'\)\) return;/, 'only for a page with data-fx');
        assert.match(nav, /siblingV\('ov-fx\.js'\)/, 'from beside the navbar, by content hash');
        assert.ok(require('../files').BROWSER.includes('ov-fx.js'), 'served');
    }

    console.log('fx: names wire their effects; reveal waits below the fold and never hides what is on screen; numbers end on their own text; reduced motion and Calm keep still; later markup wired; loaded only on request');
})().catch((e) => { console.error(e); process.exit(1); });
