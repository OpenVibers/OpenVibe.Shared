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
assert.ok(icons.CSS.startsWith(icons.APP_CSS) && /\.ov-appicon\[data-size="44"\]\{--ova-size:44px\}/.test(icons.APP_CSS), 'APP_CSS is the app icon alone, sizes included');
{
    const m = icons.appHtml('live', { size: 44 });
    assert.match(m, /^<span class="ov-appicon" data-icon="live" data-ova="live" data-size="44" style="--ova-h:\d+;--ova-size:44px" aria-hidden="true"><span class="ov-icon" data-icon="live" data-ovi="live"/, 'appHtml: filled, sized and hued inline, decoration');
    assert.ok(m.includes(`--ova-h:${icons.hue('live')};`), 'appHtml: the same hue as the menu');
    const l = icons.appHtml('tools', { label: 'A <b> & "c"' });
    assert.ok(l.includes('aria-label="A &lt;b&gt; &amp; &quot;c&quot;"') && !l.includes('<b>'), 'appHtml: a label is escaped');
    assert.match(icons.appHtml('x', { size: 9999, hue: -30 }), /data-size="256" data-hue="30" style="--ova-h:30;--ova-size:256px"/, 'appHtml: size clamped, a given hue kept');
    const nav = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
    for (const n of [20, 26, 32, 44, 56, 64]) assert.ok(icons.APP_CSS.includes(`[data-size="${n}"]{--ova-size:${n}px}`) && nav.includes(`.ov-appicon[data-size="${n}"] { --ova-size: ${n}px; }`), `size ${n}: the navbar holds the square before ov-icons.js, at the same size`);
    assert.ok(/class="ovnav-net"[^`]*<span class="ov-appicon" data-icon=/.test(nav), 'the menu\'s "Across OpenVibe" sites are app icons');
    assert.ok(/'ovq-site-icon ov-appicon'/.test(fs.readFileSync(path.join(__dirname, '..', 'quest.js'), 'utf8')), 'a quest step\'s site is its app icon');
}
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-appicon-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ssr') {
        // 4.227.0: drawn on the server: APP_CSS in the page's stylesheet, appHtml() markup, no script at all.
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><meta charset="utf-8"><style>${icons.APP_CSS}.ov-icon svg{width:100%;height:100%}</style><body style="margin:0;padding:16px;background:#0b1220">${icons.appHtml('live', { size: 44 })}${icons.appHtml('tools', { label: 'Tools & "more"' })}${icons.appHtml('chat', { size: 26, hue: 30 })}`);
    }
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
        // Drawn on the server: whole with no script, and ov-icons.js arriving later changes nothing.
        const ssr = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await ssr.goto(`http://127.0.0.1:${server.address().port}/ssr`, { maxMs: 5000 });
        const box = (i) => ssr.evaluate(`(() => { const e = document.querySelectorAll('.ov-appicon')[${i}]; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); const ring = e.querySelector('.ovi-ring');
            return { w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundImage.startsWith('linear-gradient'), radius: cs.borderRadius, ring: ring ? getComputedStyle(ring).display : 'none', label: e.getAttribute('aria-label'), svg: e.querySelector('svg') }; })()`);
        const s0 = await box(0);
        assert.deepEqual([s0.w, s0.h, s0.bg, s0.radius, s0.ring], [44, 44, true, '30%', 'none'], 'server markup: its size, its look and no ring, with no script');
        assert.deepEqual([(await box(1)).w, (await box(1)).label], [56, 'Tools & "more"'], 'server markup: the default size and its name');
        assert.equal((await box(2)).w, 26);
        await ssr.evaluate(`window.__svg = document.querySelector('.ov-appicon svg'); const sc = document.createElement('script'); sc.src = '/ov-icons.js'; document.head.append(sc); true`);
        await h.eventually(async () => assert.equal(await ssr.evaluate(`!!(window.OpenVibeIcons && document.getElementById('ov-icons-css'))`), true, 'ov-icons.js arrived'));
        assert.equal(await ssr.evaluate(`document.querySelector('.ov-appicon svg') === window.__svg && document.querySelectorAll('.ov-appicon svg').length === 3`), true, 'ov-icons.js finds them already filled and leaves them');
        await ssr.close();
        // A light theme draws the glyph dark.
        const darkGlyph = a.glyph;
        await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light'), true`);
        await wait(50);
        assert.notEqual((await look('#a')).glyph, darkGlyph, 'the glyph changes with the theme');
        await page.close();
        console.log('ov-appicon-chrome: markup and script, size, hue, label, late markup, a changed app, server markup with no script, the light theme');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
