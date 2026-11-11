'use strict';
// One window for every little interface (ov-window.js, 4.202.0; asks 304 and 318) in a real headless Chrome: a dialog
// grows out of its button, is named by its title, keeps the focus inside, closes with Escape and gives the focus back;
// windows stack and Escape closes the top one; a panel floats beside its button with no scrim, moves by its head, and
// opens again where it was left; on a phone every kind is a sheet that a swipe down closes; the window style is one
// attribute for every window; content given as text is set as text.
const assert = require('node:assert/strict');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-window-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ov-window.js')) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-window.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:1600px;background:#111;color:#eee">
<button id="open" style="position:absolute;left:40px;top:40px">Open</button><button id="pan" style="position:absolute;left:300px;top:40px">Panel</button><input id="page" style="position:absolute;left:40px;top:600px">
<script src="/ov-window.js"></script>
<script>
window.shut = [];
window.mk = (o) => { const f = document.createElement('div'); const a = document.createElement('input'); a.id = 'first'; const b = document.createElement('button'); b.id = 'last'; b.textContent = 'OK'; f.append(a, b); return OVWindow.open(Object.assign({ title: 'Your wallet', body: f, onClose: (why) => window.shut.push(why) }, o)); };
</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-window-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = async (page, k, shift) => { const codes = { Escape: 27, Tab: 9 }; const ev = { key: k, code: k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k], modifiers: shift ? 8 : 0 }; await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev }); };
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await page.goto(base, { maxMs: 5000 });
        await page.evaluate(`document.getElementById('open').focus(); window.w1 = mk({ from: document.getElementById('open'), id: 'wallet' })`);
        await wait(400);
        let v = await page.evaluate(`(() => { const el = document.querySelector('.ovw'); const r = el.getBoundingClientRect(); return { kind: el.className, role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), named: document.getElementById(el.getAttribute('aria-labelledby')).textContent, focus: document.activeElement.id, scrim: !!document.querySelector('.ovw-scrim'), cx: Math.round(r.left + r.width / 2 - document.documentElement.clientWidth / 2), locked: document.documentElement.classList.contains('ovw-locked'), popX: el.style.getPropertyValue('--ov-pop-x') }; })()`);
        assert.match(v.kind, /is-dialog/);
        assert.deepEqual([v.role, v.modal, v.named, v.focus, v.scrim, v.locked], ['dialog', 'true', 'Your wallet', 'first', true, true], 'a named modal dialog, the focus on its first field, the page behind locked');
        assert.ok(Math.abs(v.cx) < 3, `centred on a computer (${v.cx})`);
        assert.ok(v.popX !== '', 'it grows out of its button');
        // The focus stays inside: Tab from the last control goes to the first (×), Shift+Tab from the first to the last.
        await page.evaluate(`document.getElementById('last').focus()`); await key(page, 'Tab');
        await eventually(async () => assert.equal(await page.evaluate(`document.activeElement.className`), 'ovw-x', 'Tab wraps to the first control (×)'));
        await key(page, 'Tab', true);
        await eventually(async () => assert.equal(await page.evaluate(`document.activeElement.id`), 'last', 'Shift+Tab wraps to the last'));
        // A second window on top: Escape closes the top one only.
        await page.evaluate(`window.w2 = mk({ title: 'Send', from: document.getElementById('last') })`);
        await eventually(async () => assert.equal(await page.evaluate(`document.querySelectorAll('.ovw').length`), 2));
        await key(page, 'Escape'); await wait(350);
        await eventually(async () => assert.equal(await page.evaluate(`document.querySelectorAll('.ovw:not(.is-out)').length`), 1, 'Escape closed the top window'));
        await eventually(async () => assert.equal(await page.evaluate(`document.activeElement.id`), 'last', 'the focus went back to what opened it'));
        await key(page, 'Escape'); await wait(350);
        v = await page.evaluate(`({ n: document.querySelectorAll('.ovw').length, scrims: document.querySelectorAll('.ovw-scrim').length, focus: document.activeElement.id, locked: document.documentElement.classList.contains('ovw-locked'), shut: window.shut })`);
        assert.deepEqual(v, { n: 0, scrims: 0, focus: 'open', locked: false, shut: ['escape', 'escape'] }, 'both gone, the page free, the focus back on Open');
        // A press outside a dialog closes it.
        await page.evaluate(`mk({})`); await wait(80);
        await page.evaluate(`document.querySelector('.ovw-scrim').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`); await wait(350);
        await eventually(async () => assert.equal(await page.evaluate(`document.querySelectorAll('.ovw').length`), 0, 'a press outside closes a dialog'));
        // Text is text.
        await page.evaluate(`OVWindow.open({ title: '<b>x</b>', body: '<img src=x onerror=alert(1)>' })`);
        v = await page.evaluate(`({ t: document.querySelector('.ovw-t').textContent, imgs: document.querySelectorAll('.ovw img').length })`);
        assert.deepEqual(v, { t: '<b>x</b>', imgs: 0 }, 'markup given as text is shown as text');
        await page.evaluate('OVWindow.closeAll()'); await wait(300);

        // A panel: beside its button, no scrim, the page usable, moved by its head, opened again where it was left.
        await page.evaluate(`window.p1 = mk({ kind: 'panel', id: 'dock-test', title: 'Dock', from: document.getElementById('pan') })`);
        await wait(400);
        v = await page.evaluate(`(() => { const el = document.querySelector('.ovw'); const r = el.getBoundingClientRect(), b = document.getElementById('pan').getBoundingClientRect(); return { scrim: !!document.querySelector('.ovw-scrim'), modal: el.getAttribute('aria-modal'), below: Math.round(r.top - b.bottom), left: Math.round(r.left - b.left), locked: document.documentElement.classList.contains('ovw-locked') }; })()`);
        assert.deepEqual(v, { scrim: false, modal: null, below: 8, left: 0, locked: false }, 'a panel sits under its button, with no scrim, and the page stays usable');
        const hb = await page.evaluate(`(() => { const r = document.querySelector('.ovw-h').getBoundingClientRect(); return { x: r.left + 40, y: r.top + 20 }; })()`);
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hb.x, y: hb.y, button: 'left', clickCount: 1 });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hb.x + 60, y: hb.y + 30, button: 'left' });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hb.x + 200, y: hb.y + 150, button: 'left' });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hb.x + 200, y: hb.y + 150, button: 'left', clickCount: 1 });
        const moved = await page.evaluate(`(() => { const r = document.querySelector('.ovw').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; })()`);
        await eventually(async () => assert.deepEqual(await page.evaluate(`JSON.parse(localStorage.getItem('ov:window:dock-test'))`), moved, 'where it was left is kept'));
        await page.evaluate('p1.close()'); await wait(300);
        await page.evaluate(`mk({ kind: 'panel', id: 'dock-test', title: 'Dock', from: document.getElementById('pan') })`);
        await wait(400);
        await eventually(async () => assert.deepEqual(await page.evaluate(`(() => { const r = document.querySelector('.ovw').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; })()`), moved, 'and it opens there again'));
        await page.evaluate('OVWindow.closeAll()'); await wait(300);

        // The window style: one attribute, every window.
        await eventually(async () => assert.equal(await page.evaluate(`OVWindow.setStyle('outline')`), 'outline'));
        await eventually(async () => assert.equal(await page.evaluate(`document.documentElement.getAttribute('data-ov-window')`), 'outline'));
        await eventually(async () => assert.equal(await page.evaluate(`OVWindow.setStyle('nonsense')`), 'glass', 'an unknown style is the default'));
        await eventually(async () => assert.equal(await page.evaluate(`document.documentElement.getAttribute('data-ov-window')`), null));
        await page.close();

        // A phone: every kind is a sheet; a swipe down on its head closes it.
        const ph = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800, mobile: true });
        await ph.goto(base, { maxMs: 5000 });
        await ph.evaluate(`mk({ kind: 'panel', title: 'Dock' })`); await wait(400);
        v = await ph.evaluate(`(() => { const el = document.querySelector('.ovw'); const r = el.getBoundingClientRect(); return { sheet: el.classList.contains('is-sheet'), bottom: Math.round(innerHeight - r.bottom), width: Math.round(r.width) }; })()`);
        assert.deepEqual(v, { sheet: true, bottom: 0, width: 390 }, 'a sheet across the bottom of a phone');
        const sh = await ph.evaluate(`(() => { const r = document.querySelector('.ovw-h').getBoundingClientRect(); return { x: r.left + 120, y: r.top + 20 }; })()`);
        await ph.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sh.x, y: sh.y, button: 'left', clickCount: 1 });
        await ph.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sh.x, y: sh.y + 80, button: 'left' });
        await ph.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sh.x, y: sh.y + 260, button: 'left' });
        await ph.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sh.x, y: sh.y + 260, button: 'left', clickCount: 1 });
        await wait(400);
        await eventually(async () => assert.equal(await ph.evaluate(`document.querySelectorAll('.ovw').length`), 0, 'a swipe down closes the sheet'));
        await eventually(async () => assert.deepEqual(await ph.evaluate('window.shut'), ['swipe']));
        await ph.close();
        console.log('ov-window-chrome: a named modal dialog from its button, focus kept and given back, stacked Escape, outside press, text as text, a panel beside its button that keeps its place, one window style, a phone sheet closed by a swipe');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
