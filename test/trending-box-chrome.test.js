'use strict';
// ov-trending.js in real headless Chrome (4.277.0; plan §AD.13 (1); the owner, 11-15: "it scrolls thru what's trending
// with a cool animation/effects in the search input itself … across all sites"): an empty search box shows "Try <term>"
// in the box itself, its placeholder kept as its name; the line moves on every few seconds (never with motion Off); Tab
// takes the line shown; typing hides it and clearing brings it back; a search sent from the box goes out as a beacon
// with the query and the site; a box marked off, and a page whose list is empty, keep their own placeholder.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('trending-box-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const beacons = [];
let empty = false;
const page = (motion) => `<!doctype html><html lang="en"${motion ? ` data-ov-motion="${motion}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Box</title><link rel="icon" href="data:,">
<style>body{margin:0;font:16px/1.4 sans-serif}form{position:relative;display:flex;gap:8px;padding:20px}input{flex:1;height:44px;padding:0 14px;font:inherit;border:1px solid #888;border-radius:10px}</style>
<script>window.OV_TRENDING_API = location.origin + '/api/frame';</script></head>
<body><form id="f" action="/search" onsubmit="event.preventDefault()"><input id="q" type="search" name="q" placeholder="What are you looking for?"><button>Go</button></form>
<p><input id="off" type="search" data-ov-trending="off" placeholder="Not a trending box"></p>
<script src="/ov-trending.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' || u.pathname === '/off') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page(u.pathname === '/off' ? 'off' : '')); }
    if (u.pathname === '/ov-trending.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-trending.js'))); }
    if (u.pathname === '/api/frame/trending') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ trending: empty ? [] : [{ query: 'synthesizers' }, { query: 'go live from a browser' }, { query: 'drum machines' }] }));
    }
    if (u.pathname === '/api/frame/searched' && req.method === 'POST') {
        let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { beacons.push({ type: req.headers['content-type'], body: JSON.parse(b) }); res.writeHead(204); res.end(); });
        return undefined;
    }
    res.writeHead(404); return res.end();
});

const GHOST = `(() => { const g = document.querySelector('#q + .ovt-ghost'); const q = document.getElementById('q');
    return { shown: !!g && !g.hidden, text: g ? (g.querySelector('.ovt-line:last-child') || {}).textContent || '' : '', placeholder: q.getAttribute('placeholder'),
        label: q.getAttribute('aria-label'), offGhost: !!document.querySelector('#off + .ovt-ghost'), value: q.value }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-trending-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await new Promise((ok) => setTimeout(ok, 600));
        let s = await p.evaluate(GHOST);
        assert.deepStrictEqual([s.shown, s.text, s.placeholder, s.label, s.offGhost], [true, 'Try synthesizers', '', 'What are you looking for?', false], `the first trending search in the box (${JSON.stringify(s)})`);
        await new Promise((ok) => setTimeout(ok, 3600));
        s = await p.evaluate(GHOST);
        assert.strictEqual(s.text, 'Try go live from a browser', 'it moves on to the next');

        // Tab takes the line shown.
        await p.evaluate("(() => { const q = document.getElementById('q'); q.focus(); q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); return true; })()");
        s = await p.evaluate(GHOST);
        assert.deepStrictEqual([s.value, s.shown, s.placeholder], ['go live from a browser', false, 'What are you looking for?'], 'Tab took it, the line went, the placeholder came back');
        // Sent: one beacon with the query and the site.
        await p.evaluate("(document.getElementById('f').requestSubmit(), true)");
        for (let i = 0; i < 40 && !beacons.length; i++) await new Promise((ok) => setTimeout(ok, 50));
        assert.strictEqual(beacons.length, 1, 'one beacon');
        assert.deepStrictEqual([beacons[0].body.q, beacons[0].body.site, /^text\/plain/.test(beacons[0].type)], ['go live from a browser', '127.0.0.1', true], 'text/plain, the query and the site');
        await p.evaluate("(document.getElementById('f').requestSubmit(), true)");
        await new Promise((ok) => setTimeout(ok, 300));
        assert.strictEqual(beacons.length, 1, 'the same query again within ten seconds is not counted twice');
        // Cleared: the line comes back.
        await p.evaluate("(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
        s = await p.evaluate(GHOST);
        assert.strictEqual(s.shown, true, 'cleared: the trending line again');
        const over = await p.evaluate('document.documentElement.scrollWidth - innerWidth');
        assert.strictEqual(over, 0, 'nothing sticks out at 390');
        await p.close();

        // Motion Off: the first one, still.
        const still = await h.openPage(browser, context, { width: 390 });
        await still.goto(`${base}/off`, { maxMs: 5000 });
        await new Promise((ok) => setTimeout(ok, 4000));
        s = await still.evaluate(GHOST);
        assert.deepStrictEqual([s.shown, s.text], [true, 'Try synthesizers'], 'motion Off: the first trending search, never moving');
        await still.close();

        // Nothing trending: the box keeps its own placeholder.
        empty = true;
        const ctx2 = await browser.newContext();
        const bare = await h.openPage(browser, ctx2, { width: 390 });
        await bare.goto(`${base}/`, { maxMs: 5000 });
        await new Promise((ok) => setTimeout(ok, 600));
        s = await bare.evaluate(GHOST);
        assert.deepStrictEqual([s.shown, s.placeholder], [false, 'What are you looking for?'], 'an empty list draws nothing');
        await bare.close();
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log('trending-box-chrome: the trending line in the box, moving on, Tab takes it, typing hides it, one beacon a search; Off is still; empty draws nothing');
})().catch((err) => { console.error(err); process.exit(1); });
