'use strict';
// One element carries view-transition-name ov-navbar (kit.css): a navbar inside its mount was a second one, and the
// browser skips the whole cross-document transition on a duplicate name ("Unexpected duplicate view-transition-name:
// ov-navbar", seen during every site's navigation by the browser check, 11-15). A bare navbar still carries it.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('navbar-transition-name-chrome: skipped'); process.exit(0); }

const kit = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
const pages = {
    '/mounted': '<div id="navbar-mount"><nav class="openvibe-navbar">n</nav></div>',
    '/bare': '<nav class="openvibe-navbar">n</nav>',
};
const server = http.createServer((req, res) => {
    if (req.url === '/kit.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(kit); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/kit.css"></head><body>${pages[req.url] || ''}</body></html>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-vtn-'));
    const browser = await h.launch({ tmpDir: tmp });
    try {
        const context = await browser.newContext();
        const names = async (url) => {
            const p = await h.openPage(browser, context, { width: 390, height: 600 });
            await p.goto(base + url, { maxMs: 6000 });
            const out = await p.evaluate("[...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).viewTransitionName === 'ov-navbar').map((e) => e.id || e.className)");
            await p.close();
            return out;
        };
        assert.deepStrictEqual(await names('/mounted'), ['navbar-mount'], 'inside its mount, only the mount is named');
        assert.deepStrictEqual(await names('/bare'), ['openvibe-navbar'], 'a navbar without a mount is named itself');
        console.log('navbar-transition-name-chrome: one ov-navbar, mounted or bare');
    } finally { await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
