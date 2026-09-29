'use strict';
// boost.js in a real headless Chrome against a local server-rendered site (plan T11): a same-site click swaps <main>
// without a page load (styles first, head tags, inline scripts once, the load event), back restores the page and its
// scroll, and anything that is not safely swappable (another release, other external scripts, an excluded path, a new
// tab) is a normal load. Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('boost-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const hits = {};
const page = ({ title, marker = 'site@r1', css = [], scripts = ['/js/site.js'], body, canonical }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="ov-boost" content="${marker}"><meta name="description" content="about ${title}"><link rel="canonical" href="https://site.example${canonical}">
<link rel="icon" href="data:,">${css.map((c) => `<link rel="stylesheet" href="${c}">`).join('')}
${scripts.map((s) => `<script src="${s}"></script>`).join('')}<script src="/boost.js" data-main="#main" defer></script></head>
<body class="page-${title.replace(/\W+/g, '-').toLowerCase()}"><header>header</header><main id="main" data-page="${title}">${body}</main><footer>footer</footer></body></html>`;
const LINKS = '<a id="to-a" href="/a">A</a> <a id="to-b" href="/b">B</a> <a id="to-x" href="/x">X</a> <a id="to-y" href="/y">Y</a> <a id="to-api" href="/api/thing">api</a> <a id="to-new" href="/a" target="_blank">new</a>';
const PAGES = {
    '/': page({ title: 'Home', canonical: '/', body: `<h1>Home</h1><div style="height:3000px">${LINKS}</div><p id="bottom">bottom</p>` }),
    '/a': page({ title: 'Page A', canonical: '/a', css: ['/css/a.css'], body: `<h1>A</h1>${LINKS}<script>window.inlineRuns = (window.inlineRuns || 0) + 1;</script><script type="application/ld+json">{"@type":"WebPage","name":"A"}</script>` }),
    '/b': page({ title: 'Page B', canonical: '/b', body: `<h1>B</h1>${LINKS}` }),
    '/x': page({ title: 'Page X', canonical: '/x', marker: 'site@r2', body: `<h1>X</h1>${LINKS}` }),
    '/y': page({ title: 'Page Y', canonical: '/y', scripts: ['/js/site.js', '/js/other.js'], body: `<h1>Y</h1>${LINKS}` }),
    '/api/thing': page({ title: 'API', canonical: '/api/thing', body: '<h1>api</h1>' }),
};
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    hits[u.pathname] = (hits[u.pathname] || 0) + 1;
    if (PAGES[u.pathname]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PAGES[u.pathname]); }
    if (u.pathname === '/boost.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'boost.js'))); }
    if (u.pathname === '/route-transition.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'route-transition.js'))); }
    if (u.pathname.startsWith('/js/')) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end('window.loads = (window.loads || 0) + 1;'); }
    if (u.pathname === '/css/a.css') { setTimeout(() => { res.writeHead(200, { 'content-type': 'text/css' }); res.end('main h1 { color: rgb(1, 2, 3); }'); }, 200); return undefined; }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-boost-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await p.evaluate('new Promise((r) => (window.OVBoost && OVBoost.controller ? r() : addEventListener("DOMContentLoaded", () => setTimeout(r, 0))))');
        const startY = await p.evaluate('window.alive = 1; window.scrollTo(0, 1200); scrollY');
        assert.ok(startY > 300, `the home page scrolled (${startY})`);

        // Hover prefetches; the click then swaps without a page load.
        const before = hits['/a'] || 0;
        await p.evaluate('document.getElementById("to-a").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); 1');
        await wait(150);
        assert.strictEqual(hits['/a'], before + 1, 'hover prefetched the page');
        let v = await p.evaluate(`new Promise((done) => {
            document.addEventListener('ov:boost:load', () => done({ alive: window.alive, page: document.getElementById('main').dataset.page, h1color: getComputedStyle(document.querySelector('main h1')).color,
                title: document.title, canonical: document.querySelector('link[rel=canonical]').href, desc: document.querySelector('meta[name=description]').content,
                ld: document.querySelectorAll('script[type="application/ld+json"]').length, bodyClass: document.body.className, inline: window.inlineRuns, loads: window.loads, path: location.pathname, y: scrollY,
                focused: document.activeElement && document.activeElement.id }), { once: true });
            document.getElementById('to-a').click();
        })`);
        assert.strictEqual(hits['/a'], before + 1, 'the click used the prefetched page (no second fetch)');
        assert.deepStrictEqual([v.alive, v.page, v.path, v.title], [1, 'Page A', '/a', 'Page A'], 'swapped in place, no page load');
        assert.strictEqual(v.h1color, 'rgb(1, 2, 3)', 'the new stylesheet applied before the content showed');
        assert.deepStrictEqual([v.canonical, v.desc], ['https://site.example/a', 'about Page A']);
        assert.strictEqual(v.bodyClass, 'page-page-a', 'the body class follows the page');
        assert.strictEqual(v.inline, 1, 'the inline script in the new main ran once');
        assert.strictEqual(v.loads, 1, 'the site script was not loaded again');
        assert.strictEqual(v.y, 0, 'a new page starts at the top'); assert.strictEqual(v.focused, 'main', 'focus moves to the new content');

        // Back: the home page again, at its scroll position, still no page load.
        v = await p.evaluate(`new Promise((done) => { document.addEventListener('ov:boost:load', () => done({ alive: window.alive, page: document.getElementById('main').dataset.page, y: scrollY, path: location.pathname }), { once: true }); history.back(); })`);
        assert.deepStrictEqual([v.alive, v.page, v.path], [1, 'Home', '/']);
        assert.ok(Math.abs(v.y - startY) < 5, `back restores the scroll (${v.y} vs ${startY})`);

        // Not swappable: an excluded path and a new tab are left to the browser; another release or other scripts load normally.
        // Did boost claim the click? A window listener runs after boost's document listener: it records the answer and
        // then cancels the browser's own navigation so the test stays on this page.
        const claimed = (id) => p.evaluate(`(() => { let seen = null; const w = (e) => { seen = e.defaultPrevented; e.preventDefault(); }; addEventListener('click', w, { once: true }); document.getElementById('${id}').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return seen; })()`);
        v = await claimed('to-api');
        assert.strictEqual(v, false, '/api/ is not boosted');
        v = await claimed('to-new');
        assert.strictEqual(v, false, 'target=_blank is not boosted');
        await p.evaluate('document.getElementById("to-x").click(); 1');
        await wait(1500);
        v = await p.evaluate('({ alive: window.alive, path: location.pathname, page: document.getElementById("main").dataset.page })');
        assert.deepStrictEqual([v.alive, v.path, v.page], [undefined, '/x', 'Page X'], 'another release: a normal page load');
        await p.evaluate('new Promise((r) => (window.OVBoost && OVBoost.controller ? r() : addEventListener("DOMContentLoaded", () => setTimeout(r, 0))))');
        await p.evaluate('window.alive = 2; document.getElementById("to-y").click(); 1');
        await wait(1500);
        v = await p.evaluate('({ alive: window.alive, path: location.pathname })');
        assert.deepStrictEqual([v.alive, v.path], [undefined, '/y'], 'other external scripts: a normal page load');

        const errors = p.state.errors.filter((e) => !/Failed to load resource/.test(e.text));
        assert.deepStrictEqual(errors, [], JSON.stringify(errors));
        console.log('boost-chrome: all checks passed');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
