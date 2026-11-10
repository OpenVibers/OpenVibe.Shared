'use strict';
// The bottom of a phone (plan 279, the owner: "That fixed bottom position is kind of buggy … as you scroll up and
// down, so let's make that nice and smooth and perfect across all sites"). A real headless Chrome at 360×740,
// 390×844 and 430×932, with the browser's toolbar sliding away under the page:
//
//   • the toolbar is emulated with a visualViewport whose height changes while the layout viewport stays put (the
//     shim below; a real toolbar can update the visible viewport before the layout one, which is where a bar at
//     bottom: 0 is left behind);
//   • the page scrolls up and down through four positions and the toolbar opens and closes;
//   • the app bar's bottom edge stays on the visible viewport's bottom (within 1 px), the small player stays 8 px
//     above the bar and the Dock's pill 16 px above the small player, and none of them overlap;
//   • the gaps do not jump by more than 1 px between samples.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('bottom-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const file = (res, name, type) => {
    const p = path.join(ROOT, name);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(fs.existsSync(p) ? fs.readFileSync(p) : '');      // the baseline (origin/main) has no bottom.js: the page still loads
};
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bottom</title>
<style>body{margin:0;background:#0b1120;color:#e6edf7;font:15px system-ui;min-height:2600px}main{padding:20px 16px 64px}p{height:38px;margin:0 0 14px}</style></head>
<body><main><h1>Bottom</h1>${'<p>The bar, the small player and the Dock all take their place from one measured number.</p>'.repeat(40)}</main>
<script src="/bottom.js"></script>
<script src="/appbar.js"></script>
<script src="/mini.js"></script>
<script src="/dock.js"></script>
<script>
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
OpenVibeAppBar.render({
  config: { appBar: [{ label: 'Home', href: '/', icon: 'fa-house' }, { label: 'Games', href: '/games', icon: 'fa-gamepad' }, { label: 'Tools', href: '/tools', icon: 'fa-wrench' }] },
  links: [], activePage: null, nav: null,
  navIcon: () => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  escapeAttr: esc, escapeHtml: esc, flatLinks: () => [],
});
OpenVibeMini.open({ page: '/', src: '/clip.webm', title: 'The harbour at night', by: 'Kim', t: 0, dur: 60, rate: 1, vol: 0, muted: true, playing: false });
OpenVibeDock.mount({ apiBase: location.origin, token: 'tok', user: { id: 7, username: 'ada', display_name: 'Ada' } });
</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/clip.webm') return file(res, 'test/fixtures/ov-sync-clock.webm', 'video/webm');
    if (u.pathname === '/bottom.js' || u.pathname === '/appbar.js' || u.pathname === '/mini.js' || u.pathname === '/dock.js') return file(res, u.pathname.slice(1), 'application/javascript');
    if (u.pathname === '/api/v1/me/dock') {
        const body = { state: { open: false, tab: 'activity', pinned: false, agent: null, chat: null, place: { phone: { corner: 'bottom-right' }, desktop: { corner: 'bottom-right', width: null, height: null } }, updated_at: new Date().toISOString() }, counts: { running: 1, waiting: 0, unread: 0 }, sources_partial: false };
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(body));
    }
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end(PAGE);
});

// A visual viewport the test can shrink without resizing the layout viewport: the toolbar sliding over the page.
const SHIM = `(() => {
    let vh = innerHeight, top = 0;
    const vv = new EventTarget();
    Object.defineProperties(vv, {
        height: { get: () => vh }, width: { get: () => innerWidth },
        offsetTop: { get: () => top }, offsetLeft: { get: () => 0 },
        pageTop: { get: () => top + scrollY }, pageLeft: { get: () => 0 }, scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.__ovvv = {
        set(height, offset) { vh = height; top = offset || 0; vv.dispatchEvent(new Event('resize')); vv.dispatchEvent(new Event('scroll')); },
        reset() { vh = innerHeight; top = 0; vv.dispatchEvent(new Event('resize')); vv.dispatchEvent(new Event('scroll')); },
    };
})();`;

const MEASURE = `(() => {
    const px = (n) => Math.round(n * 100) / 100;
    const vv = visualViewport;
    const visibleBottom = vv.offsetTop + vv.height;
    const box = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const cs = getComputedStyle(e);
        if (e.hidden || cs.display === 'none' || cs.visibility === 'hidden') return null;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { t: px(r.top), b: px(r.bottom), l: px(r.left), r: px(r.right), w: px(r.width), h: px(r.height) };
    };
    const bar = box('.ovnav-appbar'), mini = box('.ovmini:not(.is-leaving)'), pill = box('#ovdk-pill');
    const area = (a, b) => (!a || !b) ? 0 : px(Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t)));
    return {
        visibleBottom: px(visibleBottom), innerHeight, lift: px(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ovb-lift')) || 0),
        bar, mini, pill,
        gaps: {
            bar: bar && px(visibleBottom - bar.b),
            mini: (bar && mini) ? px(bar.t - mini.b) : null,
            pill: (mini && pill) ? px(mini.t - pill.b) : null,
        },
        overlap: { barMini: area(bar, mini), barPill: area(bar, pill), miniPill: area(mini, pill) },
    };
})()`;

const SIZES = [[360, 740], [390, 844], [430, 932]];
const SCROLLS = [0, 900, 1800, 500];

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-bottom-')) });
    const report = [];
    let failed = 0;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        for (const [width, height] of SIZES) {
            const page = await h.openPage(browser, await browser.newContext(), { width, height });
            try {
                await page.send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
                await page.goto(`${base}/`, { maxMs: 15000, quietMs: 600 });
                const until = async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { let v = false; try { v = await page.evaluate(expr); } catch { v = false; } if (v) return true; await wait(80); } return false; };
                assert.ok(await until(`!!document.querySelector('.ovnav-appbar') && !!document.querySelector('.ovmini:not(.is-leaving)') && !!document.querySelector('#ovdk-pill') && !document.querySelector('#ovdk-pill').hidden`), `${width}x${height}: the bar, the small player and the Dock's pill are on the page`);
                await wait(450);       // the small player's entrance and the Dock's first read
                const samples = [];
                for (const [i, y] of SCROLLS.entries()) {
                    for (const [label, visible] of [['toolbar-shown', height - 56], ['toolbar-collapsed', height], ['toolbar-half', height - 28], ['toolbar-collapsed', height]]) {
                        await page.evaluate(`__ovvv.set(${visible}); scrollTo(0, ${y}); 0`);
                        await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
                        await wait(90);
                        const m = await page.evaluate(MEASURE);
                        m.y = y; m.toolbar = label; m.i = i;
                        samples.push(m);
                    }
                }
                // The toolbar sliding while the page is still: the same samples, for the jump.
                for (const visible of [height, height - 56, height - 56, height]) {
                    await page.evaluate(`__ovvv.set(${visible}); scrollTo(0, 900); 0`);
                    await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
                    await wait(90);
                    samples.push({ ...(await page.evaluate(MEASURE)), y: 900, toolbar: 'slide', i: 'slide' });
                }

                const failures = [];
                const check = (ok, text) => { if (!ok) failures.push(text); };
                for (const m of samples) {
                    const at = `${m.y}px/${m.toolbar}`;
                    check(!!m.bar, `${at}: the app bar is on the page`);
                    check(!!m.mini, `${at}: the small player is on the page`);
                    check(!!m.pill, `${at}: the Dock's pill is on the page`);
                    if (!m.bar || !m.mini || !m.pill) continue;
                    check(Math.abs(m.gaps.bar) <= 1, `${at}: the app bar's bottom is ${m.gaps.bar}px from the visible bottom`);
                    check(Math.abs(m.overlap.barMini) === 0, `${at}: the bar and the small player overlap by ${m.overlap.barMini}px²`);
                    check(Math.abs(m.overlap.barPill) === 0, `${at}: the bar and the Dock overlap by ${m.overlap.barPill}px²`);
                    check(Math.abs(m.overlap.miniPill) === 0, `${at}: the small player and the Dock overlap by ${m.overlap.miniPill}px²`);
                    check(Math.abs(m.gaps.mini - 8) <= 1, `${at}: the small player sits ${m.gaps.mini}px above the bar (8)`);
                    check(Math.abs(m.gaps.pill - 16) <= 1, `${at}: the Dock sits ${m.gaps.pill}px above the small player (16)`);
                }
                const spread = (key) => { const v = samples.map((m) => m.gaps[key]).filter((n) => typeof n === 'number'); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
                check(spread('bar') <= 1, `${width}x${height}: the bar jumps ${spread('bar')}px between samples`);
                check(spread('mini') <= 1, `${width}x${height}: the small player jumps ${spread('mini')}px between samples`);
                check(spread('pill') <= 1, `${width}x${height}: the Dock jumps ${spread('pill')}px between samples`);
                const barGaps = samples.map((m) => m.gaps.bar);
                const miniGaps = samples.map((m) => m.gaps.mini);
                const pillGaps = samples.map((m) => m.gaps.pill);
                report.push({
                    size: `${width}x${height}`, samples: samples.length,
                    bar: [Math.min(...barGaps), Math.max(...barGaps)],
                    mini: [Math.min(...miniGaps), Math.max(...miniGaps)],
                    pill: [Math.min(...pillGaps), Math.max(...pillGaps)],
                    overlap: Math.max(...samples.map((m) => m.overlap.barMini + m.overlap.barPill + m.overlap.miniPill)),
                });
                if (failures.length) {
                    failed++;
                    console.error(`${width}x${height}: ${failures.length} failure(s)`);
                    for (const f of failures.slice(0, 6)) console.error(`  - ${f}`);
                }
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    for (const r of report) console.log(`bottom-chrome ${r.size}: ${r.samples} samples, bar gap ${r.bar[0]}..${r.bar[1]}px, mini ${r.mini[0]}..${r.mini[1]}px, pill ${r.pill[0]}..${r.pill[1]}px, overlap ${r.overlap}px²`);
    if (failed || report.length !== SIZES.length) { console.error(`bottom-chrome: FAILED at ${failed} of ${SIZES.length} sizes`); process.exit(1); }
    console.log('bottom-chrome: the bar, the small player and the Dock hold the bottom at every size and toolbar state');
    server.close();
})().catch((e) => { console.error('bottom-chrome:', e.stack || e.message); try { server.close(); } catch { /* */ } process.exit(1); });
