'use strict';
// ov-metrics.js (4.232.0, ai-metrics.md): the network's one way to show numbers. In Node, the same words servers write;
// in a real headless Chrome, tiles with a delta and a trend, a ranked bar list, p50 and p95 on one scale, a split with
// its legend and a table that sorts on a click, at 390 px with no page overflow.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const M = require('../ov-metrics');

assert.equal(M.format.ms(540), '540 ms');
assert.equal(M.format.ms(1310), '1.3 s');
assert.equal(M.format.ms(98000), '1 min 38 s');
assert.equal(M.format.usd(0.0042), '$0.0042');
assert.equal(M.format.usd(61.2), '$61.20');
assert.equal(M.format.count(18420), '18k');
assert.equal(M.format.count(9100000), '9.1M');
assert.equal(M.format.rate(0.9941), '99.4%');
assert.equal(M.format.tps(86), '86.0 tok/s');
assert.equal(M.format.tps(133), '133 tok/s');
assert.equal(M.format.delta(0.12), '+12%');
assert.equal(M.format.ms(null), '—', 'unknown is a dash, never 0');
assert.equal(typeof M.tiles, 'undefined', 'Node has the words only');
assert.ok(require('../files').isBrowserFile('ov-metrics.js'), '/shared/ov-metrics.js');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-metrics-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ov-metrics.js')) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-metrics.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px;font:14px system-ui">
<div id="t"></div><div id="b"></div><div id="p"></div><div id="s"></div><div id="tb"></div>
<script src="/ov-metrics.js"></script><script>
document.getElementById('t').append(OVMetrics.tiles([{ label: 'Calls', value: OVMetrics.format.count(18420), delta: 0.12, trend: [3, 5, 4, 8, 9] }, { label: 'TTFT p50', value: OVMetrics.format.ms(540), sub: 'p95 1.3 s', delta: 0.08, better: 'down' }]));
document.getElementById('b').append(OVMetrics.bars([{ label: 'deepseek-v4-flash', value: 61.2 }, { label: 'gpt-5.1-mini', value: 12 }, { label: 'a-very-long-model-name-that-must-not-push-the-page-wider-than-the-phone', value: 3 }], { format: OVMetrics.format.usd }));
document.getElementById('p').append(OVMetrics.percentiles({ p50: 540, p90: 980, p95: 1310, n: 13080 }, { label: 'Time to first token' }));
document.getElementById('s').append(OVMetrics.split([{ label: 'Charged', value: 61.2 }, { label: 'Saved by cache', value: 19.8 }], { format: OVMetrics.format.usd }));
document.getElementById('tb').append(OVMetrics.table([{ model: 'b', tps: 40 }, { model: 'a', tps: 133 }, { model: 'c', tps: 86 }], [{ key: 'model', label: 'Model' }, { key: 'tps', label: 'Speed', numeric: true, bar: true, format: OVMetrics.format.tps }]));
</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-metrics-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await new Promise((r) => setTimeout(r, 150));
        const got = await page.evaluate(`(() => {
            const deltas = [...document.querySelectorAll('.ovm-delta')].map((d) => [d.textContent, d.className.includes('is-good') ? 'good' : d.className.includes('is-bad') ? 'bad' : '']);
            const bars = [...document.querySelectorAll('.ovm-bar-l')].map((b) => b.textContent);
            const spark = !!document.querySelector('.ovm-tile .ovm-spark path');
            const marks = document.querySelectorAll('.ovm-pct-mark').length;
            const pctLabel = document.querySelector('.ovm-pct').getAttribute('aria-label');
            const legend = document.querySelector('.ovm-split-legend').textContent;
            const rows = () => [...document.querySelectorAll('.ovm-table tbody tr td:first-child')].map((td) => td.textContent).join('');
            const before = rows();
            document.querySelectorAll('.ovm-table th button')[1].click();
            const desc = rows();
            document.querySelectorAll('.ovm-table th button')[1].click();
            const asc = rows();
            const sort = document.querySelectorAll('.ovm-table th')[1].getAttribute('aria-sort');
            const overflow = document.documentElement.scrollWidth > innerWidth;
            return { deltas, bars, spark, marks, pctLabel, legend, before, desc, asc, sort, overflow, css: !!document.getElementById('ov-metrics-css') };
        })()`);
        assert.deepEqual(got.deltas, [['+12%', 'good'], ['+8.0%', 'bad']], 'more calls is good; a slower first token is bad');
        assert.deepEqual(got.bars.slice(0, 2), ['deepseek-v4-flash', 'gpt-5.1-mini'], 'ranked by value');
        assert.ok(got.spark, 'a trend line in the tile');
        assert.equal(got.marks, 2, 'p50 and p95');
        assert.match(got.pctLabel, /median 540 ms, 95th percentile 1.3 s/);
        assert.match(got.legend, /Charged \$61\.20 \(75\.6%\).*Saved by cache \$19\.80/);
        assert.deepEqual([got.before, got.desc, got.asc, got.sort], ['bac', 'acb', 'bca', 'ascending'], 'a click sorts, a second click turns it');
        assert.equal(got.overflow, false, 'no page overflow at 390 px');
        assert.ok(got.css);
        console.log('ov-metrics-chrome: words in Node; tiles with deltas and trends, ranked bars, p50/p95, split with legend, a sortable table, no overflow at 390 px');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
