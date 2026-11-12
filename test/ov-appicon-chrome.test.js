'use strict';
// The one app icon (ov-icons.js .ov-appicon, OpenVibeIcons.app(), 4.225.0, design rule 142) in a real headless Chrome:
// markup and script make the same icon as the menu and Home (the app's own hue on a rounded square, its glyph drawn
// over it), at the size asked, labelled or decorative, filled when added later or when its app changes, and drawn
// dark on a light theme.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const icons = require('../ov-icons');
assert.equal(typeof icons.app, 'function', 'OpenVibeIcons.app is exported');
assert.equal(icons.hue('live'), (() => { let x = 7; for (const c of 'live') x = (x * 31 + c.charCodeAt(0)) % 360; return x; })(), 'the same hue as the menu and Home');
assert.match(icons.CSS, /\.ov-appicon\{/, 'its look ships with the icons');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-appicon-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ov-icons.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-icons.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px;background:#0b1220">
<span id="a" class="ov-appicon" data-icon="live" data-size="64"></span>
<span id="b" class="ov-appicon" data-icon="tools" data-label="Tools"></span>
<script src="/ov-icons.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-appicon-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const look = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); const g = e.querySelector('.ov-icon');
            return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, hue: e.style.getPropertyValue('--ova-h'), svg: !!e.querySelector('.ov-icon svg .ovi-glyph, .ov-icon svg .ovi-glyph--solid'),
                ring: g && g.querySelector('.ovi-ring') ? getComputedStyle(g.querySelector('.ovi-ring')).display : 'none', hidden: e.getAttribute('aria-hidden'), role: e.getAttribute('role'), label: e.getAttribute('aria-label'),
                glyph: g ? getComputedStyle(g).color : null, bg: cs.backgroundImage.startsWith('linear-gradient') }; })()`);
        await wait(100);
        const a = await look('#a');
        assert.deepEqual([a.w, a.h, a.radius, a.hue, a.svg, a.ring, a.hidden, a.bg], [64, 64, '30%', String(icons.hue('live')), true, 'none', 'true', true], 'from markup: its size, its hue, the glyph, no ring, decoration');
        const b = await look('#b');
        assert.deepEqual([b.w, b.role, b.label], [56, 'img', 'Tools'], 'the default size, and a label makes it an image with a name');
        // Script, and markup added later.
        await page.evaluate(`document.body.append(OpenVibeIcons.app('games', { size: 40, label: 'Games' })); const s = document.createElement('span'); s.id = 'late'; s.className = 'ov-appicon'; s.setAttribute('data-icon', 'chat'); document.body.append(s); true`);
        await wait(80);
        const late = await look('#late');
        assert.deepEqual([late.svg, late.hue], [true, String(icons.hue('chat'))], 'markup added later is filled');
        assert.equal(await page.evaluate(`document.querySelectorAll('.ov-appicon[data-icon="games"] .ov-icon svg').length`), 1, 'OpenVibeIcons.app() draws one');
        // Its app changes: it is redrawn in the new hue.
        await page.evaluate(`document.getElementById('late').setAttribute('data-icon', 'video'), true`);
        await wait(80);
        assert.equal((await look('#late')).hue, String(icons.hue('video')), 'a new app, a new hue');
        // A light theme draws the glyph dark.
        const darkGlyph = a.glyph;
        await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light'), true`);
        await wait(50);
        assert.notEqual((await look('#a')).glyph, darkGlyph, 'the glyph changes with the theme');
        await page.close();
        console.log('ov-appicon-chrome: markup and script, size, hue, label, late markup, a changed app, the light theme');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
