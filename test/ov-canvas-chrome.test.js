'use strict';
// ov-canvas.js in real Chrome (actor.canvas@1, ADR-059): every block is drawn, nothing is markup, a picture comes from
// openvibe.media only, a link only when it is https, a button only asks, a tick tells, an older version never rolls the
// panel back, and a wide table never makes a phone's page scroll sideways.
//   node test/ov-canvas-chrome.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('ov-canvas-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const DOC = {
    canvas: 'actor.canvas@1', id: 'cnv_01JAB2C3D4E5F6G7H8J9K0MNPQ', title: 'Lisbon, 14–17 November', version: 3,
    updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
    blocks: [
        { type: 'heading', text: 'Lisbon, 14–17 November', level: 1 },
        { type: 'metric', label: 'Flights and hotel', value: '€612', note: 'two people' },
        { type: 'checklist', id: 'todo', items: [{ id: 'flights', text: 'Pick the flights', done: true }, { id: 'hotel', text: 'Choose a hotel', done: false }] },
        { type: 'table', id: 'hotels', columns: ['Hotel', 'Night', 'Walk to the river', 'Breakfast', 'Cancellation', 'Rating'], rows: [['Casa A with a very long name indeed', 118, '6 min', 'included', 'free until Friday', 4.6], ['Hotel B', 96, '14 min', 'extra', 'none', 4.1]] },
        { type: 'chart', id: 'prices', kind: 'line', unit: '€', series: [{ name: 'Flights', points: [{ x: 'Mon', y: 240 }, { x: 'Tue', y: 212 }, { x: 'Wed', y: 199 }] }] },
        { type: 'chart', id: 'bars', kind: 'bar', series: [{ name: 'A', points: [{ x: 'Mon', y: 3 }] }, { name: 'B', points: [{ x: 'Mon', y: 5 }] }] },
        { type: 'image', src: 'https://openvibe.media/t/lisbon.jpg', alt: 'The river at dusk' },
        { type: 'image', src: 'https://tracker.example/p.png', alt: 'a tracking pixel' },
        { type: 'link', href: 'https://openvibe.video/watch?v=AbCdEfGhIjK', text: 'The walking tour' },
        { type: 'link', href: 'javascript:alert(1)', text: 'never drawn' },
        { type: 'text', text: '<script>window.__xss = 1</script><img src=x onerror="window.__xss = 2">\nSecond line.' },
        { type: 'html', html: '<b>never</b>' },
        { type: 'button', label: 'Book Casa A', action: 'ask' },
        { type: 'button', label: 'Delete everything', action: 'run' },
    ],
};
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Canvas</title><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:16px;font:15px system-ui;background:#0a0f1c;color:#e6edf7"><div id="c"></div><div id="ro"></div>
<script src="/ov-canvas.js"></script>
<script>window.__asked = []; window.__checked = []; window.__DOC = ${JSON.stringify(DOC).replace(/</g, '\\u003c')};
OVCanvas.render(document.getElementById('c'), window.__DOC, { onAsk: (l) => window.__asked.push(l), onCheck: (b, i, d) => window.__checked.push([b, i, d]) });
OVCanvas.render(document.getElementById('ro'), window.__DOC);</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (u.pathname === '/ov-canvas.js') { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-canvas.js'))); }
    res.writeHead(404); res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-canvas-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(200);
        const C = "document.getElementById('c')";
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-title').textContent`), 'Lisbon, 14–17 November');
        assert.strictEqual(await p.evaluate(`${C}.querySelector('h3').textContent`), 'Lisbon, 14–17 November', 'a heading');
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-metric-v').textContent`), '€612', 'a metric');
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-when').textContent`), '5 min ago', 'when it changed, in words');
        assert.deepStrictEqual(await p.evaluate(`[...${C}.querySelectorAll('.ovc-check input')].map((i) => i.checked)`), [true, false], 'a checklist');
        assert.strictEqual(await p.evaluate(`${C}.querySelectorAll('.ovc-table tbody tr').length`), 2, 'a table');
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-table td.is-num').textContent`), '118', 'numbers align as numbers');
        assert.strictEqual(await p.evaluate(`${C}.querySelectorAll('svg').length`), 2, 'two charts');
        assert.strictEqual(await p.evaluate(`${C}.querySelectorAll('svg polyline').length`), 1, 'a line');
        assert.strictEqual(await p.evaluate(`${C}.querySelectorAll('svg rect').length`), 2, 'grouped bars');
        assert.ok(await p.evaluate(`${C}.querySelector('table.ovc-sr').textContent.includes('240€')`), "the chart's numbers are a table for a screen reader");
        // Only openvibe.media pictures, only https links, never markup, never a block it does not know.
        assert.strictEqual(await p.evaluate("[...document.querySelectorAll('img')].every((i) => i.getAttribute('src').startsWith('https://openvibe.media/'))"), true, 'only openvibe.media pictures (one that fails to load is removed)');
        assert.deepStrictEqual(await p.evaluate(`[...${C}.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.target, a.rel, a.querySelector('span').textContent])`),
            [['https://openvibe.video/watch?v=AbCdEfGhIjK', '_blank', 'noopener noreferrer nofollow', 'openvibe.video']], 'a link shows its host; a javascript: link is not drawn');
        assert.strictEqual(await p.evaluate(`${C}.querySelectorAll('script, iframe, style:not(#ov-canvas-css)').length`), 0, 'no script, frame or style inside');
        assert.strictEqual(await p.evaluate('window.__xss === undefined'), true, 'text is text');
        assert.match(await p.evaluate(`${C}.querySelector('.ovc-text').textContent`), /^<script>window.__xss = 1<\/script>/, 'shown as written');
        assert.strictEqual(await p.evaluate(`${C}.textContent.includes('never')`), false, 'an html block and a running button are left out');
        // A button only asks; a tick tells; a canvas without the callbacks only shows.
        assert.deepStrictEqual(await p.evaluate(`[...${C}.querySelectorAll('.ovc-btn')].map((b) => b.textContent)`), ['Book Casa A']);
        await p.evaluate(`${C}.querySelector('.ovc-btn').click()`);
        assert.deepStrictEqual(await p.evaluate('window.__asked'), ['Book Casa A'], "the label goes to the agent as the person's message");
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-btn').textContent`), 'Sent');
        await p.evaluate(`${C}.querySelectorAll('.ovc-check input')[1].click()`);
        assert.deepStrictEqual(await p.evaluate('window.__checked'), [['todo', 'hotel', true]], 'the tick names the block and the item');
        assert.strictEqual(await p.evaluate("document.querySelector('#ro .ovc-btn').disabled && document.querySelector('#ro .ovc-check input').disabled"), true, 'no callbacks, nothing to press');
        // An older version never rolls the panel back; a newer one replaces it.
        assert.strictEqual(await p.evaluate(`OVCanvas.render(${C}, { ...window.__DOC, version: 2, title: 'Old' })`), 3);
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-title').textContent`), 'Lisbon, 14–17 November');
        assert.strictEqual(await p.evaluate(`OVCanvas.render(${C}, { ...window.__DOC, version: 4, title: 'Newer' })`), 4);
        assert.strictEqual(await p.evaluate(`${C}.querySelector('.ovc-title').textContent`), 'Newer');
        assert.strictEqual(await p.evaluate("OVCanvas.valid({ canvas: 'something-else', version: 1, blocks: [] })"), false);
        // A phone: the wide table scrolls in its own box; the page never scrolls sideways.
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'no sideways scroll at 390 px');
        assert.ok(await p.evaluate(`${C}.querySelector('.ovc-table').scrollWidth > ${C}.querySelector('.ovc-table').clientWidth`), 'the table scrolls inside');
        if (process.env.OV_SHOT) {
            const { data } = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            fs.writeFileSync(process.env.OV_SHOT, Buffer.from(data, 'base64'));
        }
        console.log('ov-canvas-chrome: every block, pictures from openvibe.media only, https links, text is text, a button asks, a tick tells, versions only grow, 390 px clean');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
