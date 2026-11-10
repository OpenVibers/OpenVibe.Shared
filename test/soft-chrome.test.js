'use strict';
// soft.js in a real headless Chrome: the speculation rules are in the page, the bar has exactly one view-transition
// name (kit.css's duplicate would skip the transition), and Calm/Off and on/off/exclude behave. Skipped (exit 0)
// without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('soft-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const page = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<link rel="icon" href="data:,">
<script>window.__vt = null; addEventListener('pagereveal', function (e) { window.__vt = e.viewTransition ? 'yes' : 'no'; });</script>
<script>document.documentElement.setAttribute('data-ov-motion','full');</script>
<script src="/shared/soft.js"></script></head>
<body><div id="navbar-mount"><nav class="openvibe-navbar" aria-label="Site">bar</nav></div>
<main id="top"><h1>${title}</h1>
<a id="ok" href="/two">two</a>
<a id="home" href="/">home</a>
<a id="login" href="/login">login</a>
<a id="logout" href="/logout">logout</a>
<a id="download" href="/file.zip" download>zip</a>
<a id="query" href="/two?delete=1">query</a>
<a id="marked" href="/two" data-ov-no-prefetch>marked</a>
<a id="hash" href="#top">top</a></main></body></html>`;
const PAGES = { '/': page('Home'), '/two': page('Two') };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (PAGES[u.pathname]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(PAGES[u.pathname]); }
    if (u.pathname === '/shared/soft.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'soft.js'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-soft-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 1280, block: ['*openvibe.network*'] });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await p.evaluate(`new Promise((r) => (window.OpenVibeSoft ? r() : addEventListener('load', () => r())))`);

        const seen = await p.evaluate(`(() => {
            const rules = document.querySelector('script[type="speculationrules"]');
            const style = document.querySelector('#ov-soft-css');
            const named = [...document.querySelectorAll('*')]
                .map((el) => getComputedStyle(el).viewTransitionName)
                .filter((n) => n && n !== 'none');
            return {
                rules: rules ? JSON.parse(rules.textContent) : null,
                api: Object.keys(window.OpenVibeSoft || {}).sort(),
                style: style ? style.textContent : '',
                named,
                mount: getComputedStyle(document.getElementById('navbar-mount')).viewTransitionName,
                bar: getComputedStyle(document.querySelector('.openvibe-navbar')).viewTransitionName,
            };
        })()`);
        assert.deepStrictEqual(seen.api, ['exclude', 'off', 'on'], 'window.OpenVibeSoft = { on, off, exclude }');
        assert.ok(seen.rules && seen.rules.prefetch, 'the speculation rules are in the page');
        assert.strictEqual(seen.rules.prerender, undefined, 'no prerender rule');
        assert.strictEqual(seen.rules.prefetch[0].eagerness, 'moderate', 'moderate prefetch');
        assert.strictEqual(seen.rules.prefetch[1].where.and[0].selector_matches, '[data-ov-net-link]', 'the navbar\'s cross-site links are kept');
        const where = seen.rules.prefetch[0].where.and;
        const paths = where.find((c) => c.not && c.not.href_matches).not.href_matches;
        const selectors = where.find((c) => c.not && c.not.selector_matches).not.selector_matches;
        assert.ok(paths.includes('/logout*') && paths.includes('/login*') && paths.includes('/api/*'), 'sign-in/out and the API are out');
        assert.ok(paths.includes('/*.zip'), 'downloads by extension are out');
        assert.ok(selectors.includes('[download]'), 'a download link is out');
        assert.ok(selectors.includes('[href*="?"]'), 'a query link is out');
        assert.ok(selectors.includes('[data-ov-no-prefetch]'), 'a marked link is out');

        assert.ok(seen.style.includes('@view-transition{navigation:auto}'), 'cross-document transitions are on');
        assert.strictEqual(seen.mount, 'ov-soft-bar', 'the bar mount is the named element');
        assert.strictEqual(seen.bar, 'none', 'the nested bar is not named a second time');
        assert.strictEqual(seen.named.filter((n) => n === 'ov-soft-bar').length, 1, 'exactly one element has the bar name');
        assert.ok(!seen.named.includes('ov-navbar'), 'no leftover kit.css name');

        // Calm keeps the fade and shortens it; Off removes the transition; on()/off()/exclude() work.
        const calm = await p.evaluate(`document.documentElement.setAttribute('data-ov-motion','reduced'); new Promise((r) => setTimeout(() => r(document.querySelector('#ov-soft-css').textContent), 50))`);
        assert.ok(calm.includes('navigation:auto') && calm.includes('--ov-soft-fade:.12s'), 'Calm keeps a shorter fade');
        const still = await p.evaluate(`document.documentElement.setAttribute('data-ov-motion','off'); new Promise((r) => setTimeout(() => r(document.querySelector('#ov-soft-css').textContent), 50))`);
        assert.ok(still.includes('@view-transition{navigation:none}'), 'Off has no transition');
        await p.evaluate(`document.documentElement.setAttribute('data-ov-motion','full'); OpenVibeSoft.off(); 1`);
        const off = await p.evaluate(`({ rules: !!document.querySelector('script[type="speculationrules"]'), style: document.querySelector('#ov-soft-css').textContent })`);
        assert.strictEqual(off.rules, false, 'off() removes the rules');
        assert.ok(off.style.includes('navigation:none'), 'off() has no transition');
        const back = await p.evaluate(`OpenVibeSoft.on(); OpenVibeSoft.exclude('#marked'); ({ rules: JSON.parse(document.querySelector('script[type="speculationrules"]').textContent), style: document.querySelector('#ov-soft-css').textContent })`);
        assert.ok(back.style.includes('navigation:auto'), 'on() restores the transition');
        assert.ok(JSON.stringify(back.rules).includes('"#marked"'), 'exclude(selector) joins the rule');

        // A real move between two pages runs a cross-document transition: the incoming document's pagereveal has one.
        await p.evaluate(`document.getElementById('ok').click(); 1`);
        await p.settle({ quietMs: 300, maxMs: 5000 });
        assert.strictEqual(await p.evaluate('location.pathname'), '/two', 'the link moved to the next page');
        assert.strictEqual(await p.evaluate('window.__vt'), 'yes', 'the arriving page got a view transition');

        // With motion Off on the outgoing page there is no transition into the next one.
        await p.evaluate(`document.documentElement.setAttribute('data-ov-motion','off'); new Promise((r) => setTimeout(r, 50))`);
        assert.ok((await p.evaluate(`document.querySelector('#ov-soft-css').textContent`)).includes('navigation:none'), 'the outgoing page turned its transition off');
        await p.evaluate(`document.getElementById('home').click(); 1`);
        await p.settle({ quietMs: 300, maxMs: 5000 });
        assert.strictEqual(await p.evaluate('location.pathname'), '/', 'the link moved back');
        assert.strictEqual(await p.evaluate('window.__vt'), 'no', 'motion Off has no transition');

        assert.deepStrictEqual(p.state.errors.filter((e) => /speculation|view.?transition|CSSViewTransition/i.test(e.text)), [], 'no speculation or view-transition error in the page');
    } finally {
        await browser.close();
        server.close();
    }
    console.log('soft-chrome: rules, one bar name, Calm/Off and on/off/exclude in real Chrome');
})().catch((err) => { console.error(err); process.exit(1); });
