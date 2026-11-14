'use strict';
// The composer on a page with the classless base (kit-layout.css, `.ov-base`): the base pads every bare button
// (.5em 1.1em), and the composer's 40 px icon buttons set a width but no padding, so on openvibe.exchange the mic and
// the + drew 4.5 px wide, two blank boxes under the search field (11-14 review). Every icon button now sets its own
// padding: each glyph draws at its size whatever page it is on. The first composer is openvibe.exchange's own search
// (thread.composer on the server, enhanced by ov-composer.js); the rest are the mounted presets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const thread = require('../thread');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-on-base-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const files = { '/ov-composer.js': 'application/javascript', '/ov-window.js': 'application/javascript', '/ov-capture.js': 'application/javascript', '/kit-layout.css': 'text/css', '/thread.css': 'text/css' };
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (files[u]) { res.writeHead(200, { 'content-type': files[u] }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/kit-layout.css"><link rel="stylesheet" href="/thread.css">
<body class="ov-base" style="margin:0;padding:16px">${thread.composer({ action: '/models', method: 'get', name: 'q', id: 'home-model-search', label: 'Search models', placeholder: 'Find a model or a provider', sendLabel: 'Search models', maxlength: 120, attrs: { 'data-ovc-no-draft': '' } })}
<div id="a"></div><div id="b"></div><div id="c"></div>
<script src="/ov-composer.js"></script>
<script>
const C = OpenVibeComposer;
C.mount(document.getElementById('a'), { preset: 'post', id: 'p1', user: { display_name: 'goosely' } });
C.mount(document.getElementById('b'), { preset: 'chat', id: 'c1' });
C.mount(document.getElementById('c'), { preset: 'agent', id: 'g1' });
</script>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-composer-base-')) });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 8000 });
        const icons = await page.evaluate(`[...document.querySelectorAll('.ovt-btn')].filter((b) => b.offsetParent).map((b) => {
            const s = b.querySelector('svg'); const cs = getComputedStyle(b);
            return { label: b.getAttribute('aria-label') || b.title || b.className, pad: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), w: s ? s.getBoundingClientRect().width : null };
        })`);
        assert.ok(icons.length >= 3, `the composers drew their tool buttons (${icons.length})`);
        for (const i of icons) {
            assert.equal(i.pad, 0, `${i.label}: the base's button padding does not reach it`);
            if (i.w != null) assert.ok(i.w >= 18, `${i.label}: its glyph draws at full size (${i.w.toFixed(1)} px)`);
        }
        console.log(`composer-on-base-chrome: ${icons.length} icon buttons, every glyph at full size on an ov-base page`);
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
