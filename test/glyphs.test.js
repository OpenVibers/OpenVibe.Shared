'use strict';
// openvibe-shared/glyphs (4.61.0, plan L32): the one registry of the network's icons, and ov-glyphs.js, the drop-in that
// shows them in place of Font Awesome's. Every Font Awesome name maps to a glyph that exists; every drawing is strokes
// on the 24 grid with nothing but shapes in it; the drop-in is current with the registry; in a page it swaps an icon
// in place, follows a class change, leaves brand logos and unknown names to Font Awesome, and never spins.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const glyphs = require('../glyphs');
const kit = require('../kit');

// ── The registry ──
assert.ok(glyphs.NAMES.length >= 276, `${glyphs.NAMES.length} glyphs`);
for (const name of kit.ICONS) assert.ok(glyphs.NAMES.includes(name), `the kit's ${name} is a glyph`);
for (const [fa, g] of Object.entries(glyphs.FA)) assert.ok(glyphs.path(g), `fa-${fa} → ${g}, a glyph that exists`);
for (const name of glyphs.NAMES) {
    const d = glyphs.path(name);
    const tags = [...d.matchAll(/<(\w+)/g)].map((m) => m[1]);
    assert.ok(tags.length && tags.every((t) => ['path', 'circle', 'rect', 'ellipse', 'line', 'polyline'].includes(t)), `${name}: shapes only (${tags})`);
    assert.ok(!/fill=|style=|on\w+=|href|<script|url\(/i.test(d), `${name}: no fills, styles, handlers or links`);
    for (const m of d.matchAll(/(?:cx|cy|x|y)="(-?[\d.]+)"/g)) assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 24, `${name}: on the 24 grid`);
}
// Solid drawings for small sizes (4.69.0): filled shapes and evenodd holes, a line as class "ln", on the grid.
for (const [name, d] of Object.entries(glyphs.SOLID)) {
    assert.ok(glyphs.path(name), `${name}: a solid drawing has a line one`);
    const tags = [...d.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]);
    assert.ok(tags.length && tags.every((t) => ['path', 'circle', 'rect', 'ellipse'].includes(t)), `${name}: solid shapes only (${tags})`);
    assert.ok(!/style=|on\w+=|href|<script|url\(|fill="(?!none)/i.test(d), `${name}: no styles, handlers, links or colours`);
    assert.ok([...d.matchAll(/class="([^"]*)"/g)].every((m) => m[1] === 'ln'), `${name}: the only class is ln`);
    assert.ok(glyphs.inner(name).includes('<g class="ovg-s">'), `${name}: inner() carries it`);
}
assert.ok(Object.keys(glyphs.SOLID).length >= 100, 'the glyphs most often shown small have a solid drawing (4.73.0: the most-used shapes too; 4.80.0: the next ones)');
assert.ok(glyphs.svg('eye', { style: 'thin' }).includes('stroke-width="1"'));
assert.ok(glyphs.svg('eye', { style: 'light' }).includes('stroke-width="1.5"'));
assert.ok(glyphs.svg('eye', { style: 'bold' }).includes('stroke-width="2.5"'));
assert.ok(glyphs.svg('bell', { style: 'solid' }).includes('fill="currentColor"') && glyphs.svg('bell', { style: 'solid' }).includes('stroke="none"'));
// A line inside a solid drawing keeps its stroke in the stand-alone svg (it was filled as a shape, or not drawn).
assert.ok(glyphs.svg('calendar', { style: 'solid' }).includes('<path class="ln" fill="none" stroke="currentColor" stroke-width="2.6"'), 'a solid drawing\'s line part is stroked, not filled');
assert.ok(!glyphs.svg('bell', { style: 'solid' }).includes('class="ln"'), 'a drawing with no line part is unchanged');
assert.ok(glyphs.solid('calendar').includes('<path class="ln" d='), 'the stored drawing itself is unchanged (ov-glyphs.js styles .ln in CSS)');
assert.ok(glyphs.svg('bell', { style: 'duotone' }).includes('opacity=".2"'));
assert.throws(() => glyphs.svg('eye', { style: 'heavy' }), /unsupported style/);
for (const n of ['globe', 'mail', 'key', 'server', 'phone', 'help', 'cart', 'store', 'terminal', 'database', 'eye-off', 'mic-off']) assert.ok(glyphs.solid(n), `${n}: one of the next most-used shapes has its solid drawing (4.80.0)`);
for (const n of ['copy', 'scissors', 'volume', 'robot', 'film', 'gear', 'search', 'pencil', 'save', 'chart']) assert.ok(glyphs.solid(n), `${n}: one of the sites' most-used shapes has its solid drawing`);
for (const n of ['check', 'close', 'plus', 'link', 'code', 'ban', 'stop']) assert.strictEqual(glyphs.solid(n), '', `${n}: a glyph made of lines thickens when small instead`);
assert.strictEqual(glyphs.fromFa('fa-book-open'), 'book-open', 'an open book, not a square');
assert.strictEqual(glyphs.inner('check'), glyphs.path('check'), 'a glyph without a solid one is its lines alone');
assert.strictEqual(glyphs.fromFa('fa-tower-broadcast'), 'live');
assert.strictEqual(glyphs.fromFa('eye-slash'), 'eye-off');
assert.strictEqual(glyphs.fromFa('fa-spinner'), 'busy', 'a spinner is the busy dots');
assert.strictEqual(glyphs.fromFa('fa-github'), null, 'brand logos are not ours');
assert.match(glyphs.svg('live', { size: 20 }), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">/);
assert.match(glyphs.svg('eye', { title: 'Seen <by>' }), /role="img" aria-label="Seen &lt;by&gt;"><title>Seen &lt;by&gt;<\/title>/);
assert.strictEqual(glyphs.svg('nope'), '');
// The names the network asked Font Awesome for most (the 2026-10-31 count) are covered, brand logos aside.
for (const fa of ['wand-magic-sparkles', 'eye', 'tower-broadcast', 'xmark', 'video', 'robot', 'scissors', 'copy', 'bolt', 'check', 'comments', 'play', 'tree', 'spinner', 'map-pin', 'globe', 'code', 'coins', 'clock', 'shield-halved', 'plus', 'lock', 'arrow-right', 'star', 'volume-high', 'triangle-exclamation', 'link', 'image', 'user', 'server', 'magnifying-glass', 'campground', 'utensils', 'train', 'heart']) {
    assert.ok(glyphs.fromFa(fa), `fa-${fa} has a glyph`);
}

// ── The drop-in is the registry's, current ──
const builder = require('../scripts/build-glyphs');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-glyphs.js'), 'utf8');
assert.strictEqual(SRC, builder.build(), 'ov-glyphs.js is current: run node scripts/build-glyphs.js');
const SPRITE = fs.readFileSync(path.join(__dirname, '..', 'ov-glyphs.svg'), 'utf8');
assert.strictEqual(SPRITE, builder.sprite(), 'ov-glyphs.svg is current: run node scripts/build-glyphs.js');
assert.strictEqual((SPRITE.match(/<symbol id="ovg-/g) || []).length, glyphs.NAMES.length * 5 + Object.keys(glyphs.SOLID).length * 2, 'the sprite keeps the regular alias, adds four line weights and each available solid/duotone glyph');
assert.ok(SPRITE.includes(`<symbol id="ovg-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyphs.path('eye')}</symbol>`));

// Font Awesome's features, kept (4.62.0): every documented class has a rule, with Font Awesome's own variables.
const CSS = builder.CSS;
const ON_ICON = ['fa-2xs', 'fa-xs', 'fa-sm', 'fa-lg', 'fa-xl', 'fa-2xl', 'fa-1x', 'fa-10x', 'fa-fw', 'fa-border', 'fa-pull-left', 'fa-pull-right',
    'fa-rotate-90', 'fa-rotate-180', 'fa-rotate-270', 'fa-rotate-by', 'fa-flip-horizontal', 'fa-flip-vertical', 'fa-flip-both', 'fa-inverse',
    'fa-beat', 'fa-bounce', 'fa-fade', 'fa-beat-fade', 'fa-flip', 'fa-shake', 'fa-spin', 'fa-thin', 'fa-light', 'fa-duotone'];
ON_ICON.forEach((cls) => assert.ok(CSS.includes(`.ovg.${cls}{`) || CSS.includes(`.ovg.${cls}>svg{`) || CSS.includes(`.ovg.${cls},`), `.${cls} on a swapped icon`));
['fa-ul', 'fa-li', 'fa-stack', 'fa-layers', 'fa-layers-text', 'fa-layers-counter'].forEach((cls) => assert.ok(CSS.includes(`.${cls}{`), `.${cls}, Font Awesome's wrapper`));
['--fa-beat-scale', '--fa-bounce-height', '--fa-fade-opacity', '--fa-flip-angle', '--fa-rotate-angle', '--fa-animation-duration', '--fa-li-width',
    '--fa-border-color', '--fa-counter-background-color', '--fa-primary-color', '--fa-inverse'].forEach((v) => assert.ok(CSS.includes(v), `Font Awesome's ${v}`));
assert.ok(!CSS.includes('360deg') && /\.ovg\.fa-spin[^{]*\{animation:ovgBreathe/.test(CSS), 'fa-spin breathes: nothing spins (L27)');
assert.ok(CSS.includes('html[data-ov-motion=off] .ovg,html[data-ov-motion=off] .ovg[data-ovg=busy] circle,html[data-ov-motion=off] .ovg.ovg-draw>svg>*{animation:none!important;stroke-dashoffset:0!important}') && !CSS.includes('prefers-reduced-motion') && !CSS.includes('data-ov-motion=reduced'), 'motion off stops every animation and a drawn-in glyph is simply there; Calm plays them');

// ── In a page ──
(async () => {
    const { window, document, MutationObserver } = parseHTML(`<!doctype html><html><head></head><body>
<button><i class="fa-solid fa-tower-broadcast"></i> Go live</button>
<i class="fa-solid fa-spinner fa-spin" id="spin"></i>
<i class="fa-brands fa-github" id="gh"></i>
<i class="fa-solid fa-otter" id="unknown"></i>
<i class="fa-solid fa-eye" aria-label="Seen" id="labelled"></i>
<span class="fa-solid fa-play" id="toggle"></span>
<i class="fa-solid fa-heart fa-2x fa-beat" data-fa-transform="grow-4 up-2 rotate-90 flip-h" id="tf"></i>
<i class="fa-solid fa-bell" title="Notifications" id="titled"></i>
<span class="fa-layers"><i class="fa-solid fa-envelope"></i><span class="fa-layers-counter" id="counter">12</span></span>
<i class="fa-solid fa-circle-check ovg-draw" id="drawn"></i>
<i class="fa-solid fa-bell fa-shake ovg-once" id="once"></i>
</body></html>`);
    window.MutationObserver = MutationObserver;
    new Function('window', 'document', 'MutationObserver', SRC)(window, document, MutationObserver);
    const $ = (s) => document.querySelector(s);
    const live = $('button i');
    assert.ok(live.classList.contains('ovg') && live.dataset.ovg === 'live' && live.querySelector('svg path'), 'swapped in place');
    assert.strictEqual(live.getAttribute('aria-hidden'), 'true', 'a decorative icon is hidden from screen readers');
    assert.strictEqual($('#labelled').getAttribute('aria-hidden'), null, 'a labelled one is not');
    assert.ok($('#spin').dataset.ovg === 'busy' && $('#spin').querySelectorAll('circle').length === 3, 'a spinner becomes three dots');
    assert.ok(!$('#gh').classList.contains('ovg') && !$('#unknown').classList.contains('ovg'), 'brands and unknown names stay Font Awesome');
    const css = document.getElementById('ov-glyphs-css').textContent;
    assert.ok(css.includes('.ovg::before,.ovg::after{content:none!important') && css.includes('.ovg.fa-spin,.ovg.fa-pulse,.ovg.fa-spin-pulse{animation:ovgBreathe'), "Font Awesome's own glyph is off on a swapped icon, and its spin breathes");
    // data-fa-transform: Font Awesome's sixteenths, on the drawing; size and animation classes stay on the icon.
    const tf = $('#tf');
    assert.ok(tf.classList.contains('ovg') && tf.classList.contains('fa-2x') && tf.classList.contains('fa-beat'));
    assert.strictEqual(tf.querySelector('svg').getAttribute('style'), 'transform:translate(0em,-0.125em) rotate(90deg) scale(-1.25,1.25)');
    // A title names the icon to screen readers.
    assert.ok($('#titled').getAttribute('role') === 'img' && $('#titled').getAttribute('aria-label') === 'Notifications' && !$('#titled').hasAttribute('aria-hidden'));
    // A layer's counter is text, not an icon.
    assert.ok(!$('#counter').classList.contains('ovg') && $('#counter').textContent === '12');
    assert.ok($('.fa-layers > i').dataset.ovg, 'the layer\'s icon is swapped');
    // The glyphs' own motion (4.63.0): ovg-draw measures every line as 1, so the CSS can draw it in once.
    const drawn = $('#drawn').querySelector('svg');
    assert.ok(drawn.children.length >= 2 && [...drawn.children].every((c) => c.getAttribute('pathLength') === '1'), 'every shape of a drawn-in glyph has pathLength 1');
    assert.ok(css.includes('@keyframes ovgDraw{to{stroke-dashoffset:0}}') && css.includes('.ovg.ovg-once{--fa-animation-iteration-count:1}'), 'draw-in and play-once');
    assert.ok(!$('#once').querySelector('[pathLength]'), 'only ovg-draw measures its lines');
    // A page that changes an icon by its class (play ↔ pause) gets the new glyph.
    const t = $('#toggle');
    assert.strictEqual(t.dataset.ovg, 'play');
    t.className = 'fa-solid fa-pause';
    await new Promise((r) => setImmediate(r));
    assert.ok(t.dataset.ovg === 'pause' && t.classList.contains('ovg'), 'follows a class change');
    // A page that resets the class list but keeps the name keeps the glyph (the swap class comes back).
    t.className = 'fa-solid fa-pause is-on';
    await new Promise((r) => setImmediate(r));
    assert.ok(t.classList.contains('ovg') && t.dataset.ovg === 'pause', 'the swap class comes back after a reset');
    t.className = 'fa-solid fa-otter';
    await new Promise((r) => setImmediate(r));
    assert.ok(!t.classList.contains('ovg') && !t.dataset.ovg && !t.querySelector('svg'), 'and hands back a name it does not know');
    // Markup added later is swapped too.
    const later = document.createElement('div'); later.innerHTML = '<i class="fa-solid fa-heart"></i>';
    document.body.appendChild(later);
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(later.firstChild.dataset.ovg, 'heart');
    assert.strictEqual(window.OVGlyphs.fromFa('fa-xmark'), 'close');
    console.log(`glyphs: ${glyphs.NAMES.length} glyphs, ${Object.keys(glyphs.FA).length} Font Awesome names; shapes on the grid; the drop-in is current, swaps in place, follows classes, leaves brands, never spins`);
})().catch((e) => { console.error(e); process.exit(1); });
