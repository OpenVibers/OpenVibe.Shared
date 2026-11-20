'use strict';
// Rows that scroll sideways peek (navbar.js startPeeks, 4.248.0), without measuring the page on every change (11-20,
// Live's home: the scan read each new row's scrollWidth and style after every DOM change, so each change forced a layout
// of the whole page, ~420 ms of main thread at 4x CPU in the first five seconds as cards loaded). In a real headless
// Chrome:
//   - a row wider than its box, on screen, peeks a little way and back;
//   - thirty rows added below the fold after the page loaded are observed but never measured (no scrollWidth read)
//     until they come into view.
//   node test/peek-chrome.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('peek-chrome: skipped'); process.exit(0); }

const page = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script>
    // Count scrollWidth reads, by the row read (the rows added later carry data-late).
    window.__reads = { late: 0, other: 0 }; window.__peeked = 0;
    const sw = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
    Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get() { window.__reads[this.hasAttribute && this.hasAttribute('data-late') ? 'late' : 'other']++; return sw.get.call(this); } });
    </script>
    <div class="top-chips" style="overflow-x:auto;white-space:nowrap;width:300px;margin-top:20px"><span style="display:inline-block;width:1200px;height:40px">a row of chips wider than its box</span></div>
    <div style="height:3000px"></div><div id="below"></div>
    <script src="/navbar.js"></script>
    <script>document.querySelector('.top-chips').addEventListener('scroll', (e) => { window.__peeked = Math.max(window.__peeked, e.target.scrollLeft); });</script>`;
const server = http.createServer((req, res) => {
    if (req.url === '/navbar.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'navbar.js'))); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-peek-')) });
    const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
    try {
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await h.eventually(async () => assert.ok(await p.evaluate('window.__peeked') > 10, 'the wide row on screen peeks'), { timeout: 8000 });
        const scans = await p.evaluate('window.__ovPeekScans || 0');
        assert.ok(scans >= 1, 'the rows were scanned');
        await p.evaluate(`(() => { const below = document.getElementById('below');
            for (let i = 0; i < 30; i++) { const r = document.createElement('div'); r.className = 'late-chips'; r.setAttribute('data-late', '');
                r.style.cssText = 'overflow-x:auto;white-space:nowrap;width:300px'; r.innerHTML = '<span style="display:inline-block;width:900px;height:30px">row</span>'; below.append(r); } })()`);
        await h.eventually(async () => assert.ok(await p.evaluate('window.__ovPeekScans') > scans, 'the new rows were scanned'), { timeout: 6000 });
        assert.strictEqual(await p.evaluate('window.__reads.late'), 0, 'rows below the fold are observed, not measured');
        console.log('peek-chrome: a wide row peeks; new rows below the fold cost no layout reads');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
