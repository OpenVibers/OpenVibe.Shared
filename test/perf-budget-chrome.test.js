'use strict';
// openvibe-shared/perf-budget measure({ browser }) in a real headless Chrome against a local page whose text
// is pushed down by a late block: the shift, the paint and the click are measured. Its own file so a missing
// Chrome skips only this case (exit 0) and not the byte checks in perf-budget.test.js; OV_SKIP_BROWSER=1 too.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');
const { measure, check, format } = require('../perf-budget');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('perf-budget-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CWV</title><link rel="icon" href="data:,"></head><body>
<main id="m"><h1>Vitals</h1><p>${'Server-rendered text that a late block pushes down the page. '.repeat(20)}</p></main>
<script>setTimeout(() => { const d = document.createElement('div'); d.style.height = '300px'; d.textContent = 'late block';
  document.getElementById('m').prepend(d); }, 200);
document.addEventListener('click', () => { const t = performance.now(); while (performance.now() - t < 40) { /* busy */ } });</script></body></html>`;

(async () => {
    const server = http.createServer((req, res) => {
        if (req.url !== '/') { res.writeHead(404); res.end('no'); return; }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE);
    });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-perf-budget-test-'));
    try {
        // launch() options: this call starts Chrome and stops it again.
        const m = await measure({ base, browser: { tmpDir } });
        console.log('perf-budget-chrome: cwv', JSON.stringify(m.cwv));
        assert.ok(m.cwv.cls > 0, `the late block shifts the text: ${JSON.stringify(m.cwv)}`);
        assert.ok(m.cwv.lcpMs > 0, 'the text paints');
        assert.ok(m.cwv.inpMs >= 0 && Number.isInteger(m.cwv.inpMs), 'the click is measured');
        assert.deepStrictEqual(check(m, { cls: 0 }), [{ name: 'cls', value: m.cwv.cls, budget: 0 }]);
        assert.match(format(m), /cwv: lcp \d+ ms, inp \d+ ms, cls [\d.]+/);

        // A running browser is reused and left running.
        const running = await h.launch({ tmpDir });
        try {
            const again = await measure({ base, browser: { running } });
            assert.ok(again.cwv.cls > 0 && again.cwv.lcpMs > 0, JSON.stringify(again.cwv));
            assert.strictEqual(running.closed, false, 'a browser the caller started stays open');
        } finally { await running.close(); }
    } finally {
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('perf-budget-chrome: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
