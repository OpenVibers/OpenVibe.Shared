'use strict';
// The move engine's geometry (ov-float.js, 4.208.0): the box a float takes in its frame, the snap after a drop, the
// tuck decision and the flick's projection. These are the numbers the browser check then drives by hand.
//
//   node test/ov-float.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'ov-float.js'), 'utf8');
const ctx = { window: {}, document: {}, localStorage: { getItem: () => null, setItem() {} }, console, setTimeout, clearTimeout, fetch: null };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { boxOf, settle, flick, tuckFor } = ctx.window.OVFloat._test;

const frame = (width, height) => ({ left: 0, top: 0, width, height, right: width, bottom: height });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
const geom = (x, y, w) => ({ x, y, w: w == null ? 0.25 : w, mode: 'dock', tuck: null });

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

check('a portrait source keeps its shape and the area of a 16:9 box', () => {
    const land = boxOf(geom(0.7, 0.7), frame(1280, 720), { aspect: 16 / 9 });
    const port = boxOf(geom(0.7, 0.7), frame(1280, 720), { aspect: 9 / 16 });
    near(land.wf, 0.25, 'the 16:9 width is w');
    const area = (b) => (b.wf * 1280) * ((b.wf * 1280) / b.a);
    near(area(port), area(land), 'same area in pixels');
    assert.ok(port.hf > port.wf, 'taller than wide');
    near((port.wf * 1280) / (port.hf * 720), 9 / 16, 'drawn 9:16');
});

check('never taller than 85% of the frame', () => {
    const b = boxOf(geom(0.7, 0.7, 0.6), frame(1280, 720), { aspect: 9 / 16 });
    assert.ok(b.hf <= 0.85 + 1e-9, `height ${b.hf}`);
    near(b.hf, 0.85, 'capped at the limit');
});

check('on a phone-sized frame it is never smaller than a 150 px wide 16:9 box', () => {
    const b = boxOf(geom(0.7, 0.7), frame(390, 219), { aspect: 16 / 9 });
    near(b.wf * 390, 150, '150 px wide');
    const p = boxOf(geom(0.7, 0.7), frame(390, 219), { aspect: 9 / 16 });
    near((p.wf * 390) * ((p.wf * 390) / p.a), 150 * (150 / (16 / 9)), 'a portrait one keeps that area');
    near(boxOf(geom(0.7, 0.7), frame(1280, 720), { aspect: 16 / 9 }).wf, 0.25, 'a desktop frame shows the saved size');
});

check('a free-height box keeps its own height and width (a panel window)', () => {
    const b = boxOf(geom(0.1, 0.2, 0.3), frame(1000, 800), { aspect: null, elHeight: 240 });
    assert.strictEqual(b.a, null);
    near(b.wf, 0.3, 'the saved width fraction');
    near(b.hf, 0.3, 'the measured height over the frame');
});

check('a drop near an edge snaps to a 12 px margin; the middle stays put', () => {
    const rect = frame(1280, 720);
    const o = geom(0.01, 0.02);
    settle(o, boxOf(o, rect, { aspect: 16 / 9 }));
    near(o.x, 12 / 1280, 'left edge');
    near(o.y, 12 / 720, 'top edge');
    const b = boxOf(o, rect, { aspect: 16 / 9 });
    const r = geom(1 - b.wf - 0.01, 1 - b.hf - 0.01);
    settle(r, boxOf(r, rect, { aspect: 16 / 9 }));
    near(r.x, 1 - b.wf - 12 / 1280, 'right edge');
    near(r.y, 1 - b.hf - 12 / 720, 'bottom edge');
    const m = geom(0.4, 0.3);
    settle(m, boxOf(m, rect, { aspect: 16 / 9 }));
    assert.strictEqual(m.x, 0.4); assert.strictEqual(m.y, 0.3);
});

check('a flick projects the last 90 ms 120 ms on; a slow drop stays put', () => {
    const fast = flick([{ x: 100, y: 100, t: 0 }, { x: 160, y: 70, t: 50 }], { left: 100, top: 100 });
    assert.ok(fast.fast, 'fast enough to carry');
    near(fast.vx, 1.2, 'vx');
    near(fast.vy, -0.6, 'vy');
    near(fast.left, 100 + 1.2 * 120, 'carried right');
    near(fast.top, 100 - 0.6 * 120, 'carried up');
    const slow = flick([{ x: 100, y: 100, t: 0 }, { x: 101, y: 100, t: 400 }], { left: 100, top: 100 });
    assert.ok(!slow.fast, 'too slow to carry');
    near(slow.left, 100, 'stays where it was let go');
    near(slow.top, 100, 'stays where it was let go');
});

check('thrown past a side, or flicked at it, it tucks into that side', () => {
    const rect = frame(1280, 720);
    const from = { left: -80, top: 200, width: 300, height: 169 };
    assert.strictEqual(tuckFor({ left: -140 }, from, rect, { fast: false, vx: 0 }), 'left', 'well past the left');
    assert.strictEqual(tuckFor({ left: 1100 }, from, rect, { fast: false, vx: 0 }), 'right', 'well past the right');
    assert.strictEqual(tuckFor({ left: -80 }, from, rect, { fast: true, vx: -1.6 }), 'left', 'flicked left at the edge');
    assert.strictEqual(tuckFor({ left: 1100 }, from, rect, { fast: true, vx: 1.6 }), 'right', 'flicked right at the edge');
    assert.strictEqual(tuckFor({ left: 400 }, from, rect, { fast: false, vx: 0 }), null, 'inside stays a float');
    assert.strictEqual(tuckFor({ left: 200 }, from, rect, { fast: true, vx: -2 }), null, 'a fast drag across the middle is not a tuck');
});

check('a floating box is placed as fractions of the window', () => {
    const b = boxOf({ x: 0.95, y: 0.95, w: 0.25, mode: 'float' }, frame(390, 844), { aspect: 9 / 16, minPx: 150 });
    near((b.wf * 390) * ((b.wf * 390) / b.a), 150 * (150 / (16 / 9)), 'the same area as a 150 px 16:9 box');
    assert.ok(b.hf <= 1, 'inside the window');
});

console.log(`ov-float geometry: ${n} passed`);
