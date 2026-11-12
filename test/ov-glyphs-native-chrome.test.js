'use strict';
// OpenVibe's own icon markup (4.231.0) in a real headless Chrome: <i data-ov-icon> draws its glyph, takes a size
// class, changes when its name changes, draws nothing for a name the glyphs lack; <i data-ov-brand> draws a logo from
// brands.js; OVGlyphs.icon() makes one in script; Font Awesome markup still draws while sites move. The ring icons'
// solids are glyph drawings on the 24 grid (no 512 square scaled in).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-glyphs-native-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const files = { '/ov-glyphs.js': 'ov-glyphs.js', '/brands.js': 'brands.js', '/ov-icons.js': 'ov-icons.js' };
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (files[u]) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, files[u]))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;font-size:16px;color:#123456;background:#fff">
<i id="a" data-ov-icon="live"></i>
<i id="b" data-ov-icon="eye" class="ovg-2x" title="Watching"></i>
<i id="c" data-ov-icon="no-such-glyph"></i>
<i id="d" data-ov-brand="github"></i>
<i id="e" class="fa-solid fa-tower-broadcast"></i>
<span id="f" class="ov-icon" data-icon="live" data-size="48"></span>
<script src="/ov-glyphs.js"></script><script src="/ov-icons.js"></script>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-glyphs-native-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const look = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const r = e.getBoundingClientRect(); const s = e.querySelector('svg');
            return { svg: !!s, kids: s ? s.childElementCount : 0, w: Math.round(r.width), ovg: e.dataset.ovg || null, cls: e.className, hidden: e.getAttribute('aria-hidden'), label: e.getAttribute('aria-label'), color: s ? getComputedStyle(s).stroke : null }; })()`);
        await wait(150);
        const a = await look('#a');
        assert.equal(a.svg, true, 'data-ov-icon draws its glyph');
        assert.equal(a.ovg, 'live');
        assert.equal(a.hidden, 'true', 'an icon without a title is hidden from screen readers');
        assert.equal(a.color, 'rgb(18, 52, 86)', 'in the text\'s colour');
        const b = await look('#b');
        assert.equal(b.ovg, 'eye');
        assert.equal(b.w, Math.round(16 * 2 * 1.15), 'ovg-2x doubles it');
        assert.equal(b.label, 'Watching', 'a title names it');
        const c = await look('#c');
        assert.equal(c.svg, false, 'a name the glyphs do not have draws nothing');
        const e = await look('#e');
        assert.equal(e.ovg, 'live', 'Font Awesome markup still draws its glyph while sites move');
        // A changed name redraws; script makes one.
        await page.evaluate(`document.querySelector('#a').setAttribute('data-ov-icon', 'bell')`);
        await wait(100);
        assert.equal((await look('#a')).ovg, 'bell', 'a changed name redraws');
        const made = await page.evaluate(`(() => { const el = OVGlyphs.icon('gear', { title: 'Settings' }); document.body.appendChild(el); return { ovg: el.dataset.ovg, svg: !!el.querySelector('svg'), label: el.getAttribute('aria-label'), html: OVGlyphs.html('gear'), has: OVGlyphs.has('gear') && !OVGlyphs.has('nope') }; })()`);
        assert.deepEqual(made, { ovg: 'gear', svg: true, label: 'Settings', html: '<i data-ov-icon="gear" aria-hidden="true"></i>', has: true }, 'OVGlyphs.icon, .html and .has');
        // The logo arrives once brands.js has loaded.
        let d = null;
        for (let i = 0; i < 30 && !(d && d.svg); i++) { await wait(100); d = await look('#d'); }
        assert.equal(d.svg, true, 'data-ov-brand draws the logo');
        assert.equal(d.ovg, 'brand:github');
        // The ring icon's solid is the glyph's own drawing, unscaled.
        const ring = await page.evaluate(`(() => { const f = document.querySelector('#f'); const g = f.querySelector('.ovi-glyph--solid'); return { solid: !!g, scaled: !!(g && g.querySelector('g[transform*="scale"]')), paths: g ? g.querySelectorAll('path,circle').length : 0 }; })()`);
        if (ring.solid) assert.deepEqual([ring.scaled, ring.paths > 0], [false, true], 'a ring solid is a glyph drawing on the 24 grid');
        console.log('ov-glyphs-native-chrome: data-ov-icon draws (size, title, colour, rename, unknown draws nothing), data-ov-brand draws a logo, OVGlyphs.icon/html/has, Font Awesome markup still drawn, ring solids are glyphs');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
