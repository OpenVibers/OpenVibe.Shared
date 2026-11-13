'use strict';
// The composer's + (ov-composer.js 4.241.0) in a real headless Chrome: at 390 px it is a sheet from the bottom with big
// tiles (Camera, Photos, Files) and rows (the extras, a site's own tool); what the + holds is not also in the row; a
// tile opens the browser's picker for its kinds and what is picked joins the box; a box (data-ovc-plus) and a site
// (OpenVibeComposer.configure) choose what it shows; the close button and the backdrop close it. At 1280 px it is a
// panel under the box's row. Nothing is wider than the screen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-plus-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ov-composer.js' || u === '/ov-window.js' || u === '/ov-capture.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="a"></div><div id="b"></div><div id="c"></div>
<script src="/ov-composer.js"></script>
<script>
const C = OpenVibeComposer;
window.ran = [];
C.tool('poll', { label: 'Poll', sub: 'Ask people to vote', path: 'M5 19V9M12 19V5M19 19v-7', extra: true, run: () => window.ran.push('poll') });
window.post = C.mount(document.getElementById('a'), { preset: 'post', id: 'p1', user: { display_name: 'goosely' } });
window.only = C.mount(document.getElementById('b'), { preset: 'chat', id: 'c1', plus: { tiles: [], rows: ['timer'], only: true } });
window.site = C.mount(document.getElementById('c'), { preset: 'agent', id: 'g1' });
// The browser's picker, as a stand-in: what it was asked for, and two files "picked".
window.picked = [];
HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return;
    window.picked.push({ accept: this.accept, capture: this.getAttribute('capture') });
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' }));
    this.files = dt.files;
    setTimeout(() => this.dispatchEvent(new Event('change', { bubbles: true })), 10);
};
</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-plus-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 860 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        assert.ok(await until('!!window.site'), 'the composers mount');

        // What the + holds is not also in the row; the file inputs stay in the form.
        const row = await page.evaluate(`[...document.querySelectorAll('#p1 .ovt-c-tools .ovt-btn:not([hidden])')].map((b) => b.getAttribute('aria-label'))`);
        assert.deepEqual(row.filter((l) => /Photos|Files|Camera/.test(l)), [], `no photo, file or camera button in the row (${row})`);
        assert.ok(await page.evaluate(`document.querySelectorAll('#p1 input[type=file]').length >= 1`), 'the file inputs stay in the form');

        // At 390 px the + is a sheet from the bottom: tiles, then rows, a site's own tool among them.
        await page.evaluate(`document.querySelector('#p1 .ovc-more').click()`);
        const sheet = await until(`(() => { const d = document.querySelector('dialog.ovc-add[open]'); return d ? { tiles: [...d.querySelectorAll('.ovc-add-tile')].map((t) => t.dataset.tool), rows: [...d.querySelectorAll('.ovc-add-row')].map((r) => r.dataset.tool), title: d.querySelector('.ovc-add-h b').textContent } : null; })()`);
        assert.ok(sheet, 'a sheet from the bottom');
        assert.equal(sheet.title, 'Add');
        assert.deepEqual(sheet.tiles.filter((t) => t !== 'camera'), ['photo', 'file'], `Photos and Files as tiles (Camera where the browser has one) (${sheet.tiles})`);
        assert.ok(sheet.rows.includes('timer') && sheet.rows.includes('poll'), `the extras and the site's tool as rows (${sheet.rows})`);
        assert.equal(await page.evaluate(`document.querySelector('#p1 .ovc-more').getAttribute('aria-expanded')`), 'true');
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');

        // Photos: the picker for pictures and videos; what is picked joins the box, and the sheet is gone.
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-tile[data-tool=photo]').click()`);
        assert.ok(await until(`document.querySelectorAll('#p1 .ovc-file').length === 1`), 'the picked picture is a chip in the box');
        assert.deepEqual(await page.evaluate('window.picked[0]'), { accept: 'image/*,video/*', capture: null });
        assert.equal(await page.evaluate(`!!document.querySelector('dialog.ovc-add')`), false, 'the sheet closed as the tool ran');

        // A site's tool runs from its row.
        await page.evaluate(`document.querySelector('#p1 .ovc-more').click()`);
        await until(`!!document.querySelector('dialog.ovc-add[open] .ovc-add-row[data-tool=poll]')`);
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-row[data-tool=poll]').click()`);
        assert.deepEqual(await page.evaluate('window.ran'), ['poll']);

        // The close button closes it; so does the backdrop.
        await page.evaluate(`document.querySelector('#p1 .ovc-more').click()`);
        await until(`!!document.querySelector('dialog.ovc-add[open]')`);
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-x').click()`);
        assert.ok(await until(`!document.querySelector('dialog.ovc-add')`), 'the close button closes it');
        await page.evaluate(`document.querySelector('#p1 .ovc-more').click()`);
        await until(`!!document.querySelector('dialog.ovc-add[open]')`);
        await page.evaluate(`(() => { const d = document.querySelector('dialog.ovc-add'); d.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`);
        assert.ok(await until(`!document.querySelector('dialog.ovc-add')`), 'the backdrop closes it');

        // A box that chose its own +: no tiles, only Timer.
        await page.evaluate(`document.querySelector('#c1 .ovc-more').click()`);
        const own = await until(`(() => { const d = document.querySelector('dialog.ovc-add[open]'); return d ? { tiles: d.querySelectorAll('.ovc-add-tile').length, rows: [...d.querySelectorAll('.ovc-add-row')].map((r) => r.dataset.tool).filter((t) => !/^row-/.test(t)) } : null; })()`);
        assert.deepEqual(own, { tiles: 0, rows: ['timer'] }, 'data-ovc-plus: only what the box named');
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-x').click()`);
        await until(`!document.querySelector('dialog.ovc-add')`);

        // The site's choice (configure): every box's + follows it from then on; here, Files only as a tile.
        await page.evaluate(`OpenVibeComposer.configure({ plus: { tiles: ['file'] } }), true`);
        await page.evaluate(`document.querySelector('#g1 .ovc-more').click()`);
        const siteTiles = await until(`(() => { const d = document.querySelector('dialog.ovc-add[open]'); return d ? [...d.querySelectorAll('.ovc-add-tile')].map((t) => t.dataset.tool) : null; })()`);
        assert.deepEqual(siteTiles, ['file'], 'OpenVibeComposer.configure({ plus }) sets the site\'s choice');
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-tile[data-tool=file]').click()`);
        assert.ok(await until(`window.picked.length === 2`), 'Files opens the picker');
        assert.deepEqual(await page.evaluate('window.picked[1]'), { accept: '', capture: null }, 'any file (on Android: the system\'s Choose an action)');

        // At 1280 px: a panel under the row, inside the box.
        const wide = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 860 });
        await wide.goto(base + '/', { maxMs: 5000 });
        const untilW = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await wide.evaluate(expr); if (v) return v; await wait(40); } return false; };
        await untilW('!!window.site');
        await wide.evaluate(`document.querySelector('#p1 .ovc-more').click()`);
        assert.ok(await untilW(`!!document.querySelector('#p1 .ovc-add-inline .ovc-add-tile[data-tool=photo]') && !document.querySelector('dialog.ovc-add')`), 'a panel inside the box, not a sheet');
        await wide.evaluate(`document.querySelector('#p1 .ovc-add-inline').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        assert.ok(await untilW(`!document.querySelector('#p1 .ovc-add-inline')`), 'Escape closes the panel');
        console.log('composer-plus-chrome: the + as tiles and rows, a sheet on a phone and a panel on a wide screen, per box and per site, picked files in the box');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
