'use strict';
// The Arrange editor in a real headless Chrome (make your own controls, stage 2): a surface's real parts are
// placed from the person's layout, arrow keys move and Shift+arrows resize, a refused move says why and leaves
// the layout alone, every move is announced, the part sheet hides a part, Undo/Reset/Save work, and OpenVibe's
// suggestion is previewed on the parts and applied only with Keep. Skipped (exit 0) without Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
assert.doesNotThrow(() => require('../ov-arrange'), 'ov-arrange.js loads (browser-only: Node takes the early return)');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-arrange-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}
const root = path.join(__dirname, '..');
const catalog = {
    id: 'bot.controls', version: 1, name: 'Robot controls', devices: ['phone', 'tablet', 'computer'],
    grid: { columns: { phone: 4, tablet: 8, computer: 12 }, cell_px: { phone: 64, tablet: 64, computer: 64 } },
    theme_tokens: ['danger', 'surface', 'accent', 'text'],
    parts: [
        { id: 'stop', name: 'Stop', kind: 'button', required: true, pressed: true, min: { w: 2, h: 2, px: 64 }, sizes: [{ w: 2, h: 2 }, { w: 2, h: 1 }], styles: { tints: ['danger'], shapes: ['round'], label: true }, bindings: { keys: ['Space'], gamepad: ['south'] } },
        { id: 'stick', name: 'Drive stick', kind: 'stick', required: false, pressed: true, min: { w: 2, h: 2 }, styles: { tints: ['surface'], shapes: ['round'], label: false }, bindings: { keys: ['W', 'A', 'S', 'D'], gamepad: ['left-stick'] } },
        { id: 'head', name: 'Head', kind: 'slider', required: false, pressed: true, min: { w: 2, h: 1 }, styles: { tints: ['accent'], shapes: ['pill'], label: true }, bindings: { keys: [], gamepad: [] } },
        { id: 'battery', name: 'Battery', kind: 'readout', required: false, pressed: false, min: { w: 1, h: 1 }, styles: { tints: ['text', 'surface'], shapes: ['pill', 'square'], label: true }, bindings: { keys: [], gamepad: [] } },
    ],
};
const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#0d1117;color:#e6edf3;font:14px system-ui}#surface{display:grid;gap:8px;padding:12px;width:390px}
[data-ov-part]{background:#1b2230;border:1px solid #334;border-radius:10px;padding:8px;min-height:24px}</style>
<main id="surface">${catalog.parts.map((p) => `<section data-ov-part="${p.id}" id="${p.id}">${p.name}</section>`).join('')}</main>
<script>window.CATALOG=${JSON.stringify(catalog)};</script>
<script src="/ov-arrange-core.js"></script><script src="/ov-arrange.js"></script>
<script>
window.calls = {};
window.editor = OVArrange.open({
    surface: document.getElementById('surface'), catalog: window.CATALOG, layout: null, device: 'phone',
    core: window.OVArrangeCore,
    onSave: (layout) => { window.calls.save = layout; return { ok: true }; },
    onShare: async () => ({ url: 'https://openvibe.bot/l/abc' }),
    onAsk: async (words, request) => {
        window.calls.asked = { words, request };
        const layout = OVArrangeCore.applyDefaults(window.CATALOG, 'phone');
        layout.parts = layout.parts.map((p) => p.id === 'stop' ? { ...p, place: { x: 1, y: 3, w: 2, h: 2 } } : p);
        layout.name = 'Big Stop'; layout.summary = 'Stop is first, at 2 by 2.';
        return { ok: true, layout, summary: 'Stop is first, at 2 by 2.', reasons: [] };
    },
    confirm: () => true,
});
</script>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-arrange.js' || u.pathname === '/ov-arrange-core.js') {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        return res.end(fs.readFileSync(path.join(root, u.pathname.slice(1))));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-arrange-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 800 });
        await p.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await wait(40); } return false; };
        const evalv = (expr) => p.evaluate(expr);
        assert.ok(await until(`!!window.editor && document.querySelectorAll('[data-ov-part]').length === 4`), 'the editor opened on the real parts');
        assert.ok(await evalv(`document.querySelector('[data-ov-part="stop"]').style.gridColumn === '1 / span 2'`), 'Stop is placed by the default layout');
        assert.ok(await evalv(`document.querySelector('[data-ov-part="stick"]').style.gridColumn !== ''`), 'the stick is placed too');

        // Arrow keys move, and the move is announced. The stick goes down first so Stop has room (nothing may
        // cover a required part: Stop itself stays where it is until the way is clear).
        for (let i = 0; i < 2; i++) await evalv(`(() => { const el = document.getElementById('stick'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); })()`);
        await evalv(`(() => { const el = document.getElementById('stop'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); })()`);
        const moved = await evalv(`window.editor.layout().parts.find((p) => p.id === 'stop').place`);
        assert.equal(moved.x, 1, 'ArrowRight moved Stop one cell');
        assert.ok(/Stop moved to column 2/.test(await evalv(`document.querySelector('.ov-arrange-status').textContent`)), 'the move is said in the status line');
        assert.ok(/column 2/.test(await evalv(`document.querySelector('[aria-live="polite"][aria-atomic="true"]').textContent`)), 'and announced');

        // A refused resize says why and leaves the layout alone.
        const before = JSON.stringify(await evalv(`window.editor.layout()`));
        await evalv(`(() => { const el = document.getElementById('stop'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true })); })()`);
        assert.ok(/Can't do that: Stop has to be at least 2 × 2 cells\./.test(await evalv(`document.querySelector('.ov-arrange-status').textContent`)), 'a too-small Stop is refused with the reason');
        assert.equal(JSON.stringify(await evalv(`window.editor.layout()`)), before, 'the refused resize changed nothing');

        // Undo takes the move back.
        await evalv(`document.querySelector('[data-undo]').click()`);
        assert.equal(await evalv(`window.editor.layout().parts.find((p) => p.id === 'stop').place.x`), 0, 'Undo restored Stop');

        // The part sheet hides the battery (a layout may hide what is not required), and Save sends it.
        await evalv(`(() => { const el = document.getElementById('battery'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 30, clientY: 300 })); })()`);
        await evalv(`document.querySelector('.ov-arrange-style').click()`);
        assert.ok(await until(`!!document.querySelector('.ov-arrange-sheet')`), 'the part sheet opened');
        await evalv(`(() => { const c = document.querySelector('.ov-arrange-sheet [data-visible]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        assert.ok(await evalv(`document.getElementById('battery').hidden === true`), 'hiding the battery hides its part');
        await evalv(`document.querySelector('.ov-arrange-sheet [data-close]').click()`);
        await evalv(`document.querySelector('[data-save]').click()`);
        assert.ok(await until(`!!window.calls.save`), 'Save sent the layout');
        assert.equal(await evalv(`window.calls.save.parts.find((p) => p.id === 'battery').visible`), false, 'the saved layout carries the hidden battery');

        // Ask OpenVibe: previewed on the real parts, kept only with Keep.
        await evalv(`(() => { const f = document.querySelector('form[data-ask]'); f.querySelector('input').value = 'put Stop first and make it big'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()`);
        assert.ok(await until(`!!document.querySelector('.ov-arrange-preview')`), 'the suggestion is previewed');
        assert.ok(/Stop is first/.test(await evalv(`document.querySelector('.ov-arrange-preview').textContent`)), 'the preview says what changed');
        assert.equal(await evalv(`document.getElementById('stop').style.gridColumn`), '2 / span 2', 'the suggestion is shown on the real Stop');
        assert.equal(await evalv(`document.getElementById('stop').style.gridRow`), '4 / span 2', 'and in its row');
        await evalv(`document.querySelector('.ov-arrange-preview [data-keep]').click()`);
        assert.equal(await evalv(`window.editor.layout().parts.find((p) => p.id === 'stop').place.x`), 1, 'Keep applied the suggestion');
        assert.equal(await evalv(`document.querySelector('.ov-arrange-preview') === null`), true, 'the preview bar went away');

        // A long press opens the part's sheet (the phone's way to the style controls).
        await evalv(`(() => { const el = document.getElementById('stick'); const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9, clientX: r.left + 5, clientY: r.top + 5 })); })()`);
        assert.ok(await until(`!!document.querySelector('.ov-arrange-sheet')`), 'a long press opens the part sheet');
        await evalv(`document.querySelector('.ov-arrange-sheet [data-close]').click()`);
        await evalv(`(() => { const el = document.getElementById('stick'); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 })); })()`);

        // Reset to default, Share, Done.
        await evalv(`document.querySelector('[data-reset]').click()`);
        assert.equal(await evalv(`window.editor.layout().name`), 'Default', 'Reset to default');
        await evalv(`document.querySelector('[data-share]').click()`);
        assert.ok(await until(`!!document.querySelector('.ov-arrange-share input')`), 'Share shows the link');
        await evalv(`document.querySelector('[data-done]').click()`);
        assert.equal(await evalv(`document.querySelector('.ov-arrange-bar') === null`), true, 'Done closes the editor');
        console.log('ov-arrange-chrome: move, refuse with the reason, undo, sheet, save, AI preview and Keep, reset, share and done');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
