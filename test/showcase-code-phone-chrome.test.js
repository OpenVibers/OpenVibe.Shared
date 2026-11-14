'use strict';
// .sc-code on a phone (4.254.0): its one column is the screen's, never its content's. openvibe.zone put a part bar of
// eight nowrap tabs inside one, and the column grew to 597 px: the whole page scrolled sideways on a 390 px phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const sc = require('../showcase');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('showcase-code-phone-chrome: skipped'); process.exit(0); }
const tabs = sc.parts({ name: 'Pick', front: true, items: ['Pictures', 'Videos', 'Streams', 'Clips', 'Pastes', 'Memes', 'Wiki pages', 'Everything else']
    .map((label) => ({ id: label.toLowerCase().replace(/\W+/g, '-'), label, html: `<section class="sc-sec"><h2>${label}</h2><p>${label}</p></section>` })) });
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${sc.CSS}</style>
<body style="margin:0;padding:16px"><div class="sc-code">${tabs}</div>
<div class="sc-code"><figure><pre>${'a-very-long-line-of-code-that-does-not-wrap '.repeat(8)}</pre></figure></div></body>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-sc-code-')) });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'the page never scrolls sideways');
        assert.ok(await page.evaluate(`[...document.querySelectorAll('.sc-code')].every((g) => g.getBoundingClientRect().width <= 358.5)`), 'each grid is the screen\'s width less the gutter');
        await page.close();
        const wide = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await wide.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wide.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'nor on a computer');
        await wide.close();
        console.log('showcase-code-phone-chrome: one column the screen\'s width, whatever is inside');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
