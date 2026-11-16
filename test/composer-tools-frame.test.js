'use strict';
// The composer's Tools go through the Frame by default (4.284.0; 11-16: "Failed to fetch" on openvibe.live, whose CSP
// does not allow openvibe.tools but, like every site's, allows openvibe.network): search, popular, a tool, its schema and
// a run are asked at https://openvibe.network/api/frame/tools…; a page that names Tools (data-ovc-tools or OV_TOOLS_URL)
// asks it direct at <its url>/api/v1/tools…. In a real page: the default's requests, recorded.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-tools-frame: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tools</title><link rel="icon" href="data:,">
<script>window.__asked = []; const real = window.fetch; window.fetch = async (u, init) => { const url = String(u); window.__asked.push(url);
  if (url.startsWith('https://openvibe.network/api/frame/tools')) return new Response(JSON.stringify({ tools: [{ id: 'count', name: 'Word Counter', description: 'Words.' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); };</script>
<script src="/ov-composer.js"></script></head><body><div id="host"></div>
<script>window.c = OpenVibeComposer.mount(document.getElementById('host'), { preset: 'chat', id: 'c1' });</script></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    const m = /^\/([a-z0-9-]+\.js)$/.exec(req.url);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-ctools-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        await wait(300);
        // Open the Tools row the way the + menu does: the tool's own button, or the /tool command.
        // The + menu, then its Tools row (as composer-tools-chrome does).
        await p.evaluate(`document.querySelector('#c1 .ovc-more').click()`);
        for (let i = 0; i < 125 && !(await p.evaluate("!!document.querySelector('.ovc-add-row[data-tool=tools]')")); i++) await wait(40);
        const opened = await p.evaluate(`(() => { const r = document.querySelector('.ovc-add-row[data-tool=tools], [data-tool=tools]'); if (!r) return 'no row'; r.click(); return 'row'; })()`);
        for (let i = 0; i < 40 && !(await p.evaluate("!!document.querySelector('#c1 .ovc-tools .ovc-repo-q')")); i++) await wait(40);
        await p.evaluate(`(() => { const f = document.querySelector('#c1 .ovc-tools .ovc-repo-q'); if (!f) return false; f.value = 'word count'; f.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        for (let i = 0; i < 40 && !(await p.evaluate("window.__asked.some((u) => u.includes('/tools'))")); i++) await wait(50);
        const asked = await p.evaluate('window.__asked.filter((u) => u.includes("tools"))');
        assert.ok(asked.length, `the Tools row asked something (${opened})`);
        {
            assert.ok(asked.every((u) => u.startsWith('https://openvibe.network/api/frame/tools')), `through the Frame (${asked.join(', ')})`);
            assert.ok(!asked.some((u) => u.includes('openvibe.tools')), 'never openvibe.tools direct');
        }
        // The source: the default is the Frame, a named Tools is asked direct.
        const src = fs.readFileSync(path.join(ROOT, 'ov-composer.js'), 'utf8');
        assert.ok(/const base = own \? `\$\{String\(own\)\.replace\(\/\\\/\+\$\/, ''\)\}\/api\/v1` : FRAME;/.test(src), 'own → <url>/api/v1, else the Frame');
        assert.ok(!/\/api\/v1\/tools/.test(src.slice(src.indexOf('function openToolRun'), src.indexOf('function openToolRun') + 12000)), 'no hard-coded /api/v1/tools paths left in the Tools row');
        console.log(`composer-tools-frame: the Tools row asks the Frame by default${asked.length ? ` (${asked.length} requests seen)` : ''}; a named Tools is asked direct`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
