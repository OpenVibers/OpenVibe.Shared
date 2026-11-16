'use strict';
// ov-trending.js knows where it is (4.283.0; the owner, 11-16: "it's not content aware … try GraveGateKeeper, that's a
// person … dumb to have it here in the vibe … it's also spacing wrong, offset to the top"). In real headless Chrome:
//   a site's own search (a GET form that goes somewhere, or role="search") gets what people search; a filter of the
//   person's own things (no form) keeps its placeholder and gets nothing;
//   a box its page attaches with its own list (data-ov-trending="own") rotates that list with its own words, and gets no
//   chips, no deep dive and no beacon;
//   a placeholder the page changes later is taken up at once: never two lines drawn over each other;
//   the line sits on the box's own text line (a tall box, uneven padding), and follows a box in a scrolled row.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('trending-context-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const beacons = [];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boxes</title><link rel="icon" href="data:,">
<style>body{margin:0;font:16px/1.4 sans-serif;padding:16px}input{box-sizing:border-box;font:inherit;border:1px solid #888;border-radius:10px;padding:0 14px}</style>
<script>window.OV_TRENDING_API = location.origin + '/api/frame';</script></head>
<body>
<form action="/search" onsubmit="event.preventDefault()"><input id="site" type="search" name="q" placeholder="Search the site" style="width:300px;height:44px"></form>
<p><input id="filter" type="search" placeholder="Filter your things" style="width:300px;height:44px"></p>
<p><input id="own" type="search" data-ov-trending="own" placeholder="Search sessions" style="width:300px;height:60px;padding:6px 14px 18px"></p>
<div style="position:relative"><div id="row" style="overflow-x:auto;white-space:nowrap;width:300px"><span style="display:inline-block;width:420px;height:10px"></span><span role="search" style="display:inline-block"><input id="rowq" type="search" placeholder="Search here" style="width:220px;height:40px"></span></div></div>
<script src="/ov-trending.js"></script>
<script>OVTrending.attach(document.getElementById('own'), { items: () => window.MINE }); window.MINE = ['Alpha session', 'Beta session'];</script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/ov-trending.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-trending.js'))); }
    if (u.pathname === '/api/frame/trending') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ trending: [{ query: 'GraveGateKeeper' }, { query: 'synthesizers' }] })); }
    if (u.pathname === '/api/frame/searched' && req.method === 'POST') { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { beacons.push(JSON.parse(b)); res.writeHead(204); res.end(); }); return undefined; }
    res.writeHead(404); return res.end();
});

const STATE = `(() => { const one = (id) => { const i = document.getElementById(id); const g = i.nextElementSibling && i.nextElementSibling.classList.contains('ovt-ghost') ? i.nextElementSibling : null;
        const line = g && !g.hidden ? g.querySelector('.ovt-line:last-child') : null;
        return { ghost: !!g && !g.hidden, text: line ? line.textContent : '', placeholder: i.getAttribute('placeholder'), label: i.getAttribute('aria-label') }; };
    return { site: one('site'), filter: one('filter'), own: one('own'), row: one('rowq'), chips: !!document.querySelector('.ovt-chips'), dive: !!document.querySelector('.ovt-dive') }; })()`;
// The line's glyphs against the box's text line: a Range over the line's text, centre to centre.
const CENTRE = (id) => `(() => { const i = document.getElementById(${JSON.stringify(id)}); const g = i.nextElementSibling; const line = g.querySelector('.ovt-line:last-child');
    const r = document.createRange(); r.selectNodeContents(line); const t = r.getBoundingClientRect(); const b = i.getBoundingClientRect(); const cs = getComputedStyle(i);
    // From the computed border and padding, never client* (Chrome 157 counts an input's padding into clientLeft).
    const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth), bl = parseFloat(cs.borderLeftWidth);
    const top = b.top + bt + parseFloat(cs.paddingTop), bottom = b.bottom - bb - parseFloat(cs.paddingBottom);
    return { dy: Math.round(((t.top + t.bottom) / 2 - (top + bottom) / 2) * 10) / 10, dx: Math.round((t.left - (b.left + bl + parseFloat(cs.paddingLeft))) * 10) / 10 }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-trending-ctx-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(700);
        let s = await p.evaluate(STATE);
        assert.deepStrictEqual([s.site.ghost, s.site.text], [true, 'GraveGateKeeper'], `a site's own search gets what people search (${JSON.stringify(s.site)})`);
        assert.deepStrictEqual([s.filter.ghost, s.filter.placeholder], [false, 'Filter your things'], 'a filter of the person\'s own things keeps its placeholder, nothing else');
        assert.deepStrictEqual([s.own.ghost, s.own.text, s.own.placeholder, s.own.label], [true, 'Alpha session', '', 'Search sessions'], `its own list, its own words (${JSON.stringify(s.own)})`);
        assert.deepStrictEqual([s.row.ghost, s.row.text], [true, 'GraveGateKeeper'], 'role="search" is a site search too');

        // On the box's text line: a tall box with uneven padding, and the plain one.
        for (const id of ['own', 'site']) {
            const c = await p.evaluate(CENTRE(id));
            assert.ok(Math.abs(c.dy) <= 1.5 && Math.abs(c.dx) <= 1.5, `${id}: the line sits where typing would (${JSON.stringify(c)})`);
        }
        // A box in a scrolled row: the line follows it.
        await p.evaluate("document.getElementById('row').scrollLeft = 200, true");
        await wait(150);
        const c = await p.evaluate(CENTRE('rowq'));
        assert.ok(Math.abs(c.dx) <= 1.5 && Math.abs(c.dy) <= 1.5, `the scrolled box's line came along (${JSON.stringify(c)})`);

        // The page changes the placeholder later: taken up, never drawn under the line.
        await p.evaluate("document.getElementById('own').placeholder = 'Search everything', true");
        await wait(80);
        s = await p.evaluate(STATE);
        assert.deepStrictEqual([s.own.placeholder, s.own.label, s.own.ghost, s.own.text], ['', 'Search everything', true, 'Alpha session'], `a later placeholder is taken up (${JSON.stringify(s.own)})`);

        // Its own box: no chips, no deep dive, no beacon.
        await p.evaluate("document.getElementById('own').focus(), true");
        await wait(120);
        s = await p.evaluate(STATE);
        assert.deepStrictEqual([s.chips, s.dive], [false, false], 'its own box gets no chips');
        // Focused, the line holds (no rotation past the 3.2 s step) and current() names it for the page's own list
        // (the owner, 11-16: "it should stay on whatever one it was on … put it into the list so you can click it").
        await wait(3600);
        s = await p.evaluate(STATE);
        const cur = await p.evaluate("JSON.stringify(OVTrending.current(document.getElementById('own')))");
        assert.deepStrictEqual([s.own.text, JSON.parse(cur).query], ['Alpha session', 'Alpha session'], `focused: it holds, and current() names it (${cur})`);
        await p.evaluate("(() => { const i = document.getElementById('own'); i.value = 'what is a synthesizer'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })(), true");
        await wait(200);
        s = await p.evaluate(STATE);
        assert.deepStrictEqual([s.dive, beacons.length, s.own.ghost], [false, 0, false], 'its own box: no deep dive, no beacon; typing hides the line');
        console.log('trending-context-chrome: site searches only, a filter left plain, its own list and words, a later placeholder taken up, on the text line, follows a scrolled row');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
