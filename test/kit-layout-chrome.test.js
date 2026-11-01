'use strict';
// kit-layout.css in a real headless Chrome (4.78.0, plan L54 K1/K2): the fluid scale grows with the screen and stops at
// its ends; each primitive lays out by its own width (a switcher is all side by side or all stacked, never two and one;
// a sidebar's side goes under when the rest would be too narrow; a grid fits columns of --min; a rail scrolls); and the
// classless base finishes plain HTML under .ov-base while a site's own rule still wins. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('kit-layout-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const box = (n, w = '') => Array.from({ length: n }, (_, i) => `<div class="b" style="${w}">${i + 1}</div>`).join('');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Layout</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/kit.css"><link rel="stylesheet" href="/kit-layout.css">
<style>body{margin:0}.b{min-height:20px;background:#345}.site-h2{color:rgb(255,0,0)}</style></head>
<body>
<div id="sw" class="ov-switcher" style="--min:600px">${box(3)}</div>
<div id="sb" class="ov-sidebar" style="--side:200px;--min:60%"><aside class="b">side</aside><div class="b">rest</div></div>
<div id="gr" class="ov-grid" style="--min:180px;--gap:0px">${box(8)}</div>
<div id="ra" class="ov-rail" style="--item:200px">${box(8)}</div>
<div id="co" class="ov-cover" style="--min:400px"><p>top</p><h1 class="is-centre">centred</h1><p>bottom</p></div>
<div id="fr" class="ov-frame" style="--ratio:2/1;width:300px"><svg viewBox="0 0 10 10"></svg></div>
<main class="ov-base"><h1 id="h1">A heading</h1><h2 id="h2" class="site-h2">A site's own colour</h2><p id="p">Text <a id="a" href="#">a link</a></p>
<table id="t"><tr><th>A</th><td>1</td></tr></table><input id="in"><button id="bt">Go</button></main>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/kit.css' || u.pathname === '/kit-layout.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
    res.writeHead(404); return res.end();
});

const MEASURE = `(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const tops = (s) => [...document.querySelectorAll(s + ' > *')].map((e) => Math.round(e.getBoundingClientRect().top));
    const cs = (s) => getComputedStyle(document.querySelector(s));
    const co = r('#co'), mid = r('#co .is-centre');
    return {
        step0: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--step-0')) || parseFloat(cs('#p').fontSize),
        p: parseFloat(cs('#p').fontSize), h1: parseFloat(cs('#h1').fontSize),
        sw: new Set(tops('#sw')).size,
        sb: new Set(tops('#sb')).size,
        cols: new Set([...document.querySelectorAll('#gr > *')].map((e) => Math.round(e.getBoundingClientRect().left))).size,
        rail: (() => { const e = document.querySelector('#ra'); return e.scrollWidth > e.clientWidth; })(),
        centred: Math.abs((mid.top + mid.height / 2) - (co.top + co.height / 2)) < 30,
        frame: Math.round(r('#fr').height),
        h2: cs('#h2').color, link: cs('#a').textDecorationLine, table: cs('#t').display,
        input: Math.round(r('#in').height), btnRadius: cs('#bt').borderRadius,
        over: document.documentElement.scrollWidth - innerWidth,
    };
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-kitlayout-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const at = {};
        for (const w of [320, 1280, 1920]) {
            const p = await h.openPage(browser, context, { width: w });
            await p.goto(`${base}/`, { maxMs: 5000 });
            at[w] = await p.evaluate(MEASURE);
            await p.close();
        }
        const [phone, wide, wider] = [at[320], at[1280], at[1920]];
        assert.strictEqual(phone.p, 16, 'the base step is 16 px on a 320 px screen');
        assert.strictEqual(wider.p, 18, 'and stops at 18 px');
        assert.ok(wide.h1 > phone.h1 && wide.h1 <= wider.h1, `headings grow with the screen (${phone.h1} → ${wide.h1})`);
        assert.strictEqual(phone.sw, 3, 'a switcher narrower than --min stacks every child');
        assert.strictEqual(wide.sw, 1, 'and puts them all side by side when it fits: never two and one');
        assert.strictEqual(phone.sb, 2, 'a sidebar goes under when the rest would be too narrow');
        assert.strictEqual(wide.sb, 1, 'and sits beside it when there is room');
        assert.strictEqual(phone.cols, 1, 'a grid of 180 px columns: one on a phone');
        assert.strictEqual(wide.cols, 7, 'seven across 1280 px');
        assert.ok(phone.rail && wide.rail, 'a rail of eight 200 px items scrolls sideways');
        assert.ok(phone.centred && wide.centred, 'a cover centres its .is-centre child');
        assert.strictEqual(wide.frame, 150, 'a frame keeps its ratio');
        assert.strictEqual(wide.h2, 'rgb(255, 0, 0)', 'the base weighs nothing: a site\'s own class wins');
        assert.strictEqual(wide.link, 'underline');
        assert.strictEqual(wide.table, 'block', 'a wide table scrolls in its own box');
        assert.ok(wide.input >= 44, 'fields are a finger tall');
        assert.notStrictEqual(wide.btnRadius, '0px', 'buttons are finished');
        assert.strictEqual(phone.over, 0, 'nothing pushes a 320 px page sideways');
    } finally {
        await browser.close();
        server.close();
    }
    console.log('kit-layout-chrome: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
