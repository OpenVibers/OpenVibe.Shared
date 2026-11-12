'use strict';
// showcase.parts() in a real headless Chrome (4.228.0, design rule short-pages-tabs): on a phone one part at a time
// with a tab bar, its own heading stepping aside; a tap or the arrow keys change the part; every part stays in the
// HTML; wide screens stack them with no bar; a front page tabs only at 600 px and under; no script on the page at all.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const sc = require('../showcase');
const sec = (t, body) => `<section class="sc-sec"><h2>${t}</h2><p class="sc-lede">${t} lede</p>${body}</section>`;
const tall = (t) => `<div style="height:600px">${t} body</div>`;
const page = (front) => sc.parts({ name: 'Channel', front, items: [
    { id: 'clips', label: 'Clips', count: 12, html: sec('Clips', tall('clips')) },
    { id: 'videos', label: 'Videos', count: 3, html: sec('Videos', tall('videos')) },
    { id: 'about', label: 'About', html: sec('About', tall('about')) },
    { id: 'none', label: 'Nothing', html: '' },
] });
const html = page(false);
assert.ok(!html.includes('Nothing'), 'an empty part is left out, never an empty tab');
assert.equal((html.match(/class="ov-part"/g) || []).length, 3, 'every part is in the HTML');
assert.ok(html.includes('<label for="ovp-channel-clips">Clips <span class="ov-parts-n">12</span></label>'), 'a tab names its part and its count');
assert.ok(sc.parts({ items: [{ id: 'a', label: 'A', html: '<p>a</p>' }] }).startsWith('<div class="ov-parts is-stacked">'), 'one part: stacked, no tabs');
assert.equal(sc.parts({ items: [] }), '');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('showcase-parts-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${sc.CSS}</style><body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7">${req.url.includes('front') ? page(true) : html}`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-parts-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = (p) => p.evaluate(`({ shown: [...document.querySelectorAll('.ov-part')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.part),
        bar: !!document.querySelector('.ov-parts-bar') && document.querySelector('.ov-parts-bar').offsetParent !== null,
        h2: [...document.querySelectorAll('.ov-part h2')].filter((e) => e.offsetParent !== null).length,
        lede: [...document.querySelectorAll('.ov-part .sc-lede')].filter((e) => e.offsetParent !== null).length,
        wide: document.documentElement.scrollWidth > window.innerWidth + 1, scripts: document.scripts.length })`);
    try {
        const url = `http://127.0.0.1:${server.address().port}/`;
        const phone = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await phone.goto(url, { maxMs: 5000 });
        await wait(100);
        let s = await state(phone);
        assert.deepEqual([s.shown, s.bar, s.h2, s.lede, s.wide, s.scripts], [['clips'], true, 0, 1, false, 0], 'a phone: the first part, the bar, its heading aside (its lede kept), no overflow, no script');
        await phone.evaluate(`document.querySelector('label[for="ovp-channel-videos"]').click(), true`);
        await wait(50);
        assert.deepEqual((await state(phone)).shown, ['videos'], 'a tap shows that part alone');
        await phone.evaluate(`document.getElementById('ovp-channel-videos').focus(), true`);
        await phone.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        await phone.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        await wait(50);
        assert.deepEqual((await state(phone)).shown, ['about'], 'the arrow keys move between parts');
        await phone.close();
        const desk = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await desk.goto(url, { maxMs: 5000 });
        await wait(100);
        s = await state(desk);
        assert.deepEqual([s.shown, s.bar, s.h2], [['clips', 'videos', 'about'], false, 3], 'a wide screen: every part stacked with its heading, no bar');
        await desk.close();
        const mid = await h.openPage(browser, await browser.newContext(), { width: 768, height: 900 });
        await mid.goto(`${url}front`, { maxMs: 5000 });
        await wait(100);
        assert.deepEqual((await state(mid)).shown, ['clips', 'videos', 'about'], 'a front page stacks at 768 px');
        await mid.goto(url, { maxMs: 5000 });
        await wait(100);
        assert.deepEqual((await state(mid)).shown, ['clips'], 'any other page tabs at 768 px');
        await mid.close();
        console.log('showcase-parts-chrome: one part on a phone, tap and arrow keys, all in the HTML, stacked wide, the front-page width');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
