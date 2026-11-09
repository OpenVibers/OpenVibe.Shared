'use strict';
// Sideways strips say they scroll (11-09, the owner: "it's not very apparent you can horizontal scroll… a little bounce…
// or auto scroll until you tap"), in a real headless Chrome: a kit rail's track and any [data-ovk-scroll] get edge fades
// where more is hidden and a position bar under them; data-ovk-scroll="drift" moves on its own while in view and stops for
// good at the first touch; a strip with nothing hidden shows neither. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('rails-scroll-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}
const ROOT = path.join(__dirname, '..');
const chips = (n) => Array.from({ length: n }, (_, i) => `<span style="flex:none;padding:10px 16px;border:1px solid #444;border-radius:999px">Chip number ${i + 1}</span>`).join('');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rails</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/kit.css"></head><body style="margin:0;padding:16px">
<div id="plain" data-ovk-scroll style="display:flex;gap:8px">${chips(12)}</div>
<div id="drift" data-ovk-scroll="drift" style="display:flex;gap:8px;margin-top:24px">${chips(12)}</div>
<div id="short" data-ovk-scroll style="display:flex;gap:8px;margin-top:24px">${chips(1)}</div>
<script src="/kit-web.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/kit.css' || u.pathname === '/kit-web.js') { res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-rails-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(300);
        const first = await p.evaluate(`({ endFade: document.getElementById('plain').classList.contains('is-more-end'), startFade: document.getElementById('plain').classList.contains('is-more-start'),
            bar: !document.querySelector('#plain + .ovk-scroll-bar').hidden, shortBar: document.querySelector('#short + .ovk-scroll-bar').hidden, shortFade: document.getElementById('short').classList.contains('is-more-end') })`);
        assert.ok(first.endFade && !first.startFade, `the far edge fades where more is hidden (${JSON.stringify(first)})`);
        assert.ok(first.bar, 'a position bar under a strip with more');
        assert.ok(first.shortBar && !first.shortFade, 'a strip with nothing hidden shows neither');
        await p.evaluate("document.getElementById('plain').scrollLeft = 99999");
        await wait(150);
        const end = await p.evaluate(`({ endFade: document.getElementById('plain').classList.contains('is-more-end'), startFade: document.getElementById('plain').classList.contains('is-more-start'), thumb: document.querySelector('#plain + .ovk-scroll-bar > i').style.transform })`);
        assert.ok(!end.endFade && end.startFade, 'at the end only the near edge fades');
        assert.ok(/translateX\((?!0%)/.test(end.thumb), `the bar's thumb moved (${end.thumb})`);
        // Drift: it moves on its own, and a touch stops it for good.
        const a = await p.evaluate("document.getElementById('drift').scrollLeft");
        await wait(900);
        const b = await p.evaluate("document.getElementById('drift').scrollLeft");
        assert.ok(b > a, `a drifting strip moves by itself (${a} → ${b})`);
        await p.evaluate("document.getElementById('drift').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))");
        const c = await p.evaluate("document.getElementById('drift').scrollLeft");
        await wait(700);
        assert.strictEqual(await p.evaluate("document.getElementById('drift').scrollLeft"), c, 'and stops at the first touch');
        console.log('rails-scroll-chrome: edge fades, the position bar, drift that stops at a touch, nothing on a short strip');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
