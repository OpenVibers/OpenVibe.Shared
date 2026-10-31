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
assert.ok(glyphs.NAMES.length >= 150, `${glyphs.NAMES.length} glyphs`);
for (const name of kit.ICONS) assert.ok(glyphs.NAMES.includes(name), `the kit's ${name} is a glyph`);
for (const [fa, g] of Object.entries(glyphs.FA)) assert.ok(glyphs.path(g), `fa-${fa} → ${g}, a glyph that exists`);
for (const name of glyphs.NAMES) {
    const d = glyphs.path(name);
    const tags = [...d.matchAll(/<(\w+)/g)].map((m) => m[1]);
    assert.ok(tags.length && tags.every((t) => ['path', 'circle', 'rect', 'ellipse', 'line', 'polyline'].includes(t)), `${name}: shapes only (${tags})`);
    assert.ok(!/fill=|style=|on\w+=|href|<script|url\(/i.test(d), `${name}: no fills, styles, handlers or links`);
    for (const m of d.matchAll(/(?:cx|cy|x|y)="(-?[\d.]+)"/g)) assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 24, `${name}: on the 24 grid`);
}
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
const built = require('../scripts/build-glyphs').build();
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-glyphs.js'), 'utf8');
assert.strictEqual(SRC, built, 'ov-glyphs.js is current: run node scripts/build-glyphs.js');

// ── In a page ──
(async () => {
    const { window, document, MutationObserver } = parseHTML(`<!doctype html><html><head></head><body>
<button><i class="fa-solid fa-tower-broadcast"></i> Go live</button>
<i class="fa-solid fa-spinner fa-spin" id="spin"></i>
<i class="fa-brands fa-github" id="gh"></i>
<i class="fa-solid fa-couch" id="unknown"></i>
<i class="fa-solid fa-eye" aria-label="Seen" id="labelled"></i>
<span class="fa-solid fa-play" id="toggle"></span>
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
    assert.ok(css.includes('.ovg::before,.ovg::after{content:none!important') && css.includes('.ovg.fa-spin,.ovg.fa-pulse,.ovg.fa-spin-pulse{animation:none!important}'), "Font Awesome's own glyph and spin are turned off on a swapped icon");
    // A page that changes an icon by its class (play ↔ pause) gets the new glyph.
    const t = $('#toggle');
    assert.strictEqual(t.dataset.ovg, 'play');
    t.className = 'fa-solid fa-pause';
    await new Promise((r) => setImmediate(r));
    assert.ok(t.dataset.ovg === 'pause' && t.classList.contains('ovg'), 'follows a class change');
    t.className = 'fa-solid fa-couch';
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
