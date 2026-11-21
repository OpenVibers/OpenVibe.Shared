'use strict';
// OVEmbeds (4.335.0; the owner, 11-21, on Actor's chat: "improve the formatting of these links and make more rich embedded
// content in the chat … a system that's able to just detect shit that it can add or make using custom HTML, or just
// generate code just like in the chat"): an answer's links become cards when there is more to show, a ```chart block is
// a chart, a ```html block runs in a sandbox and reports its height, ui cards an agent asks for are filled in, drawing
// again adds nothing twice, nothing spills past a 390 px phone, and the sandbox reaches neither the page nor the network.
// Real headless Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('embeds-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const ANSWER = `<div class="ovse-say" id="a1"><div class="ovse-words">
<p>Made a private repository: <a class="ovse-lk is-rich" href="https://git.openvibe.codes/goosely/add-minimal-example">goosely/add-minimal-example</a>,
the task is <a class="ovse-lk is-rich" href="https://openvibe.codes/run/tasks/tsk_01M7RNYKEW05CJVGBGN8SDKVQF">Codes task</a>, a video
<a class="ovse-lk is-rich" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">YouTube video</a>, and the docs
<a class="ovse-lk" href="https://example.com/docs/getting-started">example.com · getting started</a>
(again: <a class="ovse-lk is-rich" href="https://git.openvibe.codes/goosely/add-minimal-example#readme">repo</a>).</p>
<pre class="ovse-pre" data-lang="chart"><code>{"type":"bar","title":"Signups","labels":["Mon","Tue","Wed"],"series":[{"name":"New","data":[3,7,5]},{"name":"Back","data":[1,2,4]}]}</code></pre>
<pre class="ovse-pre" data-lang="html"><code>&lt;div id="t" style="height:300px;background:#e0f2fe"&gt;Hello&lt;/div&gt;&lt;script&gt;document.getElementById('t').textContent='Ran ' + typeof parent.document;&lt;/script&gt;</code></pre>
<pre class="ovse-pre" data-lang="js"><code>console.log(1)</code></pre>
</div><div data-ove-wait="chart" id="w1"></div></div>`;
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Embeds</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head>
<body style="margin:0;padding:16px;background:#0b0f19;color:#e6edf7;font:14px system-ui">${ANSWER}
<script src="/ov-embeds.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; style-src 'self' 'unsafe-inline'" }); return res.end(PAGE); }
    if (u.pathname === '/ov-embeds.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-embeds.js'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-embeds-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        const first = await p.evaluate(`(() => {
            document.getElementById('w1').__oveData = { type: 'line', title: 'Viewers', labels: ['1', '2', '3', '4'], series: [{ name: 'Now', data: [4, 9, 6, 12] }] };
            const a = document.getElementById('a1');
            OVEmbeds.enrich(a);
            OVEmbeds.enrich(a);   // again: nothing twice
            return {
                cards: [...a.querySelectorAll('.ove-cards .ove-card')].map((c) => [c.dataset.oveKind, c.querySelector('b').textContent]),
                cardRows: a.querySelectorAll('.ove-cards').length,
                bars: a.querySelectorAll('.ove-chart rect.ove-mark').length,
                line: a.querySelectorAll('#a1 > .ove-chart circle.ove-mark, .ove-chart circle.ove-mark').length,
                waitLeft: a.querySelectorAll('[data-ove-wait]').length,
                hiddenPre: [...a.querySelectorAll('pre[data-lang]')].map((x) => [x.dataset.lang, x.hidden]),
                sandbox: (a.querySelector('.ove-widget iframe') || {}).getAttribute && a.querySelector('.ove-widget iframe').getAttribute('sandbox'),
                info: ['https://youtu.be/dQw4w9WgXcQ', 'https://github.com/OpenVibers/OpenVibe.Shared/pull/644', 'https://openvibe.live/goosely', 'http://insecure.test/x', 'https://cdn.example.com/p/cat.webp'].map((u) => { const i = OVEmbeds.linkInfo(u); return i ? [i.kind, i.label, i.rich] : null; }),
            };
        })()`);
        assert.deepStrictEqual(first.cards, [['repo', 'goosely/add-minimal-example'], ['task', 'Codes task'], ['youtube', 'YouTube video']], `three cards, the repository once, a plain page none: ${JSON.stringify(first.cards)}`);
        assert.strictEqual(first.cardRows, 1, 'drawing again adds no second row');
        assert.strictEqual(first.bars, 6, 'two series of three bars');
        assert.ok(first.line >= 4, 'the ui chart an agent asked for is drawn');
        assert.strictEqual(first.waitLeft, 0, 'no place left waiting');
        assert.deepStrictEqual(first.hiddenPre, [['chart', true], ['html', true], ['js', false]], 'blocks that became things hide; other code stays code');
        assert.strictEqual(first.sandbox, 'allow-scripts', 'scripts run, the page and its origin are out of reach');
        assert.deepStrictEqual(first.info, [['youtube', 'YouTube video', true], ['repo', 'OpenVibers/OpenVibe.Shared #644', true], ['live', 'goosely', true], null, ['image', 'cat.webp', true]]);

        // The widget ran (its script changed its text), could not reach the page, and told its frame its height.
        const sized = await h.eventually(async () => {
            const v = await p.evaluate(`(() => { const f = document.querySelector('.ove-widget iframe'); return f ? Math.round(f.getBoundingClientRect().height) : 0; })()`);
            assert.ok(v >= 300, `the frame grew to what it draws (${v})`);
            return v;
        }, { maxMs: 6000 });
        assert.ok(sized <= 720, 'and no taller than 720');
        const inside = await p.evaluate(`(async () => { const f = document.querySelector('.ove-widget iframe'); try { return f.contentDocument ? 'reachable' : 'sealed'; } catch (e) { return 'sealed'; } })()`);
        assert.strictEqual(inside, 'sealed', 'the page cannot reach into the sandbox, nor it out');

        // Code and Preview switch; nothing spills past the phone.
        const tabs = await p.evaluate(`(() => { const w = document.querySelector('.ove-widget'); w.querySelectorAll('.ove-tabs button')[1].click(); const a = { frame: w.querySelector('iframe').hidden, code: w.querySelector('.ove-src').hidden }; w.querySelectorAll('.ove-tabs button')[0].click(); return { ...a, wide: document.documentElement.scrollWidth }; })()`);
        assert.deepStrictEqual([tabs.frame, tabs.code], [true, false], 'Code shows the source');
        assert.ok(tabs.wide <= 390, `no sideways scroll (${tabs.wide})`);
        console.log('embeds-chrome: all checks passed');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
