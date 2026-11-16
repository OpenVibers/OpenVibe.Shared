'use strict';
// The suggestion line and the box's own words are never drawn over each other (4.286.0; the owner, 11-16, a third
// screenshot: "still duplicated like labels at times in the search bar", "Try BRDNBA_2026" over "Search the feed"), in a
// real headless Chrome:
// - a page that puts the same placeholder back while the line shows (a composer fitting its words to the box): the
//   placeholder is taken out again before the next frame;
// - a page that sets new words (a menu changing tabs): the line reads its list again and the words stay out;
// - a box redrawn under its line (the old one removed): the old line goes with it;
// - the box says the line owns it (data-ovt-on), so ov-composer's own examples stand down;
// - the line starts where typing starts, never centred, in the box's typing font (bolder than a placeholder), and
//   follows the box when the box moves without resizing.
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
<style>body{margin:0;font:16px/1.4 sans-serif;padding:16px}#wrap{position:relative}input{box-sizing:border-box;font:inherit;height:48px;border:1px solid #888;border-radius:14px;padding:0 14px;width:340px;text-align:center}input::placeholder{font-size:13px;font-weight:300;color:rgb(90, 100, 110)}</style>
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
        // The line keeps the box's typing font and colour, bolder than a thin placeholder, at 62% (the owner, 11-16: "I
        // liked the bolder font … thicker and … had a cool animation"); a page's own placeholder style is not its.
        const look = await p.evaluate(`(() => { const g = [...document.querySelectorAll('.ovt-ghost')].find((x) => !x.hidden); const c = getComputedStyle(g);
            const i = getComputedStyle(document.getElementById('q')); return { size: c.fontSize, box: i.fontSize, weight: c.fontWeight, opacity: c.opacity }; })()`);
        assert.deepStrictEqual(look, { size: '16px', box: '16px', weight: '400', opacity: '0.62' }, 'the typing font, at 62%');

        // The box moves 30 px inside its container without resizing (what CI's Chrome and the owner's phone did to the
        // menu: something beside it arrived after the line was placed): the line follows within a moment.
        const startOf = `(() => { const i = document.getElementById('q'); const c = getComputedStyle(i); return Math.round(i.getBoundingClientRect().left + parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth)); })()`;
        const lineAt = `(() => { const g = [...document.querySelectorAll('.ovt-ghost')].find((x) => !x.hidden); const t = g && g.querySelector('.ovt-term'); if (!t) return null; const r = document.createRange(); r.selectNodeContents(t); return Math.round(r.getBoundingClientRect().left); })()`;
        await p.evaluate("(() => { const w = document.getElementById('wrap'); w.style.display = 'flex'; const i = document.getElementById('q'); i.style.width = '300px'; i.style.flex = 'none'; const s = document.createElement('span'); s.id = 'pusher'; s.style.cssText = 'display:block;flex:none;width:0;height:1px'; i.before(s); return 1; })()");
        await pause(900);   // the page settles with the empty neighbour; then it grows, as a picture does when it loads
        await p.evaluate("document.getElementById('pusher').style.width = '30px', 1");
        await until(p, `Math.abs(${lineAt} - ${startOf}) <= 1`, 1500);
        assert.ok(Math.abs((await p.evaluate(lineAt)) - (await p.evaluate(startOf))) <= 1, 'the line follows its box when the box moves');
        await p.evaluate("(() => { document.getElementById('pusher').remove(); const i = document.getElementById('q'); i.style.width = ''; i.style.flex = ''; document.getElementById('wrap').style.display = ''; return 1; })()");

        // The box's block opens with a transform (the menu's open animation, mid-way on CI's slower Chrome and on the
        // owner's phone): a line placed then starts where typing starts the moment the block settles. 4.286.0: it was
        // "corrected" from transformed boxes and sat the box's padding away (120 vs 90 in the menu). Measured in the same
        // frame the transform goes, before anything could place it again.
        await p.evaluate("(() => { const w = document.getElementById('wrap'); w.style.position = 'relative'; w.style.transformOrigin = '0 0'; w.style.transform = 'scale(.25)'; const i = document.getElementById('q'); i.style.paddingLeft = '40px'; i.dispatchEvent(new Event('input')); return 1; })()");
        await pause(120);
        const settled = await p.evaluate(`(() => { document.getElementById('wrap').style.transform = ''; return [${lineAt}, ${startOf}]; })()`);
        assert.ok(settled[0] != null && Math.abs(settled[0] - settled[1]) <= 1, `a line placed mid-transform starts where typing starts once it settles (${settled[0]} vs ${settled[1]})`);
        await p.evaluate("(() => { const w = document.getElementById('wrap'); w.style.position = ''; w.style.transformOrigin = ''; document.getElementById('q').style.paddingLeft = ''; return 1; })()");
        await pause(400);

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
