'use strict';
// OVForms' focus ring for text fields is the field's own border and outline, never a box-shadow (11-15, the owner on a
// phone: "a double border instead of just being no border on the inner one"): a component's bare inner field (border
// 0, outline none, inside its own bordered pill) shows no ring of its own, so the pill's is the only one; a plain
// bordered field still shows a clear ring.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-forms-focus-ring-chrome: skipped'); process.exit(0); }

const css = fs.readFileSync(path.join(__dirname, '..', 'ov-forms.css'), 'utf8');
const page = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/ov-forms.css">
<style>body{background:#0b0f17;color:#e6edf7;font:15px system-ui}
/* the theme loader's face for a field nobody styled (theme-loader.js BARE_CSS) */
:where(input:not([type=checkbox],[type=radio]),textarea):where(:not([class])){border:1px solid #334;border-radius:10px;background:#0f1522}
.pill{display:flex;border:1px solid #334;border-radius:999px;padding:4px 12px}.pill:focus-within{box-shadow:0 0 0 3px #3b82f655}
.pill input{flex:1;border:0;outline:none;background:transparent;color:inherit}</style></head><body>
<label class="pill"><input id="inner" type="search" placeholder="Search"></label>
<p><input id="plain" type="text" placeholder="Name"></p></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === '/ov-forms.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(page);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-ring-'));
    const browser = await h.launch({ tmpDir: tmp });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 600 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        const ring = async (id) => {
            // A keyboard focus, so :focus-visible applies.
            await p.evaluate(`document.getElementById('${id}').focus()`);
            await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', text: 'a' });
            await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a' });
            return p.evaluate(`(() => { const cs = getComputedStyle(document.getElementById('${id}')); return { shadow: cs.boxShadow, outline: cs.outlineStyle, width: cs.outlineWidth, focused: document.getElementById('${id}').matches(':focus-visible') }; })()`);
        };
        const inner = await ring('inner');
        assert.ok(inner.focused, 'the inner field has keyboard focus');
        assert.deepStrictEqual([inner.shadow, inner.outline], ['none', 'none'], 'a bare inner field draws no ring of its own');
        const plain = await ring('plain');
        assert.ok(plain.focused);
        assert.strictEqual(plain.shadow, 'none', 'no box-shadow halo');
        assert.deepStrictEqual([plain.outline, plain.width], ['solid', '3px'], 'a plain field shows its ring as an outline');
        console.log('ov-forms-focus-ring-chrome: one ring: a bare inner field draws none, a plain field an outline');
    } finally { await browser.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
