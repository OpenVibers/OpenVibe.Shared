'use strict';
// "One account. 61 sites." in a real headless Chrome, in Live's design (4.291.0, plan §AD.15; was 4.256.0's folds): at
// 390 px the page never scrolls sideways, every kind is open as one row of cards that scrolls sideways inside itself,
// the chips are 44 px to tap, this site is "You are here" and every icon is drawn by ov-icons.js. At 1280 px a kind is
// a grid of several columns.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const sc = require('../showcase');
const ovi = require('../ov-icons');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('network-sites-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ov-icons.js')) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-icons.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${sc.CSS}\n${ovi.APP_CSS}\nbody{margin:0;background:#0a0f1c;color:#e6edf7;font-family:sans-serif}</style>
<body>${sc.network({ service: 'live' })}<script src="/ov-icons.js"></script></body>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-network-sites-')) });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'the page never scrolls sideways');
        const shape = await page.evaluate(`new Promise((ok) => { const t0 = Date.now(); (function tick() {
            const groups = [...document.querySelectorAll('.sc-onenet-g')];
            const icons = [...document.querySelectorAll('.sc-onenet .ov-appicon')];
            const drawn = icons.filter((i) => i.querySelector('svg')).length;
            if (drawn < icons.length && Date.now() - t0 < 4000) return setTimeout(tick, 50);
            const lists = groups.map((g) => g.querySelector('.sc-onenet-list'));
            const here = document.querySelector('[aria-current="page"]');
            ok({ groups: groups.length, icons: icons.length, drawn,
                rows: lists.every((l) => getComputedStyle(l).overflowX === 'auto' && getComputedStyle(l).display === 'flex'),
                scrolls: lists.filter((l) => l.scrollWidth > l.clientWidth + 4).length,
                chips: [...document.querySelectorAll('.sc-onenet-jump a')].map((a) => Math.round(a.getBoundingClientRect().height)),
                here: here && here.textContent });
        })(); })`);
        assert.equal(shape.groups, 8, 'eight kinds, every one open');
        assert.equal(shape.drawn, shape.icons, `every icon drawn (${shape.drawn} of ${shape.icons})`);
        assert.equal(shape.icons, 61);
        assert.ok(shape.rows && shape.scrolls >= 6, `each kind a row that scrolls sideways inside itself (${shape.scrolls} of 8 overflow)`);
        assert.ok(shape.chips.length === 8 && shape.chips.every((h) => h >= 44), `a chip per kind, 44 px to tap (${shape.chips})`);
        assert.ok(/Live/.test(shape.here) && /You are here/.test(shape.here), 'this site is "You are here"');
        await page.close();
        const wide = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await wide.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });
        const cols = await wide.evaluate("getComputedStyle(document.querySelector('.sc-onenet-list')).gridTemplateColumns.split(' ').length");
        assert.ok(cols >= 3, `a kind is a grid of cards on a computer (${cols} columns)`);
        assert.ok(await wide.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'no sideways scroll on a computer either');
        await wide.close();
        console.log('network-sites-chrome: 61 sites in Live\'s design: every kind open, sideways rows on a phone, grids on a computer, every icon drawn');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
