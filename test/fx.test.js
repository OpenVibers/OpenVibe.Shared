'use strict';
// ov-fx.js (4.66.0, plan L45; the reveal remade for 278): the network's effects by data-fx. Each name wires its class
// or listener; a reveal gives its heading, rule and cards a start state only when they are below the fold and then
// shows them once — with the scroll timeline where view() exists (no script on the main thread while scrolling) and
// one shared IntersectionObserver otherwise. Calm keeps a short fade; Off shows everything at once. linkedom with a
// fake IntersectionObserver, matchMedia and CSS.supports.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-fx.js'), 'utf8');

function setup({ reduce = false, calm = false, off = false, timeline = false, html = '' } = {}) {
    const { window, document, MutationObserver } = parseHTML(`<!doctype html><html${off ? ' data-ov-motion="off"' : calm ? ' data-ov-motion="reduced"' : ''}><head></head><body>${html}</body></html>`);
    const observed = [];
    class IO { constructor(cb) { this.cb = cb; } observe(el) { observed.push(el); } unobserve() {} fire(el) { this.cb([{ target: el, isIntersecting: true }]); } }
    let io = null;
    const frames = [];
    const timers = [];
    window.IntersectionObserver = class extends IO { constructor(cb) { super(cb); io = this; } };
    window.MutationObserver = MutationObserver;
    window.CSS = { supports: (q) => !!timeline && /animation-timeline/.test(q) };
    window.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduce : /hover/.test(q) });
    window.innerHeight = 800;
    window.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn) => { timers.push(fn); return timers.length; };
    window.performance = { now: () => 0 };
    for (const el of document.querySelectorAll('[data-top]')) el.getBoundingClientRect = () => ({ top: Number(el.getAttribute('data-top')), left: 0, width: 100, height: 40 });
    window.OVFx = undefined;   // linkedom windows share their expando properties
    new Function('window', SRC)(window);
    const run = (t) => { let n = 0; while (frames.length && n++ < 500) frames.shift()(t); };
    const flush = () => { let n = 0; while (timers.length && n++ < 500) timers.shift()(); };
    return { window, document, io: () => io, observed, run, flush };
}

(async () => {
    // ── names wire their classes; the CSS carries the motion tokens and the Off/Calm guards ──
    {
        const t = setup({ html: '<a id="a" data-fx="glint lift press glow">x</a><span id="s" data-fx="shimmer"></span><b id="r" data-fx="ripple">r</b>' });
        const a = t.document.getElementById('a');
        assert.deepStrictEqual(['glint', 'lift', 'press', 'glow'].map((n) => a.classList.contains(`ovfx-${n}`)), [true, true, true, true]);
        assert.ok(t.document.getElementById('s').classList.contains('ovfx-shimmer') && t.document.getElementById('r').classList.contains('ovfx-ripple'));
        const css = t.document.getElementById('ov-fx-css').textContent;
        assert.match(css, /--ov-dur-1:\.12s;--ov-dur-2:\.2s;--ov-dur-3:\.32s;--ov-dur-4:\.52s/, 'the motion tokens');
        assert.match(css, /html\[data-ov-motion=reduced\]\{--ov-move:\.35;--ov-dur-1:\.15s;[^}]*--ov-ease-spring:var\(--ov-ease-out\)\}/, 'Calm: a third of the distance, the calm lengths, no overshoot; never zero');
        assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{html:not\(\[data-ov-motion\]\)\{--ov-move:\.35;/, 'the same when the device asks and no loader has spoken');
        assert.match(css, /html\[data-ov-motion=off\]\{--ov-move:0;--ov-dur-1:0s/, 'only Off zeroes them');
        assert.ok(css.includes('.ovfx-lift:hover{transform:translateY(calc(-3px * var(--ov-move,1)))') && css.includes('.ovfx-head.ovfx-wait{opacity:0;transform:translateY(var(--ovfx-rise,12px))'), 'distances are multiplied by --ov-move');
        assert.ok(css.includes('html[data-ov-motion=reduced] .ovfx-glint:not([data-fx-demo] *)::after{opacity:.55}'), 'Calm keeps the glint, fainter and slower');
        assert.ok(css.includes('html[data-ov-motion=off] .ovfx-glint:not([data-fx-demo] *)::after{display:none}'), 'motion off stops the glint, outside a demo scope');
        assert.ok(!/data-ov-motion=reduced\][^{]*\{[^}]*(animation|transition):none/.test(css), 'nothing is stopped under Calm');
        assert.ok(css.includes('[data-fx-demo]{--ov-move:1;') && css.includes('--ov-dur-1:.12s;--ov-dur-2:.2s'), 'a demo scope sets its own lengths and distance, so no setting reaches inside it');
        assert.ok(/html:is\([^)]*neon-tokyo[^)]*\) \[data-fx-demo\]\{--ov-dur-1:\.09s/.test(css), 'in the look\'s own feel');
        assert.ok(!/infinite/.test(css.replace(/\.ovfx-shimmer\{[^}]*\}/, '')), 'nothing loops but a placeholder\'s shimmer');
        assert.strictEqual(typeof t.window.OVFx.confetti, 'function');
        // A feel per look (4.67.0): quiet themes move calmly (no overshoot), neon ones snap; Calm still wins.
        assert.match(css, /html:is\(\[data-theme=paper\],[^)]*\)\{--ov-dur-1:\.15s;[^}]*--ov-ease-spring:var\(--ov-ease-out\)\}/, 'calm looks: slower, no overshoot');
        assert.match(css, /html:is\(\[data-theme=neon-tokyo\],[^)]*\)\{--ov-dur-1:\.09s;/, 'neon looks snap');
        assert.ok(css.indexOf('html[data-ov-motion=reduced]{--ov-move:.35') > css.indexOf('html:is([data-theme=neon-tokyo]'), 'Calm comes last, so it wins over any feel');
    }

    // ── the reveal's CSS (278): heading out of a blur, rule from the left, six card steps, scroll timeline first ──
    {
        const t = setup();
        const css = t.document.getElementById('ov-fx-css').textContent;
        assert.ok(css.includes('--ovfx-rise:12px') && css.includes('@media (max-width:600px){.ovfx-head{--ovfx-rise:8px}'), '12 px on a computer, 8 on a phone');
        assert.ok(css.includes('@keyframes ovfxHeadRise{from{opacity:0;transform:translateY(calc(var(--ovfx-rise,12px) * var(--ov-move,1)));filter:blur(4px)}'), 'the heading rises and sharpens from 4 px of blur');
        assert.ok(css.includes('@keyframes ovfxRuleDraw{from{transform:scaleX(0)'), 'the rule is drawn, not faded in');
        assert.ok(css.includes('.ovfx-rule{transform-origin:left center}'), 'from the left');
        assert.ok(css.includes('@supports (animation-timeline:view())'), 'the scroll timeline, where the browser has it');
        assert.ok(css.includes('animation-timeline:view();animation-range:entry 0% cover 25%'), 'the heading is driven by the scroll position');
        assert.ok(css.includes('animation-range:entry calc(5% + var(--ovfx-i,0) * 3%) cover calc(30% + var(--ovfx-i,0) * 3%)'), 'the cards step by index');
        assert.ok(css.includes('animation:ovfxHeadRise linear backwards'), 'backwards fill: once past the range the page\'s own styles are back, and nothing is filled forward');
        assert.ok(!/\.ovfx-head\{[^}]*opacity:0/.test(css), 'content is visible by default; only a start state the script or @supports adds hides it');
        assert.ok(css.includes('html[data-ov-motion=reduced] :is(.ovfx-head,.ovfx-card,.ovfx-rule).ovfx-scroll:not([data-fx-demo] *){animation-name:ovfxFadeIn'), 'Calm keeps only the fade');
        assert.ok(css.includes('html[data-ov-motion=off] :is(.ovfx-head,.ovfx-card,.ovfx-rule,.ovfx-fade):not([data-fx-demo] *){animation:none!important'), 'Off removes the motion');
    }

    // ── reveal: below the fold it waits for the screen; heading, rule and cards step; on screen it is never hidden ──
    {
        const html = `<section id="low" data-fx="reveal" data-fx-stagger="40" data-top="1400">
            <h2 id="h" data-top="1400">Live Now</h2><span id="r" data-fx-rule data-top="1400"></span>
            <div class="grid" id="grid">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<a class="card" data-top="${1500 + n}">${n}</a>`).join('')}</div>
        </section><section id="top" data-fx="reveal" data-top="100"><h2 data-top="100">x</h2><p data-top="100">y</p></section>`;
        const t = setup({ html });
        const low = t.document.getElementById('low'), top = t.document.getElementById('top');
        const head = t.document.getElementById('h'), rule = t.document.getElementById('r');
        const cards = [...t.document.querySelectorAll('#grid > a')];
        assert.ok(head.classList.contains('ovfx-head') && head.classList.contains('ovfx-wait'), 'the heading has a start state');
        assert.ok(rule.classList.contains('ovfx-rule') && rule.classList.contains('ovfx-wait'), 'the rule has one too');
        assert.ok(cards.every((k) => k.classList.contains('ovfx-card') && k.classList.contains('ovfx-wait')), 'so do the cards');
        assert.ok(!t.document.getElementById('grid').classList.contains('ovfx-card'), 'the grid itself is not a card');
        assert.deepStrictEqual(cards.map((k) => k.style.getPropertyValue('--ovfx-d')), ['140ms', '180ms', '220ms', '260ms', '300ms', '340ms', '340ms'], '40 ms apart after the heading, at most six, the rest together');
        assert.strictEqual(t.observed.filter((x) => x === low).length, 0, 'the section is not observed as a whole: its parts are');
        assert.strictEqual(t.observed.length, 9, 'heading, rule and seven cards wait with the one observer');
        assert.ok(t.io() instanceof t.window.IntersectionObserver, 'one shared observer');
        assert.ok(![...top.querySelectorAll('*')].some((k) => k.classList.contains('ovfx-wait')), 'on screen when wired: never hidden');
        t.io().fire(head);
        assert.ok(head.classList.contains('ovfx-in'), 'seen: the transition runs');
        t.flush();
        assert.ok(!head.classList.contains('ovfx-wait') && !head.classList.contains('ovfx-in'), 'and the start and transition classes are gone, so the page own styles are back');
        t.io().fire(cards[2]);
        assert.ok(cards[2].classList.contains('ovfx-in'), 'a card runs its own transition');
    }

    // ── a section already on screen only waits for the parts that are below it ──
    {
        const t = setup({ html: '<section data-fx="reveal" data-top="100"><h2 id="h" data-top="100">top</h2><a id="c" data-top="1400">card</a></section>' });
        const h = t.document.getElementById('h'), c = t.document.getElementById('c');
        assert.ok(!h.classList.contains('ovfx-head'), 'the heading someone can see is left alone');
        assert.ok(c.classList.contains('ovfx-card') && c.classList.contains('ovfx-wait'), 'the card below the fold waits');
        assert.deepStrictEqual(t.observed, [c], 'only that card is observed');
    }

    // ── a rule only when the section has one; cards can be named when the markup is not a list or grid ──
    {
        const t = setup({ html: '<div data-fx="reveal" data-fx-cards=".pick" data-top="1400"><h2 data-top="1400">x</h2><p data-top="1400">lede</p><div><a class="pick" data-top="1400">1</a><a class="pick" data-top="1400">2</a></div></div>' });
        assert.strictEqual(t.document.querySelector('.ovfx-rule'), null, 'no rule: nothing is drawn');
        assert.deepStrictEqual([...t.document.querySelectorAll('.pick')].map((k) => k.classList.contains('ovfx-card')), [true, true], 'the named cards are the cards');
        assert.ok(!t.document.querySelector('p').classList.contains('ovfx-card'), 'the lede is not a card when the cards are named');
    }

    // ── with the scroll timeline the browser drives it: no observer and no script while scrolling ──
    {
        const t = setup({ timeline: true, html: '<section data-fx="reveal" data-top="1400"><h2 id="h" data-top="1400">x</h2><span data-fx-rule data-top="1400"></span><div class="grid">' + [1, 2, 3, 4, 5, 6, 7].map((n) => `<a data-top="${1500 + n}">${n}</a>`).join('') + '</div></section>' });
        const head = t.document.getElementById('h'), cards = [...t.document.querySelectorAll('.grid > a')];
        assert.ok(head.classList.contains('ovfx-head') && head.classList.contains('ovfx-scroll'), 'the heading rides the scroll timeline');
        assert.ok(!head.classList.contains('ovfx-wait'), 'no start class: the keyframes hold the start state');
        assert.deepStrictEqual(cards.map((k) => k.style.getPropertyValue('--ovfx-i')), ['0', '1', '2', '3', '4', '5', '5'], 'six steps; the rest share the last');
        assert.strictEqual(t.observed.length, 0, 'no observer is used, so no script runs on the main thread while scrolling');
    }

    // ── Calm (the setting, or the device asking for less): the reveal keeps only a short fade ──
    for (const opts of [{ reduce: true }, { calm: true }]) {
        const t = setup({ ...opts, html: '<section data-fx="reveal" data-top="1400"><h2 id="h" data-top="1400">x</h2><span data-fx-rule data-top="1400"></span><a id="c" data-top="1400">card</a></section>' });
        const h = t.document.getElementById('h'), c = t.document.getElementById('c');
        assert.ok(h.classList.contains('ovfx-fade') && !h.classList.contains('ovfx-head'), 'the heading only fades');
        assert.ok(c.classList.contains('ovfx-fade') && !c.classList.contains('ovfx-card'), 'the card only fades');
        assert.strictEqual(h.style.getPropertyValue('--ovfx-d'), '', 'no rise or stagger delay');
        assert.strictEqual(t.observed.length, 3, 'the fade still waits for the screen');
        assert.strictEqual(t.window.OVFx.move(), 0.35, 'a third of the distance for everything else');
    }

    // ── motion off: nothing hidden, nothing counted, no confetti ──
    {
        const t = setup({ off: true, reduce: true, html: '<section data-fx="reveal" data-top="1400"><h2 data-top="1400">x</h2><a data-top="1400">card</a></section><b id="n" data-fx="count" data-top="1400">900</b>' });
        assert.strictEqual(t.window.OVFx.move(), 0);
        assert.strictEqual(t.document.querySelectorAll('.ovfx-wait,.ovfx-fade,.ovfx-head,.ovfx-card').length, 0, 'nothing hidden and nothing staged');
        assert.strictEqual(t.observed.length, 0, 'nothing waits to count');
        assert.strictEqual(t.document.getElementById('n').textContent, '900');
        assert.strictEqual(t.window.OVFx.confetti({ x: 1, y: 1 }), false, 'no confetti');
    }

    // ── the demo scope: a page that shows motion may play it inside [data-fx-demo], when the person asks ──
    {
        const t = setup({ off: true, timeline: true, html: '<div data-fx-demo><section id="in" data-fx="reveal" data-top="1400"><h2 data-top="1400">a</h2></section></div><section id="out" data-fx="reveal" data-top="1400"><h2 data-top="1400">b</h2></section>' });
        assert.ok(t.document.querySelector('#in h2').classList.contains('ovfx-scroll'), 'inside the scope the reveal plays in full');
        assert.strictEqual(t.document.querySelectorAll('#out .ovfx-scroll').length, 0, 'outside it the setting holds');
        assert.strictEqual(t.window.OVFx.confetti({ x: 1, y: 1 }), false, 'confetti with no source element stays off');
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

    console.log('fx: names wire their effects; the reveal stages a heading out of a blur, its rule from the left and six card steps, on the scroll timeline or one observer; Calm fades; only motion off keeps still; later markup wired; loaded only on request');
})().catch((e) => { console.error(e); process.exit(1); });
