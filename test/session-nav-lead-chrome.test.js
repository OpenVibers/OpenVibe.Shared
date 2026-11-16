'use strict';
// The session surface's sessions button goes where it belongs (4.285.0; the owner, 11-16, a screenshot of
// openvibe.codes: "move to top left"; then, of the menu's Vibe: "it does have to be intelligent and aware, so that in
// this UI it still has a way to do the button nicely, versus when you're on the site itself"), in a real headless
// Chrome:
// - on a site's page, under the navbar: the button is the navbar's top-left slot, the row under the bar goes while
//   nothing is open, and opening the drawer from the bar keeps the same button (focus stays, its pane fills);
// - in the menu's panel: the surface keeps its own button, drawn as the sidebar glyph, and the bar's slot is untouched;
// - a computer: the bar's slot folds the column away and back.
// No sideways scroll at 390 px.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('session-nav-lead-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const page = (where) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#0b0f1a;color:#e8edf6;font:15px system-ui} #host{height:calc(100vh - 56px)} .ovs-panel{position:fixed;inset:60px 8px 8px;background:#121a2b} .ovs-vibe-body{height:100%}</style>
</head><body><div id="nav"></div>
${where === 'menu' ? '<div class="ovs-panel"><div class="ovs-vibe-body" id="host"></div></div>' : '<div id="host"></div>'}
<script src="/navbar.js"></script><script>OpenVibeNavbar.init({ mount: '#nav', site: 'codes', siteName: 'Codes', dock: false, messages: false, links: [] });</script>
<script src="/ov-session.js"></script>
<script>window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, title: 'Codes', helloTitle: 'What should we build?', starters: [['code', 'Build me a landing page']] });</script>
</body></html>`;
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (p === '/' || p === '/menu') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(p === '/menu' ? 'menu' : 'page')); }
    if (/^\/[a-z0-9-]+\.(js|css)$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/runs') return json(res, 200, { runs: [{ ref: 'codes:tsk_1', kind: 'code', title: 'Add a dark mode switch', status: 'done', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }], partial: [] });
    if (p.startsWith('/api/frame/')) return json(res, 200, {});
    res.writeHead(404); res.end();
});

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-navlead-')) });
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); };
    let failed = 0;
    const check = async (name, fn) => { try { await fn(); console.log(`  ok  ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e && e.stack}`); } };
    try {
        await check('on the page: the sessions button is the navbar\'s top-left slot; the row under the bar goes while nothing is open', async () => {
            const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
            await p.goto(`${base}/`);
            await until(p, "!!document.getElementById('ovnav-lead') && document.querySelector('.ovse').classList.contains('has-nav-lead')");
            const shape = await p.evaluate(`(() => {
                const lead = document.getElementById('ovnav-lead'); const head = document.querySelector('.ovse-head'); const own = document.querySelector('.ovse-menu');
                const brand = document.querySelector('.openvibe-navbar-brand');
                return { label: lead.getAttribute('aria-label'), controls: lead.getAttribute('aria-controls'), drawer: document.querySelector('.ovse-drawer').id,
                    expanded: lead.getAttribute('aria-expanded'), first: brand.firstElementChild === lead, headShown: getComputedStyle(head).display !== 'none',
                    ownShown: getComputedStyle(own).display !== 'none', pane: !!lead.querySelector('.ovnav-sb-pane'),
                    wide: document.documentElement.scrollWidth <= innerWidth };
            })()`);
            assert.deepStrictEqual(shape, { label: 'Your sessions', controls: shape.drawer, drawer: shape.drawer, expanded: 'false', first: true, headShown: false, ownShown: false, pane: true, wide: true });
            // Open from the bar: the same element stays (focus kept), its state says open, the drawer is open.
            await p.evaluate("window.__lead = document.getElementById('ovnav-lead'); window.__lead.focus(); window.__lead.click()");
            await until(p, "document.querySelector('.ovse').classList.contains('is-drawer')");
            await until(p, "document.getElementById('ovnav-lead').getAttribute('aria-expanded') === 'true'");
            assert.strictEqual(await p.evaluate("document.getElementById('ovnav-lead') === window.__lead"), true, 'the button is updated in place, not drawn again');
            assert.strictEqual(await p.evaluate("document.activeElement === window.__lead || document.querySelector('.ovse-drawer').contains(document.activeElement)"), true);
            // Close with the drawer's own Close: the bar's button says closed again, and focus comes back to it.
            await p.evaluate("document.querySelector('.ovse-dclose').click()");
            await until(p, "document.getElementById('ovnav-lead').getAttribute('aria-expanded') === 'false'");
            await until(p, "document.activeElement === document.getElementById('ovnav-lead')");
        });

        await check('in the menu\'s panel: the surface keeps its own button (the sidebar glyph) and leaves the bar alone', async () => {
            const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
            await p.goto(`${base}/menu`);
            await until(p, "!!document.querySelector('.ovse-menu')");
            await pause(800);   // longer than the surface waits for a bar
            const shape = await p.evaluate(`(() => {
                const own = document.querySelector('.ovse-menu');
                return { lead: !!document.getElementById('ovnav-lead'), hasLead: document.querySelector('.ovse').classList.contains('has-nav-lead'),
                    ownShown: getComputedStyle(own).display !== 'none', headShown: getComputedStyle(document.querySelector('.ovse-head')).display !== 'none',
                    glyph: !!own.querySelector('.ovse-sb-pane'), controls: own.getAttribute('aria-controls') === document.querySelector('.ovse-drawer').id };
            })()`);
            assert.deepStrictEqual(shape, { lead: false, hasLead: false, ownShown: true, headShown: true, glyph: true, controls: true });
            await p.evaluate("document.querySelector('.ovse-menu').click()");
            await until(p, "document.querySelector('.ovse-menu').getAttribute('aria-expanded') === 'true'");
        });

        await check('a computer: the bar\'s slot folds the column of sessions away and back', async () => {
            const p = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 860 });
            await p.goto(`${base}/`);
            await until(p, "!!document.getElementById('ovnav-lead')");
            const before = await p.evaluate("document.getElementById('ovnav-lead').getAttribute('aria-expanded')");
            await p.evaluate("document.getElementById('ovnav-lead').click()");
            await until(p, `document.getElementById('ovnav-lead').getAttribute('aria-expanded') === '${before === 'true' ? 'false' : 'true'}'`);
            await p.evaluate("document.getElementById('ovnav-lead').click()");
            await until(p, `document.getElementById('ovnav-lead').getAttribute('aria-expanded') === '${before}'`);
        });
    } finally {
        await browser.close();
        server.close();
    }
    if (failed) { console.log(`${failed} failed`); process.exit(1); }
    console.log('session-nav-lead-chrome: ok');
})().catch((e) => { console.error(e); process.exit(1); });
