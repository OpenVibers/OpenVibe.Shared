'use strict';
// The top bar is modular (4.263.0; the owner, 11-15: "add a friend … from the top bar"): a script offers rows for what is
// typed with OpenVibeSearch.provide({ id, rows(q) }), or pushes the same object to window.OVSearchProviders before the menu
// loads. The rows lead the list as "Do it"; a press runs one, and Enter runs the first when the words were an @name.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('search-providers-chrome: skipped'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(req.url);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': m[1].endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script>
    window.__ran = [];
    window.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    // Before the menu: queued.
    (window.OVSearchProviders = window.OVSearchProviders || []).push({ id: 'early', rows: (q) => /^@\\w+$/.test(q) ? [{ title: 'Message ' + q, meta: 'Early', icon: 'send', run: () => window.__ran.push('message ' + q) }] : [] });
    </script><script src="/shared/search.js"></script><script>
    // After the menu: provide(); a broken provider takes nothing else down.
    OpenVibeSearch.provide({ id: 'late', rows: (q) => /^@\\w+$/.test(q) ? [{ title: 'Add ' + q + ' as a friend', icon: 'plus', run: () => window.__ran.push('add ' + q) }] : [] });
    OpenVibeSearch.provide({ id: 'broken', rows: () => { throw new Error('boom'); } });
    window.OVSearchProviders.push({ id: 'pushed-late', rows: () => [] });
    OpenVibeSearch.open({ service: 'site', token: 'tok_1', user: { id: 7, username: 'ada' }, apiBase: 'https://openvibe.network', sibling: (n) => '/shared/' + n });
    </script>`);
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-search-prov-')) });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const wait = async (expr, tries = 120) => { for (let n = 0; n < tries; n++) { const v = await page.evaluate(expr); if (v) return v; await pause(50); } return false; };
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait("!!document.querySelector('.ovs-input')"), 'the menu is open');
        const type = (v) => page.evaluate(`(() => { const i = document.querySelector('.ovs-input'); i.focus(); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await type('@kai');
        const rows = await wait(`(() => { const g = [...document.querySelectorAll('.ovs-group')].find((x) => /Do it/.test(x.textContent)); if (!g) return null; const out = []; for (let n = g.nextElementSibling; n && !n.classList.contains('ovs-group'); n = n.nextElementSibling) n.querySelectorAll('a').forEach((a) => out.push(a.textContent.trim())); return out.length ? out : null; })()`);
        assert.ok(rows && rows.length === 2 && /^Message @kai/.test(rows[0]) && /^Add @kai as a friend/.test(rows[1]), `the queued provider and the late one, first in the list (${rows})`);
        await page.evaluate(`[...document.querySelectorAll('.ovs a')].find((a) => /Add @kai as a friend/.test(a.textContent)).click()`);
        assert.deepStrictEqual(await page.evaluate('window.__ran'), ['add @kai'], 'a press runs it (no page change)');
        await type('@kai');
        await pause(150);
        await page.evaluate(`document.querySelector('.ovs-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
        assert.ok(await wait("window.__ran.length === 2"), 'Enter runs the first row for an @name');
        assert.deepStrictEqual(await page.evaluate('window.__ran'), ['add @kai', 'message @kai']);
        await type('plain words');
        await pause(300);
        assert.ok(await page.evaluate(`![...document.querySelectorAll('.ovs-group')].some((x) => /Do it/.test(x.textContent))`), 'no rows, no group');
        console.log('search-providers-chrome: queued and late providers, Do it first, a press and Enter run, a broken one harmless ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
