'use strict';
// The suggestion line and the box's own words are never drawn over each other (4.286.0; the owner, 11-16, a third
// screenshot: "still duplicated like labels at times in the search bar", "Try BRDNBA_2026" over "Search the feed"), in a
// real headless Chrome:
// - a page that puts the same placeholder back while the line shows (a composer fitting its words to the box): the
//   placeholder is taken out again before the next frame;
// - a page that sets new words (a menu changing tabs): the line reads its list again and the words stay out;
// - a box redrawn under its line (the old one removed): the old line goes with it;
// - the box says the line owns it (data-ovt-on), so ov-composer's own examples stand down;
// - the line starts where typing starts, never centred.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('trending-overlap-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Overlap</title><link rel="icon" href="data:,">
<style>body{margin:0;font:16px/1.4 sans-serif;padding:16px}#wrap{position:relative}input{box-sizing:border-box;font:inherit;height:48px;border:1px solid #888;border-radius:14px;padding:0 14px;width:340px;text-align:center}</style>
<script>window.OV_TRENDING_API = location.origin + '/api/frame';</script></head>
<body><form id="f" action="/search" method="get" onsubmit="event.preventDefault()"><div id="wrap"><input id="q" name="q" type="search" placeholder="Search the feed" aria-label="Search"></div></form>
<script src="/ov-trending.js"></script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/ov-trending.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-trending.js'))); }
    if (u.pathname === '/api/frame/trending') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ trending: [{ query: 'BRDNBA_2026' }, { query: 'synthesizers' }, { query: 'cooking streams' }] })); }
    if (u.pathname === '/api/frame/searched') { res.writeHead(204); return res.end(); }
    res.writeHead(404); return res.end();
});

const STATE = `(() => { const i = document.getElementById('q'); const gs = [...document.querySelectorAll('.ovt-ghost')];
    const shown = gs.filter((g) => !g.hidden);
    return { ghosts: gs.length, shown: shown.length, placeholder: i.getAttribute('placeholder'), owns: i.hasAttribute('data-ovt-on'),
        align: shown[0] ? shown[0].style.textAlign : null, text: shown[0] ? shown[0].textContent : '' }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-trending-overlap-')) });
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const until = async (p, expr, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 600 });
        await p.goto(`${base}/`);
        await until(p, `${STATE}.shown === 1`);
        let s = await p.evaluate(STATE);
        assert.strictEqual(s.placeholder, '', 'the line shows and the box\'s own words are out');
        assert.strictEqual(s.owns, true, 'the box says the line owns it');
        assert.strictEqual(s.align, 'left', 'from where typing starts, though the box centres its text');

        // A composer fitting its words to the box puts the same words back: out again before the next frame.
        const after = await p.evaluate(`new Promise((ok) => { const i = document.getElementById('q'); i.setAttribute('placeholder', 'Search the feed');
            requestAnimationFrame(() => ok(i.getAttribute('placeholder'))); })`);
        assert.strictEqual(after, '', 'the same words put back never show under the line');

        // A menu changing tabs sets new words: the line reads its list again; the new words stay out while it shows.
        const next = await p.evaluate(`new Promise((ok) => { const i = document.getElementById('q'); i.setAttribute('placeholder', 'Search your alerts');
            requestAnimationFrame(() => requestAnimationFrame(() => ok(i.getAttribute('placeholder')))); })`);
        assert.strictEqual(next, '', 'new words while the line shows: out too');

        // Typing hides the line and gives the words back; clearing brings the line back without both.
        await p.evaluate("(() => { const i = document.getElementById('q'); i.value = 'cook'; i.dispatchEvent(new Event('input')); })()");
        s = await p.evaluate(STATE);
        assert.strictEqual(s.shown, 0, 'typing: no line');
        assert.strictEqual(s.owns, false);
        assert.ok(/^Search /.test(s.placeholder || ''), `typing: the box keeps its words (${s.placeholder})`);

        // A box redrawn under its line: the old line goes with the old box.
        await p.evaluate("(() => { const i = document.getElementById('q'); i.value = ''; i.dispatchEvent(new Event('input')); })()");
        await until(p, `${STATE}.shown === 1`);
        await p.evaluate(`(() => { const old = document.getElementById('q'); const n = old.cloneNode(false); n.removeAttribute('data-ovt-on');
            n.setAttribute('placeholder', 'Search the feed'); old.replaceWith(n); })()`);
        await until(p, `(() => { const gs = [...document.querySelectorAll('.ovt-ghost')].filter((g) => !g.hidden); const i = document.getElementById('q');
            return gs.length <= 1 && !(gs.length === 1 && i.getAttribute('placeholder')); })()`, 2000);
        await pause(700);
        s = await p.evaluate(STATE);
        assert.ok(s.shown <= 1, `one line at most after a redraw (${JSON.stringify(s)})`);
        assert.ok(!(s.shown === 1 && s.placeholder), `never a line and the words together (${JSON.stringify(s)})`);
        console.log('trending-overlap-chrome: ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
