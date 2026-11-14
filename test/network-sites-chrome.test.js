'use strict';
// "One account. 61 sites." (4.256.0, plan §AA.37) in a real headless Chrome: at 390 px the section never scrolls
// sideways, this site's group is open with its icons whole, the other seven are fold rows with their counts, and a
// folded group's icons are drawn by ov-icons.js when it opens. At 1280 px the open group spans the width.
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
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'the section never scrolls sideways');
        const shape = await page.evaluate(`(() => {
            const groups = [...document.querySelectorAll('.sc-onenet-g')];
            const open = groups.filter((g) => g.open);
            const rows = groups.filter((g) => !g.open).map((g) => ({ h: g.querySelector('summary').getBoundingClientRect().height, count: getComputedStyle(g.querySelector('.sc-fold-hint')).display !== 'none' }));
            const here = document.querySelector('[aria-current="page"]');
            return { groups: groups.length, open: open.length, openIcons: open[0].querySelectorAll('.ov-appicon svg').length, rows, here: here && here.textContent };
        })()`);
        assert.equal(shape.groups, 8, 'eight groups');
        assert.equal(shape.open, 1, 'one open: this site\'s');
        assert.equal(shape.openIcons, 7, 'its seven icons drawn');
        assert.ok(shape.rows.every((r) => r.h >= 44 && r.count), 'every other group is a row to tap, with its count');
        assert.ok(/Live/.test(shape.here) && /You are here/.test(shape.here), 'this site is "You are here"');
        await page.evaluate("document.querySelectorAll('.sc-onenet-g')[5].open = true");
        const drawn = await page.evaluate(`new Promise((ok) => { const t0 = Date.now(); (function tick() {
            const done = [...document.querySelectorAll('.sc-onenet-g')[5].querySelectorAll('.ov-appicon')].every((i) => i.querySelector('svg'));
            if (done || Date.now() - t0 > 4000) ok(done); else setTimeout(tick, 50); })(); })`);
        assert.ok(drawn, 'a folded group draws its icons when it opens');
        await page.close();
        const wide = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await wide.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });
        const span = await wide.evaluate(`(() => { const g = document.querySelector('.sc-onenet-g[open]'); const box = document.querySelector('.sc-onenet-groups'); return [Math.round(g.getBoundingClientRect().width), Math.round(box.getBoundingClientRect().width)]; })()`);
        assert.equal(span[0], span[1], 'the open group spans the width on a computer');
        await wide.close();
        console.log('network-sites-chrome: 61 sites, one group open, folds that draw their icons when opened');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
