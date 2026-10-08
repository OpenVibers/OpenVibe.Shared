'use strict';
// The navbar under openvibe-shared/boost in a real headless Chrome, measured the way ovhost browser-check measures a
// site (the harness's probe installed, a forced GC, Performance.getMetrics): every boost page move re-renders the bar,
// and nothing of the old bar may survive it. Before 2.13.4 the panels coordinator kept every old drawer (and with it
// the whole old bar and its listeners) and the probe kept every listener removed through an AbortSignal: +250 nodes
// and +20 listeners per lap on openvibe.codes (2026-10-08). Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('boost-navbar-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const LINKS = [{ label: 'Home', href: '/' }, { label: 'Two', href: '/two' }, { label: 'Three', href: '/three' }];
const page = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="ov-boost" content="site@r1"><link rel="icon" href="data:,">
<script src="/shared/navbar.js" defer></script><script src="/shared/boost.js" data-main="#main" defer></script></head>
<body><div id="navbar-mount"></div><main id="main"><h1>${title}</h1><p><a id="to-home" href="/">Home</a> <a id="to-two" href="/two">Two</a></p></main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: ${JSON.stringify(LINKS)}, networkLinks: false, countViews: false, notifications: false }); });</script>
</body></html>`;
const PAGES = { '/': page('Home'), '/two': page('Two') };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (PAGES[u.pathname]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PAGES[u.pathname]); }
    const m = /^\/shared\/([a-z0-9-]+\.js)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-boost-nav-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        // Nothing leaves the machine (the bar's network data and release watch are optional).
        const p = await h.openPage(browser, context, { width: 1280, probe: true, block: ['*openvibe.network*', '*openvibe.tools*', '*jsdelivr*'] });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await p.evaluate(`new Promise((r) => { const t = setInterval(() => { if (window.OVBoost && OVBoost.controller && document.querySelector('nav.openvibe-navbar') && window.OpenVibePanels) { clearInterval(t); r(); } }, 50); })`);

        // The probe forgets a listener its AbortSignal removed, as the browser does (holding it kept what it closes over).
        const probe = await p.evaluate(`(() => { const before = __ovProbe().documentListeners; const ac = new AbortController();
            document.addEventListener('ov:test', () => {}, { signal: ac.signal }); const added = __ovProbe().documentListeners;
            ac.abort(); return [added - before, __ovProbe().documentListeners - before]; })()`);
        assert.deepStrictEqual(probe, [1, 0], 'the probe counts a signal listener, then forgets it on abort');

        const move = (id) => p.evaluate(`new Promise((done) => { document.addEventListener('ov:boost:load', () => done(location.pathname), { once: true }); document.getElementById('${id}').click(); })`);
        const sample = async () => {
            await p.send('HeapProfiler.collectGarbage'); await wait(150); await p.send('HeapProfiler.collectGarbage');
            const m = await p.metrics();
            const pr = await p.evaluate('__ovProbe()');
            return { nodes: m.Nodes, listeners: m.JSEventListeners, doc: pr.documentListeners, win: pr.windowListeners };
        };
        const samples = [];
        for (let lap = 0; lap < 6; lap++) {
            assert.strictEqual(await move('to-two'), '/two');
            assert.strictEqual(await move('to-home'), '/');
            samples.push(await sample());
        }
        assert.strictEqual(await p.evaluate('OVBoost.controller.stats().moves'), 12, 'every move was a boost swap (no page load)');
        assert.strictEqual(await p.evaluate('document.querySelectorAll("nav.openvibe-navbar").length'), 1, 'one bar on the page');
        const a = samples[1], b = samples[samples.length - 1];
        const d = { nodes: b.nodes - a.nodes, listeners: b.listeners - a.listeners, doc: b.doc - a.doc, win: b.win - a.win };
        // A re-rendered bar is ~60 nodes and ~10 listeners here: four laps (eight moves) of keeping it would be ~500 and ~80.
        assert.ok(d.nodes <= 20, `no DOM growth from lap 2 to lap 6 (${JSON.stringify(d)}; ${JSON.stringify(samples)})`);
        assert.ok(d.listeners <= 2, `no listener growth from lap 2 to lap 6 (${JSON.stringify(d)})`);
        assert.ok(d.doc <= 0 && d.win <= 0, `the probe's window and document listeners do not grow (${JSON.stringify(d)})`);
        try {
            const { detachedNodes } = await p.send('DOM.getDetachedDomNodes');
            const bars = detachedNodes.filter((n) => n.treeNode && n.treeNode.nodeName === 'NAV');
            assert.strictEqual(bars.length, 0, `no old bar survives (${bars.length} detached)`);
        } catch (e) { if (e instanceof assert.AssertionError) throw e; /* an older Chrome without DOM.getDetachedDomNodes */ }
        console.log('boost-navbar-chrome: all checks passed');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
