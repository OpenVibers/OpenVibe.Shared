'use strict';
// One ring per field, for every kind of field (4.274.0; design rule one-ring-per-field; the owner, 11-15: "make sure that
// input double border shit is fixed for all element types"). A real Chrome draws a page as the sites do: the navbar, the
// kit, a theme-less field of every type, the boilerplate rule 15 sites carried (an outline 2 px apart from the field), and
// fields inside pills, cards, a composer and a chip, some with a border of their own, some bare, one drawn only later.
// openvibe-shared/field-rings measures each at rest and focused: no field may show two rings, a bare field's box takes
// the accent while it holds the focus, and a plain field keeps a clear ring of its own.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const { RINGS } = require('../field-rings');

const ROOT = path.join(__dirname, '..');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('one-ring-every-field-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const TYPES = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week'];
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fields</title><link rel="icon" href="data:,">
<script>window.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });</script>
<link rel="stylesheet" href="/shared/kit.css">
<style>
:root { --accent: #3b82f6; }
body { background: #0b0f17; color: #e6edf7; font: 15px system-ui; padding: 0 16px; }
/* The boilerplate 15 sites carried: a focus outline 2 px apart from every field's border. */
a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.pill { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid #334; border-radius: 999px; }
.pill input, .pill select { flex: 1; min-width: 0; padding: 8px; }
.pill.own input, .pill.own select { border: 1px solid #445; border-radius: 8px; background: #0f1522; color: inherit; }
.pill.bare input { border: 0; background: none; color: inherit; }
.card { padding: 6px; border: 1px solid #334; border-radius: 14px; }
.card textarea { width: 100%; box-sizing: border-box; border: 1px solid #445; }
.composer { display: flex; padding: 6px 10px; border: 1px solid #334; border-radius: 20px; }
.composer [contenteditable] { flex: 1; min-height: 28px; padding: 4px; }
.composer [contenteditable]:focus { outline: 2px solid var(--accent); }
.chip { display: inline-flex; padding: 4px 10px; border: 1px solid #334; border-radius: 999px; }
.chip select { border: 0; background: none; color: inherit; }
.chip select:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
</style>
<script src="/shared/navbar.js" defer></script></head><body><div id="navbar-mount"></div><main><h1>Every field</h1>
${TYPES.map((t) => `<p><label>${t} <input type="${t}" id="plain-${t}"></label></p>`).join('')}
<p><label>Notes <textarea id="plain-textarea"></textarea></label></p>
<p><label>Pick <select id="plain-select"><option>One</option><option>Two</option></select></label></p>
${TYPES.slice(0, 6).map((t) => `<div class="pill own"><span aria-hidden="true">⌕</span><input type="${t}" id="own-${t}" aria-label="${t}"><button type="button">Go</button></div>`).join('')}
${TYPES.slice(0, 6).map((t) => `<div class="pill bare"><input type="${t}" id="bare-${t}" aria-label="${t}"></div>`).join('')}
<div class="pill own"><select id="own-select" aria-label="Pick"><option>One</option></select></div>
<div class="card"><textarea id="card-textarea" aria-label="Message"></textarea></div>
<div class="composer"><div contenteditable="true" id="composer" aria-label="Message"></div></div>
<div class="chip"><select id="chip-select" aria-label="Sort"><option>New</option><option>Top</option></select></div>
<form class="ovk-form"><label>Kit field <input id="kit-text" type="text"></label><label>Kit notes <textarea id="kit-textarea"></textarea></label></form>
<div id="later" hidden><div class="pill own"><input type="search" id="later-search" aria-label="Search later"></div></div>
</main>
<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [{ label: 'Home', href: '/' }], countViews: false, notifications: false }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const m = /^\/shared\/([a-z0-9-]+\.(js|css))$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': m[2] === 'css' ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-one-ring-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        await wait(2500);   // the navbar settles, the forms stylesheet arrives

        const first = await p.evaluate(`(${RINGS})()`, 60000);
        assert.ok(first.fields >= TYPES.length + 20, `every field was measured (${first.fields})`);
        assert.deepStrictEqual(first.doubles, [], `no field shows two rings:\n${first.doubles.map((d) => `  ${d.field}: ${d.why.join('; ')}`).join('\n')}`);

        const marks = await p.evaluate(`JSON.stringify({ plain: document.getElementById('plain-search').dataset.ovField, own: document.getElementById('own-search').dataset.ovField,
            bare: document.getElementById('bare-search').dataset.ovField, chip: document.getElementById('chip-select').dataset.ovField || (document.querySelector('.chip .ov-sel') || {}).dataset?.ovField,
            composer: document.getElementById('composer').dataset.ovField, card: document.getElementById('card-textarea').dataset.ovField })`);
        const m = JSON.parse(marks);
        assert.deepStrictEqual([m.plain, m.own, m.bare, m.composer, m.card], ['own', 'inner', 'bare', 'bare', 'inner'], `the marks: ${marks}`);

        // A plain field keeps a clear ring of its own, on its border; a bare field's pill takes the accent.
        const plain = await p.evaluate(`(() => { const e = document.getElementById('plain-text'); e.focus(); const c = getComputedStyle(e); return [c.outlineStyle, c.outlineOffset]; })()`);
        assert.deepStrictEqual(plain, ['solid', '0px'], 'a plain field rings on its border, not 2 px apart');
        await p.evaluate("(document.getElementById('bare-text').focus(), 1)");
        await wait(250);
        const box = await p.evaluate("getComputedStyle(document.getElementById('bare-text').parentElement).borderTopColor");
        assert.strictEqual(box, 'rgb(59, 130, 246)', 'the pill holding a bare field takes the accent while focused');

        // A field drawn later (a dialog opens) is measured when it is drawn.
        await p.evaluate("(document.getElementById('later').hidden = false, 1)");
        await wait(700);
        const later = await p.evaluate(`(${RINGS})()`, 60000);
        assert.deepStrictEqual(later.doubles, [], `a field drawn later has one ring too:\n${later.doubles.map((d) => `  ${d.field}: ${d.why.join('; ')}`).join('\n')}`);
        assert.strictEqual(await p.evaluate("document.getElementById('later-search').dataset.ovField"), 'inner');
        console.log(`one-ring-every-field-chrome: ${first.fields} fields (${TYPES.length} input types, textarea, select, OpenVibe's select, contenteditable; plain, in pills, a card, a composer, a chip, the kit, drawn later): one ring each`);
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
