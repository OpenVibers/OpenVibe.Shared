'use strict';
// The forms kit loads when a form control is drawn, not merely present (4.141.0, the owner 11-07: "make things faster
// and more optimized"). Live's shell carries hidden modal forms, so every Live page fetched ov-forms.js and .css
// (17 KB) for selects nobody saw. A real headless Chrome; skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('forms-when-seen-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forms</title><link rel="icon" href="data:,">
<script>window.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });</script>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div>${body}
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
</body></html>`;
const HIDDEN = page('<main><h1>Home</h1><div id="modal" hidden><label>Voice <select id="voice"><option>One</option><option>Two</option></select></label></div></main>');
const SHOWN = page('<main><h1>Settings</h1><label>Voice <select id="voice"><option>One</option><option>Two</option></select></label></main>');

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/hidden') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(HIDDEN); }
    if (u.pathname === '/shown') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(SHOWN); }
    const m = /^\/shared\/([a-z0-9-]+\.(js|css))$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': m[2] === 'css' ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-forms-seen-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const asked = "performance.getEntriesByType('resource').some((e) => /ov-forms\\.js/.test(e.name))";
        const until = async (p, expr) => { const end = Date.now() + 4000; while (Date.now() < end) { if (await p.evaluate(expr)) return true; await wait(100); } return false; };
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/hidden`, { maxMs: 5000 });
        await wait(3000);
        assert.strictEqual(await p.evaluate(asked), false, 'a hidden dialog\'s select does not fetch the forms kit');
        assert.strictEqual(await p.evaluate('!!window.OVForms'), false);

        await p.evaluate("(document.getElementById('modal').hidden = false, 1)");
        assert.ok(await until(p, '!!window.OVForms'), 'the kit loads when the dialog opens');
        assert.strictEqual(await p.evaluate(asked), true);

        const q = await h.openPage(browser, context, { width: 390 });
        await q.goto(`${base}/shown`, { maxMs: 5000 });
        assert.ok(await until(q, '!!window.OVForms'), 'a drawn select loads it once the page settles, as before');
        console.log('forms-when-seen-chrome: hidden forms fetch nothing; the kit arrives when one is drawn');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
