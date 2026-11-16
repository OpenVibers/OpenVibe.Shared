'use strict';
// A site's search suggests from where it is (4.287.0; the owner, 11-16: "more curated based on the content on the page …
// intelligent … smart based on where it is and what it's being used for"). In a real headless Chrome at 390 px:
//   • the empty box's chips mix your recent searches here, the page's own titles (its main content, never its nav),
//     and the site's trending, each group labelled in the list (Yours, On this page, Trending), never in the box;
//   • a search made here is remembered on this device and comes first next time;
//   • a box for people (data-ov-trending="people") suggests the people on the page, not its headings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('trending-content-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');

const page = (people) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>window.OV_TRENDING_API = location.origin + '/api/frame';</script></head>
<body style="margin:0;font:16px system-ui;background:#0b1220;color:#e6edf7">
<nav><h3>Menu</h3><h2>Settings</h2></nav>
<form id="f" action="/search" method="get" onsubmit="event.preventDefault()"><input id="q" name="q" type="search" placeholder="Search the streams" aria-label="Search"${people ? ' data-ov-trending="people"' : ''} style="width:300px;padding:8px 12px"></form>
<main><h1>Live now</h1><h2>Night speedruns</h2><section><h3>Cozy art streams</h3><h3>Retro racing cup</h3></section>
<a href="/@ada">@ada</a> <a href="/@bo">@bo</a> <div hidden><h2>Hidden heading</h2></div></main>
<script src="/ov-trending.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-trending.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-trending.js'))); }
    if (u.pathname === '/api/frame/trending') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ trending: [{ query: 'speedrun world record' }, { query: 'lofi beats' }, { query: 'chess blitz' }] })); }
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page(u.searchParams.has('people')));
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-trending-content-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    // The chips in order: a label ("# Yours") or a suggestion.
    const chips = (p) => p.evaluate(`[...document.querySelectorAll('.ovt-chips > *')].map((c) => (c.classList.contains('ovt-chips-head') ? '# ' : '') + c.textContent.trim())`);
    const focus = (p) => p.evaluate(`(() => { const i = document.getElementById('q'); i.blur(); i.focus(); return 1; })()`);
    try {
        const ctx = await browser.newContext();
        const p = await h.openPage(browser, ctx, { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await focus(p);
        await until(p, "document.querySelectorAll('.ovt-chips .ovt-chip').length > 0", 'chips under the empty box');
        assert.deepEqual(await chips(p), ['# On this page', 'Night speedruns', 'Cozy art streams', '# Trending', 'speedrun world record', 'lofi beats', 'chess blitz'],
            'the page\'s own titles (never its nav, never a hidden one), then the site\'s trending');
        assert.equal(await p.evaluate("document.querySelector('.ovt-chips').getAttribute('aria-label')"), 'Suggestions');
        const line = await p.evaluate("(document.querySelector('.ovt-ghost .ovt-line') || {}).textContent || ''");
        assert.ok(!/On this page|Yours|Trending/.test(line), `the box's line never names where it came from ("${line}")`);
        // A search made here is remembered and comes first next time.
        await p.evaluate("(() => { const i = document.getElementById('q'); i.value = 'pixel art'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()");
        const q = await h.openPage(browser, ctx, { width: 390, height: 844 });
        await q.goto(`${base}/`, { maxMs: 6000 });
        await focus(q);
        await until(q, "document.querySelectorAll('.ovt-chips .ovt-chip').length > 0", 'chips on the next visit');
        const again = await chips(q);
        assert.deepEqual(again.slice(0, 2), ['# Yours', 'pixel art'], `your search first (${again.join(' | ')})`);
        assert.equal(again[2], '# On this page');
        // A box for people suggests the people on the page.
        const r = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await r.goto(`${base}/?people`, { maxMs: 6000 });
        await focus(r);
        await until(r, "document.querySelectorAll('.ovt-chips .ovt-chip').length > 0", 'chips in a people box');
        const people = await chips(r);
        assert.deepEqual(people.slice(0, 3), ['# On this page', 'ada', 'bo'], `the people on the page (${people.join(' | ')})`);
        assert.equal(await r.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');
        console.log('trending-content-chrome: the page\'s titles, your searches here and the site\'s trending, each labelled; a people box suggests people');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
