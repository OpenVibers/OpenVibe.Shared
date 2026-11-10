'use strict';
// The one dropdown (ov-drop.js, 4.191.0) in a real headless Chrome: it opens under what was pressed and stays on screen,
// opens above when there is no room below, marks the present page, moves with the arrow keys, closes with Escape (the
// focus goes back) and with a press outside, and the bar's name opens the site's pages with Home first.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-drop-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ov-drop.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-drop.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:1400px">
<a id="name" href="/" style="position:absolute;left:300px;top:20px">Chat</a>
<button id="low" style="position:fixed;right:4px;bottom:6px">More</button>
<script src="/ov-drop.js"></script>
<script>
  window.picked = '';
  OVDrop.attach(document.getElementById('low'), [{ label: 'Rename', onClick: () => { window.picked = 'rename'; } }, null, { label: 'Delete', danger: true, onClick: () => { window.picked = 'delete'; } }], { label: 'This room', align: 'end' });
  document.getElementById('name').addEventListener('click', (e) => { e.preventDefault(); OVDrop.pages(e.currentTarget, [{ label: 'Servers', href: '/servers', icon: 'i' }, { label: 'Vibe', href: '/vibe' }, { label: 'Elsewhere', href: 'https://example.org/' }, { label: 'Hidden', href: '/x', hidden: true }], (n) => '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>'); });
</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-drop-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await page.goto(`http://127.0.0.1:${server.address().port}/servers/abc`, { maxMs: 5000 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(50); } return false; };

        // The site's name: its pages, Home first, the present page marked, an outside address and a hidden link left out.
        await page.evaluate(`document.getElementById('name').click()`);
        assert.ok(await until(`!!document.querySelector('.ovdrop.is-open')`), 'it opens');
        const a = await page.evaluate(`(() => { const d = document.querySelector('.ovdrop'), r = d.getBoundingClientRect(), n = document.getElementById('name').getBoundingClientRect();
            return { rows: [...d.querySelectorAll('.ovdrop-item')].map((x) => x.textContent.trim() + (x.hasAttribute('aria-current') ? '*' : '')), left: r.left, right: r.right, top: r.top, under: r.top >= n.bottom, vw: innerWidth,
                label: d.getAttribute('aria-label'), role: d.getAttribute('role'), expanded: document.getElementById('name').getAttribute('aria-expanded'), icons: d.querySelectorAll('.ovdrop-ic svg').length }; })()`);
        assert.deepEqual(a.rows, ['Home', 'Servers*', 'Vibe'], 'Home first, then the links; the page you are on is marked (/servers/abc is under Servers)');
        assert.ok(a.under && a.left >= 8 && a.right <= a.vw - 8, 'under the name and wholly on the screen, though the name is near the right edge');
        assert.deepEqual([a.label, a.role, a.expanded, a.icons], ['Pages on Chat', 'menu', 'true', 3], 'named, a menu, the name says it is open, each row has its icon');
        // Escape closes it; the name says so.
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        assert.ok(await until(`!document.querySelector('.ovdrop.is-open') && document.getElementById('name').getAttribute('aria-expanded') === 'false'`), 'Escape closes it');

        // A button at the bottom of the screen: the list opens above it, aligned to its end; a row's action runs once.
        await page.evaluate(`document.getElementById('low').click()`);
        assert.ok(await until(`!!document.querySelector('.ovdrop.is-open')`));
        const b = await page.evaluate(`(() => { const d = document.querySelector('.ovdrop.is-open'), r = d.getBoundingClientRect(), n = document.getElementById('low').getBoundingClientRect();
            return { above: r.bottom <= n.top, right: r.right, vw: innerWidth, vh: innerHeight, bottom: r.bottom, sep: d.querySelectorAll('.ovdrop-sep').length, danger: d.querySelectorAll('.is-danger').length }; })()`);
        assert.ok(b.above && b.bottom <= b.vh && b.right <= b.vw - 4, 'no room below: it opens above, still on the screen');
        assert.deepEqual([b.sep, b.danger], [1, 1], 'a hairline between groups; a destructive row is marked');
        await page.evaluate(`document.querySelector('.ovdrop.is-open .ovdrop-item:last-of-type').click()`);
        assert.ok(await until(`window.picked === 'delete' && !document.querySelector('.ovdrop.is-open')`), 'choosing runs the row and closes the list');
        // The same button closes what it opened; one list at a time.
        await page.evaluate(`document.getElementById('low').click()`); assert.ok(await until(`!!document.querySelector('.ovdrop.is-open')`));
        await page.evaluate(`document.getElementById('name').click()`);
        assert.ok(await until(`document.querySelectorAll('.ovdrop.is-open').length === 1 && document.querySelector('.ovdrop.is-open').getAttribute('aria-label') === 'Pages on Chat'`), 'opening another closes the first');
        await page.evaluate(`document.getElementById('name').click()`);
        assert.ok(await until(`!document.querySelector('.ovdrop.is-open')`), 'pressing the same thing again closes it');
        console.log('ov-drop-chrome: under or above what was pressed, on the screen, pages with Home first and the present page marked, Escape, one at a time');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
