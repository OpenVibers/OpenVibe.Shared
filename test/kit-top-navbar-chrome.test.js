'use strict';
// Sticky kit things follow a phone's navbar (4.276.0; the owner's /search screenshot, 11-15): navbar.js slides the bar
// away while reading down (.ovnav-hide), and a sticky .ovk-head used to keep stopping 52 px down, a see-through strip
// with the page showing through above it. With the bar away, --ovk-top is 0 and the head rides at the very top; with the
// bar back, it stops under the bar again. Real headless Chrome at 390 px. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('kit-top-navbar-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Top</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/kit.css"><style>body{margin:0}#navbar-mount{position:sticky;top:0;z-index:10000}.openvibe-navbar{height:52px;background:#123}.openvibe-navbar.ovnav-hide{transform:translateY(-110%)}
html{--ovnav-real-h:52px}.ovk-head{transition:none}</style></head>
<body><div id="navbar-mount"><nav class="openvibe-navbar">bar</nav></div><main style="padding:0 16px"><header class="ovk-head"><div class="ovk-head-row"><div class="ovk-head-id"><h1>Search</h1></div></div></header>
<div style="height:4000px">long page</div></main></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/kit.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, 'kit.css'))); }
    res.writeHead(404); return res.end();
});

const TOP = `(() => Math.round(document.querySelector('.ovk-head').getBoundingClientRect().top))()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-kittop-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await p.evaluate('window.scrollTo(0, 1500), true');
        const shown = await p.evaluate(TOP);
        await p.evaluate("document.querySelector('.openvibe-navbar').classList.add('ovnav-hide'), true");
        const away = await p.evaluate(TOP);
        await p.evaluate("document.querySelector('.openvibe-navbar').classList.remove('ovnav-hide'), true");
        const back = await p.evaluate(TOP);
        assert.strictEqual(shown, 52, `under the bar when it shows (${shown})`);
        assert.strictEqual(away, 0, `at the very top when the bar is away, no strip (${away})`);
        assert.strictEqual(back, 52, `under the bar again when it comes back (${back})`);
        await p.close();
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('kit-top-navbar-chrome: a sticky head rides under the navbar, and to the very top when a phone\'s navbar is away');
})().catch((err) => { console.error(err); process.exit(1); });
