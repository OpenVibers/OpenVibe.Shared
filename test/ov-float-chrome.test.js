'use strict';
// ov-float.js (4.208.0) in a real headless Chrome: a box docked in its frame, lifted on the first move and floating
// over the page, dropped back over its frame it docks, thrown past a side it tucks into a small handle that slides
// along that side and pulls out, the tab brings it
// back, the arrows, + and T move and size it, the corner grip sizes it, Home puts it back, the place is kept and
// comes back on a reload, a pluggable account store receives each save, and `ov:float` and OVFloat.layout() say where
// it is.
//
//   node test/ov-float-chrome.test.js
const assert = require('node:assert/strict');
const { eventually, launch, openPage, findChrome } = require('../browser-harness');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
if (process.env.OV_SKIP_BROWSER === '1' || !findChrome()) { console.log('ov-float-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ov-float.js')) {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        return res.end(fs.readFileSync(path.join(root, 'ov-float.js')));
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;height:1400px;background:#111}#frame{position:absolute;left:40px;top:40px;width:800px;height:450px;background:#222}
#box{width:200px;background:#3b82f6;border-radius:14px;outline:0}#box:focus-visible{outline:2px solid #fff}</style>
<div id="frame"><div id="box" tabindex="0" aria-label="A floating box"></div></div>
<script src="/ov-float.js"></script>
<script>
window.puts = [];
window.remote = null;
OVFloat.store = { load: () => Promise.resolve({}), get: (key) => window.remote && window.remote[key], put: (key, value) => window.puts.push({ key, value }) };
window.events = [];
addEventListener('ov:float', (e) => window.events.push({ key: e.detail.key, geom: e.detail.geom }));
window.f = OVFloat.attach(document.getElementById('box'), {
  frame: document.getElementById('frame'), key: 'test-float', defaults: { x: 0.1, y: 0.1, w: 0.25 }, aspect: 16 / 9,
  onChange: (g) => { window.saved = g; },
});
</script>`);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-float-'));
    const browser = await launch({ tmpDir });
    const mouse = async (page, type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    const drag = async (page, from, to) => {
        // Slow enough not to be a flick: the last 90 ms carry only a few pixels, so the drop is where it was let go.
        await mouse(page, 'mousePressed', from.x, from.y);
        for (let i = 1; i <= 4; i += 1) {
            await mouse(page, 'mouseMoved', from.x + ((to.x - from.x) * i) / 4, from.y + ((to.y - from.y) * i) / 4);
            await wait(60);
        }
        await mouse(page, 'mouseMoved', to.x - 4, to.y - 4);
        await wait(100);
        await mouse(page, 'mouseMoved', to.x, to.y);
        await mouse(page, 'mouseReleased', to.x, to.y);
    };
    const key = async (page, k, shift) => {
        const codes = { ArrowRight: 39, ArrowLeft: 37, Home: 36, '=': 187, '-': 189, t: 84, f: 70 };
        const ev = { key: k, code: k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k], modifiers: shift ? 8 : 0, text: k.length === 1 ? k : undefined };
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev });
    };
    const box = (page) => page.evaluate(`(() => { const el = document.getElementById('box'); const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, cls: el.className, parent: el.parentElement.id, leftStyle: el.style.left, widthStyle: el.style.width, mode: window.f.geom().mode, x: window.f.geom().x, w: window.f.geom().w }; })()`);
    try {
        const page = await openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await page.goto(base, { maxMs: 5000 });
        await wait(250);
        let v = await box(page);
        assert.equal(v.parent, 'frame', 'docked in its frame');
        assert.match(v.cls, /ov-float/, 'the engine class');
        assert.doesNotMatch(v.cls, /is-floating/, 'not floating yet');
        assert.equal(v.leftStyle, '10%', 'placed as a fraction of the frame');
        assert.equal(v.widthStyle, '25%', 'sized as a fraction of the frame');
        assert.ok(Math.abs(v.width - 200) < 2, `the frame is 800 px (${v.width})`);

        // Lift on the first move: over the page, following with a transform, then a slow drop back inside docks it.
        const c = { x: v.left + v.width / 2, y: v.top + v.height / 2 };
        await mouse(page, 'mousePressed', c.x, c.y);
        await mouse(page, 'mouseMoved', c.x + 8, c.y + 6);
        await wait(100);
        await mouse(page, 'mouseMoved', c.x + 8, c.y + 6);
        const lifted = await page.evaluate(`(() => { const el = document.getElementById('box'); return { parent: el.parentElement.tagName, cls: el.className, transform: el.style.transform, hint: document.getElementById('frame').className }; })()`);
        assert.equal(lifted.parent, 'BODY', 'lifted over the page');
        assert.match(lifted.cls, /is-lifted/, 'marked as lifted');
        assert.match(lifted.cls, /is-dragging/, 'marked as dragging');
        await mouse(page, 'mouseReleased', c.x + 8, c.y + 6);
        await wait(400);
        assert.equal((await box(page)).mode, 'dock', 'a slow drop inside still docks');

        // Dragged outside its frame it floats over the page.
        v = await box(page);
        await drag(page, { x: v.left + v.width / 2, y: v.top + v.height / 2 }, { x: 900, y: 600 });
        await eventually(async () => {
            v = await box(page);
            assert.equal(v.mode, 'float', 'dropped outside the frame it floats');
            assert.match(v.cls, /is-floating/, 'fixed over the page');
        }, 'a drop over the page floats');
        assert.ok((await page.evaluate('window.puts.length')) >= 1, 'the account store got the save');
        assert.ok((await page.evaluate('window.events.length')) >= 1, 'ov:float fired');
        assert.equal((await page.evaluate('OVFloat.layout().length')), 1, 'layout lists it');
        const stored = await page.evaluate(`JSON.parse(localStorage.getItem('test-float'))`);
        assert.equal(stored.mode, 'float', 'the place is kept in the browser');

        // Dropped back over the frame it docks.
        v = await box(page);
        await drag(page, { x: v.left + v.width / 2, y: v.top + v.height / 2 }, { x: 400, y: 300 });
        await eventually(async () => assert.equal((await box(page)).mode, 'dock', 'dropped over its frame it docks'), 'dock again');
        assert.equal((await box(page)).parent, 'frame', 'and is a child of the frame again');

        // Thrown past the left: tucked into that side, its tab on screen; the tab brings it back.
        v = await box(page);
        await drag(page, { x: v.left + v.width / 2, y: v.top + v.height / 2 }, { x: 1, y: v.top + v.height / 2 });
        await eventually(async () => assert.match((await box(page)).cls, /is-tucked-left/, 'tucked into the left'), 'tuck');
        const tab = await page.evaluate(`(() => { const t = document.querySelector('.ov-float-tab'); return { display: getComputedStyle(t).display, label: t.getAttribute('aria-label') }; })()`);
        assert.equal(tab.display, 'grid', 'the tab is on screen');
        assert.equal(tab.label, 'Bring it back');
        // 4.235.0: tucked, it is a small handle at the edge, not a strip as tall as itself.
        const handle = async () => page.evaluate(`(() => { const t = document.querySelector('.ov-float-tab').getBoundingClientRect(); const el = document.getElementById('box'); return { w: t.width, h: t.height, left: t.left, top: t.top, clip: getComputedStyle(el).clipPath, frameLeft: document.getElementById('frame').getBoundingClientRect().left, y: window.f.geom().y }; })()`);
        let hd;
        await eventually(async () => {
            hd = await handle();
            assert.ok(Math.abs(hd.w - 30) < 1 && Math.abs(hd.h - 64) < 1, `a 30 × 64 handle (${hd.w} × ${hd.h})`);
            assert.ok(Math.abs(hd.left) < 1, `at the side of the window it was thrown at (${hd.left})`);
            assert.match(hd.clip, /inset/, 'the rest of it is folded away');
        }, 'the handle');
        // Dragged up or down, the handle slides along its side and stays tucked.
        await drag(page, { x: hd.left + hd.w / 2, y: hd.top + hd.h / 2 }, { x: hd.left + hd.w / 2 + 3, y: hd.top + hd.h / 2 + 90 });
        let slid;
        await eventually(async () => {
            slid = await handle();
            assert.match((await box(page)).cls, /is-tucked-left/, 'still tucked after a slide');
            assert.ok(slid.top > hd.top + 60 && slid.y > hd.y, `slid down its side (${hd.top} → ${slid.top})`);
        }, 'the slide');
        // Pulled out sideways, it opens under the finger and lands where it is let go.
        await drag(page, { x: slid.left + slid.w / 2, y: slid.top + slid.h / 2 }, { x: slid.left + 260, y: slid.top + slid.h / 2 });
        await eventually(async () => assert.doesNotMatch((await box(page)).cls, /is-tucked/, 'a pull brings it out'), 'pull');
        assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('box')).clipPath`), 'none', 'nothing folded once it is out');
        // Thrown again and tapped: it opens at its side.
        v = await box(page);
        await drag(page, { x: v.left + v.width / 2, y: v.top + v.height / 2 }, { x: 1, y: v.top + v.height / 2 });
        await eventually(async () => assert.match((await box(page)).cls, /is-tucked-left/, 'tucked again'), 'tuck again');
        await page.evaluate(`document.querySelector('.ov-float-tab').click()`);
        await eventually(async () => assert.doesNotMatch((await box(page)).cls, /is-tucked/, 'the tab brings it back'), 'untuck');
        assert.ok(!(await page.evaluate(`window.puts.some((p) => 'ux' in p.value)`)), 'the account gets only the place, never the browser\'s extras');

        // The keyboard: an arrow moves it, + grows it, T tucks, Home puts it back where it started.
        await page.evaluate(`document.getElementById('box').focus()`);
        const before = await box(page);
        await key(page, 'ArrowRight');
        await eventually(async () => assert.ok((await box(page)).x > before.x, 'ArrowRight moves it right'), 'arrow');
        const width0 = (await box(page)).w;
        await key(page, '=');
        await eventually(async () => assert.ok((await box(page)).w > width0, '= grows it'), 'grow');
        await key(page, 't');
        await eventually(async () => assert.match((await box(page)).cls, /is-tucked/, 'T tucks it'), 'T');
        await key(page, 'Home');
        await eventually(async () => {
            const g = await box(page);
            assert.equal(g.mode, 'dock', 'Home docks it again');
            assert.ok(Math.abs(g.x - 0.1) < 0.001 && Math.abs(g.w - 0.25) < 0.001, 'and puts it back where it started');
        }, 'Home');

        // The corner grip sizes it.
        v = await box(page);
        const grip = await page.evaluate(`(() => { const r = document.querySelector('.ov-float-resize').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await drag(page, grip, { x: grip.x + 80, y: grip.y + 50 });
        await eventually(async () => assert.ok((await box(page)).w > 0.25, 'the corner sizes it'), 'resize');
        assert.ok((await page.evaluate(`JSON.parse(localStorage.getItem('test-float')).w`)) > 0.25, 'the new size is kept');

        // Past what its frame holds it floats over the page and keeps growing, up to the window's width.
        v = await box(page);
        const grip2 = await page.evaluate(`(() => { const r = document.querySelector('.ov-float-resize').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        await drag(page, grip2, { x: 1270, y: grip2.y + 300 });
        await eventually(async () => {
            const g = await box(page);
            assert.equal(g.mode, 'float', 'grown past its frame, it floats');
            assert.ok(g.width > 800, `wider than its frame (${g.width})`);
            assert.ok(g.width <= 1280 + 1 && g.left >= -1 && g.left + g.width <= 1281, 'and inside the window');
        }, 'grow past the frame');
        await key(page, 'Home');
        await wait(400);

        // The place comes back on a reload.
        const last = await box(page);
        await page.goto(base, { maxMs: 5000 });
        await wait(300);
        const again = await box(page);
        assert.ok(Math.abs(again.width - last.width) < 2 && Math.abs(again.left - last.left) < 2, `the place came back (${again.left}/${again.width} vs ${last.left}/${last.width})`);
        await page.close();

        // A phone-sized frame: the 150 px floor, and the box stays inside it.
        const ph = await openPage(browser, await browser.newContext(), { width: 390, height: 844, mobile: true });
        await ph.goto(base, { maxMs: 5000 });
        await ph.evaluate(`Object.assign(document.getElementById('frame').style, { left: '0px', width: '390px', height: '219px' }); window.f.set({ w: 0.25, mode: 'dock', x: 0.9, y: 0.9 }, { settle: true, save: true })`);
        const small = await ph.evaluate(`(() => { const el = document.getElementById('box'); const r = el.getBoundingClientRect(); const f = document.getElementById('frame').getBoundingClientRect(); return { w: r.width, inside: r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1 }; })()`);
        assert.ok(small.w >= 149.5, `never smaller than 150 px (${small.w})`);
        assert.ok(small.inside, 'shown inside its frame');
        // A double tap on a phone: the whole width of the screen.
        const pb = await ph.evaluate(`(() => { const r = document.getElementById('box').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        for (let i = 0; i < 2; i += 1) {
            await ph.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pb.x, y: pb.y, button: 'left', clickCount: 1 });
            await ph.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pb.x, y: pb.y, button: 'left', clickCount: 1 });
            await wait(60);
        }
        await eventually(async () => {
            const full = await ph.evaluate(`(() => { const r = document.getElementById('box').getBoundingClientRect(); return { w: r.width, left: r.left, mode: window.f.geom().mode }; })()`);
            assert.ok(full.w > 380 && full.left > -1 && full.left + full.w < 391, `a double tap fills the phone's width (${full.w})`);
        }, 'double tap on a phone');
        // This device's place wins over an older or newer one in the account; a device without one takes the account's.
        await ph.evaluate(`window.remote = { 'test-float': { x: 0.5, y: 0.5, w: 0.3, mode: 'float', tuck: null, at: Date.now() + 60000 } }`);
        const keep = await ph.evaluate(`JSON.parse(localStorage.getItem('test-float')).w`);
        await ph.goto(base, { maxMs: 5000 });
        await ph.evaluate(`window.remote = { 'test-float': { x: 0.5, y: 0.5, w: 0.3, mode: 'float', tuck: null, at: Date.now() + 60000 } }`);
        await eventually(async () => assert.ok(Math.abs((await ph.evaluate('window.f.geom().w')) - keep) < 0.001, 'this phone keeps its own place'), 'own place');
        await ph.close();
        console.log('ov-float-chrome: docked and floating, the lift and the landing, the tuck and its tab, the keys, the corner, the kept place, the account store, ov:float and layout()');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
