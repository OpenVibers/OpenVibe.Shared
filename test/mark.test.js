'use strict';
// openvibe-shared/mark (4.59.0): the OpenVibe mark, the Pair, as static SVG. One set of numbers is drawn in four places:
// mark.js (servers, icons, share cards, downloads), ov-mark.js (the browser drop-in), app-icon.js (favicons and app
// icons, through mark.js) and loading.js (the loader's mark, by its own copy of the V). They must agree, or the logo
// differs between a tab, the navbar and the loader.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const mark = require('../mark');
const appIcon = require('../app-icon');

// ov-mark.js's own numbers, from a page that mounts it.
const { window, document, MutationObserver } = parseHTML('<!doctype html><html><head></head><body><span class="ov-mark" data-size="40"></span></body></html>');
window.__ovMark = false;
window.matchMedia = () => ({ matches: false, addEventListener() {} });
new Function('window', 'document', 'IntersectionObserver', 'MutationObserver', 'sessionStorage', fs.readFileSync(path.join(__dirname, '..', 'ov-mark.js'), 'utf8'))(window, document, undefined, MutationObserver, { getItem: () => null, setItem() {}, removeItem() {} });
const drop = window.OVMark.FORMS;

for (const form of ['pair', 'heavy']) {
    const g = mark.geo(form), d = drop[form];
    for (const k of ['cx', 'cy', 'r', 'sw', 'R', 'vsw', 'halo', 'ring', 'box', 'wideBox']) assert.deepStrictEqual(d[k], g[k], `${form}.${k}: ov-mark.js and mark.js agree`);
    for (const k of ['A', 'T', 'B']) assert.deepStrictEqual(d[k], g[k], `${form}.${k}`);
    assert.deepStrictEqual(d.shapes, mark.shapes(form), `${form}: the V's shapes agree`);
}

// The geometry: the V as tall as the O, the mark centred on (50, 50) in its box, and the V's caps clear of the ring.
for (const form of ['pair', 'heavy']) {
    const g = mark.geo(form);
    assert.strictEqual(+(g.T[1] + g.vsw / 2).toFixed(2), +(g.cy + g.R).toFixed(2), `${form}: the V's point meets the O's bottom`);
    assert.strictEqual(+(g.A[1] - g.vsw / 2).toFixed(2), +(g.cy - g.R).toFixed(2), `${form}: its caps meet the O's top`);
    const left = g.cx - g.R, right = g.B[0] + g.vsw / 2;
    assert.ok(Math.abs((left + right) / 2 - 50) < 0.02, `${form}: centred across (${left}, ${right})`);
    const [x, y, w, h] = g.box.split(' ').map(Number);
    assert.ok(Math.abs(x + w / 2 - 50) < 0.02 && Math.abs(y + h / 2 - 50) < 0.02 && w === h, `${form}: the square box is centred on the mark`);
}

// The standalone SVG: the gap is a mask, so it holds on any ground; the tones; the wide box.
const svg = mark.svg({ size: 64, title: 'OpenVibe' });
assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. ]+" width="64" height="64" role="img" aria-label="OpenVibe"><title>OpenVibe<\/title>/);
assert.match(svg, /<mask id="ovmh"[\s\S]*stroke="#000" stroke-width="20"[\s\S]*<\/mask>[\s\S]*<circle [^>]*stroke="#4f7cff"[^>]*mask="url\(#ovmh\)"\/><path [^>]*stroke="#8b5cf6"/, 'blue O cut by a mask, violet V on top');
assert.match(mark.svg({ tone: 'ink' }), /stroke="currentColor"[\s\S]*stroke="currentColor"/, 'ink: the text colour');
assert.match(mark.svg({ tone: 'white' }), /stroke="#fff"[\s\S]*stroke="#fff"/, 'white: for a colour tile');
const wide = mark.svg({ wide: true, size: 40 });
assert.match(wide, new RegExp(`viewBox="${mark.geo('pair').wideBox}" width="66.13" height="40"`), 'wide: the box hugs the mark, the width follows');
assert.match(mark.svg({ title: '<b>&' }), /aria-label="&lt;b&gt;&amp;"><title>&lt;b&gt;&amp;<\/title>/, 'the title is escaped');

// Favicons and app icons draw the same mark (the heavy at favicon size) on the navy tile.
const fav = appIcon.favicon({ site: 'network' });
assert.ok(fav.includes(`stroke-width="${mark.geo('heavy').vsw}"`) && fav.includes('<mask id="ovh"'), 'favicon: the heavy form, with its gap');
const live = appIcon.svg({ site: 'live', maskable: false });
assert.ok(live.includes('fill="#ef4444"'), "Live's icon carries the record light in the O");
assert.ok(!appIcon.svg({ site: 'network' }).includes('fill="#ffffff"'), 'a white "dot" means no light');
// Maskable: the farthest point of the mark (the V's caps) stays inside the 40 % safe circle of a 512 icon.
{
    const g = mark.geo('pair'), scale = 4;
    const far = Math.max(...[g.A, g.B].map(([x, y]) => Math.hypot(x - 50, y - 50) + g.vsw / 2), 50 - (g.cx - g.R));
    assert.ok(far * scale <= 204.8, `maskable: ${(far * scale).toFixed(1)} of 204.8`);
    assert.ok(appIcon.svg({ site: 'network', maskable: true }).includes(`scale(${scale})`), 'drawn at that scale');
}

// The loader's mark is the pair's V, and its "!" on a failure.
{
    const src = fs.readFileSync(path.join(__dirname, '..', 'loading.js'), 'utf8');
    const p = mark.shapes('pair'), seg = (s, i) => `M${s[i]} ${s[i + 1]}L${s[i + 2]} ${s[i + 3]}`;
    assert.ok(src.includes(`const V = ['${seg(p.v, 0)}', '${seg(p.v, 4)}'], BANG = ['${seg(p.err, 0)}', '${seg(p.err, 4)}'];`), 'loading.js draws the same V and "!"');
    assert.ok(src.includes(`viewBox="${mark.geo('pair').box}"`) && src.includes(`cx="${mark.geo('pair').cx}" cy="50" r="20"`), 'and the same O in the same box');
}

console.log('mark: one geometry in mark.js, ov-mark.js, the icons and the loader; centred, level, the gap a mask; tones, wide box, maskable safe zone');
